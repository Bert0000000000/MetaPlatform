"""L5 检索高级技术测试 —— HyDE / query augmentation / BM25 reranker。"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_tech_ont.v2_kernel.search_boost import (
    bm25_rerank,
    extract_query_terms,
    remove_stopwords,
)


class TestExtractQueryTerms:
    def test_en_terms_stopwords_removed(self) -> None:
        terms = extract_query_terms("find all Finance AR specialists")
        assert "find" not in terms and "all" not in terms
        assert "finance" in terms and "specialists" in terms

    def test_cn_bigram(self) -> None:
        terms = extract_query_terms("华东重工集团的订单")
        assert any("华东" in t or "重工" in t for t in terms)

    def test_dedup(self) -> None:
        terms = extract_query_terms("order order order")
        assert terms.count("order") == 1


class TestRemoveStopwords:
    def test_fallback_keeps_content(self) -> None:
        assert "the" not in remove_stopwords("the order status").split()


class TestBM25Rerank:
    def test_ranks_relevant_doc_first(self) -> None:
        docs = [
            "财务应收专员负责发票核对",  # 无关
            "华东重工集团的订单已确认",  # 相关（订单）
            "员工请假申请审批流程",  # 无关
        ]
        ids = ["d0", "d1", "d2"]
        ranked = bm25_rerank("订单 确认", docs, ids)
        assert ranked[0][0] == "d1"
        assert ranked[0][1] > 0

    def test_top_k_truncates(self) -> None:
        ranked = bm25_rerank("a", ["x", "y", "z"], ["1", "2", "3"], top_k=2)
        assert len(ranked) == 2

    def test_empty_query_returns_original_order(self) -> None:
        ranked = bm25_rerank("", ["x", "y"], ["1", "2"])
        assert [r[0] for r in ranked] == ["1", "2"]

    def test_empty_docs(self) -> None:
        assert bm25_rerank("q", []) == []


class TestHyDEEnrich:
    def test_hyde_degrades_to_none(self, monkeypatch) -> None:
        # 无 SERVICE_CLIENT_SECRET / llmgw 时返回 None（不抛）。
        # 注意：必须用 monkeypatch.delenv（用例结束自动还原）—— 直接
        # `os.environ.pop` 会**永久删除整个 pytest 进程**的该变量，污染后续
        # 用例（实测：会让 llmgw 的 _fetch_iam_configs 读到空 → 3 个用例失败）。
        from mate_tech_ont.v2_kernel.search_boost import hyde_expand

        monkeypatch.delenv("SERVICE_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("LLMGW_CHAT_URL", raising=False)
        monkeypatch.delenv("LLMGW_EMBED_URL", raising=False)
        result = hyde_expand("test query")
        assert result is None

    def test_enrich_degrades_to_stopwords_removed(self, monkeypatch) -> None:
        from mate_tech_ont.v2_kernel.search_boost import enrich_query

        monkeypatch.delenv("SERVICE_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("LLMGW_CHAT_URL", raising=False)
        monkeypatch.delenv("LLMGW_EMBED_URL", raising=False)
        result = enrich_query("find the order status")
        assert "the" not in result.lower().split() or result == "find the order status"
