import hashlib
import hmac
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
from zipfile import ZipFile

from cryptography.fernet import Fernet
from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.api.wordpress import complete_wordpress_plugin_connect, download_wordpress_plugin
from app.core.config import settings
from app.db.base import Base
from app.models.website import Website
from app.models.wordpress_connect_state import WordPressConnectState
from app.models.wordpress_integration import WordPressIntegration
from app.models.wordpress_request_nonce import WordPressRequestNonce
from app.schemas.wordpress_plugin import WordPressPluginConnectRequest
from app.services.credential_cipher import get_credential_cipher
from app.services.wordpress import build_wordpress_payload
from app.services.wordpress_plugin import begin_plugin_connect, verify_plugin_signature


class WordPressPluginTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine, tables=[
            Website.__table__, WordPressIntegration.__table__,
            WordPressConnectState.__table__, WordPressRequestNonce.__table__,
        ])
        self.db = Session(self.engine)
        self.previous_key = settings.wordpress_credentials_key
        self.previous_env = settings.app_env
        settings.wordpress_credentials_key = Fernet.generate_key().decode()
        settings.app_env = "test"

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        settings.wordpress_credentials_key = self.previous_key
        settings.app_env = self.previous_env

    def connect(self):
        target = begin_plugin_connect(
            self.db,
            "https://example.com/",
            "https://example.com/wp-admin/admin.php?page=seo-automation",
            "test-correlation-id",
        )
        token = parse_qs(urlsplit(target).query)["seoa_state"][0]
        payload = WordPressPluginConnectRequest(
            state=token,
            base_url="https://example.com/",
            admin_url="https://example.com/wp-admin",
            rest_url="https://example.com/wp-json/",
            username="editor",
            app_password="abcd efgh ijkl mnop",
            plugin_version="1.0.1",
            seo_plugin="yoast",
            cid="test-correlation-id",
        )
        with patch("app.api.wordpress.verify_wordpress_credentials") as verify:
            result = complete_wordpress_plugin_connect(payload, Response(), self.db)
        verify.assert_called_once_with(
            "https://example.com/wp-json/", "editor", "abcd efgh ijkl mnop"
        )
        return payload, result

    def test_zip_is_served_without_changing_the_archive(self):
        result = download_wordpress_plugin()
        self.assertTrue(Path(result.path).is_file())
        self.assertEqual(result.filename, "hiqain-wordpress-plugin.zip")
        with ZipFile(result.path) as archive:
            names = archive.namelist()
            self.assertIn("seo-automation/seo-automation.php", names)
            self.assertTrue(all(name.startswith("seo-automation/") for name in names))
            self.assertTrue(all("\\" not in name for name in names))

    def test_connect_refuses_redirect_to_another_site(self):
        with self.assertRaises(HTTPException) as caught:
            begin_plugin_connect(
                self.db,
                "https://example.com/",
                "https://other.example/wp-admin/admin.php?page=seo-automation",
                "test-correlation-id",
            )
        self.assertEqual(caught.exception.status_code, 400)

    def test_connect_creates_encrypted_single_use_integration(self):
        payload, result = self.connect()
        integration = self.db.get(WordPressIntegration, result.integration_id)
        self.assertEqual(result.website_id, integration.website_id)
        self.assertEqual(len(result.shared_secret), 64)
        self.assertNotEqual(integration.application_password_encrypted, payload.app_password.get_secret_value())
        self.assertEqual(get_credential_cipher().decrypt(integration.shared_secret_encrypted), result.shared_secret)
        with self.assertRaises(HTTPException) as caught:
            complete_wordpress_plugin_connect(payload, Response(), self.db)
        self.assertEqual(caught.exception.status_code, 400)

    def test_signed_callback_rejects_replayed_nonce(self):
        _, result = self.connect()
        timestamp = "1780000000"
        with patch("app.services.wordpress_plugin.time.time", return_value=int(timestamp)):
            nonce = "a" * 32
            body = b'{"site_url":"https://example.com"}'
            canonical = f"POST\n/api/integrations/wordpress/permalinks\n{timestamp}\n{hashlib.sha256(body).hexdigest()}"
            signature = "sha256=" + hmac.new(bytes.fromhex(result.shared_secret), canonical.encode(), hashlib.sha256).hexdigest()
            scope = {
                "type": "http",
                "method": "POST",
                "path": "/api/integrations/wordpress/permalinks",
                "query_string": b"",
                "scheme": "https",
                "server": ("api.example.com", 443),
                "headers": [
                    (b"x-seoa-integration-id", str(result.integration_id).encode()),
                    (b"x-seoa-timestamp", timestamp.encode()),
                    (b"x-seoa-nonce", nonce.encode()),
                    (b"x-seoa-signature", signature.encode()),
                ],
            }
            request = Request(scope)
            self.assertEqual(verify_plugin_signature(request, body, self.db).id, result.integration_id)
            self.db.commit()
            with self.assertRaises(HTTPException) as caught:
                verify_plugin_signature(request, body, self.db)
            self.assertEqual(caught.exception.status_code, 409)

    def test_plugin_publish_payload_marks_managed_post(self):
        article = SimpleNamespace(
            id=42,
            title="Example article",
            meta_title="SEO title",
            meta_description="SEO description",
            slug="example-article",
            content="Hello world",
            faq=[],
            topic=SimpleNamespace(keyword_ideas=["example keyword"]),
        )
        integration = SimpleNamespace(id=7, shared_secret_encrypted="encrypted", seo_plugin="yoast")
        payload = build_wordpress_payload(article, "draft", integration)
        self.assertEqual(payload["meta"], {"_seoa_article_id": 42, "_seoa_integration_id": 7})
        self.assertEqual(payload["yoast_meta"]["yoast_wpseo_focuskw"], "example keyword")


if __name__ == "__main__":
    unittest.main()
