"""Vendored model pricing table (P1, LiteLLM pattern).

Resolution order for ``PricingTable.get`` (borrowed from LiteLLM's
cost_calculator model-info chain):

1. ``LLMGW_MODEL_ALIASES`` env JSON — explicit mapping; the ONLY reliable
   source for ARK ``ep-xxx`` endpoint IDs (ARK accepts both canonical model
   names and endpoint IDs, and echoes the request value back, so the gateway
   cannot infer the catalog entry from the response).
2. Vendored table exact hit (``cost/data/model_prices.json``).
3. Longest family-prefix match (``doubao-1.5-pro-32k-250115`` → the
   ``doubao-1.5-pro-32k`` entry when the dated variant is absent).
4. Miss → cost 0 + ``llmgw.pricing.unknown_model`` WARNING (observable,
   never blocks the request).

``LLMGW_PRICE_OVERRIDES`` env JSON replaces entries wholesale
(negotiated / discounted prices) without a redeploy.
"""

from __future__ import annotations

import fnmatch
import json
import os
from dataclasses import dataclass
from importlib import resources
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

VENDORED_RESOURCE = "mate_tech_llmgw.cost.data"
VENDORED_FILENAME = "model_prices.json"

UNKNOWN_MODEL_WARN_EVERY = 100
_unknown_model_counter: dict[str, int] = {}


@dataclass(frozen=True, slots=True)
class ModelPrice:
    """Per-token unit price in USD."""

    input_per_token: float
    output_per_token: float
    cache_read_per_token: float = 0.0
    source: str = "vendored"

    def cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        return prompt_tokens * self.input_per_token + (completion_tokens * self.output_per_token)

    def cost_cached(
        self, cached_prompt_tokens: int, prompt_tokens: int, completion_tokens: int
    ) -> float:
        """Cache-hit aware cost (LiteLLM cache_read_input_token_cost pattern)."""
        uncached = max(prompt_tokens - cached_prompt_tokens, 0)
        return (
            uncached * self.input_per_token
            + cached_prompt_tokens * self.cache_read_per_token
            + completion_tokens * self.output_per_token
        )


class PricingTable:
    """Lookup façade: aliases → overrides → vendored exact → prefix."""

    def __init__(
        self,
        vendored: dict[str, dict[str, Any]],
        overrides: dict[str, ModelPrice] | None = None,
        aliases: dict[str, str] | None = None,
    ) -> None:
        self._vendored = vendored
        self._overrides = overrides or {}
        self._aliases = aliases or {}
        # Longest-prefix candidates sorted once: "doubao-1.5-pro-32k" before "doubao".
        self._prefixes = sorted(
            (k for k in vendored if "*" in k or self._looks_like_family(k)),
            key=len,
            reverse=True,
        )

    @staticmethod
    def _looks_like_family(key: str) -> bool:
        # Only bare family names participate in prefix matching; dated
        # variants ("...-250115") and meta keys do not.
        return not key.startswith("_") and not any(
            key.endswith(suf) for suf in ("-250115", "-240715", "-240915", "-250515")
        )

    def resolve_alias(self, model: str) -> str:
        return self._aliases.get(model, model)

    def get(self, model: str) -> ModelPrice | None:
        """Resolve a request model name to a price entry (None = unknown)."""
        name = self.resolve_alias((model or "").strip())
        if not name:
            return None

        if name in self._overrides:
            return self._overrides[name]

        entry = self._vendored.get(name)
        if entry is not None:
            return self._from_entry(name, entry, "vendored")

        # Family prefix: exact catalog key that the request name starts with.
        lower = name.lower()
        for prefix in self._prefixes:
            if lower.startswith(prefix.lower()) and "*" not in prefix:
                return self._from_entry(prefix, self._vendored[prefix], "prefix")

        # Glob aliases (fnmatch) let operators register whole ep- families.
        for pattern, target in self._aliases.items():
            if any(ch in pattern for ch in "*?[") and fnmatch.fnmatchcase(lower, pattern):
                resolved = self.get(target)
                if resolved is not None:
                    return resolved

        self._warn_unknown(name)
        return None

    def _from_entry(self, key: str, entry: dict[str, Any], source: str) -> ModelPrice:
        return ModelPrice(
            input_per_token=float(entry.get("input_cost_per_token", 0.0) or 0.0),
            output_per_token=float(entry.get("output_cost_per_token", 0.0) or 0.0),
            cache_read_per_token=float(entry.get("cache_read_input_token_cost", 0.0) or 0.0),
            source=str(entry.get("_source", source)),
        )

    @staticmethod
    def _warn_unknown(name: str) -> None:
        count = _unknown_model_counter.get(name, 0) + 1
        _unknown_model_counter[name] = count
        if count == 1 or count % UNKNOWN_MODEL_WARN_EVERY == 0:
            logger.warning("llmgw.pricing.unknown_model", model=name, seen=count)

    def catalog_keys(self) -> list[str]:
        return [k for k in self._vendored if not k.startswith("_")]


def load_vendored_prices() -> dict[str, dict[str, Any]]:
    """Read the vendored JSON via importlib.resources (wheel-safe)."""
    ref = resources.files(VENDORED_RESOURCE).joinpath(VENDORED_FILENAME)
    with ref.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _parse_env_json(raw: str | None) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.warning("llmgw.pricing.env_json_invalid", error=str(exc))
        return {}
    return data if isinstance(data, dict) else {}


def load_pricing_from_env() -> PricingTable:
    """Build the process-wide pricing table from vendored data + env."""
    overrides_raw = _parse_env_json(os.getenv("LLMGW_PRICE_OVERRIDES"))
    overrides: dict[str, ModelPrice] = {}
    for name, entry in overrides_raw.items():
        if not isinstance(entry, dict):
            continue
        overrides[name] = ModelPrice(
            input_per_token=float(entry.get("input_cost_per_token", 0.0) or 0.0),
            output_per_token=float(entry.get("output_cost_per_token", 0.0) or 0.0),
            cache_read_per_token=float(entry.get("cache_read_input_token_cost", 0.0) or 0.0),
            source="override",
        )

    aliases_raw = _parse_env_json(os.getenv("LLMGW_MODEL_ALIASES"))
    aliases = {str(k): str(v) for k, v in aliases_raw.items() if isinstance(v, str)}

    return PricingTable(load_vendored_prices(), overrides, aliases)


_table: PricingTable | None = None


def get_pricing() -> PricingTable:
    """Process-wide pricing table singleton (built lazily, env-aware)."""
    global _table
    if _table is None:
        _table = load_pricing_from_env()
    return _table


def set_pricing(table: PricingTable | None) -> None:
    """Test hook: replace/reset the singleton."""
    global _table
    _table = table
