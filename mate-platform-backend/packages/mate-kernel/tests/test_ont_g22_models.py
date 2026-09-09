"""ONT-G22 — 模型对象注册 + 动态安全（marking 可见性）单测。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

import pytest  # noqa: E402

from mate_kernel.ontology.models import ModelObject, ModelRegistry  # noqa: E402


def _mdl(rid: str, markings: tuple[str, ...] = ()) -> ModelObject:
    return ModelObject(
        rid=rid, display_name=rid, provider="ark-plan", model="glm-5.3-flash",
        base_url="https://ark.cn-beijing.volces.com/api/plan/v3",
        required_markings=frozenset(markings),
    )


def test_register_and_get():
    r = ModelRegistry()
    r.register(_mdl("ont.t1.mdl.text.basic.v1"))
    assert r.get("ont.t1.mdl.text.basic.v1") is not None
    assert r.get("ont.t1.mdl.text.ghost.v1") is None


def test_invalid_rid_rejected():
    with pytest.raises(ValueError):
        ModelRegistry().register(_mdl("bad.rid"))


def test_visible_to_filters_by_markings():
    r = ModelRegistry()
    r.register(_mdl("ont.t1.mdl.pub.v1"))
    r.register(_mdl("ont.t1.mdl.sec.v1", ("PII",)))
    pub_actor = frozenset()
    sec_actor = {"PII"}
    assert [m.rid for m in r.visible_to(pub_actor)] == ["ont.t1.mdl.pub.v1"]
    assert [m.rid for m in r.visible_to(sec_actor)] == \
        ["ont.t1.mdl.pub.v1", "ont.t1.mdl.sec.v1"]


def test_check_gate_reasons():
    r = ModelRegistry()
    r.register(_mdl("ont.t1.mdl.sec.v1", ("PII", "FIN")))
    ok, reason = r.check("ont.t1.mdl.sec.v1", {"PII"})
    assert not ok and "FIN" in reason
    ok, reason = r.check("ont.t1.mdl.sec.v1", {"PII", "FIN"})
    assert ok and reason == "ok"
    ok, reason = r.check("ont.t1.mdl.ghost.v1", set())
    assert not ok and reason == "not_found"


def test_marking_superset_actor_sees_all():
    r = ModelRegistry()
    r.register(_mdl("ont.t1.mdl.a.v1", ("M1",)))
    r.register(_mdl("ont.t1.mdl.b.v1", ("M2",)))
    actor = {"M1", "M2", "EXTRA"}
    assert len(r.visible_to(actor)) == 2
