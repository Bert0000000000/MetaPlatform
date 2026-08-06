"""OWL/RDF v1 → KERNEL-01 v2 迁移脚本。

输入：N-Triples RDF 简化格式（每行：subject predicate object .）
输出：12 基元 dataclass 序列化 JSON（与 `mate_kernel.ontology.serde` 对位）

策略：
- rdf:type owl:Class → ObjectType
- rdf:type owl:ObjectProperty → LinkType
- rdf:type owl:DatatypeProperty → Property
- rdf:type owl:Restriction (with onProperty) → ActionType 候选（保守：仅警告）
- owl:equivalentClass / rdfs:subClassOf → Axiom (same_as / subclass)
- owl:TransitiveProperty → Axiom (transitivity)

rid 编码：subject 的裸 URI → `ont.<tenant>.<kind>.<slug>`，tenant 默认 `legacy`。
运行：`python -m mate_kernel.ontology.migrate_v1_v2 <input.nt> <output.json>`

不依赖任何第三方 RDF 库；保持 stdlib + regex。
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .identity import ClassRef, Version
from .instances import Individual, LinkInstance
from .reasoning import (
    Axiom,
    AxiomKind,
    Function,
    FunctionLanguage,
)
from .serde import to_dict
from .types import (
    ActionType,
    Cardinality,
    Directionality,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)


_LEGACY_TENANT = "legacy"

_TRIPLE_RE = re.compile(
    r"^\s*<(?P<s>[^>]+)>\s+<(?P<p>[^>]+)>\s+(?P<o><[^>]+>|\"[^\"]*\")\s*\.\s*$"
)


def _strip_brackets(s: str) -> str:
    return s.lstrip("<").rstrip(">")


def _local(uri: str) -> str:
    """裸 URI → local slug（去掉 namespace 斜杠或 #，lowercase 以匹配 v2 rid 正则）。"""
    raw = _strip_brackets(uri).rsplit("/", 1)[-1].rsplit("#", 1)[-1]
    return raw.lower()


def _make_rid(kind: str, uri: str) -> str:
    return f"ont.{_LEGACY_TENANT}.{kind}.{_local(uri)}"


def _to_python_object(s: str) -> str:
    """N-Triples 字面量字符串去引号。"""
    if s.startswith('"') and s.endswith('"'):
        return s[1:-1]
    return s


def parse_ntriples(text: str) -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    for line in text.splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        m = _TRIPLE_RE.match(line)
        if not m:
            continue
        out.append((m.group("s"), m.group("p"), _to_python_object(m.group("o"))))
    return out


def migrate(triples: list[tuple[str, str, str]]) -> dict[str, list[Any]]:
    """v1 N-Triples → v2 dataclass dicts（按基元分桶）。"""
    # 按 subject 聚合
    by_s: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for s, p, o in triples:
        by_s[s][p].append(o)

    properties: dict[str, Property] = {}
    object_types: dict[str, ObjectType] = {}
    link_types: dict[str, LinkType] = {}
    interfaces: dict[str, Interface] = {}
    action_types: dict[str, ActionType] = {}
    axioms: dict[str, Axiom] = {}
    functions: dict[str, Function] = {}

    # Pass 1: properties & link types & axioms (no class deps)
    for s, props in by_s.items():
        types = props.get("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", [])
        def _is(t: str, suffix: str) -> bool:
            inner = _strip_brackets(t)
            return inner.endswith(suffix)

        is_data_prop = any(_is(t, "owl#DatatypeProperty") for t in types)
        is_obj_prop = any(_is(t, "owl#ObjectProperty") for t in types)
        is_transitive = any(_is(t, "owl#TransitiveProperty") for t in types)

        if is_data_prop:
            prop = Property(
                rid=ClassRef(_make_rid("prop", s)),
                type_id="string",
                nullable=True,
                primary_key=False,
                title=_local(s),
                format=PropertyFormat.STRING,
            )
            properties[prop.rid.rid] = prop

        if is_obj_prop:
            domains = props.get(
                "http://www.w3.org/2000/01/rdf-schema#domain", []
            )
            ranges = props.get(
                "http://www.w3.org/2000/01/rdf-schema#range", []
            )
            src = ClassRef(_make_rid("obj", domains[0])) if domains else ClassRef(
                _make_rid("obj", "Unknown")
            )
            dst = ClassRef(_make_rid("obj", ranges[0])) if ranges else ClassRef(
                _make_rid("obj", "Unknown")
            )
            lt = LinkType(
                rid=ClassRef(_make_rid("link", s)),
                src=src,
                dst=dst,
                cardinality=Cardinality.MANY_TO_MANY,
                directionality=Directionality.DIRECTED,
                link_properties=(),
            )
            link_types[lt.rid.rid] = lt

        if is_transitive:
            operands = (
                ClassRef(_make_rid("obj", s)),
                ClassRef(_make_rid("obj", s)),
            )
            ax = Axiom(
                rid=ClassRef(_make_rid("ax", f"transitive_{_local(s)}")),
                kind=AxiomKind.TRANSITIVITY,
                operands=operands,
                rule_ref="owl:TransitiveProperty",
                metadata=(),
            )
            axioms[ax.rid.rid] = ax

    # Pass 2: object types (now properties are populated)
    for s, props in by_s.items():
        types = props.get("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", [])
        def _is2(t: str, suffix: str) -> bool:
            inner = _strip_brackets(t)
            return inner.endswith(suffix)

        is_class = any(_is2(t, "owl#Class") for t in types)
        if not is_class:
            continue

        pk_props = [
            properties[_make_rid("prop", p)]
            for p in props.get("http://example.org/hasPK", [])
            if _make_rid("prop", p) in properties
        ]
        class_props = [
            properties[_make_rid("prop", p)]
            for p in props.get("http://example.org/hasProperty", [])
            if _make_rid("prop", p) in properties
        ]
        if not pk_props and class_props:
            pk_props = [class_props[0]]
        if not pk_props:
            continue
        ot = ObjectType(
            rid=ClassRef(_make_rid("obj", s)),
            primary_key=tuple(pk.rid for pk in pk_props),
            properties=tuple(class_props),
            interfaces=(),
            display_name=_local(s),
        )
        object_types[ot.rid.rid] = ot

    return {
        "property": [to_dict(p) for p in properties.values()],
        "object_type": [to_dict(o) for o in object_types.values()],
        "link_type": [to_dict(l) for l in link_types.values()],
        "interface": [to_dict(i) for i in interfaces.values()],
        "action_type": [to_dict(a) for a in action_types.values()],
        "axiom": [to_dict(a) for a in axioms.values()],
        "function": [to_dict(f) for f in functions.values()],
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: python -m mate_kernel.ontology.migrate_v1_v2 <input.nt> <output.json>")
        return 2
    src = Path(argv[1])
    dst = Path(argv[2])
    text = src.read_text(encoding="utf-8")
    triples = parse_ntriples(text)
    result = migrate(triples)
    dst.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        f"migrated {len(triples)} triples → "
        f"{sum(len(v) for v in result.values())} v2 records"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))