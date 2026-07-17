"""Context assembly service (P1-RAG-09).

Fuses context from multiple sources: RAG retrieval, Ontology concept
definitions, and conversation history. Manages token budget with priority
ordering (HIGH = ontology, MEDIUM = RAG, LOW = conversation).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.hybrid_search_service import HybridSearchService

logger = logging.getLogger("techrag")

# Rough token estimate: ~4 characters per token.
_CHARS_PER_TOKEN = 4


def _estimate_tokens(text: str) -> int:
    """Estimate token count for a string."""
    return max(1, len(text) // _CHARS_PER_TOKEN)


class ContextAssemblyService:
    """Multi-source context fusion with priority and token budget management."""

    def __init__(
        self,
        hybrid_search_service: HybridSearchService,
    ) -> None:
        self._hybrid = hybrid_search_service

    async def assemble(
        self,
        tenant_id: str,
        query: str,
        kb_ids: list[str],
        conversation_history: list[dict[str, str]] | None = None,
        ontology_concept_ids: list[str] | None = None,
        context_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Assemble unified context from multiple sources.

        Returns a dict with ``assembledContext``, ``sources``, ``tokenCount``.
        """

        config = context_config or {}
        max_tokens = config.get("maxTokens", 4096)
        include_ontology = config.get("includeOntology", True)
        include_rag = config.get("includeRag", True)
        include_conversation = config.get("includeConversation", True)

        sources: list[dict[str, Any]] = []
        sections: list[str] = []

        # --- Priority 1: Ontology definitions (HIGH) ---
        if include_ontology and ontology_concept_ids:
            ont_sources = await self._fetch_ontology_sources(
                ontology_concept_ids
            )
            sources.extend(ont_sources)

        # --- Priority 2: RAG chunks (MEDIUM) ---
        if include_rag:
            rag_sources = await self._fetch_rag_sources(
                tenant_id, query, kb_ids
            )
            sources.extend(rag_sources)

        # --- Priority 3: Conversation history (LOW) ---
        if include_conversation and conversation_history:
            conv_sources = self._build_conversation_sources(
                conversation_history
            )
            sources.extend(conv_sources)

        # Sort sources by priority: HIGH > MEDIUM > LOW.
        priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        sources.sort(key=lambda s: priority_order.get(s["priority"], 3))

        # Assemble with token budget management.
        assembled_parts: list[str] = []
        token_budget = max_tokens
        total_tokens = 0

        for source in sources:
            content = source["content"]
            tokens = _estimate_tokens(content)
            if tokens > token_budget:
                # Truncate to fit remaining budget.
                char_limit = token_budget * _CHARS_PER_TOKEN
                content = content[:char_limit].rstrip()
                tokens = _estimate_tokens(content)
                source["content"] = content

            if tokens == 0:
                continue

            section = self._format_section(source)
            assembled_parts.append(section)
            token_budget -= tokens
            total_tokens += tokens

            if token_budget <= 0:
                break

        assembled_context = "\n\n".join(assembled_parts)

        return {
            "assembledContext": assembled_context,
            "sources": sources,
            "tokenCount": total_tokens,
        }

    # --------------------------------------------------- ontology retrieval

    async def _fetch_ontology_sources(
        self, concept_ids: list[str]
    ) -> list[dict[str, Any]]:
        """Fetch concept definitions from TECH-ONT."""

        sources: list[dict[str, Any]] = []

        if not settings.ont_base_url:
            return sources

        for concept_id in concept_ids[:20]:
            definition = await self._fetch_concept_definition(concept_id)
            if definition:
                sources.append({
                    "type": "ontology",
                    "id": concept_id,
                    "content": definition,
                    "relevance": 1.0,
                    "priority": "HIGH",
                })

        return sources

    async def _fetch_concept_definition(
        self, concept_id: str
    ) -> str | None:
        """Fetch a single concept definition from TECH-ONT."""

        url = f"{settings.ont_base_url}/api/v1/ont/concepts/{concept_id}"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=10.0)
                resp.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.debug("ONT concept fetch failed for %s: %s", concept_id, exc)
            return None
        except Exception as exc:
            logger.debug("ONT concept fetch error for %s: %s", concept_id, exc)
            return None

        data = resp.json()
        # Normalise ONT concept response into a text definition.
        name = data.get("name", concept_id)
        description = data.get("description", "")
        definition = f"[Concept: {name}]"
        if description:
            definition += f" {description}"
        # Include related entities if available.
        entities = data.get("entities", [])
        if entities:
            entity_strs = [
                e.get("name", str(e)) if isinstance(e, dict) else str(e)
                for e in entities[:5]
            ]
            definition += f" Related entities: {', '.join(entity_strs)}"
        return definition

    # -------------------------------------------------------- RAG retrieval

    async def _fetch_rag_sources(
        self,
        tenant_id: str,
        query: str,
        kb_ids: list[str],
    ) -> list[dict[str, Any]]:
        """Fetch RAG chunks from specified knowledge bases."""

        sources: list[dict[str, Any]] = []

        for kb_id in kb_ids:
            try:
                results = await self._hybrid.hybrid_search(
                    query=query,
                    kb_id=kb_id,
                    tenant_id=tenant_id,
                    top_k=5,
                )
            except Exception as exc:
                logger.warning("RAG retrieval failed for kb=%s: %s", kb_id, exc)
                continue

            for r in results:
                sources.append({
                    "type": "rag",
                    "id": r.get("chunkId", ""),
                    "content": r.get("content", ""),
                    "relevance": float(r.get("score", 0.0)),
                    "priority": "MEDIUM",
                })

        return sources

    # ---------------------------------------------------- conversation context

    @staticmethod
    def _build_conversation_sources(
        conversation_history: list[dict[str, str]],
    ) -> list[dict[str, Any]]:
        """Build sources from recent conversation turns."""

        # Take only the last 5 turns to avoid excessive context.
        recent = conversation_history[-5:]

        sources: list[dict[str, Any]] = []
        for turn in recent:
            role = turn.get("role", "unknown")
            content = turn.get("content", "")
            if not content:
                continue
            sources.append({
                "type": "conversation",
                "id": f"{role}-{len(sources)}",
                "content": f"[{role}] {content}",
                "relevance": 0.5,
                "priority": "LOW",
            })

        return sources

    # ----------------------------------------------------- section formatting

    @staticmethod
    def _format_section(source: dict[str, Any]) -> str:
        """Format a source into a context section string."""

        source_type = source.get("type", "unknown")
        content = source.get("content", "")
        source_id = source.get("id", "")

        if source_type == "ontology":
            return f"## Ontology Context\n{content}"
        elif source_type == "rag":
            return f"## Knowledge Base Excerpt (source: {source_id})\n{content}"
        elif source_type == "conversation":
            return f"## Conversation History\n{content}"
        else:
            return content
