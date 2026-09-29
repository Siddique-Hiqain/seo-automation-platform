from pydantic import BaseModel


class SearchResult(BaseModel):
    chunk_id: int
    page_id: int
    score: float
    url: str
    title: str | None
    content: str


class WebsiteSearchResponse(BaseModel):
    website_id: int
    query: str
    results: list[SearchResult]