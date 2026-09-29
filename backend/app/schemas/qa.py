from pydantic import BaseModel, Field


class WebsiteQuestionRequest(BaseModel):
    question: str = Field(
        min_length=2,
        max_length=2000,
    )


class AnswerSource(BaseModel):
    page_id: int
    chunk_id: int
    title: str | None
    url: str
    score: float


class WebsiteAnswerResponse(BaseModel):
    website_id: int
    question: str
    answer: str
    sources: list[AnswerSource]