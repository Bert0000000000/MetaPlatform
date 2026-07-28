# Blue-Green 切换 Runbook (ST-7.2.4)

## 概述

Mate Platform 使用蓝绿部署实现零停机切换。流程：
预发布 → 双写 → 流量分阶段（10% → 50% → 100%）→ 7 天观察 → 清理。

## 脚本清单

```
scripts/blue-green/
├── 01-namespace.yaml       # ST-7.1.1: K8s namespace + ResourceQuota + RBAC
├── 02-data-isolation.sh    # ST-7.1.3: stg_ 前缀数据隔离
├── 03-traffic-shadow.sh    # ST-7.1.4: 5% 流量影子
├── 04-dual-tag.sh          # ST-7.2.1: v_n + previous 双 tag
├── 05-weight-switch.sh     # ST-7.2.2: Traefik 权重切换
└── 06-auto-rollback.sh     # ST-7.2.3: 健康检查 + 自动回滚
```

## 完整流程

### 1. 预发布环境

```bash
kubectl apply -f scripts/blue-green/01-namespace.yaml
bash scripts/blue-green/02-data-isolation.sh
```

### 2. 部署新版本

```bash
# CI 自动触发
bash scripts/blue-green/04-dual-tag.sh tech-msg 20261010-1200
```

### 3. 流量分阶段

```bash
# 10% 切流
bash scripts/blue-green/05-weight-switch.sh tech-msg 10

# 监控 24h
# ... 

# 50% 切流
bash scripts/blue-green/05-weight-switch.sh tech-msg 50

# 监控 24h
# ...

# 100% 切流
bash scripts/blue-green/05-weight-switch.sh tech-msg 100
```

### 4. 健康检查 + 自动回滚

```bash
# 切 100% 后立即启动监控
bash scripts/blue-green/06-auto-rollback.sh tech-msg previous latest 60 1
```

5xx > 1% 持续 60s → 自动回滚到 `previous` tag。

## 关键检查点

| 阶段 | 检查项 | 失败回退 |
|---|---|---|
| 10% 切流 | 24h 内错误率 < 0.1% | 切回 0% |
| 50% 切流 | 24h 内错误率 < 0.1% | 切回 0% |
| 100% 切流 | 7 天 0 P0/P1 | 切回 previous |
| 7 天后 | 无重大问题 | 标 latest = v_n |

## 应急操作

```bash
# 立即回滚
bash scripts/blue-green/05-weight-switch.sh tech-msg 0

# 验证 current tag
docker tag ghcr.io/mate/tech-msg:previous ghcr.io/mate/tech-msg:latest
docker push ghcr.io/mate/tech-msg:latest
```

## 风险

- 🔴 R1: 单模块迁移失败无 Java 兜底 → 充分预演 + 7 天回退窗口
- 🔴 R2: 数据迁移 v_{n-1} 写入丢失 → 双向同步 3 天后再切
- 🟡 R3: 影子流量敏感数据泄露 → 脱敏后比对、不落库