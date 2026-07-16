from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8901
    reload: bool = False

    # Platform metadata database (stores knowledge_base / document rows).
    database_url: str = "postgresql+asyncpg://meta:meta@localhost:5432/metaplatform_rag"

    # Local file storage root for uploaded documents (M2 phase; MinIO later).
    storage_root: str = "./storage"

    # Max upload size in bytes (50 MB).
    max_upload_size: int = 50 * 1024 * 1024

    # LLM Gateway base URL (TECH-LLMGW) for embedding generation.
    llmgw_base_url: str = "http://localhost:8401"


settings = Settings()
