def chunk_text(
    text: str,
    chunk_size: int = 300,
    overlap: int = 50,
) -> list[str]:

    if chunk_size <= 0:
        raise ValueError(
            "chunk_size must be greater than 0"
        )

    if overlap < 0:
        raise ValueError(
            "overlap cannot be negative"
        )

    if overlap >= chunk_size:
        raise ValueError(
            "overlap must be smaller than chunk_size"
        )

    words = text.split()

    if not words:
        return []

    chunks: list[str] = []

    start = 0

    while start < len(words):

        end = min(
            start + chunk_size,
            len(words),
        )

        chunk_words = words[
            start:end
        ]

        chunk = " ".join(
            chunk_words
        ).strip()

        if chunk:
            chunks.append(
                chunk
            )

        if end >= len(words):
            break

        start = end - overlap

    return chunks