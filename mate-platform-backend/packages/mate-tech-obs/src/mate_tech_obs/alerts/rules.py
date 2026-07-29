"""Prometheus alert rules (ST-5.2.8).

10 条关键告警（5xx 错误率、p95 延迟、PG 连接数、Milvus p99 等）。
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AlertRule:
    """单条告警规则."""

    alert: str
    expr: str
    for_duration: str  # 持续时间
    severity: str  # warning / critical
    description: str
    annotations: dict[str, str]


# 10 条核心告警
ALERT_RULES: list[AlertRule] = [
    AlertRule(
        alert="Http5xxRate",
        expr='sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01',
        for_duration="5m",
        severity="critical",
        description="HTTP 5xx 错误率超过 1% 持续 5 分钟",
        annotations={"summary": "5xx 错误率过高", "runbook": "检查上游依赖与日志"},
    ),
    AlertRule(
        alert="HttpP95Latency",
        expr='histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) > 1',
        for_duration="5m",
        severity="warning",
        description="HTTP p95 延迟超过 1s 持续 5 分钟",
        annotations={"summary": "接口延迟升高"},
    ),
    AlertRule(
        alert="PgConnectionPoolFull",
        expr='pg_stat_activity_count / pg_settings_max_connections > 0.9',
        for_duration="2m",
        severity="critical",
        description="PG 连接池使用率超过 90%",
        annotations={"summary": "PG 连接池即将耗尽"},
    ),
    AlertRule(
        alert="MilvusP99Latency",
        expr='histogram_quantile(0.99, milvus_search_latency_seconds_bucket) > 0.1',
        for_duration="5m",
        severity="warning",
        description="Milvus search p99 超过 100ms",
        annotations={"summary": "向量检索慢"},
    ),
    AlertRule(
        alert="KafkaConsumerLag",
        expr='kafka_consumer_lag > 10000',
        for_duration="10m",
        severity="warning",
        description="Kafka consumer 滞后超过 10000 条",
        annotations={"summary": "消息处理慢"},
    ),
    AlertRule(
        alert="AppDown",
        expr='up{job="mate-apps"} == 0',
        for_duration="1m",
        severity="critical",
        description="应用 down 持续 1 分钟",
        annotations={"summary": "应用不可用"},
    ),
    AlertRule(
        alert="LlmErrorRate",
        expr='sum(rate(llm_requests_total{status=~"error"}[5m])) / sum(rate(llm_requests_total[5m])) > 0.05',
        for_duration="5m",
        severity="warning",
        description="LLM 错误率超过 5%",
        annotations={"summary": "LLM 调用失败率高"},
    ),
    AlertRule(
        alert="RagRecallFailure",
        expr='sum(rate(rag_search_failed_total[10m])) > 0.1',
        for_duration="10m",
        severity="warning",
        description="RAG 检索失败率异常",
        annotations={"summary": "RAG 检索异常"},
    ),
    AlertRule(
        alert="DiskSpaceLow",
        expr='(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.1',
        for_duration="5m",
        severity="warning",
        description="磁盘剩余空间低于 10%",
        annotations={"summary": "磁盘空间不足"},
    ),
    AlertRule(
        alert="MemoryHigh",
        expr='(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.9',
        for_duration="5m",
        severity="warning",
        description="内存使用率超过 90%",
        annotations={"summary": "内存紧张"},
    ),
]


def to_prometheus_yaml() -> str:
    """渲染为 Prometheus alert rules YAML 格式."""
    lines = ["groups:"]
    lines.append("  - name: mate-platform")
    lines.append("    interval: 30s")
    lines.append("    rules:")
    for r in ALERT_RULES:
        lines.append(f"      - alert: {r.alert}")
        lines.append(f"        expr: '{r.expr}'")
        lines.append(f"        for: {r.for_duration}")
        labels = f'        labels:\n          severity: "{r.severity}"'
        lines.append(labels)
        ann_lines = "        annotations:"
        lines.append(ann_lines)
        for k, v in r.annotations.items():
            lines.append(f'          {k}: "{v}"')
        lines.append(f"          description: \"{r.description}\"")
        lines.append("")
    return "\n".join(lines)


def get_alert_count() -> int:
    """告警数量."""
    return len(ALERT_RULES)
