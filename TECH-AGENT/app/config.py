from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8501
    reload: bool = False
    jwt_secret: str = "metaplatform-jwt-secret-key-2026"
    jwt_algorithm: str = "HS256"

    # Platform metadata database. Defaults to SQLite for local dev/tests.
    # PostgreSQL example:
    #   postgresql+asyncpg://meta:meta@localhost:5432/metaplatform_agent
    database_url: str = "sqlite+aiosqlite:///./tech_agent.db"

    # Upstream LLM Gateway (TECH-LLMGW). Empty string disables external calls
    # and the execution engine falls back to a deterministic mock response.
    llmgw_base_url: str = "http://localhost:8401"
    llmgw_timeout: float = 30.0

    # TECH-ACTION base URL. Empty string enables mock mode.
    action_base_url: str = "http://localhost:8403"
    action_timeout: float = 30.0

    # TECH-RAG base URL. Empty string enables mock mode.
    rag_base_url: str = "http://localhost:8405"
    rag_timeout: float = 30.0

    # Kafka bootstrap servers. Empty string disables Kafka and uses in-memory outbox.
    kafka_bootstrap_servers: str = ""
    kafka_topic: str = "agent-execution-events"


settings = Settings()
