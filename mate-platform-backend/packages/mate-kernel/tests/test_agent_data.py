"""AGENT-DATA-01 Data Product 数字员工测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.agent.data_product import (
    DataProduct,
    DataProductAgent,
    DataProductKind,
    LineageEdge,
    QualityDimension,
    QualitySummary,
)
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


def _cls() -> ClassRef:
    return ClassRef(rid="ont.acme.cls.order.v1")


def _product(
    rid: str = "data.acme.product.orders.v1",
    bound: ClassRef | None = None,
    quality: tuple[QualitySummary, ...] = (),
) -> DataProduct:
    return DataProduct(
        product_rid=rid,
        name=rid.split(".")[3],
        kind=DataProductKind.TABLE,
        bound_class_rid=bound,
        source_uri="pg://db/orders",
        quality=quality,
    )


class TestDataProduct:
    def test_quality_of(self) -> None:
        p = _product(quality=(
            QualitySummary(dimension=QualityDimension.COMPLETENESS, value=0.98),
        ))
        assert p.quality_of(QualityDimension.COMPLETENESS) is not None
        assert p.quality_of(QualityDimension.ROW_COUNT) is None


class TestDataProductAgent:
    def _a(self) -> DataProductAgent:
        return DataProductAgent()

    def test_register_and_get(self) -> None:
        a = self._a()
        p = _product()
        a.register(p, Manager(_ctx()))
        assert a.get(p.product_rid) is p

    def test_register_duplicate_raises(self) -> None:
        a = self._a()
        a.register(_product(), Manager(_ctx()))
        with pytest.raises(ValueError, match="already registered"):
            a.register(_product(), Manager(_ctx()))

    def test_for_class(self) -> None:
        a = self._a()
        cls = _cls()
        a.register(_product("data.acme.product.orders.v1", bound=cls), Manager(_ctx()))
        a.register(_product("data.acme.product.invoices.v1", bound=cls), Manager(_ctx()))
        a.register(_product("data.acme.product.audit.v1", bound=None), Manager(_ctx()))
        products = a.for_class(cls)
        assert len(products) == 2

    def test_register_tracks_change(self) -> None:
        a = self._a()
        mgr = Manager(_ctx())
        a.register(_product(bound=_cls()), mgr)
        changes = mgr.drain_changes()
        assert len(changes) == 1

    def test_get_unknown_raises(self) -> None:
        a = self._a()
        with pytest.raises(KeyError):
            a.get("data.acme.product.missing.v1")

    def test_lineage(self) -> None:
        a = self._a()
        a.register(_product("data.acme.product.raw.v1"), Manager(_ctx()))
        a.register(_product("data.acme.product.dw.v1"), Manager(_ctx()))
        a.register(_product("data.acme.product.dm.v1"), Manager(_ctx()))
        a.add_lineage(LineageEdge(
            upstream_rid="data.acme.product.raw.v1",
            downstream_rid="data.acme.product.dw.v1",
            transform="dbt.stg_orders",
        ))
        a.add_lineage(LineageEdge(
            upstream_rid="data.acme.product.dw.v1",
            downstream_rid="data.acme.product.dm.v1",
            transform="dbt.dim_orders",
        ))
        assert len(a.lineage_upstream("data.acme.product.dm.v1")) == 1
        assert len(a.lineage_downstream("data.acme.product.raw.v1")) == 1

    def test_lineage_missing_raises(self) -> None:
        a = self._a()
        a.register(_product("data.acme.product.raw.v1"), Manager(_ctx()))
        with pytest.raises(KeyError, match="downstream"):
            a.add_lineage(LineageEdge(
                upstream_rid="data.acme.product.raw.v1",
                downstream_rid="data.acme.product.missing.v1",
                transform="x",
            ))

    def test_quality_alerts(self) -> None:
        a = self._a()
        good = _product("data.acme.product.good.v1", quality=(
            QualitySummary(dimension=QualityDimension.COMPLETENESS, value=0.99),
            QualitySummary(dimension=QualityDimension.FRESHNESS_SECONDS, value=60.0),
        ))
        bad = _product("data.acme.product.bad.v1", quality=(
            QualitySummary(dimension=QualityDimension.COMPLETENESS, value=0.5),
            QualitySummary(dimension=QualityDimension.FRESHNESS_SECONDS, value=7200.0),
        ))
        a.register(good, Manager(_ctx()))
        a.register(bad, Manager(_ctx()))
        alerts = a.quality_alerts(completeness_min=0.95, freshness_max_seconds=3600)
        assert len(alerts) == 1
        assert alerts[0].product_rid == bad.product_rid


class TestSelectorRoutedToData:
    def test_data_rid_routes_to_data_product(self) -> None:
        from mate_kernel.agent.orchestrator import AgentRole, AgentSelector
        assert AgentSelector().select("data.acme.product.orders.v1") == AgentRole.DATA_PRODUCT
