# SealedSecrets 主私钥备份与恢复 Runbook

> **关联**: ADR-0010 §4.3 / 13 硬规则 §13 第 12 条（Secret 不进 git）
> **责任人**: Platform Owner / SRE on-call
> **状态**: Active
> **创建日期**: 2026-08-01

---

## 1. 目的

SealedSecrets controller 的主私钥（`sealed-secrets-key`）是整个平台
Secret 加密体系的根信任锚。一旦丢失：

- 所有已提交到 git 的 SealedSecret **不可解密** → 生产环境全部
  Secret 不可恢复（数据库密码、Kafka SASL 凭证、Keycloak client secret 等）。
- 平台无法启动 → 业务全面中断。

本 runbook 定义 **异地备份 + 季度恢复演练** 流程，确保主私钥在
灾难场景下可在 ≤ 4h 内还原。

---

## 2. 前置条件

| 项 | 要求 | 验证方式 |
|---|---|---|
| Kubeseal CLI | ≥ 0.27 | `kubeseal --version` |
| SealedSecrets controller | ≥ 2.16 | `kubectl get deployment -n kube-system sealed-secrets-controller` |
| kubectl 集群访问 | staging + production context | `kubectl config get-contexts` |
| 异地存储访问 | Vault Transit / AWS KMS / GCP KMS（推荐 Vault） | 见 §3.2 |
| SRE on-call 联系方式 | PagerDuty / 飞书群 | 详见 on-call schedule |
| 备份清单 | `docs/active/runbooks/sealed-secret-backup-inventory.md` | 存在且最新 |

---

## 3. 备份流程

### 3.1 从 K8s 提取主私钥

SealedSecrets controller 在 `kube-system` namespace 下创建一个名为
`sealed-secrets-key<suffix>` 的 Secret（type: `kubernetes.io/tls`），
包含 `tls.key`（私钥）和 `tls.crt`（证书）。

```bash
# 1. 找到当前的 sealed-secrets-key Secret
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key=active \
  -o name

# 2. 导出私钥 + 证书到临时文件（切勿提交到 git）
SEALED_KEY_SECRET=$(kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key=active \
  -o jsonpath='{.items[0].metadata.name}')

kubectl get secret -n kube-system "$SEALED_KEY_SECRET" \
  -o jsonpath='{.data.tls\.key}' | base64 -d > /tmp/sealed-secrets-key.key

kubectl get secret -n kube-system "$SEALED_KEY_SECRET" \
  -o jsonpath='{.data.tls\.crt}' | base64 -d > /tmp/sealed-secrets-key.crt

# 3. 验证密钥对完整性
openssl x509 -in /tmp/sealed-secrets-key.crt -noout -modulus \
  | openssl md5
openssl rsa -in /tmp/sealed-secrets-key.key -noout -modulus 2>/dev/null \
  | openssl md5

# 两个 MD5 必须一致 → 证明 key / cert 配对正确
```

### 3.2 加密到异地存储

**推荐方案：Vault Transit Engine**

```bash
# 前置：Vault 已启用 transit engine
# vault secrets enable transit
# vault write -f transit/keys/sealed-secrets-backup type=rsa-4096

# 加密私钥文件
vault write transit/encrypt/sealed-secrets-backup \
  plaintext=$(base64 -e /tmp/sealed-secrets-key.key) \
  -format=json | jq -r '.data.ciphertext' > /tmp/sealed-secrets-key.enc

# 加密证书文件
vault write transit/encrypt/sealed-secrets-backup \
  plaintext=$(base64 -e /tmp/sealed-secrets-key.crt) \
  -format=json | jq -r '.data.ciphertext' > /tmp/sealed-secrets-key-cert.enc
```

**替代方案 A：AWS KMS**

```bash
# 加密
aws kms encrypt \
  --key-id alias/mate-platform-sealed-secrets \
  --plaintext fileb:///tmp/sealed-secrets-key.key \
  --output text --query CiphertextBlob \
  | base64 -d > /tmp/sealed-secrets-key.enc
```

**替代方案 B：GCP KMS**

```bash
# 加密
gcloud kms encrypt \
  --key=sealed-secrets-backup \
  --key-ring=mate-platform \
  --location=global \
  --plaintext-file=/tmp/sealed-secrets-key.key \
  --ciphertext-file=/tmp/sealed-secrets-key.enc
```

### 3.3 存储加密产物

将加密后的文件存放到 **至少两个独立物理位置**：

1. **Vault KV v2**（primary）：`secret/data/mate-platform/sealed-secrets-backup`
2. **离线介质**（secondary）：USB 加密盘 / 公司保险柜

```bash
# 存入 Vault KV
vault kv put secret/mate-platform/sealed-secrets-backup \
  tls_key_enc=@/tmp/sealed-secrets-key.enc \
  tls_crt_enc=@/tmp/sealed-secrets-key-cert.enc \
  backed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  backed_by="$(whoami)" \
  cluster="<staging|production>"
```

### 3.4 清理临时文件

```bash
# 覆写并删除明文临时文件（防止磁盘恢复）
shred -u /tmp/sealed-secrets-key.key
shred -u /tmp/sealed-secrets-key.crt
# 加密临时文件也清理
rm -f /tmp/sealed-secrets-key.enc /tmp/sealed-secrets-key-cert.enc
```

### 3.5 更新备份清单

每次备份完成后，更新
[`sealed-secret-backup-inventory.md`](./sealed-secret-backup-inventory.md)，
记录备份时间、责任人、加密方案、验证状态。

---

## 4. 恢复流程

### 4.1 从异地解密还原

```bash
# 1. 从 Vault KV 取回加密产物
vault kv get -format=json secret/mate-platform/sealed-secrets-backup \
  | jq -r '.data.data.tls_key_enc' > /tmp/sealed-secrets-key.enc

vault kv get -format=json secret/mate-platform/sealed-secrets-backup \
  | jq -r '.data.data.tls_crt_enc' > /tmp/sealed-secrets-key-cert.enc

# 2. 用 Vault Transit 解密
vault write transit/decrypt/sealed-secrets-backup \
  ciphertext=@/tmp/sealed-secrets-key.enc \
  -format=json | jq -r '.data.plaintext' | base64 -d > /tmp/sealed-secrets-key.key

vault write transit/decrypt/sealed-secrets-backup \
  ciphertext=@/tmp/sealed-secrets-key-cert.enc \
  -format=json | jq -r '.data.plaintext' | base64 -d > /tmp/sealed-secrets-key.crt
```

### 4.2 重新 apply 到 K8s

```bash
# 1. 构造 K8s Secret manifest（不要提交到 git！）
cat > /tmp/sealed-secrets-key-restore.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: sealed-secrets-key
  namespace: kube-system
  labels:
    sealedsecrets.bitnami.com/sealed-secrets-key: active
type: kubernetes.io/tls
data:
  tls.key: $(base64 -w0 /tmp/sealed-secrets-key.key)
  tls.crt: $(base64 -w0 /tmp/sealed-secrets-key.crt)
EOF

# 2. Apply 到目标集群
kubectl apply -f /tmp/sealed-secrets-key-restore.yaml

# 3. 重启 SealedSecrets controller 使其加载新密钥
kubectl rollout restart deployment/sealed-secrets-controller \
  -n kube-system

# 4. 等待 controller 就绪
kubectl rollout status deployment/sealed-secrets-controller \
  -n kube-system --timeout=120s
```

### 4.3 验证现有 SealedSecret 可解密

```bash
# 1. 选一个已存在的 SealedSecret 做 decrypt 验证
TEST_SS=$(kubectl get sealedsecret -A -o jsonpath='{.items[0].metadata.name}')
TEST_NS=$(kubectl get sealedsecret -A -o jsonpath='{.items[0].metadata.namespace}')

# 2. 查看 controller 是否成功解密（status.conditions 应为 decompiled=True）
kubectl get sealedsecret "$TEST_SS" -n "$TEST_NS" -o jsonpath='{.status}'
# 预期输出: {"conditions":[{"type":"Synced","status":"True"}]}

# 3. 检查对应的 Secret 是否被正确创建
kubectl get secret "$TEST_SS" -n "$TEST_NS" -o jsonpath='{.data}' | jq 'keys'

# 4. 清理临时文件
shred -u /tmp/sealed-secrets-key.key /tmp/sealed-secrets-key.crt
rm -f /tmp/sealed-secrets-key-restore.yaml \
      /tmp/sealed-secrets-key.enc /tmp/sealed-secrets-key-cert.enc
```

如果验证失败（SealedSecret `status.conditions` 为 `Synced=False`），
说明密钥不匹配 → 检查备份版本是否正确，或回滚到上一个 controller 版本。

---

## 5. 演练计划

| 项 | 要求 |
|---|---|
| 频率 | **每季度 1 次**（Q1 / Q2 / Q3 / Q4） |
| 环境 | staging → 验证通过后在 production 复验 |
| 参与者 | ≥ 2 名 SRE（执行 + 审计） |
| 目标 RTO | ≤ 4h（从发现丢失到恢复完成） |
| 记录 | 演练结果写入 `sealed-secret-backup-inventory.md` 演练日志节 |
| 升级 | 演练失败 → 立即开 ticket 修复，不得推迟到下季度 |

### 演练步骤摘要

1. 在 staging 集群模拟主私钥丢失（删除 `sealed-secrets-key` Secret）。
2. 按 §4 恢复流程从异地备份还原。
3. 验证 ≥ 3 个 SealedSecret 可正确解密。
4. 记录 RTO 实际耗时。
5. 如 RTO > 4h → 分析瓶颈并开改进 ticket。

---

## 6. 责任人

| 角色 | 职责 | 联系方式 |
|---|---|---|
| **Platform Owner** | 本 runbook 的 owner；审批备份策略变更 | 见 on-call schedule |
| **SRE on-call** | 执行备份 / 恢复 / 演练；第一时间响应告警 | PagerDuty: mate-platform-sre |
| **Security Officer** | 审计备份清单；审批异地存储访问权限 | 见安全联系人目录 |

---

## 7. 关联文档

- [ADR-0010: Platform K8s Baseline](../decisions/ADR-0010-platform-k8s-baseline.md) §4.3
- [13 硬规则设计](../specs/2026-07-30-backend-production-readiness-design.md) §13 第 12 条
- [备份清单模板](./sealed-secret-backup-inventory.md)
- [GA-ACCEPTANCE](../delivery/evidence/GA-ACCEPTANCE.md) — 13 硬规则 §13 收口证据
- SealedSecret Helm chart: `infra/helm/charts/postgresql/templates/sealedsecret.yaml`（已有 SealedSecret 模式参考）
