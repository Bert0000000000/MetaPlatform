import pybreaker  # pyright: ignore[reportMissingImports]

DEFAULT = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)


def circuit_breaker() -> pybreaker.CircuitBreaker:
    return DEFAULT
