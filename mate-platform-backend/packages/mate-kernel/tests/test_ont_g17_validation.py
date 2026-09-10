"""ONT-G17 — model/data validation 单测。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.ontology.validation_ops import validate_instance, validate_model

ID = "ont.t.prop.g-id.v1"
NAME = "ont.t.prop.g-name.v1"
AMT = "ont.t.prop.g-amt.v1"


def _ot():
    return ObjectType(
        rid=ClassRef("ont.t.obj.goods.v1"), display_name="goods",
        primary_key=(ClassRef(ID),),
        properties=(
            Property(rid=ClassRef(ID), type_id="string", nullable=False,
                     primary_key=True, title="id", format=PropertyFormat.STRING),
            Property(rid=ClassRef(NAME), type_id="string", nullable=False,
                     primary_key=False, title="name", format=PropertyFormat.STRING),
            Property(rid=ClassRef(AMT), type_id="integer", nullable=True,
                     primary_key=False, title="amt", format=PropertyFormat.INTEGER),
        ),
    )


class TestModel:
    def test_valid(self):
        assert validate_model(_ot())["valid"] is True

    def test_pk_missing_from_properties(self):
        ot = _ot()
        # 绕过构造器不变量（DTO 路径可能带进坏数据）：模拟 PK 引用丢失
        object.__setattr__(ot, "primary_key", (ClassRef("ont.t.prop.ghost.v1"),))
        d = validate_model(ot)
        assert d["valid"] is False
        assert any("存在于 properties" in e for e in d["errors"])

    def test_duplicate_slug(self):
        a, b = "ont.t.prop.dup.v1", "ont.t.prop.dup.v2"
        d = validate_model(ObjectType(
            rid=ClassRef("ont.t.obj.dup.v1"), display_name="d",
            primary_key=(ClassRef(a),),
            properties=(Property(rid=ClassRef(a), type_id="string", nullable=False,
                                 primary_key=True, title="a", format=PropertyFormat.STRING),
                        Property(rid=ClassRef(b), type_id="string", nullable=False,
                                 primary_key=False, title="b", format=PropertyFormat.STRING))))
        assert any("重复" in e for e in d["errors"])


class TestData:
    def test_valid_instance(self):
        d = validate_instance(_ot(), {"g-id": "x1", "g-name": "n", "g-amt": 3})
        assert d["valid"] is True

    def test_missing_required(self):
        d = validate_instance(_ot(), {"g-id": "x1"})
        assert d["valid"] is False
        assert any("g-name" in e for e in d["errors"])

    def test_unknown_prop(self):
        d = validate_instance(_ot(), {"g-id": "x1", "g-name": "n", "ghost": 1})
        assert any("未知属性" in e for e in d["errors"])

    def test_wrong_type(self):
        d = validate_instance(_ot(), {"g-id": "x1", "g-name": "n", "g-amt": "abc"})
        assert any("integer" in e for e in d["errors"])

    def test_rid_key_accepted(self):
        d = validate_instance(_ot(), {ID: "x1", NAME: "n"})
        assert d["valid"] is True
