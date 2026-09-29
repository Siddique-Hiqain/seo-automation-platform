from pydantic import BaseModel


class WebsiteProfileResponse(BaseModel):
    website_id: int
    profile: dict