# GOAL 模式启动提示词 —— Agent 产品层 2.1-C（产品统一）

> **必读**：`2026-09-17-agent-product-layer-2.1-roadmap.md` **§4**（七条定义）；
> `MetaPlatform-调整优化方案执行计划-2026-09-17.md`（量化准出以它为准，只引用不重定义）；
> `AGENT-PRODUCT-LAYER-2.1-B-ACCEPTANCE.md`（上一批产出与自标边界——**本批要接住它的 A1**）。
> **2.1-A / 2.1-B 均已合并**，基线 **501 passed / 0 skipped**。

你是自主执行工程师。按依赖并行/串行；每条做完跑验证并 commit，最后输出本批
`AGENT-PRODUCT-LAYER-2.1-C-ACCEPTANCE.md`。

## GOAL

把两条并行的东西收敛成一条：
**Conversation → AgentRun → Runtime → Task/ToolInvocation → Evidence/Proposal/Artifact**。
本批是**产品统一**——与 A/B 的硬化不同，**它会动前端与契约**。

## 顺序与硬前置

- **C-2 先评审再动手**：ADR-0065 现在仍是 **Proposed**，**不得为赶进度偷偷升格**。
  走完评审转 Accepted，再按 S1~S3 实施
- **C-1 是 C-3 的前置**：会话↔run 不落后端，新旧合并就没有关系源
- 其余可并行

## 锁死决策

- **C-1 后端是唯一关系源**：新增 `conversation_run` + `GET /runs?conversation=`；
  前端 localStorage 降级为缓存
- **C-3 旧 copilot loop 明确标 Legacy + 给退役版本**，不做「两套平级」的默认长期共存
- **C-4 别再覆盖写**：现状同 ID `ON CONFLICT DO UPDATE` 会把上一版盖掉 ——
  加 `version` + `immutable_digest`；小文本留 PG、大文件进对象存储、元数据统一 PG
- **C-5 不许静默切换 Runtime**：`profile_store` 加 `runtimes` 列 + HTTP 暴露 + 管理界面；
  配置要能落库、重启后保持
- **C-6 的底子比先前稳**：`llmgw-fallback-hardening`（#57）已做「员工路径禁回显 +
  上游超时可配」——**先确认它生效**，再建 Golden Dataset
- **C-7 关联键统一**：`tenant_id / run_id / task_id / trace_id / conversation_id`

## 硬约束

13 硬规则；只用 `.venv`（基线 **501 passed / 0 skipped，只升不降**）；Conventional Commits +
**按文件 add**；中文加 `PYTHONIOENCODING=utf-8`；分支 `feat/agent-product-layer-2.1-c`；
**新增 HTTP 面先进契约 + 登记 `REQUIREMENT-MATRIX.yaml`**（本批会加端点，这条是硬门槛）。
**前端**：dev server 9250；**dev 模式 Semi Button 的 `onClick` 是 noop**，交互按钮用原生 `<button>`。

## 准出

① 换机器 / 清浏览器 → 会话仍看得到历史轮次的 run（后端是唯一关系源）
② **ADR-0065 转 Accepted** 且有评审记录；选中对象提问 → Agent 先按 RID 查新数据
③ 只剩一条 Agent 主线；旧 copilot loop 有 Legacy 标注与退役版本
④ Artifact 有 `version` + `digest`；重跑不覆盖旧版，**能证明第一次交付了什么**
⑤ 员工 Runtime 配置从管理界面落库、重启后保持，且不静默切换
⑥ Golden Dataset 在真实 provider 上跑出基线数字
⑦ Span 分层 + token / 成本可查
⑧ **接住 2.1-B 的 A1**：真集群里杀一个正在跑的 Pod → 30s 内被接管续跑（端到端）

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

前端 `pnpm test:unit && pnpm typecheck`，**并且浏览器实跑**（不是只跑单测）。
动到 ACL 层时 `packages/mate-clients/tests` 也跑。

## 报告

七条结果 + 回归数字 + commits + PR + 本批 `*-ACCEPTANCE.md` + **发现但未做的建议**。

## 边界

**ADR-0065 升格要走评审，不是写代码**；secret 不进 git；
MCP 协议面 / `tenant_switch_enabled` 仍归 `MP-MCP-TENANT-SECURITY-01`；
`MP-REPLICA-READINESS-01` 的 kind 脚本值得收进 CI（2.1-B 建议 2）——**顺带做，别单开批次**。
