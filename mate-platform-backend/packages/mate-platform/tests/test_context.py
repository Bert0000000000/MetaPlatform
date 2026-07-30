from mate_platform.errors import PlatformError, to_http_response
from mate_platform.tenancy import RequestContext, TenantId, UserId


def test_request_context_is_immutable() -> None:
    ctx = RequestContext(
        request_id="r-1", trace_id="t-1", tenant_id=TenantId("tenant-1"),
        user_id=UserId("u-1"), roles=frozenset({"viewer"}), permissions=frozenset(),
        locale="zh-CN",
    )
    assert ctx.tenant_id == "tenant-1"
    assert "viewer" in ctx.roles


def test_to_http_response_uses_canonical_code() -> None:
    err = PlatformError(code="E400_VALIDATION", message="bad", status=422)
    body, status = to_http_response(err, request_id="r-1")
    assert status == 422
    assert body["code"] == "E400_VALIDATION"
    assert body["requestId"] == "r-1"
