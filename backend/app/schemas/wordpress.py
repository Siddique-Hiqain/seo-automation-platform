from typing import Literal

from pydantic import BaseModel, Field, SecretStr


class WordPressCredentialRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    application_password: SecretStr = Field(min_length=1, max_length=255)


class WordPressIntegrationResponse(BaseModel):
    id: int
    website_id: int
    base_url: str
    username: str
    status: str
    connected_at: str


class WordPressPublishRequest(BaseModel):
    status: Literal["draft", "publish"] = "draft"


class WordPressPublishResponse(BaseModel):
    article_id: int
    wordpress_post_id: int
    link: str
    status: str
