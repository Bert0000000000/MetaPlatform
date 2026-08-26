"""Production profile must use durable ontology and sandbox backends."""
from __future__ import annotations

import pytest

from mate_tech_ont.main import _inject_function_executor, _validate_production_configuration


class _Repo:
    def set_function_executor(self, executor: object) -> None:
        self.executor = executor


def test_production_rejects_memory_function_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("FUNCTION_BACKEND", "memory")

    with pytest.raises(RuntimeError, match="FUNCTION_BACKEND"):
        _inject_function_executor(_Repo())


def test_production_rejects_memory_ontology_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("KERNEL_BACKEND", "memory")
    monkeypatch.setenv("FUNCTION_BACKEND", "k8s")

    with pytest.raises(RuntimeError, match="KERNEL_BACKEND"):
        _validate_production_configuration()
