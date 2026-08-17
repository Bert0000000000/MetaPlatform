"""MP-SAL-02: 对象语义检索（OAG）—— tech-ont 侧红测试。

对象卡片契约：检索命中返回 {individual_rid, class_rid, score,
matched: [{property_rid, value_text, score}], card_text}，rid 全程可追溯。
索引侧：Individual 写入时属性级 embedding（embedder 未配置则跳过）；
reindex 端点补齐存量。测试用确定性 HashEmbedder（离线可复现）。
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.object_search import HashEmbedder

_T = "oagtest"
_NOW = datetime.now(UTC)


def _prop(slug: str, type_id: str = "string") -> Property:
    return Property(
        rid=ClassRef(f"ont.{_T}.prop.{slug}.v1"),
        type_id=type_id, nullable=True, primary_key=False, title=slug,
        format=PropertyFormat.STRING,
    )


def _ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.oid.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.oid.v1"), type_id="string",
                     nullable=False, primary_key=True, title="oid",
                     format=PropertyFormat.STRING),
            _prop("status"), _prop("memo"),
        ),
        display_name="order",
    )


def _ind(oid: str, status: str, memo: str) -> Individual:
    return Individual(
        rid=f"ont.{_T}.ind.order.{oid}",
        class_rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.oid.v1"), oid),
            (ClassRef(f"ont.{_T}.prop.status.v1"), status),
            (ClassRef(f"ont.{_T}.prop.memo.v1"), memo),
        ),
        primary_key=oid, created_at=_NOW, updated_at=_NOW, tenant_id=_T, marking=(),
    )


class TestHashEmbedder:
    def test_deterministic_and_normalized(self) -> None:
        e = HashEmbedder()
        a = e.embed("open orders")
        b = e.embed("open orders")
        assert a == b
        assert abs(sum(x * x for x in a) - 1.0) < 1e-6

    def test_similar_texts_rank_above_unrelated(self) -> None:
        e = HashEmbedder()
        q = e.embed("rush shipment")
        near = e.embed("rush shipment memo")
        far = e.embed("budget audit")
        near_score = sum(x * y for x, y in zip(q, near, strict=True))
        far_score = sum(x * y for x, y in zip(q, far, strict=True))
        assert near_score > far_score


class TestInMemoryObjectSearch:
    def test_search_returns_traceable_cards(self) -> None:
        from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: PLC0415

        repo = InMemoryOntologyRepository()
        repo.set_embedder(HashEmbedder())  # index-on-write：先设 embedder 再写入
        repo.upsert_object_type(_ot())
        repo.create_individual(_ind("o1", "open", "rush shipment for acme"))
        repo.create_individual(_ind("o2", "closed", "budget audit note"))

        cards = repo.search_objects("rush shipment", top_k=2)
        assert cards, "search must return at least one card"
        top = cards[0]
        assert top["individual_rid"] == f"ont.{_T}.ind.order.o1"
        assert top["class_rid"] == f"ont.{_T}.obj.order.v1"
        assert top["matched"], "card must carry matched properties with rids"
        assert any("memo" in m["property_rid"] for m in top["matched"])
        assert top["card_text"]

    def test_class_filter_scopes_search(self) -> None:
        from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: PLC0415

        repo = InMemoryOntologyRepository()
        repo.upsert_object_type(_ot())
        repo.create_individual(_ind("o1", "open", "rush shipment for acme"))
        repo.set_embedder(HashEmbedder())
        cards = repo.search_objects("rush", class_rid=f"ont.{_T}.obj.customer.v1")
        assert cards == []

    def test_no_embedder_returns_empty(self) -> None:
        from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: PLC0415

        repo = InMemoryOntologyRepository()
        repo.create_individual(_ind("o1", "open", "memo"))
        assert repo.search_objects("memo") == []


# ─────────────────── PG 侧（mock 捕获 + 可达门控真跑） ───────────────────


class _CaptureCursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, list[Any]]] = []

    def __enter__(self) -> _CaptureCursor:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def execute(self, sql: str, params: list[Any] | None = None) -> None:
        self.executed.append((sql, list(params or [])))

    def fetchall(self) -> list[dict[str, Any]]:
        return []

    def fetchone(self) -> dict[str, Any] | None:
        return None


class _CaptureConn:
    def __init__(self) -> None:
        self.cursor_obj = _CaptureCursor()

    def cursor(self, cursor_factory: Any = None) -> _CaptureCursor:
        return self.cursor_obj

    def commit(self) -> None:
        return None

    def close(self) -> None:
        return None


@pytest.fixture
def capture_repo(monkeypatch: pytest.MonkeyPatch) -> tuple[Any, _CaptureCursor]:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository  # noqa: PLC0415

    repo = PgOntologyRepository.__new__(PgOntologyRepository)
    repo._dsn = "postgresql://mock/mock"
    repo._lock = threading.Lock()
    repo._initialized = True
    repo._tenant_local = threading.local()
    from mate_kernel.action.engine import ActionService  # noqa: PLC0415
    from mate_kernel.ontology.function_resolver import (  # noqa: PLC0415
        InMemoryFunctionResolver,
    )
    repo._action_service = ActionService()
    repo._function_resolver = InMemoryFunctionResolver()
    repo._function_executor = None
    repo.set_embedder(HashEmbedder())

    conn = _CaptureConn()

    def _fake_connect() -> tuple[_CaptureConn, Any]:
        return conn, None

    monkeypatch.setattr(repo, "_connect", _fake_connect)
    return repo, conn.cursor_obj


class TestPgObjectSearchSql:
    def test_search_selects_embedding_table(self, capture_repo: tuple[Any, _CaptureCursor]) -> None:
        repo, cur = capture_repo
        repo.search_objects("rush", top_k=3)
        sql, _ = cur.executed[-1]
        assert "ont_object_embedding" in sql

    def test_reindex_scans_individuals(self, capture_repo: tuple[Any, _CaptureCursor]) -> None:
        repo, cur = capture_repo
        count = repo.reindex_object_embeddings()
        assert count == 0  # 捕获连接 fetchall 为空
        sql, _ = cur.executed[0]
        assert "ont_individual" in sql
