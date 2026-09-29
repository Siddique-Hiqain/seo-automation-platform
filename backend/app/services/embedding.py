from functools import lru_cache
from fastembed import TextEmbedding
from app.core.config import settings


@lru_cache
def get_embedding_model() -> TextEmbedding:
    return TextEmbedding(
        model_name=settings.embedding_model,
    )


def embed_passages(
    texts: list[str],
) -> list[list[float]]:

    model = get_embedding_model()

    embeddings = model.passage_embed(
        texts
    )

    return [
        vector.tolist()
        for vector in embeddings
    ]


def embed_query(
    text: str,
) -> list[float]:

    model = get_embedding_model()

    vector = next(
        model.query_embed(
            [text]
        )
    )

    return vector.tolist()