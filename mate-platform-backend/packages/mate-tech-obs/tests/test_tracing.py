"""OTel tracing tests."""
from __future__ import annotations

from mate_tech_obs.tracing.otel import get_tracer, init_tracing, traced


def test_init_tracing_default() -> None:
    tracer = init_tracing(console_export=True)
    assert tracer is not None


def test_init_tracing_custom_name() -> None:
    tracer = init_tracing("custom-svc", console_export=True)
    assert tracer is not None


def test_get_tracer_default() -> None:
    tracer = get_tracer()
    assert tracer is not None


def test_traced_decorator_sync() -> None:
    @traced("test.sync")
    def add(a: int, b: int) -> int:
        return a + b

    assert add(2, 3) == 5


def test_traced_decorator_async() -> None:
    import asyncio

    @traced("test.async")
    async def double(x: int) -> int:
        return x * 2

    async def go() -> int:
        return await double(21)

    assert asyncio.run(go()) == 42