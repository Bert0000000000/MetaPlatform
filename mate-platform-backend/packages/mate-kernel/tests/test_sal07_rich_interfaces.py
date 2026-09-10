"""SAL-07 — 富属性格式 + Interface conformance。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.types.interface import (  # noqa: E402
    Interface,
    implements_interface,
)
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402


def _prop(rid: str, fmt=PropertyFormat.STRING, pk=False):
    return Property(rid=ClassRef(rid), type_id="string", nullable=False,
                    primary_key=pk, title=rid.split(".")[-2], format=fmt)


class TestRichFormats:
    def test_new_formats_present(self):
        for f in ("geojson", "latlon", "timeseries", "image", "audio", "video"):
            assert PropertyFormat(f).value == f

    def test_rich_property_constructible(self):
        p = _prop("ont.t.prop.loc.v1", PropertyFormat.GEOJSON)
        assert p.format is PropertyFormat.GEOJSON


class TestInterfaceConformance:
    def _ifc(self):
        return Interface(
            rid=ClassRef("ont.t.if.identifiable.v1"),
            properties=(_prop("ont.t.prop.id.v1", pk=True),),
        )

    def test_conforming(self):
        ot = ObjectType(
            rid=ClassRef("ont.t.obj.thing.v1"), display_name="thing",
            primary_key=(ClassRef("ont.t.prop.id.v1"),),
            properties=(_prop("ont.t.prop.id.v1", pk=True),
                        _prop("ont.t.prop.name.v1")),
            interfaces=(ClassRef("ont.t.if.identifiable.v1"),),
        )
        assert implements_interface(ot, self._ifc()) is True

    def test_missing_property_fails(self):
        ot = ObjectType(
            rid=ClassRef("ont.t.obj.bare.v1"), display_name="bare",
            primary_key=(ClassRef("ont.t.prop.k.v1"),),
            properties=(_prop("ont.t.prop.k.v1", pk=True),),
        )
        assert implements_interface(ot, self._ifc()) is False
