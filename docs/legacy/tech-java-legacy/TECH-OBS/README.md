# TECH-OBS - 可观测性服务

> 平台可观测性服务（v1.3 含 RunEvent / Claim / Evidence / Audit）。

## 关键能力

- 日志接入（V10 / Loki 3.3.2）
- **RunEvent**（P8.2 增强）：全链路事件流（RunStarted / ClaimProduced / EvidenceAttached / ActionProposed / OntologyCommitted）
- **审计**（P5.x / P6.x / P8.2）：所有 Agent Run / Action / Ontology Commit 均可审计

## 标准 RunEvent 类型

```text
RUN_STARTED / RUN_COMPLETED / RUN_FAILED / RUN_PAUSED / RUN_RESUMED
PLAN_CREATED / TASK_CREATED / SUBAGENT_STARTED
MODEL_STARTED / MODEL_COMPLETED
TOOL_STARTED / TOOL_COMPLETED
EVIDENCE_ATTACHED / CLAIM_PRODUCED
ARTIFACT_CREATED
APPROVAL_REQUIRED / ACTION_PROPOSED / ACTION_GUARD_DECIDED / ACTION_EXECUTED / ACTION_FAILED
ONTOLOGY_EVENT_RECEIVED / CHECKPOINT_SAVED
```

## 多租户压测

P8.2 阶段：1000 并发 / 50 租户 / 5 分钟。无 OOM / P99 ≤ 5s。
