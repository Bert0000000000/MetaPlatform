"""OWL export roundtrip tests (ST-5.4.6 边角)."""
from __future__ import annotations

import pytest
from rdflib import Graph, Literal, Namespace, RDF, RDFS

from mate_tech_ont.owl.io import export_owl_rdf_xml, parse_owl_rdf_xml


def test_export_empty_classes() -> None:
    """空类列表 → 最小 XML."""
    xml = export_owl_rdf_xml([])
    assert "<rdf:RDF" in xml
    assert "</rdf:RDF>" in xml


def test_export_single_class() -> None:
    classes = [{"id": "Concept", "label": "Concept"}]
    xml = export_owl_rdf_xml(classes)
    assert "Concept" in xml
    assert "<rdfs:Class" in xml or "rdf:about" in xml


def test_export_no_label() -> None:
    """类无 label → 仍生成."""
    classes = [{"id": "NoLabel"}]
    xml = export_owl_rdf_xml(classes)
    assert "NoLabel" in xml


def test_roundtrip() -> None:
    """导出 → 解析 → 验证."""
    classes = [
        {"id": "Concept", "label": "Concept"},
        {"id": "Object", "label": "Object"},
    ]
    xml = export_owl_rdf_xml(classes)
    result = parse_owl_rdf_xml(xml)
    assert result.triples_loaded > 0
    assert result.classes_imported >= 2