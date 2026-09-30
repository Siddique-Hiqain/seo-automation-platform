import html
import ipaddress
import re
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from markdown_it import MarkdownIt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.article import Article
from app.models.wordpress_integration import WordPressIntegration
from app.services.credential_cipher import get_credential_cipher


class WordPressConfigurationError(RuntimeError):
    pass


class WordPressPublishError(RuntimeError):
    pass


class WordPressConnectionError(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_site_url(value: str) -> str:
    parts = urlsplit(value.strip())
    if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
        raise ValueError("A valid http(s) WordPress URL is required.")
    if parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("WordPress URLs cannot contain credentials, a query, or a fragment.")

    scheme = parts.scheme.lower()
    host = parts.hostname.lower()
    port = parts.port
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    netloc = host if port is None or default_port else f"{host}:{port}"
    path = parts.path.rstrip("/")
    return urlunsplit((scheme, netloc, path, "", ""))


def ensure_publish_target_allowed(url: str) -> None:
    parts = urlsplit(url)
    if not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise WordPressConfigurationError("The stored WordPress REST URL is invalid.")
    if settings.app_env not in {"development", "test"}:
        if parts.scheme.lower() != "https":
            raise WordPressConfigurationError("Production WordPress publishing requires HTTPS.")
        try:
            addresses = socket.getaddrinfo(parts.hostname, parts.port or 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise WordPressConfigurationError("The WordPress host could not be resolved.") from exc
        if not addresses or any(
            not ipaddress.ip_address(address[4][0]).is_global for address in addresses
        ):
            raise WordPressConfigurationError("Private WordPress hosts are not allowed in production.")


def verify_wordpress_credentials(rest_url: str, username: str, password: str) -> None:
    """Require a core WordPress Application Password with post-publishing rights."""
    try:
        ensure_publish_target_allowed(rest_url)
    except WordPressConfigurationError as exc:
        raise WordPressConnectionError(str(exc)) from exc

    root = rest_url.rstrip("/") + "/"
    auth = httpx.BasicAuth(username, password)
    try:
        with httpx.Client(
            timeout=settings.wordpress_request_timeout_seconds,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            user_response = client.get(
                urljoin(root, "wp/v2/users/me?context=edit"), auth=auth
            )
            if user_response.status_code in {401, 403}:
                raise WordPressConnectionError(
                    "WordPress rejected these credentials. Use a WordPress Application Password, not your login password."
                )
            if user_response.status_code != 200:
                raise WordPressConnectionError(
                    f"Could not verify the WordPress user (HTTP {user_response.status_code}). Check the site URL and REST API."
                )
            user = user_response.json()
            capabilities = user.get("capabilities") if isinstance(user, dict) else None
            if not isinstance(capabilities, dict) or not all(
                capabilities.get(name) for name in ("edit_posts", "publish_posts")
            ):
                raise WordPressConnectionError(
                    "This WordPress user needs permission to edit and publish posts."
                )

            app_response = client.get(
                urljoin(root, "wp/v2/users/me/application-passwords/introspect"),
                auth=auth,
            )
            if app_response.status_code != 200:
                raise WordPressConnectionError(
                    "Could not verify an Application Password. Enable WordPress Application Passwords and try again."
                )
            app = app_response.json()
            if not isinstance(app, dict) or not app.get("uuid"):
                raise WordPressConnectionError("WordPress returned an invalid Application Password response.")
    except (httpx.RequestError, ValueError) as exc:
        raise WordPressConnectionError("Could not reach the WordPress REST API securely.") from exc


_HTML_TAG = re.compile(r"<\s*[a-zA-Z][^>]*>")
_MARKDOWN = MarkdownIt("commonmark", {"html": True})


def render_markdown_or_html(value: str) -> str:
    if _HTML_TAG.search(value):
        return value
    return _MARKDOWN.render(value)


def render_faq(faq: list | None) -> str:
    if not faq:
        return ""
    items: list[str] = []
    for item in faq:
        if isinstance(item, str):
            question, answer = item, ""
        elif isinstance(item, dict):
            question = str(item.get("question") or item.get("q") or "")
            answer = str(item.get("answer") or item.get("a") or "")
        else:
            continue
        if not question.strip() and not answer.strip():
            continue
        items.append(
            '<div class="hiqain-faq-item">'
            f"<h3>{html.escape(question)}</h3>"
            f"{render_markdown_or_html(answer)}"
            "</div>"
        )
    if not items:
        return ""
    return '<section class="hiqain-faq"><h2>Frequently Asked Questions</h2>' + "".join(items) + "</section>"


def build_wordpress_payload(
    article: Article,
    target_status: str,
    integration: WordPressIntegration | None = None,
) -> dict:
    content = render_markdown_or_html(article.content)
    faq_html = render_faq(article.faq)
    if faq_html:
        content = f"{content}\n{faq_html}"

    payload: dict = {
        "title": article.title,
        "content": content,
        "status": target_status,
    }
    if article.slug:
        payload["slug"] = article.slug
    if article.meta_description:
        payload["excerpt"] = article.meta_description

    if integration is not None and integration.shared_secret_encrypted:
        payload["meta"] = {
            "_seoa_article_id": article.id,
            "_seoa_integration_id": integration.id,
        }
        seo_title = article.meta_title or article.title
        seo_description = article.meta_description or ""
        keyword_ideas = getattr(getattr(article, "topic", None), "keyword_ideas", None) or []
        focus_keyword = keyword_ideas[0] if keyword_ideas else ""
        if integration.seo_plugin == "yoast":
            payload["yoast_meta"] = {
                "yoast_wpseo_title": seo_title,
                "yoast_wpseo_metadesc": seo_description,
                "yoast_wpseo_focuskw": focus_keyword,
            }
        elif integration.seo_plugin == "rank_math":
            payload["rank_math_meta_data"] = {
                "title": seo_title,
                "description": seo_description,
                "focuskw": focus_keyword,
            }
        elif integration.seo_plugin == "aioseo":
            payload["aioseo_meta_data"] = {
                "title": seo_title,
                "description": seo_description,
                "focuskw": focus_keyword,
            }
    return payload


@dataclass(frozen=True)
class PublishTarget:
    article_id: int
    existing_post_id: int | None
    rest_url: str
    username: str
    application_password: str
    payload: dict


def prepare_publish_target(db: Session, article_id: int, target_status: str) -> PublishTarget:
    row = db.execute(
        select(Article, WordPressIntegration)
        .join(WordPressIntegration, WordPressIntegration.website_id == Article.website_id)
        .where(Article.id == article_id, WordPressIntegration.status == "connected")
    ).one_or_none()
    if row is None:
        raise WordPressConfigurationError(
            "This article does not have an active WordPress integration. Connect WordPress first."
        )

    article, integration = row
    if not integration.application_password_encrypted:
        raise WordPressConfigurationError("The WordPress integration credential has been revoked.")
    cipher = get_credential_cipher()
    password = cipher.decrypt(integration.application_password_encrypted)
    payload = build_wordpress_payload(article, target_status, integration)
    target = PublishTarget(
        article_id=article.id,
        existing_post_id=article.wp_post_id,
        rest_url=integration.rest_url,
        username=integration.username,
        application_password=password,
        payload=payload,
    )
    # End the read transaction before making a potentially slow network request.
    db.commit()
    return target


def publish_article_to_wordpress(db: Session, article_id: int, target_status: str) -> dict:
    target = prepare_publish_target(db, article_id, target_status)
    ensure_publish_target_allowed(target.rest_url)
    rest_root = target.rest_url.rstrip("/") + "/"
    path = f"wp/v2/posts/{target.existing_post_id}" if target.existing_post_id else "wp/v2/posts"
    endpoint = urljoin(rest_root, path)

    try:
        with httpx.Client(
            timeout=settings.wordpress_request_timeout_seconds,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = client.post(
                endpoint,
                auth=httpx.BasicAuth(target.username, target.application_password),
                json=target.payload,
                headers={"User-Agent": "SEO-Automation-Platform/0.1"},
            )
    except httpx.RequestError as exc:
        raise WordPressPublishError(f"Could not reach WordPress: {exc}") from exc

    if response.status_code < 200 or response.status_code >= 300:
        message = response.text
        try:
            body = response.json()
            if isinstance(body, dict) and isinstance(body.get("message"), str):
                message = body["message"]
        except ValueError:
            pass
        raise WordPressPublishError(f"WordPress rejected the article ({response.status_code}): {message}")

    try:
        result = response.json()
        post_id = int(result["id"])
        link = str(result.get("link") or "")
        status = str(result.get("status") or target_status)
    except (ValueError, KeyError, TypeError) as exc:
        raise WordPressPublishError("WordPress returned a malformed publish response.") from exc

    article = db.get(Article, article_id)
    if article is None:
        raise WordPressPublishError("The article was removed while WordPress was publishing it.")
    article.wp_post_id = post_id
    article.wp_link = link
    article.status = status
    db.commit()

    return {
        "article_id": article.id,
        "wordpress_post_id": post_id,
        "link": link,
        "status": status,
    }
