"""AI-10：chunk 对象管道 —— 文档块即对象 + link 回源（Palantir 溯源关键设计）。

Palantir 语义（调研材料 03 §document-processing）：
  文档 → chunk → **chunk 成为独立 Ontology 对象并通过 link type 链回源文档**
  → 检索命中 chunk 后可沿 link 追溯原文件。

Mate 落地（引擎侧最小集，可与 mate-app-kb / tech-rag 的文档宇宙对接）：
- ``ensure_chunk_model(repo, tenant, doc_class_rid)`` —— 幂等建
  Chunk ObjectType（chunk_text + position 属性）+ chunk→doc LinkType；
- ``ingest_document_chunks(repo, tenant, doc, chunks)`` —— 文档对象 +
  chunk 对象批量落库 + 回源 link；
- 检索消费：``search_objects_hybrid`` 命中 chunk → ``search_around``
  回源文档（UI-01 对象主页天然支持该导航）。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.instances.link_instance import LinkInstance
from mate_kernel.ontology.types.link_type import (
    Cardinality, Directionality, LinkType,
)
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

__all__ = [
    "chunk_class_rid",
    "chunk_link_rid",
    "ensure_chunk_model",
    "ingest_document_chunks",
]

CHUNK_SLUG = "kb-chunk"
LINK_SLUG = "chunk-source-doc"


def _slug(rid: str) -> str:
    parts = rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def chunk_class_rid(tenant: str) -> str:
    return f"ont.{tenant}.obj.kb.{CHUNK_SLUG}.v1"


def chunk_link_rid(tenant: str) -> str:
    return f"ont.{tenant}.link.kb.{LINK_SLUG}.v1"


def ensure_chunk_model(
    repo: Any,
    tenant: str,
    doc_class_rid: str,
    *,
    doc_class_display: str = "",
) -> tuple[str, str]:
    """幂等建 Chunk ObjectType + chunk→doc LinkType。返回 (class_rid, link_rid)。

    doc_class_rid：源文档在本体里的对象类型（由调用方保证已注册 ——
    KB 侧建 Doc 类型或直接用既有类型）。
    """
    cls_rid = chunk_class_rid(tenant)
    lnk_rid = chunk_link_rid(tenant)
    p_text = f"ont.{tenant}.prop.chunk-text.v1"
    p_pos = f"ont.{tenant}.prop.chunk-position.v1"
    p_doc = f"ont.{tenant}.prop.chunk-doc.v1"

    chunk_ot = ObjectType(
        rid=ClassRef(cls_rid),
        primary_key=(ClassRef(p_doc),),
        properties=(
            # 主键 = <doc_pk>#<position>（doc 内唯一；跨 doc 唯一因 doc_pk 前缀）
            Property(rid=ClassRef(f"ont.{tenant}.prop.chunk-key.v1"),
                     type_id="string", nullable=False, primary_key=True,
                     title="chunkKey", format=PropertyFormat.STRING),
            Property(rid=ClassRef(p_text), type_id="string", nullable=False,
                     primary_key=False, title="chunkText",
                     format=PropertyFormat.STRING,
                     description="文档块正文（语义检索单元）"),
            Property(rid=ClassRef(p_pos), type_id="integer", nullable=False,
                     primary_key=False, title="position",
                     format=PropertyFormat.INTEGER,
                     description="块在源文档中的序位"),
            Property(rid=ClassRef(p_doc), type_id="string", nullable=False,
                     primary_key=False, title="sourceDocPk",
                     format=PropertyFormat.STRING,
                     description="源文档主键"),
        ),
        display_name="知识块",
        description="文档切块对象（AI-10 管道产物；沿 chunk-source-doc 回源文档）",
        type_group="kb",
    )
    # 主键声明必须指向 properties 内字段 —— 修正为 chunkKey
    from dataclasses import replace as _replace

    chunk_ot = _replace(
        chunk_ot,
        primary_key=(ClassRef(f"ont.{tenant}.prop.chunk-key.v1"),),
    )
    try:
        repo.get_object_type(ClassRef(cls_rid))
    except KeyError:
        repo.upsert_object_type(chunk_ot)
    try:
        repo.get_link_type(ClassRef(lnk_rid))
    except KeyError:
        repo.upsert_link_type(LinkType(
            rid=ClassRef(lnk_rid),
            src=ClassRef(cls_rid),
            dst=ClassRef(doc_class_rid),
            cardinality=Cardinality.MANY_TO_ONE,
            directionality=Directionality.DIRECTED,
            src_display_name="sourceDocument",
            dst_display_name="chunks",
            description="chunk 回溯源文档（检索溯源导航）",
        ))
    return cls_rid, lnk_rid


def ingest_document_chunks(
    repo: Any,
    tenant: str,
    doc_class_rid: str,
    doc_pk: str,
    chunks: list[str],
    *,
    chunk_size_hint: int = 512,
    doc_props: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """文档 + chunk 批量落库 + 回源 link。返回统计。

    幂等：chunk 主键 = ``<doc_pk>#<i>``，重复 ingest 走 upsert 语义
    （create_individual 的 upsert / edit-set 语义由 repo 决定）。
    """
    cls_rid, lnk_rid = ensure_chunk_model(repo, tenant, doc_class_rid)
    now = datetime.now(UTC)

    # 1) 源文档对象
    doc_parts = doc_class_rid.split(".")
    doc_slug = doc_parts[4] if len(doc_parts) >= 6 else doc_parts[3]
    doc_rid = f"ont.{tenant}.ind.{doc_slug}.{doc_pk}"
    try:
        repo.get_individual(doc_rid)
    except KeyError:
        # 用类型第一个属性当主键承载（调用方也可 doc_props 指定）
        try:
            ot = repo.get_object_type(ClassRef(doc_class_rid))
        except KeyError:
            raise ValueError(f"doc class not registered: {doc_class_rid}")
        pk_prop = ot.primary_key[0]
        props = dict(doc_props or {})
        props[pk_prop.rid] = doc_pk
        repo.create_individual(Individual(
            rid=doc_rid, class_rid=ClassRef(doc_class_rid),
            props=tuple((ClassRef(k), v) for k, v in props.items()),
            primary_key=str(doc_pk), created_at=now, updated_at=now,
            tenant_id=tenant,
        ))

    # 2) chunk 对象 + 回源 link
    created_chunks = 0
    for i, text in enumerate(chunks):
        key = f"{doc_pk}#{i}"
        chunk_rid = f"ont.{tenant}.ind.{CHUNK_SLUG}.{key}"
        repo.create_individual(Individual(
            rid=chunk_rid, class_rid=ClassRef(cls_rid),
            props=(
                (ClassRef(f"ont.{tenant}.prop.chunk-key.v1"), key),
                (ClassRef(f"ont.{tenant}.prop.chunk-text.v1"), text),
                (ClassRef(f"ont.{tenant}.prop.chunk-position.v1"), i),
                (ClassRef(f"ont.{tenant}.prop.chunk-doc.v1"), doc_pk),
            ),
            primary_key=key, created_at=now, updated_at=now, tenant_id=tenant,
        ))
        created_chunks += 1
        repo.create_link_instance(LinkInstance(
            rid=f"ont.{tenant}.lnk.{LINK_SLUG}.{key}",
            link_type_rid=ClassRef(lnk_rid),
            src=chunk_rid, dst=doc_rid, props=(),
            created_at=now, tenant_id=tenant,
        ))
    return {
        "doc_rid": doc_rid,
        "chunk_class_rid": cls_rid,
        "link_type_rid": lnk_rid,
        "chunks": created_chunks,
        "chunk_size_hint": chunk_size_hint,
    }
