from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider


def setup_tracing(service_name: str, otlp_endpoint: str) -> TracerProvider:
    provider = TracerProvider()
    trace.set_tracer_provider(provider)
    return provider
