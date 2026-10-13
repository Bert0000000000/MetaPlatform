"""Runtime field binding — maps form fields to flow node variables.

APPHUB-RUNTIME-01 phase B.
"""

from __future__ import annotations


def resolve_field_binding(
    form_config: dict,
    flow_config: dict,
) -> dict:
    """Resolve form field → flow variable mappings.

    ``form_config`` shape::

        {"fields": [{"name": "title", "bind": "flow_title"}, ...]}

    ``flow_config`` shape::

        {"variables": {"flow_title": {"type": "string"}, ...}}

    Resolution rules (in priority order):
      1. If the field has an explicit ``bind`` and that key exists in
         ``flow_config["variables"]``, use the bind key.
      2. If the field name matches a flow variable key directly, use
         the field name.
      3. Otherwise, default the binding to the field name (identity).

    Returns ``{field_name: flow_variable}``.
    """
    flow_vars: dict = flow_config.get("variables", {}) if flow_config else {}
    form_fields: list = form_config.get("fields", []) if form_config else []

    mapping: dict[str, str] = {}
    for field in form_fields:
        if isinstance(field, dict):
            field_name = field.get("name", "")
            bind_target = field.get("bind")
        else:
            field_name = str(field)
            bind_target = None

        if bind_target and bind_target in flow_vars:
            mapping[field_name] = bind_target
        elif field_name in flow_vars:
            mapping[field_name] = field_name
        else:
            mapping[field_name] = field_name

    return mapping


# Order-review bindings use the existing ontology HTTP authority. Credentials
# live only on the request and are never persisted in page/version definitions.
import hashlib
import json
import os
from urllib.parse import quote

import httpx
from fastapi import HTTPException, Request

from mate_clients.security.outgoing import user_async_client


def ontology_client(request: Request) -> httpx.AsyncClient:
    ctx = request.state.ctx
    authorization = request.headers.get("authorization", "")
    if (
        not ctx.is_authenticated
        or not ctx.has_scope("platform.read")
        or not authorization.startswith("Bearer ")
    ):
        raise HTTPException(status_code=403, detail="Verified reader bearer required")
    return user_async_client(
        authorization,
        tenant_id=str(ctx.tenant_id),
        base_url=(
            os.getenv("TECH_ONT_URL") or os.getenv("ONTOLOGY_URL") or "http://localhost:8100"
        ).rstrip("/"),
        timeout=20,
    )


async def ontology_request(client: httpx.AsyncClient, method: str, path: str, **kwargs):
    try:
        response = await client.request(method, "/api/v1/ont/v2" + path, **kwargs)
    except httpx.RequestError:
        raise HTTPException(
            status_code=503, detail="Ontology unavailable; retry required"
        ) from None
    if response.status_code >= 400:
        # Never render an upstream failure as empty data or disclose diagnostic credentials.
        code = (
            response.status_code if response.status_code in {401, 403, 404, 409, 410, 422} else 503
        )
        raise HTTPException(
            status_code=code,
            detail="Ontology dependency rejected or unavailable; check binding and retry",
        )
    try:
        return response.json()
    except ValueError:
        raise HTTPException(status_code=503, detail="Ontology returned invalid data") from None


def fingerprint(value: dict) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


async def validate_order_binding(client: httpx.AsyncClient, tenant_id: str, binding: dict) -> dict:
    result = dict(binding)
    for key in ("object_type", "customer_type", "link_type", "action_rid"):
        value = binding.get(key)
        if not isinstance(value, str) or not value.startswith(f"ont.{tenant_id}."):
            raise HTTPException(status_code=403, detail=f"{key} must belong to the current tenant")
    for key, checksum_key in (
        ("object_type", "model_checksum"),
        ("customer_type", "customer_checksum"),
    ):
        model = await ontology_request(
            client, "GET", "/object-types/" + quote(binding[key], safe="")
        )
        if model.get("status") != "active":
            raise HTTPException(status_code=422, detail=f"{key} is not a published active model")
        if not binding.get(checksum_key) or binding[checksum_key] != model.get("checksum"):
            raise HTTPException(
                status_code=409, detail=f"{key} model changed; refresh the saved binding"
            )
        if key == "object_type":
            fields = binding.get("fields")
            if (
                not isinstance(fields, list)
                or not fields
                or not all(isinstance(f, str) for f in fields)
            ):
                raise HTTPException(status_code=422, detail="Choose published object fields")
            available = {p["rid"] for p in model.get("properties", [])}
            if not set(fields).issubset(available):
                raise HTTPException(status_code=422, detail="Binding contains missing fields")
            properties = {p["rid"]: p for p in model["properties"]}
            result["field_metadata"] = [properties[rid] for rid in fields]
    action = await ontology_request(
        client, "GET", "/action-types/" + quote(binding["action_rid"], safe="")
    )
    if binding["object_type"] not in action.get("on", []):
        raise HTTPException(status_code=422, detail="Action does not target the bound object type")
    link = await ontology_request(
        client, "GET", "/link-types/" + quote(binding["link_type"], safe="")
    )
    if {link.get("src"), link.get("dst")} != {binding["object_type"], binding["customer_type"]}:
        raise HTTPException(
            status_code=422, detail="Relationship does not connect bound Order and Customer types"
        )
    for key, value in (("action_checksum", action), ("link_checksum", link)):
        actual = fingerprint(value)
        if binding.get(key) and binding[key] != actual:
            raise HTTPException(status_code=409, detail=f"{key} changed; refresh the saved binding")
        result[key] = actual
    result["action_parameters"] = action.get("parameters", [])
    object_set = binding.get("object_set", {})
    if not isinstance(object_set, dict) or not isinstance(object_set.get("filter_expr", ""), str):
        raise HTTPException(status_code=422, detail="Invalid ObjectSet binding")
    limit = object_set.get("paging_limit", 100)
    if not isinstance(limit, int) or not 1 <= limit <= 1000:
        raise HTTPException(status_code=422, detail="ObjectSet page limit must be 1..1000")
    result["object_set"] = {
        "class_rid": binding["object_type"],
        "filter_expr": object_set.get("filter_expr", ""),
        "paging_limit": limit,
        "paging_offset": 0,
    }
    return result
