"""Performance baseline test suite (V11-12).

Measures response time of core APIs across TECH-DATA / TECH-AGENT (real ASGI)
and TECH-RULE / TECH-WFE (Mock FastAPI). Asserts P95 < 500ms.

Independent of tests/e2e to allow running `pytest tests/perf/` in isolation.
"""
