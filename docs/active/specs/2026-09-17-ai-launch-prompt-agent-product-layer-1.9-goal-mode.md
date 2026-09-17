# GOAL 模式启动提示词 —— Agent 产品层 1.9（多副本与重启下的正确性）

> **必读**：`2026-09-16-agent-product-layer-env-facts.md`、`agent-team-dev-env-facts.md`、
> **`api/run_control.py` 顶部的行为说明**。1.0~1.8 已在 main（→ `b30043d0`）。

你是自主执行工程师。按任务 1→3 推进，每任务**先写 failing tests 再实现**，完成后跑验证并 commit。全部完成后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

1.0~1.8 把机制建起来了，但有几处**只在单进程、不重启的前提下成立**。本批让它们在**多副本 + 重启**下也正确：**续跑的真授权** / **取消信号跨副本** / **幂等跨副本竞态**。

## 锁死决策

- **不把令牌落库**（1.8 已定）。续跑要**与令牌分离的 per-run 授权**，最小够用、不可复用
- **取消跨副本**保住 1.5 语义：停闸门的 run 不受影响（终态已在检查点）；执行中的按**波边界**停，不硬断
- **幂等**：同 `Idempotency-Key` 并发提交**只能产生一个 run**
- **1.3~1.8 已定语义别破**（取消幂等 / 终态 409 / 越权转 proposal / 深度与跨租户硬拒 / 包络四维 / 重试幂等 / 证据 / Artifact / 202 受理 / SSE / 投影下放）
- **LangChain 类型不得进公开契约**（R10）；**不用 `interrupt()`**；**不用裸 dict 作状态 schema**

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`（首跑记基线，此后不得低于）；代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开分支；**契约先行**；中文加 `PYTHONIOENCODING=utf-8`；**新 operationId 同步登记 `REQUIREMENT-MATRIX.yaml`**。

**两个钩子（照做）**：`detect-private-key` 比 gitleaks 更宽（测试注释里也不能有私钥头连写，样本按片段拼）；`forbid_skip_tests` 禁 `skip`/`skipif`/`xfail` 但放行 `importorskip`——**跑不了的用例要么修前置、要么删、要么改成任何机器都成立的断言**。

## 任务 1 · 续跑的真授权

**现状**（`run_control.py:38-43` 自述）：续跑扫检查点，但**令牌刻意不进状态** → 重启后**没有链根包络** → 需授权的那一步 **fail-closed 转待授权提案**。

设计**与令牌分离**的 per-run 派活授权，让续跑那段**真能跑**（不是伪造"跑完了"）。
**判据**：起 run → **执行中重启** → **续跑真跑到底**；**授权不能跨 run 复用**（负例）；**令牌仍未落库**（断言）。

## 任务 2 · 取消信号跨副本

**现状**：控制面「**不持有任何 run 历史**」，取消标志在**进程内存** → 副本 A 起的 run，副本 B 取消不到。

让取消信号**跨副本可见**，保住 1.5 语义。
**判据**：**模拟多副本**（两个控制面实例共享检查点）→ 在另一副本取消，**生效**；停闸门的语义不变。

## 任务 3 · 幂等跨副本竞态

**现状**：1.7 自标"幂等跨副本有极小竞态"。

消除竞态，或**明确写成边界并给出可复现判定**。
**判据**：并发同 `Idempotency-Key` → **只产生一个 run**；跨副本同样成立。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

既有链路**不得回归**（主链 / 闸门 / 包络四维 / MCP 租户绑定 / 双向消息 / 运行控制 / 重试 / 证据 / Artifact / SSE / 投影 / 续跑）。

## 报告

任务 1~3 结果 + 回归 + 基线→最终 + commits + PR + 遗留。

## 边界

不接 Codex / dsh（**本机 CLI 未登录，只能验到 CLI 契约**）；不做嵌套子图等编排深度。
不重写本体引擎 / SkillHub / MCP 中心；**不换 LLM 通道**；不让 LangChain 类型漏进契约。
不用 `interrupt()`；不用裸 dict 作 schema；建表不用服务角色；断言不用 `meta`；secret 不进 git。
