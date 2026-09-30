from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class WebsiteCreate(BaseModel):
    url: AnyHttpUrl


class WebsiteResponse(BaseModel):
    id: int
    url: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WebsiteDeleteRequest(BaseModel):
    confirm_url: str = Field(min_length=1, max_length=512)
