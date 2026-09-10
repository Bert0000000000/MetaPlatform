"""AI-10/11 —— chunk 对象管道（回源溯源）+ agent 工具面扩展（写/检索工具）。

覆盖：
1. ensure_chunk_model 幂等 + ingest：chunk 对象落库 + MANY_TO_ONE 回源 link；
2. 溯源闭环：hybrid 检索命中 chunk → search_around 回到源文档；
3. 重复 ingest 幂等（upsert）；
4. 工具面：propose_action_<slug> 写工具 schema（HITL 描述 + required 参数）
   + search_objects 工具；agent_tool_schemas 接收 action_types。
"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.tooling.schema_gen import (
    action_propose_tool_schema,
    agent_tool_schemas,
    semantic_search_tool_schema,
)

T = "ai1011"
OBJ_DOC = f"ont.{T}.obj.kb.document.v1"
P_TITLE = f"ont.{T}.prop.doc-title.v1"


def _repo_with_doc() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ_DOC),
        primary_key=(ClassRef(P_TITLE),),
        properties=(
            Property(rid=ClassRef(P_TITLE), type_id="string", nullable=False,
                     primary_key=True, title="title", format=PropertyFormat.STRING),
        ),
        display_name="document",
    ))
    return r


class TestChunkPipeline:
    def test_ingest_and_traceback(self) -> None:
        from mate_tech_ont.v2_kernel.chunk_pipeline import (
            chunk_class_rid,
            ingest_document_chunks,
        )
        from mate_tech_ont.v2_kernel.object_search import HashEmbedder

        r = _repo_with_doc()
        r.set_embedder(HashEmbedder())
        out = ingest_document_chunks(
            r, T, OBJ_DOC, "spec-001",
            ["Ontology 是组织的操作层", "Action 是写入唯一合法入口",
             "Scenarios 提供沙盒模拟"])
        assert out["chunks"] == 3
        # chunk 类 + 回源 link 建好
        chunk_cls = chunk_class_rid(T)
        lt = r.get_link_type(ClassRef(out["link_type_rid"]))
        assert lt.src.rid == chunk_cls and lt.dst.rid == OBJ_DOC
        # 检索命中 chunk → search_around 回源
        cards = r.search_objects_hybrid("操作层 ontology", top_k=3)
        assert cards, "chunk should be searchable"
        top_chunk = cards[0]["individual_rid"]
        around = r.search_around(top_chunk)
        assert around, "chunk should have backlink to doc"
        assert any(p.get("doc-title") == "spec-001"
                   for g in around for p in g["peers"])

    def test_idempotent_reingest(self) -> None:
        from mate_tech_ont.v2_kernel.chunk_pipeline import ingest_document_chunks

        r = _repo_with_doc()
        ingest_document_chunks(r, T, OBJ_DOC, "d2", ["a", "b"])
        ingest_document_chunks(r, T, OBJ_DOC, "d2", ["a", "b"])
        chunks = r.list_individuals(ClassRef(
            f"ont.{T}.obj.kb.kb-chunk.v1"))
        assert len(chunks) == 2  # upsert 不重复


class TestToolSurface:
    def test_propose_action_tool_schema(self) -> None:
        at = ActionType(
            rid=ClassRef(f"ont.{T}.act.org.approve.v1"),
            parameters=(
                Property(rid=ClassRef(f"ont.{T}.prop.comment.v1"), type_id="string",
                         nullable=True, primary_key=False, title="comment",
                         format=PropertyFormat.STRING, description="审批意见"),
                Property(rid=ClassRef(f"ont.{T}.prop.level.v1"), type_id="integer",
                         nullable=False, primary_key=False, title="level",
                         format=PropertyFormat.INTEGER),
            ),
            submission_criteria=(), side_effects=(),
            function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
            on=(ClassRef(OBJ_DOC),), title="Approve",
            declarative_edits=({"op": "set_property"},),
        )
        schema = action_propose_tool_schema(at)
        assert schema["function"]["name"] == "propose_action_approve"
        assert "HITL" in schema["function"]["description"]
        assert schema["function"]["parameters"]["required"] == ["level"]
        assert schema["function"]["parameters"]["properties"]["comment"][
            "description"] == "审批意见"

    def test_agent_tool_schemas_extended(self) -> None:
        r = _repo_with_doc()
        ots = r.list_object_types(100, 0)
        at = ActionType(
            rid=ClassRef(f"ont.{T}.act.org.tag.v1"), parameters=(),
            submission_criteria=(), side_effects=(),
            function_ref=ClassRef(f"ont.{T}.fn.y.v1"), on=(ClassRef(OBJ_DOC),),
        )
        schemas = agent_tool_schemas(ots, (), (), action_types=[at])
        names = {s["function"]["name"] for s in schemas}
        assert "search_objects" in names
        assert "propose_action_tag" in names
        assert semantic_search_tool_schema()["function"]["name"] == "search_objects"
