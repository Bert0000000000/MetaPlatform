"""Neo4jGraphRAGClient: real Neo4j connection for ENTITY retrieval."""
from __future__ import annotations

import logging
import os
import re
import threading
import uuid
from typing import Protocol

from mate_tech_rag.api.schemas import ChunkHit

_log = logging.getLogger(__name__)
_ENTITY_RE = re.compile(r"[\u4e00-\u9fff]{2,4}|[A-Z][A-Za-z0-9_]{2,}")


class GraphRAGClient(Protocol):
    def query(self, query, top_k=10): ...
    def insert(self, text, document_id, metadata=None): ...
    def count(self): ...


class Neo4jGraphRAGClient:
    """Real Neo4j client for entity graph (GraphRAG ENTITY mode).

    Database: rag-graphrag (per v3.0 Plan D).
    """

    DEFAULT_DATABASE = "rag-graphrag"
    DEFAULT_URI = "bolt://localhost:7687"

    def __init__(self, uri=None, user=None, password=None, database=None):
        self._uri = uri or os.environ.get("NEO4J_URI", self.DEFAULT_URI)
        self._user = user or os.environ.get("NEO4J_USER", "neo4j")
        self._password = password or os.environ.get("NEO4J_PASSWORD", "mate-pass")
        self._database = database or os.environ.get("NEO4J_DATABASE", self.DEFAULT_DATABASE)
        self._driver = None
        self._lock = threading.Lock()
        self._connect()

    def _connect(self):
        try:
            from neo4j import GraphDatabase
        except ImportError as exc:
            raise RuntimeError("neo4j driver not installed") from exc
        try:
            self._driver = GraphDatabase.driver(self._uri, auth=(self._user, self._password))
            with self._driver.session(database="system") as sys_sess:
                sys_sess.run(f"CREATE DATABASE `{self._database}` IF NOT EXISTS").consume()
            with self._driver.session(database=self._database) as sess:
                sess.run("CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE").consume()
            _log.info("Connected to Neo4j at %s/%s", self._uri, self._database)
        except Exception as exc:
            _log.warning("Neo4j connect failed (%s): %s", self._uri, exc)
            self._driver = None

    @staticmethod
    def _extract_entities(text):
        return set(_ENTITY_RE.findall(text))

    def insert(self, text, document_id, metadata=None):
        chunk_id = str(uuid.uuid4())
        if self._driver is None:
            return chunk_id
        entities = self._extract_entities(text)
        snippet = text[:200]
        meta_str = str(metadata or {})
        with self._lock, self._driver.session(database=self._database) as sess:
                sess.run(
                    "MERGE (c:Chunk {id: $cid}) SET c.document_id=$did, c.snippet=$snip, c.text=$text, c.metadata=$meta "
                    "WITH c UNWIND $ents AS e_name "
                    "MERGE (e:Entity {name: e_name}) ON CREATE SET e.freq=1 ON MATCH SET e.freq=e.freq+1 "
                    "MERGE (e)-[:MENTIONED_IN]->(c)",
                    cid=chunk_id, did=document_id, snip=snippet, text=text[:1000], meta=meta_str, ents=list(entities) or ["__empty__"],
                ).consume()
        return chunk_id

    def query(self, query, top_k=10):
        if self._driver is None:
            return []
        entities = self._extract_entities(query)
        if not entities:
            return []
        cypher = "UNWIND $ents AS e_name MATCH (e:Entity {name:e_name})-[r:MENTIONED_IN]->(c:Chunk) WITH c, count(DISTINCT e) AS hits, sum(r.freq) AS freq ORDER BY hits DESC, freq DESC LIMIT $limit RETURN c.id AS cid, c.document_id AS did, c.snippet AS snip, hits AS score"
        with self._lock, self._driver.session(database=self._database) as sess:
            records = list(sess.run(cypher, ents=list(entities), limit=max(1, top_k)))
        hits = []
        for r in records:
            hits.append(
                ChunkHit(
                    chunk_id=r["cid"],
                    document_id=r["did"],
                    score=1.0 / (1.0 + len(hits)),
                    text=r["snip"],
                    metadata={"mode": "ENTITY", "matched": str(r["score"])},
                )
            )
        return hits

    def count(self):
        if self._driver is None:
            return 0
        try:
            with self._driver.session(database=self._database) as sess:
                rec = sess.run("MATCH (:Entity) RETURN count(e) AS n").single()
                return int(rec["n"]) if rec else 0
        except Exception:
            return 0

    def close(self):
        if self._driver is not None:
            self._driver.close()
            self._driver = None
