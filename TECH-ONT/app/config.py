"""Service configuration."""

from __future__ import annotations

import os


class Settings:
    """Simple environment-based settings.

    Pydantic-Settings is intentionally avoided to keep the footprint small for
    this spike.
    """

    def __init__(self) -> None:
        self.ont_api_base_url = os.getenv(
            "ONT_API_BASE_URL",
            "http://localhost:8080/api/v1/ont",
        )
        self.llmgw_api_base_url = os.getenv(
            "LLMGW_API_BASE_URL",
            "http://localhost:8000/api/v1/llmgw",
        )
        self.llm_model = os.getenv("LLM_MODEL", "auto")


settings = Settings()
