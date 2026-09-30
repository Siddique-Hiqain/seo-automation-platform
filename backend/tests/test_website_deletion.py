import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.api.websites import delete_website
from app.db.base import Base
from app.models.article import Article
from app.models.content_chunk import ContentChunk
from app.models.keyword_metric import KeywordMetric
from app.models.topic import Topic
from app.models.website import Website
from app.models.website_page import WebsitePage
from app.models.website_profile import WebsiteProfile
from app.models.wordpress_integration import WordPressIntegration
from app.schemas.website import WebsiteDeleteRequest


@compiles(LONGTEXT, "sqlite")
def compile_longtext_for_sqlite(_type, _compiler, **_kwargs):
    return "TEXT"


class WebsiteDeletionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        website = Website(url="https://example.com/", status="crawled")
        other = Website(url="https://other.example/", status="pending")
        self.db.add_all([website, other])
        self.db.flush()
        self.website_id = website.id
        self.other_id = other.id

        page = WebsitePage(
            website_id=website.id,
            url=website.url,
            status_code=200,
            content="Home page",
        )
        topic = Topic(
            website_id=website.id,
            title="A topic",
            keyword_ideas=[],
            search_intent="informational",
        )
        self.db.add_all([
            page,
            topic,
            WebsiteProfile(website_id=website.id, profile_data={"business_name": "Example"}),
            WordPressIntegration(
                website_id=website.id,
                base_url=website.url,
                rest_url=website.url + "wp-json/",
                username="editor",
            ),
        ])
        self.db.flush()
        self.db.add_all([
            ContentChunk(page_id=page.id, chunk_index=0, content="Chunk"),
            KeywordMetric(topic_id=topic.id, keyword="keyword"),
            Article(website_id=website.id, topic_id=topic.id, title="Article", content="Content"),
        ])
        self.db.commit()
        self.qdrant = Mock()
        self.qdrant.collection_exists.return_value = True
        self.patch = patch("app.api.websites.qdrant_client", self.qdrant)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.db.close()
        self.engine.dispose()

    def test_deletes_only_confirmed_business_and_related_data(self):
        delete_website(
            self.website_id,
            WebsiteDeleteRequest(confirm_url="https://example.com/"),
            self.db,
        )

        self.assertIsNone(self.db.get(Website, self.website_id))
        self.assertIsNotNone(self.db.get(Website, self.other_id))
        for model in (
            WebsitePage, ContentChunk, WebsiteProfile, Topic,
            KeywordMetric, Article, WordPressIntegration,
        ):
            self.assertEqual(self.db.scalars(select(model)).all(), [])

        selector = self.qdrant.delete.call_args.kwargs["points_selector"]
        self.assertEqual(selector.filter.must[0].match.value, self.website_id)
        self.assertTrue(self.qdrant.delete.call_args.kwargs["wait"])

    def test_rejects_incorrect_confirmation_without_deleting(self):
        with self.assertRaises(HTTPException) as caught:
            delete_website(
                self.website_id,
                WebsiteDeleteRequest(confirm_url="https://other.example/"),
                self.db,
            )

        self.assertEqual(caught.exception.status_code, 409)
        self.assertIsNotNone(self.db.get(Website, self.website_id))
        self.qdrant.delete.assert_not_called()

    def test_keeps_database_when_vector_cleanup_fails(self):
        self.qdrant.delete.side_effect = RuntimeError("Qdrant unavailable")
        with patch("app.api.websites.logger"):
            with self.assertRaises(HTTPException) as caught:
                delete_website(
                    self.website_id,
                    WebsiteDeleteRequest(confirm_url="https://example.com/"),
                    self.db,
                )

        self.assertEqual(caught.exception.status_code, 503)
        self.assertIsNotNone(self.db.get(Website, self.website_id))

    def test_deletes_when_vector_collection_has_not_been_created(self):
        self.qdrant.collection_exists.return_value = False
        delete_website(
            self.website_id,
            WebsiteDeleteRequest(confirm_url="https://example.com/"),
            self.db,
        )
        self.assertIsNone(self.db.get(Website, self.website_id))
        self.qdrant.delete.assert_not_called()

    def test_missing_business_is_not_deleted(self):
        with self.assertRaises(HTTPException) as caught:
            delete_website(
                999,
                WebsiteDeleteRequest(confirm_url="https://example.com/"),
                self.db,
            )
        self.assertEqual(caught.exception.status_code, 404)
        self.qdrant.delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
