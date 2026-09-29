from qdrant_client import models
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.content_chunk import ContentChunk
from app.services.embedding import embed_query
from app.vector_store.qdrant import qdrant_client


def semantic_search(
    db: Session,
    website_id: int,
    query: str,
    limit: int = 5,
) -> list[dict]:

    # Convert the user's question into
    # the same vector space as our chunks.
    query_vector = embed_query(
        query
    )

    search_response = qdrant_client.query_points(
        collection_name=settings.qdrant_collection,
        query=query_vector,

        # CRITICAL:
        # only search vectors belonging
        # to this website.
        query_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="website_id",
                    match=models.MatchValue(
                        value=website_id
                    ),
                )
            ]
        ),

        limit=limit,
        with_payload=True,
    )

    hits = search_response.points

    if not hits:
        return []

    chunk_ids = []

    for hit in hits:
        payload = hit.payload or {}

        chunk_id = payload.get(
            "chunk_id"
        )

        if chunk_id is not None:
            chunk_ids.append(
                int(chunk_id)
            )

    chunks = db.scalars(
        select(ContentChunk).where(
            ContentChunk.id.in_(
                chunk_ids
            )
        )
    ).all()

    chunk_map = {
        chunk.id: chunk
        for chunk in chunks
    }

    results = []

    # Iterate over Qdrant results,
    # not MySQL results, so we preserve
    # similarity ranking.
    for hit in hits:

        payload = hit.payload or {}

        chunk_id = payload.get(
            "chunk_id"
        )

        if chunk_id is None:
            continue

        chunk = chunk_map.get(
            int(chunk_id)
        )

        if chunk is None:
            continue

        results.append(
            {
                "chunk_id": chunk.id,
                "page_id": int(
                    payload["page_id"]
                ),
                "score": float(
                    hit.score
                ),
                "url": str(
                    payload["url"]
                ),
                "title": payload.get(
                    "title"
                ),
                "content": chunk.content,
            }
        )

    return results