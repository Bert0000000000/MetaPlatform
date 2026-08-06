"""Journey OTel spans (ADR-0018 §2.2).

Helper to wrap a FastAPI handler with a named journey span that
carries ``tenant.id`` + ``user.id`` + ``outcome``. This is the
``start_as_current_span`` shape the SLO dashboard scrapes from,
and is shared by copilot / llmgw / rag entry points.

Usage:

    from mate_platform.observability.journey import journey_span

    @app.post("/api/v1/llmgw/chat")
    async def chat_endpoint(req: Request, body: ChatRequest):
        with journey_span("llmgw.chat", tenant_id=ctx.tenant_id, user_id=ctx.user_id) as span:
            try:
                ...
                span.set_attribute("outcome", "success")
            except Exception:
                span.set_attribute("outcome", "error")
                raise
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

_tracer = trace.get_tracer("mate_platform.journey")


@contextmanager
def journey_span(
    name: str,
    *,
    tenant_id: str | None = None,
    user_id: str | None = None,
    attributes: dict[str, object] | None = None,
) -> Iterator[trace.Span]:
    """Wrap a code block in a journey span with ADR-0018 required attributes."""
    attrs: dict[str, object] = {}
    if tenant_id:
        attrs["tenant.id"] = tenant_id
    if user_id:
        attrs["user.id"] = user_id
    if attributes:
        attrs.update(attributes)
    with _tracer.start_as_current_span(name, attributes=attrs) as span:
        try:
            yield span
            try:
                status_code = span.status.status_code  # type: ignore[attr-defined]
            except AttributeError:
                status_code = None
            if status_code != StatusCode.ERROR:
                span.set_attribute("outcome", "success")
        except Exception as exc:
            span.set_attribute("outcome", "error")
            try:
                span.record_exception(exc)
                span.set_status(Status(StatusCode.ERROR, str(exc)))
            except AttributeError:
                pass
            raise


def record_outcome(span: trace.Span, outcome: str) -> None:
    """Helper for endpoints that handle success/error branching explicitly."""
    span.set_attribute("outcome", outcome)