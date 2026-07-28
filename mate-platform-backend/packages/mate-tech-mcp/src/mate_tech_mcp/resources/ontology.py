"""Ontology resource (ST-5.3.3).

URI: ontology://{class_id} → 调 tech-ont 返回类定义。
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


class OntologyResource:
    """ontology://{class_id} URI 资源."""

    uri_template = "ontology://{class_id}"
    name = "ontology_class"
    description = "查询本体的类定义（concept / object / metric / action）"

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or os.getenv(
            "TECH_ONT_URL", "http://localhost:8007"
        )
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
        )

    async def read(self, uri: str) -> dict[str, Any]:
        """读取 ontology://xxx 资源."""
        if not uri.startswith("ontology://"):
            return {"error": f"Unsupported URI scheme: {uri}"}
        class_id = uri[len("ontology://"):]
        try:
            resp = await self._client.get(
                f"/api/v1/ont/classes/{class_id}"
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("ontology.read.ok", class_id=class_id)
            return {
                "uri": uri,
                "class_id": class_id,
                "definition": data,
            }
        except httpx.HTTPError as e:
            logger.error("ontology.read.http_error", class_id=class_id, error=str(e))
            return {"error": f"tech-ont unreachable: {e}", "uri": uri}

    async def list_classes(self, namespace: str = "default") -> list[dict[str, Any]]:
        """列出 namespace 下所有类."""
        try:
            resp = await self._client.get(
                f"/api/v1/ont/classes",
                params={"namespace": namespace},
            )
            resp.raise_for_status()
            return resp.json().get("items", [])
        except httpx.HTTPError as e:
            logger.error("ontology.list.error", error=str(e))
            return []

    async def aclose(self) -> None:
        await self._client.aclose()


def build_ontology_resource() -> OntologyResource:
    return OntologyResource()