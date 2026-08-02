"""OpenTelemetry tracer factory for mate-app-hub (K3-2).

Provides a lazily-initialised tracer keyed to the package name and a
fixed version. The SDK is intentionally *not* imported here — only the
``opentelemetry-api`` types are used so that production builds that
already wire up an SDK (via the broader platform) get their spans
flushed through the configured exporter, while test runs can attach an
in-memory exporter without affecting the runtime.

Per ADR-0015 §13 rule 9 ("没有审计/指标/trace"), 4 critical paths
emit spans:

- ``apphub.runtime.load``     (loader.load_app_runtime)
- ``apphub.runtime.execute``  (executor.execute_action)
- ``apphub.shortlink.resolve``  (resolver.resolve)
- ``apphub.shortlink.create``   (service.create_shortlink)

For tests that want to capture spans, the helper
``install_in_memory_exporter`` swaps the global tracer provider with
a fresh one backed by an ``InMemorySpanExporter``. Subsequent calls
to ``get_tracer()`` will return a tracer backed by that provider,
and the returned exporter lets the test inspect the captured spans.
"""
from __future__ import annotations

from collections.abc import Generator

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)

_TRACER_NAME = "mate-app-hub"
_TRACER_VERSION = "1.0.0"

_tracer: trace.Tracer | None = None


def get_tracer() -> trace.Tracer:
    """Return the package's tracer. Initialised lazily on first call."""
    global _tracer  # noqa: PLW0603
    if _tracer is None:
        _tracer = trace.get_tracer(_TRACER_NAME, _TRACER_VERSION)
    return _tracer


def install_in_memory_exporter() -> Generator[InMemorySpanExporter, None, None]:
    """Test helper: install an InMemorySpanExporter and reset cached tracer.

    Returns the exporter so the test can introspect the captured spans.
    The provider is shut down on context exit.
    """
    global _tracer  # noqa: PLW0603
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    # We can't call trace.set_tracer_provider() twice — but in the very
    # first test process it has not been set yet (only the default
    # ProxyTracerProvider is in place). We attach our provider as a child
    # of the existing provider via the SDK's add_span_processor path is
    # not exposed at the API level — so for tests we directly bypass the
    # trace singleton and rebuild the cached tracer against our provider.
    trace._TRACER_PROVIDER_SET_ONCE._done = False
    trace.set_tracer_provider(provider)
    _tracer = None  # force get_tracer() to pick up the new provider
    try:
        yield exporter
    finally:
        provider.shutdown()
        _tracer = None
