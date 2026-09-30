from pydantic import BaseModel


class WebsiteCrawlResponse(BaseModel):
    website_id: int
    pages_crawled: int
    pages_failed: int
    page_urls: list[str]
