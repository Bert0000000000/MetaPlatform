"""ontology-sdk —— ONT-G11 typed client（SDK 包封装）。

对 mate-tech-ont v2 REST（契约 contracts/openapi/services/ont.yaml）的
Python typed 封装：ObjectType CRUD / proposal 状态机 / SHACL 验证（含
subclass_axioms 推理联动）/ reasoning / alignment。Bearer token + tenant
header 双注入（GOVERN-06），全部方法返回 dict（契约响应形状）。

用法::

    sdk = OntologySDK(base_url="http://localhost:8100", token=tok, tenant_id="tenant-default")
    sdk.create_object_type({...})  # POST /v2/object-types
    sdk.propose_model_type(type_def)  # POST /v2/object-types/propose
    sdk.confirm_proposal(pid)  # POST /v2/proposals/{id}/confirm
    sdk.execute_proposal(pid)  # POST /v2/proposals/{id}/execute
    sdk.validate_shacl(target_class, ...)  # POST /v2/shacl/validate
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

import httpx


class OntologySDKError(RuntimeError):
    """非 2xx 响应（携带 status 与契约 error body）。"""

    def __init__(self, status: int, body: Any) -> None:
        self.status = status
        self.body = body
        super().__init__(f"ont v2 call failed: {status} {body!r}")


class OntologySDK:
    """mate-tech-ont v2 typed client（同步 httpx）。"""

    def __init__(
        self,
        base_url: str = "http://localhost:8100",
        token: str = "",
        tenant_id: str = "tenant-default",
        *,
        timeout: float = 60.0,
        token_provider: Callable[[], str] | None = None,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._tenant = tenant_id
        self._token = token
        self._token_provider = token_provider
        self._client = httpx.Client(
            timeout=timeout,
            headers={"X-Tenant-Id": tenant_id},
        )

    def _headers(self) -> dict[str, str]:
        token = self._token_provider() if self._token_provider else self._token
        return {"Authorization": f"Bearer {token}"} if token else {}

    @staticmethod
    def _idempotency_key() -> str:
        return uuid.uuid4().hex

    def _request(
        self, method: str, path: str, *, json: Any = None, idempotent: bool = False
    ) -> dict[str, Any]:
        headers = self._headers()
        if idempotent:
            headers["Idempotency-Key"] = self._idempotency_key()
        resp = self._client.request(method, f"{self._base}{path}", json=json, headers=headers)
        if resp.status_code >= 300:
            try:
                body: Any = resp.json()
            except ValueError:
                body = resp.text
            raise OntologySDKError(resp.status_code, body)
        if not resp.content:
            return {}
        return resp.json()

    # ---------------- ObjectType ----------------
    def create_object_type(self, dto: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/v1/ont/v2/object-types", json=dto)

    def get_object_type(self, rid: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/ont/v2/object-types/{rid}")

    def list_object_types(self, limit: int = 100, offset: int = 0) -> list:
        return self._request("GET", f"/api/v1/ont/v2/object-types?limit={limit}&offset={offset}")

    # ---------------- Proposal 状态机 ----------------
    def propose_model_type(
        self, type_def: dict[str, Any], impact_summary: str = ""
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/ont/v2/object-types/propose",
            json={"type_def": type_def, "impact_summary": impact_summary},
        )

    def propose_instance(
        self, class_rid: str, props: dict[str, Any], impact_summary: str = ""
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/ont/v2/classes/{class_rid}/propose-instance",
            json={"props": props, "impact_summary": impact_summary},
        )

    def confirm_proposal(self, proposal_id: str) -> dict[str, Any]:
        return self._request(
            "POST", f"/api/v1/ont/v2/proposals/{proposal_id}/confirm", json={}, idempotent=True
        )

    def execute_proposal(self, proposal_id: str) -> dict[str, Any]:
        return self._request(
            "POST", f"/api/v1/ont/v2/proposals/{proposal_id}/execute", json={}, idempotent=True
        )

    def revert_proposal(self, proposal_id: str) -> dict[str, Any]:
        return self._request(
            "POST", f"/api/v1/ont/v2/proposals/{proposal_id}/revert", json={}, idempotent=True
        )

    def get_proposal(self, proposal_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/ont/v2/proposals/{proposal_id}")

    # ---------------- SHACL / reasoning / alignment ----------------
    def validate_shacl(
        self,
        target_class: str,
        *,
        individuals: list | None = None,
        property_shapes: list | None = None,
        closed: bool = False,
        subclass_axioms: list[tuple[str, str]] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"target_class": target_class, "closed": closed}
        if individuals is not None:
            body["individuals"] = individuals
        if property_shapes is not None:
            body["property_shapes"] = property_shapes
        if subclass_axioms:
            body["subclass_axioms"] = [list(p) for p in subclass_axioms]
        return self._request("POST", "/api/v1/ont/v2/shacl/validate", json=body)

    def reasoning_run(
        self,
        *,
        subclass_axioms: list | None = None,
        individuals: dict | None = None,
        same_as_pairs: list | None = None,
        transitive_axioms: list | None = None,
        property_edges: list | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/ont/v2/reasoning/run",
            json={
                "subclass_axioms": subclass_axioms or [],
                "individuals": individuals or {},
                "same_as_pairs": same_as_pairs or [],
                "transitive_axioms": transitive_axioms or [],
                "property_edges": property_edges or [],
            },
        )

    def align_individuals(
        self, left: list, right: list, *, explicit_pairs: list | None = None
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/ont/v2/alignment/run",
            json={
                "left": left,
                "right": right,
                "explicit_pairs": explicit_pairs or [],
            },
        )

    def close(self) -> None:
        self._client.close()
