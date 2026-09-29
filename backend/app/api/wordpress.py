from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.website import Website
from app.models.wordpress_integration import WordPressIntegration
from app.schemas.wordpress import WordPressCredentialRequest, WordPressIntegrationResponse
from app.services.credential_cipher import CredentialConfigurationError, get_credential_cipher
from app.services.wordpress import (
    WordPressConnectionError,
    normalize_site_url,
    utc_now,
    verify_wordpress_credentials,
)


router = APIRouter(prefix="/integrations/wordpress", tags=["WordPress"])


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
    integration.disconnected_at = utc_now()
    db.commit()
