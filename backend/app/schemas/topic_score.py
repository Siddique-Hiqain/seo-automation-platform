from pydantic import BaseModel


class TopicScoreResponse(BaseModel):
    website_id: int
    topics_scored: int