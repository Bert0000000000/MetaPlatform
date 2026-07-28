"""OWL IO tests (ST-5.4.6)."""
from __future__ import annotations

from mate_tech_ont.owl.io import (
    OwlImportResult,
    parse_owl_rdf_xml,
)


def test_parse_owl_minimal_xml() -> None:
    xml = """<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
  <rdfs:Class rdf:about="http://example.org/Concept"/>
  <rdfs:Class rdf:about="http://example.org/Object"/>
</rdf:RDF>"""
    result = parse_owl_rdf_xml(xml)
    assert result.triples_loaded >= 2


def test_parse_empty_xml() -> None:
    result = parse_owl_rdf_xml("")
    assert result.triples_loaded == 0


def test_parse_malformed_xml() -> None:
    result = parse_owl_rdf_xml("not xml at all")
    assert isinstance(result, OwlImportResult)
    assert result.triples_loaded == 0


def test_owl_import_result_dataclass() -> None:
    r = OwlImportResult(triples_loaded=10, classes_imported=3, properties_imported=2)
    assert r.triples_loaded == 10
    assert r.classes_imported == 3