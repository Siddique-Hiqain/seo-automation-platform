import secrets
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.article import Article
from app.models.website import Website
from app.models.wordpress_integration import WordPressIntegration
from app.models.wordpress_status_event import WordPressStatusEvent
from app.schemas.wordpress import WordPressCredentialRequest, WordPressIntegrationResponse
from app.schemas.wordpress_plugin import (
    WordPressPermalinkEvent,
    WordPressPluginConnectRequest,
    WordPressPluginConnectResponse,
    WordPressPostStatusEvent,
)
from app.services.credential_cipher import CredentialConfigurationError, get_credential_cipher
from app.services.wordpress import (
    WordPressConnectionError,
    WordPressConfigurationError,
    normalize_site_url,
    utc_now,
    verify_wordpress_credentials,
)
from app.services.wordpress_plugin import (
    begin_plugin_connect,
    consume_connect_state,
    find_connect_state,
    verify_plugin_signature,
)


router = APIRouter(prefix="/integrations/wordpress", tags=["WordPress"])


@router.get("/plugin/download", include_in_schema=False)
def download_wordpress_plugin():
    archive = Path(__file__).resolve().parents[3] / "hiqain-wordpress-plugin.zip"
    if not archive.is_file():
        raise HTTPException(status_code=404, detail="The Hiqain WordPress plugin is not installed on this server.")
    return FileResponse(
        archive,
        media_type="application/zip",
        filename="hiqain-wordpress-plugin.zip",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/connect", include_in_schema=False)
def begin_wordpress_plugin_connect(
    site_url: str,
    return_url: str = Query(alias="return"),
    cid: str = "",
    db: Session = Depends(get_db),
):
    target = begin_plugin_connect(db, site_url, return_url, cid)
    return RedirectResponse(
        target,
        status_code=302,
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


@router.post("/connect", response_model=WordPressPluginConnectResponse)
def complete_wordpress_plugin_connect(
    payload: WordPressPluginConnectRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        site_url = normalize_site_url(payload.base_url)
        rest_url = normalize_site_url(payload.rest_url) + "/"
        admin_url = normalize_site_url(payload.admin_url)
        site = urlsplit(site_url)
        for candidate in (rest_url, admin_url):
            parts = urlsplit(candidate)
            if (parts.scheme, parts.hostname, parts.port) != (site.scheme, site.hostname, site.port):
                raise ValueError("The WordPress URLs must belong to the same site.")
        if not urlsplit(rest_url).path.rstrip("/").endswith("/wp-json"):
            raise ValueError("The WordPress REST URL is invalid.")
        if not urlsplit(admin_url).path.rstrip("/").endswith("/wp-admin"):
            raise ValueError("The WordPress admin URL is invalid.")
        password = payload.app_password.get_secret_value().strip()
        if not password:
            raise ValueError("A WordPress Application Password is required.")
        cipher = get_credential_cipher()
        find_connect_state(db, payload.state, payload.cid, site_url)
        db.commit()  # Do not hold a database transaction during the WordPress request.
        verify_wordpress_credentials(rest_url, payload.username, password)
    except (ValueError, WordPressConnectionError, WordPressConfigurationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CredentialConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    consume_connect_state(db, payload.state, payload.cid, site_url)
    website = db.scalar(select(Website).where(Website.url.in_([site_url, site_url + "/"])).with_for_update())
    if website is None:
        website = Website(url=site_url + "/", status="pending")
        db.add(website)
        db.flush()
    integration = db.scalar(
        select(WordPressIntegration)
        .where(WordPressIntegration.website_id == website.id)
        .with_for_update()
    )
    if integration is None:
        integration = WordPressIntegration(website_id=website.id)
        db.add(integration)
    shared_secret = secrets.token_hex(32)
    integration.base_url = site_url
    integration.admin_url = admin_url
    integration.rest_url = rest_url
    integration.username = payload.username
    integration.application_password_encrypted = cipher.encrypt(password)
    integration.shared_secret_encrypted = cipher.encrypt(shared_secret)
    integration.seo_plugin = payload.seo_plugin
    integration.permalink_structure = payload.permalink_structure
    integration.plugin_version = payload.plugin_version
    integration.capabilities = []
    integration.status = "connected"
    integration.connected_at = utc_now()
    integration.disconnected_at = None
    db.commit()
    db.refresh(integration)
    response.headers["Cache-Control"] = "no-store"
    return WordPressPluginConnectResponse(
        integration_id=integration.id,
        shared_secret=shared_secret,
        website_id=website.id,
    )


@router.post("/disconnect")
async def disconnect_wordpress_plugin(request: Request, db: Session = Depends(get_db)):
    integration = verify_plugin_signature(request, await request.body(), db)
    integration.status = "disconnected"
    integration.application_password_encrypted = None
    integration.shared_secret_encrypted = None
    integration.disconnected_at = utc_now()
    db.commit()
    return {"status": "disconnected"}


@router.post("/permalinks")
async def update_wordpress_plugin_details(
    payload: WordPressPermalinkEvent,
    request: Request,
    db: Session = Depends(get_db),
):
    integration = verify_plugin_signature(request, await request.body(), db)
    if normalize_site_url(payload.site_url) != integration.base_url:
        raise HTTPException(status_code=400, detail="The WordPress site does not match this connection.")
    integration.permalink_structure = payload.permalink_structure
    integration.plugin_version = payload.plugin_version
    integration.capabilities = payload.plugin_capabilities
    if payload.seo_plugin is not None:
        integration.seo_plugin = payload.seo_plugin
    db.commit()
    return {"status": "updated"}


@router.post("/post-status")
async def receive_wordpress_post_status(
    payload: WordPressPostStatusEvent,
    request: Request,
    db: Session = Depends(get_db),
):
    integration = verify_plugin_signature(request, await request.body(), db)
    if db.scalar(select(WordPressStatusEvent.id).where(WordPressStatusEvent.event_id == payload.event_id)):
        db.commit()
        return {"status": "already_received"}
    article = db.get(Article, payload.article_id) if payload.article_id is not None else None
    if article is not None and (
        article.website_id != integration.website_id or str(article.wp_post_id) != payload.platform_id
    ):
        article = None
    db.add(WordPressStatusEvent(
        integration_id=integration.id,
        article_id=article.id if article else None,
        event_id=payload.event_id,
        status=payload.status,
        blocked=payload.blocked,
        payload=payload.model_dump(),
    ))
    if article is not None and not payload.blocked:
        article.status = payload.status
        if payload.link:
            article.wp_link = payload.link
    db.commit()
    return {"status": "received"}


def _response(integration: WordPressIntegration) -> WordPressIntegrationResponse:
    return WordPressIntegrationResponse(
        id=integration.id,
        website_id=integration.website_id,
        base_url=integration.base_url,
        username=integration.username,
        status=integration.status,
        connected_at=integration.connected_at.isoformat(),
    )


@router.put("/websites/{website_id}", response_model=WordPressIntegrationResponse)
def connect_wordpress(
    website_id: int,
    payload: WordPressCredentialRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    website = db.get(Website, website_id)
    if website is None:
        raise HTTPException(status_code=404, detail="Website not found.")

    try:
        base_url = normalize_site_url(website.url)
        rest_url = base_url + "/wp-json/"
        username = payload.username.strip()
        password = payload.application_password.get_secret_value().strip()
        if not username or not password:
            raise ValueError("A WordPress username and Application Password are required.")
        cipher = get_credential_cipher()
        verify_wordpress_credentials(rest_url, username, password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CredentialConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except WordPressConnectionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    integration = db.scalar(
        select(WordPressIntegration)
        .where(WordPressIntegration.website_id == website_id)
        .with_for_update()
    )
    if integration is None:
        integration = WordPressIntegration(website_id=website_id)
        db.add(integration)

    integration.base_url = base_url
    integration.rest_url = rest_url
    integration.username = username
    integration.application_password_encrypted = cipher.encrypt(password)
    integration.shared_secret_encrypted = None
    integration.seo_plugin = None
    integration.capabilities = None
    integration.status = "connected"
    integration.connected_at = utc_now()
    integration.disconnected_at = None
    db.commit()
    db.refresh(integration)
    response.headers["Cache-Control"] = "no-store"
    return _response(integration)


@router.get("/websites/{website_id}", response_model=WordPressIntegrationResponse)
def get_integration(website_id: int, response: Response, db: Session = Depends(get_db)):
    integration = db.scalar(
        select(WordPressIntegration).where(
            WordPressIntegration.website_id == website_id,
            WordPressIntegration.status == "connected",
            WordPressIntegration.application_password_encrypted.is_not(None),
        )
    )
    if integration is None:
        raise HTTPException(status_code=404, detail="WordPress is not connected.")
    response.headers["Cache-Control"] = "no-store"
    return _response(integration)


@router.delete("/websites/{website_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_wordpress(website_id: int, db: Session = Depends(get_db)):
    integration = db.scalar(
        select(WordPressIntegration)
        .where(WordPressIntegration.website_id == website_id)
        .with_for_update()
    )
    if integration is None:
        raise HTTPException(status_code=404, detail="WordPress is not connected.")
    integration.status = "disconnected"
    integration.application_password_encrypted = None
    integration.shared_secret_encrypted = None
    integration.disconnected_at = utc_now()
    db.commit()
