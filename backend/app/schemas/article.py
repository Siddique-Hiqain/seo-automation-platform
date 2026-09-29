from pydantic import BaseModel


class ArticleWriterResponse(BaseModel):
    topic_id: int
    article: dict

class ArticleItem(BaseModel):
    id: int | None = None
    topic_id: int
    title: str
    status: str | None = None
    created_at: str | None = None

class ArticleListResponse(BaseModel):
    written: list[ArticleItem]
    unwritten: list[ArticleItem]

class ArticleDetailResponse(BaseModel):
    id: int
    website_id: int
    topic_id: int
    title: str
    meta_title: str | None = None
    meta_description: str | None = None
    content: str
    faq: list | None = None
    status: str
    wp_post_id: int | None = None
    wp_link: str | None = None
    created_at: str | None = None

class ArticleUpdateRequest(BaseModel):
    title: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    content: str | None = None
    faq: list | None = None
