# SealedSecrets 主私钥备份清单

> **模板文件**: 每次备份后由 SRE on-call 填写更新
> **关联 runbook**: [`sealed-secret-backup.md`](./sealed-secret-backup.md)
> **敏感度**: 本文件不存储任何密钥明文，仅记录元数据

---

## 备份记录

| 日期 (UTC) | 集群 | 执行人 | 加密方案 | 加密密钥 ID | 验证状态 | 备注 |
|---|---|---|---|---|---|---|
| _YYYY-MM-DDThh:mm:ssZ_ | staging | _SRE name_ | Vault Transit | `sealed-secrets-backup` | ✅ 已验证 decrypt | 首次备份 |
| _YYYY-MM-DDThh:mm:ssZ_ | production | _SRE name_ | Vault Transit | `sealed-secrets-backup` | ✅ 已验证 decrypt | 首次备份 |
| | | | | | | |
| | | | | | | |

### 字段说明

- **集群**: `staging` / `production` / `pre-production`
- **加密方案**: `Vault Transit` / `AWS KMS` / `GCP KMS`
- **加密密钥 ID**: Vault transit key name / KMS key alias / GCP key ring
- **验证状态**: ✅ 已验证 decrypt / ❌ 未验证（需补验证）
- **备注**: 轮换记录 / 异常说明 / 补充信息

---

## Vault KV 路径

| 集群 | Vault KV 路径 | 说明 |
|---|---|---|
| staging | `secret/data/mate-platform/sealed-secrets-backup` | staging 主私钥加密产物 |
| production | `secret/data/mate-platform/sealed-secrets-backup` | production 主私钥加密产物 |

> **注意**: staging 和 production 使用同一个 Vault KV 路径但不同的
> Vault namespace / mount，通过 `cluster` 标签字段区分。

---

## 恢复演练日志

| 演练日期 | 集群 | 参与者 | RTO (实际) | 验证 SealedSecret 数 | 结果 | 改进项 |
|---|---|---|---|---|---|---|
| _YYYY-MM-DD_ | staging | _SRE 1, SRE 2_ | _Xh Ym_ | _N_ | ✅ Pass / ❌ Fail | _ticket #_ |
| | | | | | | |
| | | | | | | |

### 字段说明

- **RTO (实际)**: 从模拟丢失到恢复验证完成的总耗时
- **验证 SealedSecret 数**: 恢复后成功解密的 SealedSecret 数量（≥ 3 为合格）
- **改进项**: 演练中发现的问题对应的 ticket 编号

---

## 密钥轮换记录

SealedSecrets controller 默认每 30 天自动轮换主私钥。每次轮换后
应执行一次完整备份（§3 备份流程）。

| 轮换日期 | 集群 | 旧 key Secret 名称 | 新 key Secret 名称 | 备份状态 |
|---|---|---|---|---|
| _YYYY-MM-DD_ | staging | `sealed-secrets-keyxxxx` | `sealed-secrets-keyyyyy` | ✅ 已备份 |
| | | | | |
| | | | | |

---

## 审计追踪

| 审计日期 | 审计人 | 检查项 | 结果 |
|---|---|---|---|
| _YYYY-MM-DD_ | _Security Officer_ | 备份清单与实际 Vault KV 一致 | ✅ / ❌ |
| _YYYY-MM-DD_ | _Security Officer_ | 最近一次备份 ≤ 35 天 | ✅ / ❌ |
| _YYYY-MM-DD_ | _Security Officer_ | 最近一次演练 ≤ 1 季度 | ✅ / ❌ |
| | | | |
