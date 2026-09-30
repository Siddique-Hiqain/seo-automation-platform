import hashlib
import hmac
import re
import secrets
import time
from datetime import timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.wordpress_connect_state import WordPressConnectState
from app.models.wordpress_integration import WordPressIntegration
from app.models.wordpress_request_nonce import WordPressRequestNonce
from app.services.credential_cipher import get_credential_cipher
from app.services.wordpress import (
    WordPressConfigurationError,
    ensure_publish_target_allowed,
    normalize_site_url,
    utc_now,
)


CONNECT_TTL = timedelta(minutes=10)
SIGNATURE_SKEW_SECONDS = 300
_HEX_32 = re.compile(r"^[0-9a-fA-F]{32}$")
_SIGNATURE = re.compile(r"^sha256=[0-9a-fA-F]{64}$")


def _same_origin(left: str, right: str) -> bool:
    a, b = urlsplit(left), urlsplit(right)
    return (a.scheme.lower(), a.hostname, a.port) == (b.scheme.lower(), b.hostname, b.port)


def validate_connect_urls(site_url: str, return_url: str) -> str:
    try:
        site = normalize_site_url(site_url)
        target = urlsplit(return_url)
        if not _same_origin(site, return_url) or target.username or target.password or target.fragment:
            raise ValueError("The WordPress return URL must be on the same site.")
        if not target.path.rstrip("/").endswith("/wp-admin/admin.php"):
            raise ValueError("The WordPress return URL must be the Hiqain admin page.")
        if ("page", "seo-automation") not in parse_qsl(target.query):
            raise ValueError("The WordPress return URL must be the Hiqain admin page.")
        ensure_publish_target_allowed(site)
    except (ValueError, OverflowError, WordPressConfigurationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return site


def begin_plugin_connect(db: Session, site_url: str, return_url: str, cid: str) -> str:
    if not cid or len(cid) > 64:
        raise HTTPException(status_code=400, detail="Invalid connection ID.")
    site = validate_connect_urls(site_url, return_url)
    token = secrets.token_urlsafe(32)
    now = utc_now()
    db.execute(delete(WordPressConnectState).where(WordPressConnectState.expires_at < now))
    db.add(WordPressConnectState(
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        site_url=site,
        return_url=return_url,
        correlation_id=cid,
        expires_at=now + CONNECT_TTL,
    ))
    db.commit()
    parts = urlsplit(return_url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    query.append(("seoa_state", token))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def find_connect_state(db: Session, token: str, cid: str, site_url: str) -> WordPressConnectState:
    digest = hashlib.sha256(token.encode()).hexdigest()
    state = db.scalar(select(WordPressConnectState).where(WordPressConnectState.token_hash == digest))
    if (
        state is None or state.consumed_at is not None or state.expires_at <= utc_now()
        or not hmac.compare_digest(state.correlation_id, cid)
        or not hmac.compare_digest(state.site_url, site_url)
    ):
        raise HTTPException(status_code=400, detail="The WordPress connection has expired or is invalid. Click Connect again.")
    return state


def consume_connect_state(db: Session, token: str, cid: str, site_url: str) -> None:
    digest = hashlib.sha256(token.encode()).hexdigest()
    state = db.scalar(
        select(WordPressConnectState)
        .where(WordPressConnectState.token_hash == digest)
        .with_for_update()
    )
    if (
        state is None or state.consumed_at is not None or state.expires_at <= utc_now()
        or not hmac.compare_digest(state.correlation_id, cid)
        or not hmac.compare_digest(state.site_url, site_url)
    ):
        raise HTTPException(status_code=400, detail="The WordPress connection has expired or was already used.")
    state.consumed_at = utc_now()


def verify_plugin_signature(request: Request, raw_body: bytes, db: Session) -> WordPressIntegration:
    headers = request.headers
    try:
        integration_id = int(headers.get("X-SEOA-Integration-Id", ""))
        timestamp = int(headers.get("X-SEOA-Timestamp", ""))
        nonce = headers.get("X-SEOA-Nonce", "")
        signature = headers.get("X-SEOA-Signature", "")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid plugin signature.") from exc
    if (
        integration_id <= 0 or abs(time.time() - timestamp) > SIGNATURE_SKEW_SECONDS
        or not _HEX_32.fullmatch(nonce) or not _SIGNATURE.fullmatch(signature)
    ):
        raise HTTPException(status_code=401, detail="Invalid plugin signature.")
    integration = db.get(WordPressIntegration, integration_id)
    if integration is None or integration.status != "connected" or not integration.shared_secret_encrypted:
        raise HTTPException(status_code=401, detail="Plugin connection is not active.")
    secret = get_credential_cipher().decrypt(integration.shared_secret_encrypted)
    path = request.url.path
    if request.url.query:
        path += "?" + request.url.query
    canonical = f"{request.method.upper()}\n{path}\n{timestamp}\n{hashlib.sha256(raw_body).hexdigest()}"
    expected = "sha256=" + hmac.new(bytes.fromhex(secret), canonical.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid plugin signature.")
    nonce_hash = hashlib.sha256(nonce.encode()).hexdigest()
    db.execute(delete(WordPressRequestNonce).where(
        WordPressRequestNonce.created_at < utc_now() - timedelta(seconds=SIGNATURE_SKEW_SECONDS)
    ))
    db.add(WordPressRequestNonce(integration_id=integration.id, nonce_hash=nonce_hash))
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Plugin request was already received.") from exc
    return integration
