"""Pydantic schemas for the Embedding domain."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field, field_validator


class TokenUsage(BaseModel):
    promptTokens: int = 0
    totalTokens: int = 0


class BatchEmbeddingRequest(BaseModel):
    modelId: str
    inputs: List[str] = Field(min_length=1, max_length=100)
    normalize: bool = False

    @field_validator("inputs")
    @classmethod
    def _no_blank_inputs(cls, value: List[str]) -> List[str]:
        for idx, text in enumerate(value):
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"inputs[{idx}] 必须为非空字符串")
            if len(text) > 8192:
                raise ValueError(f"inputs[{idx}] 长度超过 8192 字符")
        return value


class BatchEmbeddingResponse(BaseModel):
    model: str
    provider: str
    dimension: int
    embeddings: List[List[float]]
    usage: TokenUsage