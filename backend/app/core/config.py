from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SEO Automation API"
    app_env: str = "development"
    app_debug: bool = True
    database_url: str
    qdrant_url: str = "http://localhost:6333"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    qdrant_collection: str = "website_chunks"
    openrouter_api_key: str
    llm_model: str = "openrouter/free"
    DATAFORSEO_LOGIN: str
    DATAFORSEO_PASSWORD: str
    wordpress_credentials_key: str = ""
    wordpress_request_timeout_seconds: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
