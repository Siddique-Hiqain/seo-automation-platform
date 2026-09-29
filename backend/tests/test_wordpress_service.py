import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from cryptography.fernet import Fernet
from fastapi import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.wordpress import connect_wordpress, disconnect_wordpress
from app.core.config import settings
from app.db.base import Base
from app.models.website import Website
from app.models.topic import Topic
from app.models.keyword_metric import KeywordMetric
from app.models.wordpress_integration import WordPressIntegration
from app.schemas.wordpress import WordPressCredentialRequest
from app.services.credential_cipher import CredentialCipher
from app.services.wordpress import (
    WordPressConnectionError,
    build_wordpress_payload,
    normalize_site_url,
    verify_wordpress_credentials,
)


class CredentialCipherTests(unittest.TestCase):
    def test_encrypts_and_decrypts_application_password(self):
        cipher = CredentialCipher(Fernet.generate_key().decode("ascii"))
        encrypted = cipher.encrypt("abcd efgh ijkl mnop")

        self.assertNotEqual(encrypted, "abcd efgh ijkl mnop")
        self.assertEqual(cipher.decrypt(encrypted), "abcd efgh ijkl mnop")


class WordPressUrlTests(unittest.TestCase):
    def test_normalizes_default_port_and_trailing_slash(self):
        self.assertEqual(
            normalize_site_url("HTTPS://Example.COM:443/blog/"),
            "https://example.com/blog",
        )


class WordPressCredentialTests(unittest.TestCase):
    def _run_verification(self, handler):
        previous = settings.app_env
        settings.app_env = "test"
        transport = httpx.MockTransport(handler)
        real_client = httpx.Client

        def test_client(**kwargs):
            return real_client(transport=transport, **kwargs)

        try:
            with patch("app.services.wordpress.httpx.Client", side_effect=test_client):
                verify_wordpress_credentials("https://example.com/wp-json/", "editor", "app password")
        finally:
            settings.app_env = previous

    def test_accepts_application_password_with_publish_permission(self):
        visited = []

        def handler(request):
            visited.append(request.url.path)
            self.assertTrue(request.headers["authorization"].startswith("Basic "))
            if request.url.path.endswith("/users/me"):
                return httpx.Response(200, json={"capabilities": {"edit_posts": True, "publish_posts": True}})
            return httpx.Response(200, json={"uuid": "app-password-id"})

        self._run_verification(handler)
        self.assertEqual(len(visited), 2)
        self.assertTrue(visited[1].endswith("/application-passwords/introspect"))

    def test_rejects_normal_login_password(self):
        def handler(request):
            if request.url.path.endswith("/users/me"):
                return httpx.Response(200, json={"capabilities": {"edit_posts": True, "publish_posts": True}})
            return httpx.Response(404, json={"code": "rest_no_route"})

        with self.assertRaisesRegex(WordPressConnectionError, "Application Password"):
            self._run_verification(handler)

    def test_rejects_account_without_publish_permission(self):
        def handler(request):
            return httpx.Response(200, json={"capabilities": {"edit_posts": True}})

        with self.assertRaisesRegex(WordPressConnectionError, "permission"):
            self._run_verification(handler)


class WordPressPayloadTests(unittest.TestCase):
    def test_payload_uses_only_core_wordpress_fields(self):
        article = SimpleNamespace(
            title="A useful article",
            content="# Introduction\n\nHello world.",
            faq=[{"question": "Does it work?", "answer": "Yes."}],
            slug="useful-article",
            meta_description="A useful description.",
        )

        payload = build_wordpress_payload(article, "draft")

        self.assertEqual(set(payload), {"title", "content", "status", "slug", "excerpt"})
        self.assertEqual(payload["excerpt"], "A useful description.")
        self.assertIn("<h1>Introduction</h1>", payload["content"])
        self.assertIn("Frequently Asked Questions", payload["content"])


class WordPressConnectionStorageTests(unittest.TestCase):
    def test_connect_encrypts_credential_and_disconnect_removes_it(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(
            engine, tables=[Website.__table__, WordPressIntegration.__table__]
        )
        previous = settings.wordpress_credentials_key
        settings.wordpress_credentials_key = Fernet.generate_key().decode("ascii")
        try:
            with Session(engine) as db:
                website = Website(url="https://example.com/", status="pending")
                db.add(website)
                db.commit()
                with patch("app.api.wordpress.verify_wordpress_credentials") as verify:
                    result = connect_wordpress(
                        website.id,
                        WordPressCredentialRequest(
                            username="editor",
                            application_password="abcd efgh ijkl mnop",
                        ),
                        Response(),
                        db,
                    )
                verify.assert_called_once_with(
                    "https://example.com/wp-json/", "editor", "abcd efgh ijkl mnop"
                )
                self.assertNotIn("password", result.model_dump())
                integration = db.get(WordPressIntegration, result.id)
                self.assertNotEqual(
                    integration.application_password_encrypted, "abcd efgh ijkl mnop"
                )
                disconnect_wordpress(website.id, db)
                db.refresh(integration)
                self.assertIsNone(integration.application_password_encrypted)
                self.assertEqual(integration.status, "disconnected")
        finally:
            settings.wordpress_credentials_key = previous
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
