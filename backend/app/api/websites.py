import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.website import Website
from app.schemas.website import WebsiteCreate, WebsiteResponse
from app.models.website_page import WebsitePage
from app.schemas.crawl import (
    CrawlResponse,
    WebsiteCrawlResponse,
)
from app.services.crawler import (
    CrawlerError,
    UnsafeURLError,
    crawl_page,
    crawl_website,
)
from app.models.content_chunk import ContentChunk
from app.schemas.chunk import WebsiteChunkResponse
from app.services.chunker import chunk_text
from qdrant_client import models
from app.core.config import settings
from app.models.content_chunk import ContentChunk
from app.schemas.embedding import WebsiteEmbeddingResponse
from app.services.embedding import embed_passages
from app.vector_store.knowledge import ensure_knowledge_collection
from app.vector_store.qdrant import qdrant_client
from app.schemas.search import (
    WebsiteSearchResponse,
)
from app.services.semantic_search import (
    semantic_search,
)
from app.graphs.website_qa import (
    WebsiteQAContext,
    website_qa_graph,
)
from app.providers.llm.openrouter import (
    OpenRouterProvider,
)
from app.schemas.qa import (
    AnswerSource,
    WebsiteAnswerResponse,
    WebsiteQuestionRequest,
)
from app.graphs.website_profile import (
    WebsiteProfileContext,
    website_profile_graph,
)
from app.schemas.profile import (
    WebsiteProfileResponse,
)
from app.models.website_profile import WebsiteProfile
from app.graphs.topic_research import (
    TopicResearchContext,
    topic_research_graph,
)
from app.schemas.topic import (
    TopicResearchResponse,
)
from app.models.topic import Topic
from app.graphs.keyword_research import (
    KeywordResearchContext,
    keyword_research_graph,
)
from app.schemas.keyword import (
    KeywordResearchResponse,
)
from app.graphs.topic_scoring import (
    topic_scoring_graph,
    TopicScoringContext,
)
from app.graphs.article_writer import (
    article_writer_graph,
    ArticleWriterContext,
)
from app.schemas.article import (
    ArticleWriterResponse,
    ArticleListResponse,
    ArticleItem,
)
from app.schemas.topic_score import (
    TopicScoreResponse,
)
from app.models.article import Article




router = APIRouter(
    prefix="/api/websites",
    tags=["Websites"],
)


@router.post(
    "",
    response_model=WebsiteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_website(
    payload: WebsiteCreate,
    db: Session = Depends(get_db),
):
    url = str(payload.url)

    existing_website = db.scalar(
        select(Website).where(Website.url == url)
    )

    if existing_website:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Website already exists",
        )

    website = Website(
        url=url,
        status="pending",
    )

    db.add(website)
    db.commit()
    db.refresh(website)

    return website

@router.get(
    "",
    response_model=list[WebsiteResponse],
)
def list_websites(
    db: Session = Depends(get_db),
):
    websites = db.scalars(
        select(Website).order_by(Website.created_at.desc())
    ).all()

    return websites

@router.post(
    "/{website_id}/crawl-homepage",
    response_model=CrawlResponse,
)
def crawl_website_homepage(
    website_id: int,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    website.status = "crawling"
    db.commit()

    try:
        with httpx.Client(
            timeout=10.0,
            headers={
                "User-Agent": "SEOAutomationBot/0.1"
            },
            follow_redirects=False,
        ) as client:
            result = crawl_page(
                website.url,
                client,
            )

    except UnsafeURLError as exc:
        website.status = "failed"
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except CrawlerError as exc:
        website.status = "failed"
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    page = db.scalar(
        select(WebsitePage).where(
            WebsitePage.website_id == website.id,
            WebsitePage.url == result.url,
        )
    )

    if page is None:
        page = WebsitePage(
            website_id=website.id,
            url=result.url,
            title=result.title,
            status_code=result.status_code,
            content=result.content,
        )

        db.add(page)

    else:
        page.title = result.title
        page.status_code = result.status_code
        page.content = result.content

    website.status = "crawled"

    db.commit()
    db.refresh(page)

    return CrawlResponse(
        page_id=page.id,
        website_id=website.id,
        url=page.url,
        title=page.title,
        status_code=page.status_code,
        characters=len(page.content),
        preview=page.content[:500],
    )

@router.post(
    "/{website_id}/crawl",
    response_model=WebsiteCrawlResponse,
)
def crawl_entire_website(
    website_id: int,
    max_pages: int = 10,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    if max_pages < 1 or max_pages > 25:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_pages must be between 1 and 25",
        )

    website.status = "crawling"
    db.commit()

    try:
        pages, failed_urls = crawl_website(
            website.url,
            max_pages=max_pages,
        )

    except (
        CrawlerError,
        UnsafeURLError,
    ) as exc:
        website.status = "failed"
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    for result in pages:

        existing_page = db.scalar(
            select(WebsitePage).where(
                WebsitePage.website_id
                == website.id,
                WebsitePage.url
                == result.url,
            )
        )

        if existing_page:
            existing_page.title = (
                result.title
            )

            existing_page.status_code = (
                result.status_code
            )

            existing_page.content = (
                result.content
            )

        else:
            page = WebsitePage(
                website_id=website.id,
                url=result.url,
                title=result.title,
                status_code=result.status_code,
                content=result.content,
            )

            db.add(page)

    if pages:
        website.status = "crawled"
    else:
        website.status = "failed"

    db.commit()

    return WebsiteCrawlResponse(
        website_id=website.id,
        pages_crawled=len(pages),
        pages_failed=len(
            failed_urls
        ),
        page_urls=[
            page.url
            for page in pages
        ],
    )

@router.post(
    "/{website_id}/chunk",
    response_model=WebsiteChunkResponse,
)
def chunk_website_pages(
    website_id: int,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    pages = db.scalars(
        select(WebsitePage).where(
            WebsitePage.website_id
            == website.id
        )
    ).all()

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Website has no crawled pages",
        )

    chunks_created = 0
    pages_chunked = 0

    for page in pages:

        # Remove old chunks because page content
        # may have changed after a recrawl.
        db.execute(
            delete(ContentChunk).where(
                ContentChunk.page_id
                == page.id
            )
        )

        chunks = chunk_text(
            page.content
        )

        for index, content in enumerate(
            chunks
        ):
            chunk = ContentChunk(
                page_id=page.id,
                chunk_index=index,
                content=content,
            )

            db.add(chunk)

            chunks_created += 1

        if chunks:
            pages_chunked += 1

    db.commit()

    return WebsiteChunkResponse(
        website_id=website.id,
        pages_chunked=pages_chunked,
        chunks_created=chunks_created,
    )

@router.post(
    "/{website_id}/embed",
    response_model=WebsiteEmbeddingResponse,
)
def embed_website_chunks(
    website_id: int,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    rows = db.execute(
        select(
            ContentChunk,
            WebsitePage,
        )
        .join(
            WebsitePage,
            ContentChunk.page_id
            == WebsitePage.id,
        )
        .where(
            WebsitePage.website_id
            == website.id
        )
        .order_by(
            ContentChunk.id
        )
    ).all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Website has no chunks",
        )

    ensure_knowledge_collection()

    texts = [
        chunk.content
        for chunk, page in rows
    ]

    vectors = embed_passages(
        texts
    )

    points = []

    for (
        chunk,
        page,
    ), vector in zip(
        rows,
        vectors,
        strict=True,
    ):

        point = models.PointStruct(
            id=chunk.id,
            vector=vector,
            payload={
                "chunk_id": chunk.id,
                "page_id": page.id,
                "website_id": website.id,
                "url": page.url,
                "title": page.title,
                "chunk_index": chunk.chunk_index,
            },
        )

        points.append(
            point
        )

    qdrant_client.upsert(
        collection_name=settings.qdrant_collection,
        points=points,
        wait=True,
    )

    return WebsiteEmbeddingResponse(
        website_id=website.id,
        chunks_embedded=len(points),
        collection=settings.qdrant_collection,
    )

@router.get(
    "/{website_id}/search",
    response_model=WebsiteSearchResponse,
)
def search_website(
    website_id: int,
    query: str,
    limit: int = 5,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    if not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty",
        )

    if limit < 1 or limit > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit must be between 1 and 20",
        )

    results = semantic_search(
        db=db,
        website_id=website_id,
        query=query,
        limit=limit,
    )

    return WebsiteSearchResponse(
        website_id=website_id,
        query=query,
        results=results,
    )

@router.post(
    "/{website_id}/ask",
    response_model=WebsiteAnswerResponse,
)
def ask_website(
    website_id: int,
    payload: WebsiteQuestionRequest,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    llm = OpenRouterProvider()

    try:
        result = website_qa_graph.invoke(
            {
                "website_id": website_id,
                "question": payload.question,
                "retrieved_chunks": [],
                "context": "",
                "answer": "",
            },
            context=WebsiteQAContext(
                db=db,
                llm=llm,
            ),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    sources = [
        AnswerSource(
            page_id=item["page_id"],
            chunk_id=item["chunk_id"],
            title=item["title"],
            url=item["url"],
            score=item["score"],
        )
        for item in result[
            "retrieved_chunks"
        ]
    ]

    return WebsiteAnswerResponse(
        website_id=website_id,
        question=payload.question,
        answer=result["answer"],
        sources=sources,
    )

@router.post(
    "/{website_id}/profile",
    response_model=WebsiteProfileResponse,
)
def generate_website_profile(
    website_id: int,
    db: Session = Depends(get_db),
):
    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    llm = OpenRouterProvider()

    try:
        result = website_profile_graph.invoke(
            {
                "website_id": website_id,
                "website_context": "",
                "profile": {},
            },

            context=WebsiteProfileContext(
                db=db,
                llm=llm,
            ),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile generation failed: {str(exc)}",
        ) from exc


    return WebsiteProfileResponse(
        website_id=website_id,
        profile=result["profile"],
    )

@router.get(
    "/{website_id}/profile",
    response_model=WebsiteProfileResponse,
)
def get_website_profile(
    website_id: int,
    db: Session = Depends(get_db),
):

    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    profile = db.query(
        WebsiteProfile
    ).filter(
        WebsiteProfile.website_id
        == website_id
    ).first()


    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website profile not generated yet",
        )


    return WebsiteProfileResponse(
        website_id=website_id,
        profile=profile.profile_data,
    )


@router.post(
    "/{website_id}/topics/research",
    response_model=TopicResearchResponse,
)
def research_topics(
    website_id: int,
    db: Session = Depends(get_db),
):

    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    llm = OpenRouterProvider()

    try:
        result = topic_research_graph.invoke(
            {
                "website_id": website_id,
                "profile": {},
                "topics": [],
            },

            context=TopicResearchContext(
                db=db,
                llm=llm,
            ),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Topic research failed: {str(exc)}",
        ) from exc


    return TopicResearchResponse(
        website_id=website_id,
        topics_generated=len(
            result["topics"]
        ),
        topics=result["topics"],
    )

@router.get(
    "/{website_id}/topics",
    response_model=TopicResearchResponse,
)
def get_topics(
    website_id: int,
    db: Session = Depends(get_db),
):

    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    topics = db.scalars(
        select(Topic).where(
            Topic.website_id == website_id
        )
    ).all()


    return TopicResearchResponse(
        website_id=website_id,
        topics_generated=len(topics),
        topics=[
            {
                "id": topic.id,
                "title": topic.title,
                "keyword_ideas": topic.keyword_ideas,
                "search_intent": topic.search_intent,
                "business_value": topic.business_value,
                "priority_score": topic.priority_score,
                "reasoning": topic.reasoning,
            }
            for topic in topics
        ],
    )


@router.post(
    "/{website_id}/keywords/research",
    response_model=KeywordResearchResponse,
)
def research_keywords(
    website_id: int,
    db: Session = Depends(get_db),
):

    website = db.get(
        Website,
        website_id,
    )

    if website is None:
        raise HTTPException(
            status_code=404,
            detail="Website not found",
        )

    llm = OpenRouterProvider()

    result = keyword_research_graph.invoke(

        {
            "website_id": website_id,
            "topics": [],
            "keywords": [],
        },

        context=KeywordResearchContext(
            db=db,
            llm=llm,
        ),
    )


    return KeywordResearchResponse(
        website_id=website_id,
        keywords_created=len(
            result["keywords"]
        ),
    )


@router.post(
    "/{website_id}/topics/score",
    response_model=TopicScoreResponse
)
def score_topics(
    website_id: int,
    db: Session = Depends(get_db),
):

    context = TopicScoringContext(
        db=db,
    )

    result = topic_scoring_graph.invoke(
        {
            "website_id": website_id,
            "topics": [],
            "metrics": [],
            "scores": [],
        },
        context=context,
    )


    return {
        "website_id": website_id,
        "topics_scored": len(
            result["scores"]
        ),
    }


@router.post(
    "/topics/{topic_id}/write",
    response_model=ArticleWriterResponse,
)
def write_article(
    topic_id: int,
    db: Session = Depends(get_db),
):

    topic = db.get(
        Topic,
        topic_id
    )

    if topic is None:
        raise HTTPException(
            status_code=404,
            detail="Topic not found",
        )

    llm = OpenRouterProvider()

    try:

        result = article_writer_graph.invoke(
            {
                "topic_id": topic_id,
                "topic": {},
                "keywords": [],
                "context": [],
                "article": {},
            },

            context=ArticleWriterContext(
                db=db,
                llm=llm,
            ),
        )


    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Article writing failed: {str(exc)}",
        ) from exc


    return {
        "topic_id": topic_id,
        "article": result["article"],
    }


@router.get(
    "/{website_id}/articles",
    response_model=ArticleListResponse,
)
def get_articles(
    website_id: int,
    db: Session = Depends(get_db),
):

    website = db.get(
        Website,
        website_id,
    )

    if website is None:

        raise HTTPException(
            status_code=404,
            detail="Website not found",
        )

    topics = db.scalars(
        select(Topic)
        .where(
            Topic.website_id == website_id
        )
    ).all()

    articles = db.scalars(
        select(Article)
        .where(
            Article.website_id == website_id
        )
    ).all()

    article_map = {
        article.topic_id: article
        for article in articles
    }

    written = []
    unwritten = []

    for topic in topics:
        article = article_map.get(
            topic.id
        )

        if article:
            written.append(
                ArticleItem(
                    id=article.id,
                    topic_id=topic.id,
                    title=article.title,
                    status=article.status,
                    created_at=str(
                        article.created_at
                    ),
                )
            )
        else:
            unwritten.append(
                ArticleItem(
                    topic_id=topic.id,
                    title=topic.title,
                    status="unwritten",
                )
            )


    return ArticleListResponse(
        written=written,
        unwritten=unwritten,
    )
