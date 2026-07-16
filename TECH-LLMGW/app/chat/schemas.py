"""Chat domain schemas (Pydantic)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

Detail = Literal["low", "high", "auto"]


class MultimodalImage(BaseModel):
    url: Optional[str] = None
    base64: Optional[str] = None
    detail: Detail = "auto"

    @model_validator(mode="after")
    def _exactly_one_source(self) -> "MultimodalImage":
        has_url = bool(self.url)
        has_b64 = bool(self.base64)
        if has_url == has_b64:
            raise ValueError("images[].url 与 base64 必须二选一")
        return self


class TokenUsage(BaseModel):
    promptTokens: int = 0
    completionTokens: int = 0
    totalTokens: int = 0


class MultimodalRequest(BaseModel):
    modelId: str
    text: str = Field(min_length=1, max_length=8192)
    images: List[MultimodalImage] = Field(min_length=1, max_length=8)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    maxTokens: int = Field(default=1024, ge=1, le=8192)
    systemPrompt: Optional[str] = Field(default=None, max_length=4096)


class MultimodalResponse(BaseModel):
    id: str
    model: str
    provider: str
    content: str
    finishReason: str = "stop"
    usage: TokenUsage
    latencyMs: int = 0


class StreamChatRequest(BaseModel):
    """Request body for the streaming chat endpoint (S-LLMGW-04).

    Mirrors ``MultimodalRequest`` but ``text`` allows empty strings so the
    endpoint can return a 422 (``InvalidRequestError``) instead of a pydantic
    400 validation error.
    """

    modelId: str
    text: str = Field(default="", max_length=8192)
    images: List[MultimodalImage] = Field(min_length=1, max_length=8)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    maxTokens: int = Field(default=1024, ge=1, le=8192)
    systemPrompt: Optional[str] = Field(default=None, max_length=4096)