from pydantic import BaseModel


class CrawlResponse(BaseModel):
    page_id: int
    website_id: int
    url: str
    title: str | None
    status_code: int
    characters: int
    preview: str


class WebsiteCrawlResponse(BaseModel):
    website_id: int
    pages_crawled: int
    pages_failed: int
    page_urls: list[str]