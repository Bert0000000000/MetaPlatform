from mate_kernel.types import DomainError, DomainEvent, Entity, Result


def test_entity_protocol_identity() -> None:
    class User:
        def __init__(self, id: str) -> None:
            self.id = id

        def entity_id(self) -> str:
            return self.id

    assert isinstance(User("u-1"), Entity)


def test_domain_error_is_distinct_from_infra() -> None:
    err = DomainError(code="E400_X", message="bad")
    assert err.code == "E400_X"
    assert str(err) == "E400_X: bad"


def test_result_keeps_domain_and_infra_separate() -> None:
    r_ok: Result[int, DomainError] = Result.ok(1)
    r_err: Result[int, DomainError] = Result.err(DomainError(code="E400_X"))
    assert r_ok.unwrap() == 1
    assert isinstance(r_err.unwrap_err(), DomainError)


def test_domain_event_carries_trace() -> None:
    evt = DomainEvent(name="OrderPlaced", trace_id="trace-1")
    assert evt.trace_id == "trace-1"
