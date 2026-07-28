"""OWL 2 import/export (ST-5.4.6)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class OwlImportResult:
    triples_loaded: int
    classes_imported: int
    properties_imported: int


def parse_owl_rdf_xml(rdf_xml: str) -> OwlImportResult:
    try:
        from rdflib import Graph, RDF, RDFS
    except ImportError:
        logger.warning("owl.rdflib_missing")
        return OwlImportResult(0, 0, 0)

    g = Graph()
    try:
        g.parse(data=rdf_xml, format="xml")
    except Exception as e:
        logger.error("owl.parse_failed", error=str(e))
        return OwlImportResult(0, 0, 0)

    classes = set()
    properties = set()
    for s, p, o in g:
        if p == RDF.type:
            classes.add(str(o))
        elif p == RDFS.label:
            properties.add(str(s))

    return OwlImportResult(
        triples_loaded=len(g),
        classes_imported=len(classes),
        properties_imported=len(properties),
    )


def export_owl_rdf_xml(classes: list[dict[str, Any]]) -> str:
    from rdflib import Graph, Literal, Namespace, RDF, RDFS

    ont = Namespace("http://mate.local/ontology#")
    g = Graph()
    for c in classes:
        cls_uri = ont[c["id"]]
        g.add((cls_uri, RDF.type, RDFS.Class))
        if c.get("label"):
            g.add((cls_uri, RDFS.label, Literal(c["label"])))
    out = g.serialize(format="xml")
    return out.decode("utf-8") if hasattr(out, "decode") else str(out)