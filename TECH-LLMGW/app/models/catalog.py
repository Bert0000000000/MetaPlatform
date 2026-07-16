"""Hardcoded model catalog (mirrors ``llm_models`` metadata)."""

from __future__ import annotations

from typing import Dict, Iterable, List

from app.models.schemas import ModelCapability, ModelSpec, ModelType


class ModelCatalog:
    """Static catalog of known models with pricing & capabilities.

    Phase 2 does not call vendor ``/v1/models`` endpoints; instead this
    catalog is the single source of truth for metadata used by the
    ``/models/sync`` endpoint and ``ModelRepository`` defaults.
    """

    CATALOG: List[ModelSpec] = [
        # OpenAI
        ModelSpec(
            provider="OPENAI",
            code="gpt-4o",
            display_name="GPT-4o",
            type=ModelType.MULTIMODAL,
            context_length=128_000,
            input_price=0.005,
            output_price=0.015,
            capabilities=[ModelCapability.CHAT, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING],
            description="OpenAI 多模态旗舰模型",
        ),
        ModelSpec(
            provider="OPENAI",
            code="gpt-4o-mini",
            display_name="GPT-4o mini",
            type=ModelType.MULTIMODAL,
            context_length=128_000,
            input_price=0.00015,
            output_price=0.0006,
            capabilities=[ModelCapability.CHAT, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING],
            description="OpenAI 轻量多模态模型",
        ),
        ModelSpec(
            provider="OPENAI",
            code="text-embedding-3-large",
            display_name="Text Embedding 3 Large",
            type=ModelType.EMBEDDING,
            context_length=8_191,
            input_price=0.00013,
            output_price=0.0,
            capabilities=[ModelCapability.EMBEDDING],
            description="OpenAI 大维度 Embedding 模型",
        ),
        # Anthropic
        ModelSpec(
            provider="ANTHROPIC",
            code="claude-3-5-sonnet",
            display_name="Claude 3.5 Sonnet",
            type=ModelType.MULTIMODAL,
            context_length=200_000,
            input_price=0.003,
            output_price=0.015,
            capabilities=[ModelCapability.CHAT, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING],
            description="Anthropic 多模态模型",
        ),
        # Volcengine (方舟)
        ModelSpec(
            provider="VOLCENGINE",
            code="doubao-pro-32k",
            display_name="Doubao Pro 32K",
            type=ModelType.CHAT,
            context_length=32_768,
            input_price=0.008,
            output_price=0.024,
            capabilities=[ModelCapability.CHAT, ModelCapability.FUNCTION_CALLING],
            description="字节豆包 Pro 长文模型",
        ),
        ModelSpec(
            provider="VOLCENGINE",
            code="doubao-vision-pro",
            display_name="Doubao Vision Pro",
            type=ModelType.MULTIMODAL,
            context_length=32_768,
            input_price=0.012,
            output_price=0.036,
            capabilities=[ModelCapability.CHAT, ModelCapability.VISION],
            description="字节豆包视觉多模态模型",
        ),
        ModelSpec(
            provider="VOLCENGINE",
            code="doubao-embedding-large",
            display_name="Doubao Embedding Large",
            type=ModelType.EMBEDDING,
            context_length=8_192,
            input_price=0.0005,
            output_price=0.0,
            capabilities=[ModelCapability.EMBEDDING],
            description="字节豆包大维度 Embedding 模型",
        ),
        # 通义千问
        ModelSpec(
            provider="QWEN",
            code="qwen-vl-max",
            display_name="Qwen VL Max",
            type=ModelType.MULTIMODAL,
            context_length=32_000,
            input_price=0.02,
            output_price=0.06,
            capabilities=[ModelCapability.CHAT, ModelCapability.VISION],
            description="通义千问视觉多模态模型",
        ),
        ModelSpec(
            provider="QWEN",
            code="text-embedding-v3",
            display_name="Text Embedding v3",
            type=ModelType.EMBEDDING,
            context_length=8_192,
            input_price=0.0007,
            output_price=0.0,
            capabilities=[ModelCapability.EMBEDDING],
            description="通义千问 Embedding 模型",
        ),
    ]

    @classmethod
    def all(cls) -> List[ModelSpec]:
        return list(cls.CATALOG)

    @classmethod
    def providers(cls) -> List[str]:
        seen: List[str] = []
        for spec in cls.CATALOG:
            if spec.provider not in seen:
                seen.append(spec.provider)
        return seen

    @classmethod
    def filter_by_providers(cls, providers: Iterable[str]) -> List[ModelSpec]:
        wanted = {p.upper() for p in providers}
        return [spec for spec in cls.CATALOG if spec.provider in wanted]

    @classmethod
    def index_by(cls, provider: str, code: str) -> ModelSpec | None:
        provider = provider.upper()
        for spec in cls.CATALOG:
            if spec.provider == provider and spec.code == code:
                return spec
        return None

    @classmethod
    def by_capability(cls, capability: ModelCapability) -> List[ModelSpec]:
        return [spec for spec in cls.CATALOG if capability in spec.capabilities]

    @classmethod
    def by_type(cls, type_: ModelType) -> List[ModelSpec]:
        return [spec for spec in cls.CATALOG if spec.type == type_]

    @classmethod
    def as_lookup(cls) -> Dict[tuple[str, str], ModelSpec]:
        return {(s.provider, s.code): s for s in cls.CATALOG}