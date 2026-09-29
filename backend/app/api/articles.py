from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.article import Article
from app.schemas.article import ArticleDetailResponse
from app.schemas.article import (
    ArticleUpdateRequest,
)
from app.schemas.wordpress import WordPressPublishRequest, WordPressPublishResponse
from app.services.credential_cipher import (
    CredentialConfigurationError,
    CredentialDecryptionError,
)
from app.services.wordpress import (
    WordPressConfigurationError,
    WordPressPublishError,
    publish_article_to_wordpress,
)


router = APIRouter(
    prefix="/articles",
    tags=["Articles"]
)

@router.get(
    "/{article_id}",
    response_model=ArticleDetailResponse,
)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
):

    article = db.get(
        Article,
        article_id
    )

    if article is None:
        raise HTTPException(
            status_code=404,
            detail="Article not found"
        )

    return ArticleDetailResponse(
        id=article.id,
        website_id=article.website_id,
        topic_id=article.topic_id,
        title=article.title,
        meta_title=article.meta_title,
        meta_description=article.meta_description,
        content=article.content,
        faq=article.faq,
        status=article.status,
        wp_post_id=article.wp_post_id,
        wp_link=article.wp_link,
        created_at=str(
            article.created_at
        ),
    )

@router.put(
    "/{article_id}",
)
def update_article(
    article_id: int,
    payload: ArticleUpdateRequest,
    db: Session = Depends(get_db),
):

    article = db.get(
        Article,
        article_id
    )

    if article is None:

        raise HTTPException(
            status_code=404,
            detail="Article not found"
        )

    if payload.title is not None:
        article.title = payload.title

    if payload.meta_title is not None:
        article.meta_title = payload.meta_title

    if payload.meta_description is not None:
        article.meta_description = payload.meta_description

    if payload.content is not None:
        article.content = payload.content

    if payload.faq is not None:
        article.faq = payload.faq


    db.commit()
    db.refresh(article)


    return {
        "message": "Article updated successfully",
        "article_id": article.id,
    }


@router.post(
    "/{article_id}/publish",
    response_model=WordPressPublishResponse,
)
def publish_article(
    article_id: int,
    payload: WordPressPublishRequest,
    db: Session = Depends(get_db),
):
    if db.get(Article, article_id) is None:
        raise HTTPException(status_code=404, detail="Article not found")

    try:
        return publish_article_to_wordpress(db, article_id, payload.status)
    except (CredentialConfigurationError, CredentialDecryptionError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except WordPressConfigurationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except WordPressPublishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
