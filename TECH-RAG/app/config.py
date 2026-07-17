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

    # Ontology engine base URL (TECH-ONT) for graph queries & concept retrieval.
    # When empty, graph-enhanced search and context assembly gracefully fall
    # back to normal RAG-only behaviour.
    ont_base_url: str = "http://localhost:8201"

    # Kafka bootstrap servers for Outbox event relay (P1-RAG-07).
    # When empty, the relay runs in no-op mode (logs + marks SENT).
    kafka_bootstrap_servers: str = ""
    kafka_topic_prefix: str = "metaplatform"
    kafka_relay_interval_seconds: float = 5.0


settings = Settings()
