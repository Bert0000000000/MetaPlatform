"""Tests for the request context resolver."""

from __future__ import annotations

import base64
import json

from app.common.context import resolve_context


def test_tenant_from_header_wins_over_jwt():
    jwt_payload = base64.urlsafe_b64encode(
        json.dumps({"tenantId": "tenant-jwt"}).encode()
    ).rstrip(b"=").decode()
    token = f"hdr.{jwt_payload}.sig"
    ctx = resolve_context(
        x_tenant_id="tenant-header",
        authorization=f"Bearer {token}",
        x_trace_id="trace-1",
    )
    assert ctx.tenant_id == "tenant-header"
    assert ctx.trace_id == "trace-1"


def test_tenant_falls_back_to_jwt():
    jwt_payload = base64.urlsafe_b64encode(
        json.dumps({"tenantId": "tenant-jwt"}).encode()
    ).rstrip(b"=").decode()
    token = f"hdr.{jwt_payload}.sig"
    ctx = resolve_context(None, f"Bearer {token}", None)
    assert ctx.tenant_id == "tenant-jwt"
    assert ctx.trace_id  # auto-generated


def test_default_tenant_when_nothing_provided():
    ctx = resolve_context(None, None, None)
    assert ctx.tenant_id == "tenant-default"
    assert ctx.trace_id


def test_invalid_authorization_falls_back_to_default():
    ctx = resolve_context(None, "NotBearer", None)
    assert ctx.tenant_id == "tenant-default"