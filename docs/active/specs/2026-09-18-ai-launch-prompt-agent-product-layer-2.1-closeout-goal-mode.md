# GOAL 模式启动提示词 —— Agent 产品层 2.1 收尾批（closeout）

> **必读**：`AGENT-PRODUCT-LAYER-2.1-OPEN-ITEMS.md`（`delivery/evidence/`，未收尾清单，
> 逐条带出处）+ `…-2.1-C-ACCEPTANCE.md` **§3-A4 与 §5.7**（主任务实证输入）。
> 2.1-A/B/C 已全部合并（357→**593 passed**）。

**批次号**：主 `MP-MCP-TENANT-SECURITY-01`（平台 S2 已有）+ 新提 `MP-CONTRACT-COVERAGE-01`。

你是自主执行工程师。按依赖并行/串行；每条做完跑验证并 commit，
最后输出本批 `AGENT-PRODUCT-LAYER-2.1-CLOSEOUT-ACCEPTANCE.md`。

## GOAL

把收尾清单里**代码可做**的四件做掉，让「接管 → 续跑**到底**」真正成立。
环境条件类（真 CLI / token exchange 端到端 / A2A 对端 / staging）**不在本批**。

## 任务一（主）· 租户切换安全边界收口

**实证**（2.1-C §3-A4，故障路径真撞的）：接管成功后续跑的调用被 llmgw 拒——
`403 tenant binding rejected … tenant switching is not enabled`。
2.1-A 的委托身份 + 2.1-B 的接管**各自成立，拼起来卡在这**。
方案（2.0 边界表 B-10）：① 专用 MCP client + SealedSecret；② token exchange 短时令牌；
③ 维持共享 client。**2.1-A 的 A-2 已实现 token exchange 签发面**——先评估 ② 是否正解。
**约束**：不得松成「任何持共享密钥者可代任意租户」；动 llmgw / MCP 协面前先定
是否补 ADR（ADR-0067 是基础）。

**判据**：复跑 §5.7 的 ⑧，接管后**续跑到底**（不再 403）；负例：共享密钥**不能**
代任意租户；决策落 ADR 或修订。

## 任务二 · oasdiff 名义覆盖收口（清单 D1）

agent-team **不在** `platform.yaml` 打包的 bundle 里，`breaking-change` job 对本服务
从没看过一眼（2.1-C C1）。二选一：并进 bundle，或把 job 覆盖面**如实**写进名字。
顺带核对 `mate-app-copilot` 是否同样漏在 bundle 外。

**判据**：故意做一次破坏性契约改动，oasdiff **能抓到**（探针 → revert）。

## 任务三 · 小件（D5 / D2-登录）

- 控制面口令 `--set` 改 Secret 引用（chart 已留 `secretRef.keys` 位）
- e2e 共用登录 helper 30s 超时写死 → 环境变量可配（本机尖峰 30s+ 假红；三个 spec 抄了同段）

## 硬约束

13 硬规则；只用 `.venv`（基线 **593 passed / 0 skipped，只升不降**）；Conventional Commits +
**按文件 add**（并发会话在改同仓文件，别用 `-u`/`-A`）；中文加 `PYTHONIOENCODING=utf-8`；
分支 `feat/agent-product-layer-2.1-closeout`；改 `contracts/**/*.yaml` 先过
`npx --yes prettier@3.1.0 --check`。**钩子**：`ruff format` 不只是 check；rule 4 别裸 httpx；
禁 `skip`/`skipif`/`xfail`（放行 `importorskip`）。

## 准出

① ⑧ 复跑：接管后续跑**到底**（不再 403），全程有审计行
② 共享密钥代任意租户的**负例**存在且被拒
③ oasdiff 探针证明 agent-team 契约**真被看着**（抓到后 revert）
④ 控制面口令无明文 `--set`；登录超时可配
⑤ 环境类未做项（E1~E5）**如实登记**，不留空

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

动到 copilot / ACL 时对应套件也跑。⑧ 复跑按 §5.7 脚本（注意 §3-C7/C8 的坑：
`BUILD_IMAGE=1` 别用 auto、pod-kill 选副本要筛 Running）。

## 报告

四件结果 + 回归数字 + commits + PR + 本批 `*-ACCEPTANCE.md` + **发现但未做的建议**
（含：31.1s 接管默认值归 `MP-STAGING-GATE-01` 定 / pyright 295 独立工程化）。

## 边界

**不扩功能面**；v6 / A2A 长任务 / MinIO / marking 强制 / 批量运维面不做（D6/D11）；
「连续 10 次合并全绿」是观察项（4/10），**无需动作**；平台季度计划不代改不代提交。
