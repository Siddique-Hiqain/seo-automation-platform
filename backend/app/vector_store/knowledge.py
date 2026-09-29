from qdrant_client import models
from app.core.config import settings
from app.vector_store.qdrant import qdrant_client


VECTOR_SIZE = 384


def ensure_knowledge_collection() -> None:

    exists = qdrant_client.collection_exists(
        collection_name=settings.qdrant_collection,
    )

    if exists:
        return

    qdrant_client.create_collection(
        collection_name=settings.qdrant_collection,
        vectors_config=models.VectorParams(
            size=VECTOR_SIZE,
            distance=models.Distance.COSINE,
        ),
    )