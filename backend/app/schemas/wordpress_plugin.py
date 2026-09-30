from typing import Literal

from pydantic import BaseModel, Field, SecretStr


class WordPressPluginConnectRequest(BaseModel):
    state: str = Field(min_length=20, max_length=200)
    base_url: str = Field(max_length=512)
    admin_url: str = Field(max_length=512)
    rest_url: str = Field(max_length=512)
    username: str = Field(min_length=1, max_length=255)
    app_password: SecretStr
    permalink_structure: str = Field(default="", max_length=255)
    site_name: str = Field(default="", max_length=255)
    wp_version: str = Field(default="", max_length=30)
    plugin_version: str = Field(default="", max_length=20)
    seo_plugin: Literal["yoast", "rank_math", "aioseo", "none"] = "none"
    cid: str = Field(min_length=1, max_length=64)


class WordPressPluginConnectResponse(BaseModel):
    integration_id: int
    shared_secret: str
    website_id: int


class WordPressPermalinkEvent(BaseModel):
    permalink_structure: str = Field(max_length=255)
    old_permalink_structure: str | None = Field(default=None, max_length=255)
    site_url: str = Field(max_length=512)
    plugin_version: str = Field(max_length=20)
    plugin_capabilities: list[str] = Field(default_factory=list)
    seo_plugin: Literal["yoast", "rank_math", "aioseo", "none"] | None = None


class WordPressPostStatusEvent(BaseModel):
    platform_id: str = Field(max_length=32)
    article_id: int | None = None
    status: Literal["publish", "draft", "trash"]
    link: str = Field(default="", max_length=512)
    event_id: str = Field(min_length=1, max_length=64)
    previous_status: str = Field(default="", max_length=20)
    origin: str = Field(default="UNKNOWN", max_length=32)
    actor_user_id: int | None = None
    blocked: bool = False
    occurred_at: str = Field(default="", max_length=50)
    plugin_version: str = Field(default="", max_length=20)
