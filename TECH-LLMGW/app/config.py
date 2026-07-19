from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8401
    reload: bool = False
    jwt_secret: str = "metaplatform-jwt-secret-key-2026"
    jwt_algorithm: str = "HS256"
    # Platform metadata database. PostgreSQL is required for production.
    database_url: str = "postgresql+asyncpg://meta:meta@localhost:5432/metaplatform_llmgw"


settings = Settings()
