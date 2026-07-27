# Mate Platform 安全白皮书（P8.3）

## 1. 多层防御

- 网络层：VPC + SecurityGroup + 白名单
- 鉴权层：TECH-IAM OAuth2/JWT + PermissionSnapshot 缓存
- 数据层：Postgres 多租户隔离 + 字段级脱敏
- 应用层：Ontology Context Envelope 签名 + ActionGuard

## 2. Ontology-Native DeerFlow 安全要点

1. LLM 不能直接写 Ontology：所有写入经过 Commit Service 治理
2. Sandbox 默认不挂 Docker Socket：使用 K8s Pod Sandbox + NetworkPolicy
3. Secret 临时注入：通过 Broker，不写入 Prompt 与日志
4. Action 自动分级：LOW 自动 / MEDIUM/HIGH 审批 / CRITICAL 默认拒绝
5. Memory PII 检测：身份证 / 手机号 / 银行卡 / 邮箱自动 redact

## 3. 审计

所有 Agent Run / Claim / Evidence / Action / Ontology Commit 全量入 obs_run_event，
保留 >= 90 天，支持任意 Run 端到端回放。

## 4. 公测灰度策略

- 内部 -> 50 试点租户 -> 100 全量租户
- 滚动升级，按租户 ID 取模 100
- 任一 P0 事故自动回滚到上一版本
