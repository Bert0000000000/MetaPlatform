from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8701
    reload: bool = False

    # Platform metadata database (stores data_source rows).
    database_url: str = "postgresql+asyncpg://meta:meta@localhost:5432/metaplatform_data"

    # AES-256 key material for encrypting connection_config passwords.
    data_encryption_key: str = "metaplatform-data-key-2026"


settings = Settings()
