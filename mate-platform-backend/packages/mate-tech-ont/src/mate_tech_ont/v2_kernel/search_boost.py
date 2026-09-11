"""L5 检索高级技术 —— HyDE / query augmentation / BM25 reranker（Palantir OAG 对位）。

调研材料 03 §OAG 四大高级检索技术，本模块补齐后三（hybrid+RRF 已有）：

1. **HyDE**（Hypothetical Document Embedding）：query → LLM 生成假设性答案
   文档 → 对假设文档嵌入（而非 query 本身）→ KNN。弥合"query 短语 vs
   答案段落"的分布不对称。走 llmgw chat（轻 prompt）。
2. **Query augmentation**：
   - enriching：去停用词 + 同义词/相关词扩展（LLM 一并生成或内置映射）
   - extraction：提取核心实体词（分词 + 过滤）
3. **BM25 reranker**：向量召回 top-K → 对候 chunk 文本按原 query 打 BM25
   精排 → 融合排序。无外部依赖（纯 Python 实现 Okapi BM25）。

接线点：`enhance_search(text, top_k)` 返回增强后的检索入口参数；
`rerank(query, cards, embedder_texts)` 返回精排后 cards。
"""

from __future__ import annotations

import math
import re

__all__ = [
    "bm25_rerank",
    "extract_query_terms",
    "hyde_expand",
    "remove_stopwords",
    "STOPWORDS_CN_EN",
]

# ─────────────────── Query Augmentation ───────────────────

STOPWORDS_CN_EN = frozenset(
    {
        # EN
        "a",
        "an",
        "the",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "shall",
        "can",
        "of",
        "in",
        "on",
        "at",
        "to",
        "for",
        "with",
        "by",
        "from",
        "up",
        "about",
        "into",
        "over",
        "after",
        "what",
        "which",
        "who",
        "whom",
        "where",
        "when",
        "why",
        "how",
        "all",
        "any",
        "both",
        "each",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "find",
        "search",
        "show",
        "list",
        "get",
        "query",
        "给我",
        "找出",
        "查找",
        "搜索",
        "列出",
        "哪些",
        "什么",
        "怎么",
        "如何",
        "所有",
        # CN 常用停用
        "的",
        "了",
        "在",
        "是",
        "我",
        "有",
        "和",
        "就",
        "不",
        "人",
        "都",
        "一",
        "个",
        "上",
        "也",
        "很",
        "到",
        "说",
        "要",
        "去",
        "会",
        "着",
        "没有",
        "看",
        "好",
        "自己",
        "这",
        "那",
        "它",
        "我们",
        "你们",
    }
)

_WORD_RE = re.compile(r"[0-9A-Za-z]+", re.UNICODE)
_CJK_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿]+", re.UNICODE)


def extract_query_terms(text: str) -> list[str]:
    """query → 核心词列表（EN 词 + CN bigram，去停用词）。"""
    tokens: list[str] = [w.lower() for w in _WORD_RE.findall(text)]
    for run in _CJK_RE.findall(text):
        if len(run) == 1:
            tokens.append(run)
        else:
            tokens.extend(run[i : i + 2] for i in range(len(run) - 1))
    seen: list[str] = []
    for t in tokens:
        if t not in STOPWORDS_CN_EN and t not in seen:
            seen.append(t)
    return seen


def remove_stopwords(text: str) -> str:
    """简单版：整词替换去停用（保底路径，无 LLM 时用）。"""
    words = text.split()
    kept = [w for w in words if w.lower() not in STOPWORDS_CN_EN]
    return " ".join(kept) if kept else text


def _llmgw_chat(prompt: str, system: str = "") -> str | None:
    """llmgw chat 单轮（query enrich/HyDE 用）。失败返回 None（调用方降级）。"""
    import os

    url = os.environ.get("LLMGW_CHAT_URL", "")
    if not url:
        # 从 llmgw embeddings URL 推导（/api/v1/llmgw/embeddings → /chat）
        emb = os.environ.get("LLMGW_EMBED_URL", "")
        if emb:
            url = emb.rsplit("/", 1)[0] + "/chat"
    if not url:
        return None
    kc = os.environ.get("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
    token_url = kc + "/realms/metaplatform/protocol/openid-connect/token"
    try:
        import httpx as _hx

        with _hx.Client(timeout=15.0) as c:
            resp = c.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": os.environ.get("SERVICE_CLIENT_ID", "metaplatform-backend"),
                    "client_secret": os.environ.get("SERVICE_CLIENT_SECRET", ""),
                },
            )
            resp.raise_for_status()
            token = resp.json()["access_token"]
            chat = c.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "messages": [
                        *([{"role": "system", "content": system}] if system else []),
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 200,
                },
            )
            chat.raise_for_status()
            body = chat.json()
            # llmgw chat 返回 OpenAI 兼容或简化 {reply}
            if "choices" in body:
                return body["choices"][0]["message"].get("content")
            return body.get("reply") or body.get("content")
    except Exception:
        return None


def hyde_expand(query: str) -> str | None:
    """HyDE：query → 假设性文档（LLM 生成），用于替代原 query 嵌入。

    失败返回 None（调用方降级为原 query / query+terms 混合）。
    """
    prompt = (
        "请写一段 50-80 字的假设性文档片段，直接回答以下问题（不要说"
        "'答案是'，直接写内容，像百科条目的一段）：\n\n" + query
    )
    return _llmgw_chat(prompt)


def enrich_query(query: str) -> str:
    """query enrichment：LLM 同义词扩展。失败降级为去停用词。"""
    terms = extract_query_terms(query)
    if not terms:
        return query
    prompt = (
        "为以下搜索词生成同义词和相关词（中英文各至多 3 个，用空格分隔，"
        "不要标点不要解释）：\n" + " ".join(terms)
    )
    expanded = _llmgw_chat(prompt)
    if expanded and expanded.strip():
        # 只取词（防 LLM 返回解释文本），拼回原 query
        extra = [
            w
            for w in re.split(r"[\s,，、]+", expanded.strip())
            if w and w.lower() not in STOPWORDS_CN_EN
        ][:6]
        if extra:
            return query + " " + " ".join(extra)
    return remove_stopwords(query)


# ─────────────────── BM25 Reranker（Okapi）───────────────────


def bm25_rerank(
    query: str,
    docs: list[str],
    ids: list[str] | None = None,
    *,
    k1: float = 1.5,
    b: float = 0.75,
    top_k: int = 10,
) -> list[tuple[str, float]]:
    """BM25 精排：对候选文档按原 query 打分。

    返回 [(id, score)] 按分数降序，截断 top_k。ids 缺省时用 docs 索引
    字符串。纯 Python，无外部依赖；文档数 ≤ 100 时毫秒级。
    """
    if not docs:
        return []
    if ids is None:
        ids = [str(i) for i in range(len(docs))]
    q_terms = extract_query_terms(query)
    if not q_terms:
        return list(zip(ids[:top_k], [0.0] * min(len(ids), top_k), strict=True))

    # 分词 + df 统计
    doc_terms = [extract_query_terms(d) for d in docs]
    N = len(doc_terms)
    avgdl = sum(len(dt) for dt in doc_terms) / N if N else 1.0
    df: dict[str, int] = {}
    for dt in doc_terms:
        for t in set(dt):
            df[t] = df.get(t, 0) + 1

    scored: list[tuple[str, float]] = []
    for i, dt in enumerate(doc_terms):
        score = 0.0
        dl = len(dt)
        for qt in q_terms:
            tf = dt.count(qt)
            if tf == 0:
                continue
            n = df.get(qt, 0)
            idf = math.log((N - n + 0.5) / (n + 0.5) + 1.0)
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
        scored.append((ids[i], score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]
