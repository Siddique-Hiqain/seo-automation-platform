from pydantic import BaseModel


class WebsiteChunkResponse(BaseModel):
    website_id: int
    pages_chunked: int
    chunks_created: int