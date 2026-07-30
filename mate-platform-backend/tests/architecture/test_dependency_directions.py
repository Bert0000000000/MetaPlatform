"""Forbid framework/infrastructure imports in domain layer."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN = ("sqlalchemy", "redis", "aiokafka", "neo4j", "pymilvus", "minio", "httpx", "fastapi")

def test_domain_layer_has_no_infrastructure_imports() -> None:
    for package in [
        "packages/mate-tech-rag/src/mate_tech_rag/domain",
        "packages/mate-tech-agent/src/mate_tech_agent/domain",
        "packages/mate-tech-ont/src/mate_tech_ont/domain",
    ]:
        d = ROOT / package
        if not d.exists():
            continue
        for path in d.rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            assert not any(token in text for token in FORBIDDEN), path
