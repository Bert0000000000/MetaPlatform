# ADR-0041: Session Sandbox（用户级会话沙箱）

> 状态：Draft v0.1 · 日期：2026-08-06 · 决策人：TBD
>
> 上游：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §5
> 关联：MP-SESSION-01 / MP-SUPER-COPILOT-01 / MP-AGENT-ORCH-01

## 1. 背景

蓝图 v0.4 要求：每用户每会话独占上下文；用户之间信息不能相互影响；多用户并发与 SuperAI 编排必须在沙箱内完成。Function Sandbox（ADR-0040）只覆盖"调用级"，本 ADR 覆盖"用户级"。两者必须独立，生命周期不同。

## 2. 决策

### 2.1 Session Sandbox 7 条硬要求

1. **每用户每会话独占上下文** —— Redis 命名 `session:{tenant}:{user}:{sid}`，按 sid 强制归属
2. **上下文加密存储** —— DEK 来自 KMS；会话内容用 AES-256-GCM 加密后存 Redis
3. **跨会话默认隔离** —— 旧会话偏好/历史**不**自动注入新会话，需 opt-in
4. **跨域访问严格继承租户 + 用户身份** —— Session 颁发 token 时绑定 user_id+tenant_id；Function Sandbox 拿到 token 后由 mate-platform 验签
5. **Plan 持久化 + 严格归属** —— PG `session_plans(rid, session_id, dag_json, status, ...)`；RLS 按 tenant_id；plan 不能跨会话引用
6. **超时/配额** —— 默认 30 分钟，可配 24h；超时会话强制 `archived` 状态
7. **会话结束清理** —— 默认 `retention_policy=discard`（GC 即清）；可 opt-in `keep_7d`

### 2.2 决策点收口

| 决策点 | 选项 | 落地 |
|---|---|---|
| C1 | 默认 30 分钟，可配 24h | `session.ttl_seconds` 字段，30 min / 24h / 自定义 |
| C2 | opt-in | `session.preferences.cross_session: enabled` 默认 false |
| C3 | 默认不保留，可 opt-in 7 天 | `session.retention_policy: discard \| keep_7d`，默认 `discard` |
| C4 | 同步 | 多设备共用 plan + history，写走 outbox + Redis Stream 广播 |

### 2.3 凭证流

```
用户登录（JWT）
  → 创建 Session（POST /api/v1/session/start）
       → 颁发 session_token（30 分钟）
            → Orchestrator 进入循环
                 → Plan 节点 → Function Sandbox 拿 service-to-service 凭证
                      → 凭证由 mate-platform 用 session_token 派生
            → Plan 写回 session_plans（带 session_id）
  → 用户登出 / 超时 → Session archived
       → GC sweeper 按 retention_policy 清理
```

### 2.4 多设备同步（C4）

- Session 状态是**逻辑单实例、物理多副本**
- 写路径：所有变更走 `mate_platform.messaging.outbox` + Redis Stream 广播
- 读路径：客户端订阅 `session:{tenant}:{user}:{sid}` Stream
- 冲突解决：Last-Write-Wins，按 `correlation_id` 排序

### 2.5 Plan 状态机

```
planning → awaiting_user → running → completed
                  ↑           ↓
                  └─── aborted (用户取消)
```

- `awaiting_user`：HITL 强制点（决策点 B3），不下发到 Function Sandbox
- `running` → `awaiting_user`：当 ActionType 含 marking 变更 / 跨域写 / 大额操作时自动进入
- 用户 UI 弹出确认 → 签字 → `running` 续跑

### 2.6 OWASP LLM Top 10 对位

| 风险 | Session 承担 |
|---|---|
| LLM01 Prompt Injection | session 入口对用户输入做长度/编码/敏感词清洗；prompt 模板与用户内容结构上隔离 |
| LLM06 Excessive Agency | 每会话 `tools[]` 白名单来自该用户角色（不是 Agent 默认值） |
| LLM07 System Prompt Leakage | 错误日志禁记 user 文本，只记 hash + 长度 + session_id |

## 3. 跟 ADR-0040 的关系

| 维度 | Session Sandbox | Function Sandbox |
|---|---|---|
| 隔离对象 | 对话上下文、Plan、素材、用户偏好 | 代码进程、网络、文件 I/O、密钥 |
| 生命周期 | 30 分钟到 24 小时 | 几秒到几分钟 |
| 凭证 | 会话 token（用户→session） | service-to-service（session→function） |
| 等级 | L2 容器 | L2 容器 / L3 MicroVM |
| 持久化 | Redis 加密 + PG `session_plans` | 无（关掉即丢） |

**关键不变量**：Function Sandbox 永远拿不到原始 JWT；只能拿 session 颁发的派生 token。

## 4. 跟 13 硬规则对位

| 硬规则 | Session 承担 |
|---|---|
| ③ 没有 tenant 不访问 repo | session_token 含 tenant_id；Function 入口校验 |
| ⑨ 没有审计/指标/trace | OTel span `session.start / session.step / session.end` + ADS 事件 |
| ⑫ Secret 不进 git | DEK 不进日志 / 不进 outbox 事件体 |
| ⑬ NetworkPolicy default-deny | 沙箱专用 NetworkProfile |

## 5. 验收

- 7 条硬要求各 ≥1 集成测试
- 跨用户 negative 测试 ≥20 条
- 多设备同步压测 ≥100 并发
- GC sweeper 验证（discard / keep_7d 两条路径）
- OWASP 3 类风险攻防测试
- 13 硬规则对位

## 6. 影响

- `mate-platform/auth` 新增 `session.py`（颁发表 + 派生）
- `mate-platform/session/` 新包（context / preferences / retention / gc_sweeper）
- `mate-clients/redis/keys.py` 扩展 `session:*` 命名空间
- `infra/helm/function-runtime` 启用 session NetworkProfile
- PG 新表 `session_plans`
- Redis 新 stream `session:{tenant}:{user}:{sid}`

## 7. 替代方案与拒绝理由

- **每会话独占 K8s Pod**：被拒——成本太高（30 分钟级 vs 几秒级混部）
- **不加密上下文（明文 Redis）**：被拒——合规要求加密静态数据
- **跨会话偏好自动加载**：被拒——决策点 C2 选 opt-in
