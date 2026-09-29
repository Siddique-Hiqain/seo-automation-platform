from pydantic import BaseModel


class WebsiteEmbeddingResponse(BaseModel):
    website_id: int
    chunks_embedded: int
    collection: str