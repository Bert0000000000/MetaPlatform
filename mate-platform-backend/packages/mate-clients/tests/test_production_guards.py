"""Client stubs must fail closed when used by production code."""
from __future__ import annotations

import pytest

from mate_clients.wfe import FlowableClient


@pytest.mark.asyncio
async def test_production_rejects_synthetic_flowable_instance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="synthetic Flowable"):
        await FlowableClient().start_process("review", "order-1", {}, "tenant-1")
