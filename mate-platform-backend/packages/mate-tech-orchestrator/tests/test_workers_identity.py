"""orchestrator worker identity — dev legacy token fallback tests."""
from __future__ import annotations

import jwt

from mate_tech_orchestrator.workers.identity import LegacyServiceIdentity, build_service_identity


def test_legacy_identity_mints_aud_iss_claims() -> None:
    ident = LegacyServiceIdentity(tenant_id="tenant-acme")
    token = ident.token()
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["iss"].endswith("/realms/metaplatform")
    assert "metaplatform-backend" in claims["aud"]
    assert claims["tenant_id"] == "tenant-acme"
    assert claims["token_kind"] == "access"


def test_legacy_identity_token_is_cached() -> None:
    ident = LegacyServiceIdentity()
    first = ident.token()
    assert ident.token() == first


def test_build_service_identity_returns_token_provider() -> None:
    ident = build_service_identity()
    assert hasattr(ident, "token")
    assert callable(ident.token)
