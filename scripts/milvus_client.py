"""MilvusHybridClient: real Milvus v2.5+ connection for FACTUAL retrieval."""
from __future__ import annotations

import logging
import os
import threading
import uuid
from typing import Protocol

from mate_tech_rag.api.schemas import ChunkHit

_log = logging.getLogger(__name__)


class HybridClient(Protocol):
    def search(self, query, query_vector, top_k=10): ...
    def add(self, document_id, text, vector, metadata=None): ...
    def count(self): ...


class MilvusHybridClient:
    """Real Milvus client for vector search.

    Env: MILVUS_HOST, MILVUS_PORT, MILVUS_COLLECTION (default mate_kb_chunks).
    """

    DEFAULT_COLLECTION = "mate_kb_chunks"

    def __init__(self, host=None, port=None, collection_name=None, dim=384):
        self._host = host or os.environ.get("MILVUS_HOST", "localhost")
        self._port = int(port or os.environ.get("MILVUS_PORT", "19530"))
        self._collection = collection_name or os.environ.get("MILVUS_COLLECTION", self.DEFAULT_COLLECTION)
        self._dim = dim
        self._client = None
        self._lock = threading.Lock()
        self._connect()

    def _connect(self):
        try:
            from pymilvus import MilvusClient
        except ImportError as exc:
            raise RuntimeError("pymilvus not installed") from exc
        try:
            self._client = MilvusClient(uri=f"http://{self._host}:{self._port}")
            if not self._client.has_collection(self._collection):
                self._client.create_collection(
                    self._collection,
                    dimension=self._dim,
                    metric_type="COSINE",
                    auto_id=False,
                )
                _log.info("Created Milvus collection %s (dim=%d)", self._collection, self._dim)
            _log.info("Connected to Milvus at %s:%d/%s", self._host, self._port, self._collection)
        except Exception as exc:
            _log.warning("Milvus connect failed (%s:%d): %s", self._host, self._port, exc)
            self._client = None

    def add(self, document_id, text, vector, metadata=None):
        chunk_id = str(uuid.uuid4())
        if self._client is None:
            return chunk_id
        with self._lock:
            self._client.insert(
                self._collection,
                data=[{"id": chunk_id, "document_id": document_id, "text": text, "embedding": list(vector), "metadata": str(metadata or {})}],
            )
        return chunk_id

    def search(self, query, query_vector, top_k=10):
        if self._client is None:
            return []
        with self._lock:
            res = self._client.search(
                self._collection,
                data=[list(query_vector)],
                limit=max(1, top_k),
                output_fields=["document_id", "text", "metadata"],
            )
        hits = []
        for batch in res:
            for h in batch:
                hits.append(
                    ChunkHit(
                        chunk_id=str(h["id"]),
                        document_id=h.get("document_id", ""),
                        score=max(0.0, min(1.0, float(h.get("distance", 0.0)))),
                        text=h.get("text", ""),
                        metadata={"mode": "FACTUAL"},
                    )
                )
        return hits

    def count(self):
        if self._client is None:
            return 0
        try:
            stats = self._client.get_collection_stats(self._collection)
            return int(stats.get("row_count", 0))
        except Exception:
            return 0

    def close(self):
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
