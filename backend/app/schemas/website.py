from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, ConfigDict


class WebsiteCreate(BaseModel):
    url: AnyHttpUrl


class WebsiteResponse(BaseModel):
    id: int
    url: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)