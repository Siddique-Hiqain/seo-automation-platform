from pydantic import BaseModel


class KeywordResearchResponse(BaseModel):
    website_id: int
    keywords_created: int