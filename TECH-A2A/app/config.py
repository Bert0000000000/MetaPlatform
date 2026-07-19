from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8502
    reload: bool = False
    jwt_secret: str = "metaplatform-jwt-secret-key-2026"
    jwt_algorithm: str = "HS256"

    # Platform metadata database. PostgreSQL is required for production.
    database_url: str = "postgresql+asyncpg://meta:meta@localhost:5432/metaplatform_a2a"

    # TECH-AGENT base URL. Empty string enables mock mode.
    agent_base_url: str = "http://localhost:8501"
    agent_timeout: float = 30.0

    # TECH-WFE base URL. Empty string enables mock mode.
    wfe_base_url: str = "http://localhost:8801"
    wfe_timeout: float = 30.0

    # Kafka bootstrap servers. Empty string disables Kafka and uses in-memory outbox.
    kafka_bootstrap_servers: str = ""
    kafka_topic: str = "a2a-protocol-events"


settings = Settings()
