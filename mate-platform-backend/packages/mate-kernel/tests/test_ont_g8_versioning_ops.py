"""ONT-G8 — ObjectType diff 纯函数单测（kernel 层）。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402
from mate_kernel.ontology.versioning_ops import diff_object_types  # noqa: E402


def _mk(rid, props):
    pks = tuple(ClassRef(pr) for pr, _ in props if pr.endswith("-id"))
    if not pks:
        pks = (ClassRef(props[0][0]),)
    return ObjectType(
        rid=ClassRef(rid), display_name=rid,
        primary_key=pks,
        properties=tuple(
            Property(rid=ClassRef(r), type_id=t, nullable=False,
                     primary_key=r.endswith("-id"), title=r, format=PropertyFormat.STRING)
            for r, t in props
        ),
    )


class TestDiff:
    def test_identical_no_changes(self):
        a = _mk("ont.t.obj.x.v1", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-name.v1", "string")])
        b = _mk("ont.t.obj.x.v2", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-name.v1", "string")])
        d = diff_object_types(a, b)
        assert d["has_changes"] is False and d["added"] == [] and d["removed"] == []

    def test_added_detected(self):
        a = _mk("ont.t.obj.x.v1", [("ont.t.prop.x-id.v1", "string")])
        b = _mk("ont.t.obj.x.v2", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-qty.v1", "integer")])
        d = diff_object_types(a, b)
        assert d["has_changes"] is True and d["added"] == ["x-qty"]

    def test_removed_and_changed(self):
        a = _mk("ont.t.obj.x.v1", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-old.v1", "string")])
        b = _mk("ont.t.obj.x.v2", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-new.v1", "integer")])
        d = diff_object_types(a, b)
        assert d["removed"] == ["x-old"] and d["added"] == ["x-new"]

    def test_type_change_detected(self):
        a = _mk("ont.t.obj.x.v1", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-amt.v1", "string")])
        b = _mk("ont.t.obj.x.v2", [("ont.t.prop.x-id.v1", "string"),
                                   ("ont.t.prop.x-amt.v1", "integer")])
        d = diff_object_types(a, b)
        assert d["changed"] == ["x-amt"] and d["has_changes"] is True
