"""Unit tests for scripts/ci/forbid_bare_kafka_producer.py (G2 rule 4)."""
from __future__ import annotations

import tempfile
from pathlib import Path

from forbid_bare_kafka_producer import (  # type: ignore[import-not-found]
    check_file,
    check_line,
)


def test_detects_kafka_producer_constructor() -> None:
    hits = check_line("producer = KafkaProducer(bootstrap_servers=brokers)")
    assert "KafkaProducer(...)" in hits


def test_detects_from_kafka_import() -> None:
    hits = check_line("from kafka import KafkaProducer")
    assert "from kafka import KafkaProducer" in hits


def test_detects_import_with_multiple_names() -> None:
    hits = check_line("from kafka import KafkaConsumer, KafkaProducer")
    assert "from kafka import KafkaProducer" in hits


def test_allows_mate_clients_dir() -> None:
    # The ACL client implementation may construct the producer itself.
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "mate-clients" / "kafka" / "producer.py"
        f.parent.mkdir(parents=True)
        f.write_text(
            "p = KafkaProducer(bootstrap_servers=brokers)\n", encoding="utf-8"
        )
        assert check_file(f) == []


def test_allows_tests_dir() -> None:
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "tests" / "test_msg.py"
        f.parent.mkdir(parents=True)
        f.write_text(
            "p = KafkaProducer(bootstrap_servers=brokers)\n", encoding="utf-8"
        )
        assert check_file(f) == []


def test_allows_kafka_consumer() -> None:
    # Only the *producer* is forbidden; consumers are fine.
    assert check_line("consumer = KafkaConsumer('topic')") == []
