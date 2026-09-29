from pydantic import BaseModel


class TopicResearchResponse(BaseModel):
    website_id: int
    topics_generated: int
    topics: list[dict]