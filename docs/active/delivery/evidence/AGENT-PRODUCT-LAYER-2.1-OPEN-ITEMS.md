# AGENT-PRODUCT-LAYER-2.1 · 未收尾清单（跨 A / B / C 收口）

> 2026-09-18 · 基线：`main` = `34e6a664`（PR #63 合并后）
> 性质：**不是验收证据**，是 2.1 三批交付后的**未收尾事项登记**——每条给出处。
> 来源：`AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §3、`…-2.1-A-ACCEPTANCE.md` §4/§6、
> `…-2.1-B-ACCEPTANCE.md` §4/§6、`…-2.1-C-ACCEPTANCE.md` §3/§6，逐条核对后汇总。
>
> **2026-09-18 closeout 批更新**：§1（MP-MCP-TENANT-SECURITY-01）、D1（oasdiff 名义覆盖）、
> D5（控制面口令）、D2 的登录超时子项已收口——证据见
> `AGENT-PRODUCT-LAYER-2.1-CLOSEOUT-ACCEPTANCE.md`（决策记录 ADR-0068）；其余条目不变。

## 0. 总况

| 批 | PR | 状态 | 测试 |
| --- | --- | --- | --- |
| 2.1-A 生产安全收口 | #59 → `4e33e304` | ✅ 已合并 | 357 → **415** |
| 2.1-B 分布式运行时收口 | #61 + #62 → `cd57883a` | ✅ 已合并 | 415 → **501** |
| 2.1-C 产品统一 | #63 → `34e6a664` | ✅ 已合并 | 501 → **593** |

2.0 边界表 10 条的最终去向：**闭合 5**（B-2 归档 / B-3 异步取消 / B-4 租约 / B-5 早闭合 / B-8 ADR-0065 转 Accepted）、**机制闭合剩环境验证 3**（B-1 token exchange / B-6 CLI 登录 / B-7 A2A 对端）、**未启动 1**（B-9 v6 dsh）、**待安全复核 1**（B-10 → 本清单 §1）。

## 1. 最优先：`MP-MCP-TENANT-SECURITY-01`（有生产实证）

**租户切换安全边界（`tenant_switch_enabled` + 共享 client 收窄）**——从 2.0 的 B-10 传到现在，未立项执行。

**2.1-C 给了它第一条生产形态的实证**（`…-2.1-C-ACCEPTANCE.md` §3-A4）：接管成功后 run 继续推进，但恢复出来的调用被 llmgw 拒——

```text
403 tenant binding rejected: X-Tenant-Id header is present and differs
from the token tenant, but tenant switching is not enabled
```

2.1-B 验的「接管」与 2.1-A 验的「委托身份」各自成立，**拼起来的最后一步卡在这里**。
2.1-C §6-2 原话："本批最该接着查的一条"。建议把它作为下一批的第一件事，
并把 2.1-C §5.7 的实测记录当输入带过去。

## 2. 环境条件类（代码到位，缺环境——不是代码缺口）

| # | 事项 | 卡在哪 | 出处 |
| --- | --- | --- | --- |
| E1 | 真 CLI 端到端（Claude Code） | `claude -p` 回 Not logged in；也是 v6 轨道（2.0 B-9）的前置 | 2.0 B-6 → 2.1-A A2 → 2.1-B A2 |
| E2 | token exchange 端到端 | Keycloak 未配该 client 的 exchange 权限；四种负例已验 | 2.1-A A1 |
| E3 | ADR-0065 指代消解端到端 | 需真实 provider + 本体有真实实例；本机 `/ontology/objects` 0 行 | 2.1-C A1 / B1 |
| E4 | pod-kill 端到端进 CI | 需 staging 全栈（脚本与可判的门已交付） | 2.1-C §6-6 |
| E5 | kind multi-replica job 首次 CI 实跑 | 本机过两次；CI 侧待观察 | 2.1-C §6-7 |

## 3. 欠账类（有归属、未排期）

| # | 事项 | 归属 / 建议 | 出处 |
| --- | --- | --- | --- |
| D1 | **oasdiff 对 agent-team 是名义覆盖**（bundle 不含它，breaking-change 从没看过本服务一眼） | 单独收口：并进 `platform.yaml` 或如实改名 | 2.1-C C1 / §6-4 |
| D2 | `ProposalConfirmDrawer` 预存红 + `test_recovery` flaky + 登录 helper 30s 超时 | `MP-QA-BASELINE-01` | 2.1-A B4/B5、2.1-C §6-5 |
| D3 | pyright 295 errors（kernel 治理，非 required 红） | 独立工程，已量化（六类三包） | 2.1-A B7 |
| D4 | `github-advanced-security` 红 | GitHub 侧模型不可用，从仓库修不了 | 2.1-A B8 |
| D5 | 控制面口令走 `--set` 非 Secret 引用（chart 已留 `secretRef.keys` 位） | 生产 values 接上 | 2.1-B A3 / 建议 3 |
| D6 | A2A 长任务（轮询 / 中途取消 / trace） | 无真实对端，缓做 | 2.1-B B1 |
| D7 | `model_cost` 填不上（llmgw 无价格字段；"算它就得编费率"） | 接价格源再填 | 2.1-C A2 |
| D8 | 默认接管 31.1s 略超 30s 预算（TTL=15/扫描=5 实测 17.2s） | `MP-STAGING-GATE-01` 真实负载下定 | 2.1-C §6-3 |
| D9 | `PgRunIndex` 控制面 DSN 只授 checkpoints SELECT | 扩表时同步扩授并登记 | 2.1-B 建议 4 |
| D10 | gate_type 只有 `plan_gate`；第二种闸门出现时 `required_roles` 层级语义要重判 | 有需求再做 | 2.1-B B2 / 建议 5 |
| D11 | 小项：navigate 卡片只挂会话页（Dock 不渲染）/ 点击行不更新 `openRecordIds` / C-6 重启一致率 `--repeat 2` 未跑（`not_computed`）/ MinIO 未接 / marking 只记不强制 / 批量运维面 / skill 正文摘要不进快照 | 各自小切片 | 2.1-C A3/B2/B3/B4/B5/B6、2.1-A C5 |

## 4. 组织 / 流程决策

| # | 事项 | 说明 |
| --- | --- | --- |
| O1 | approval 规则集开不了 | 仓库仅一个 collaborator；GitHub 不许作者自批——开了所有 PR 立刻冻结。需第二个评审人 / bot |
| O2 | 「连续 10 次合并 required 全绿」 | 观察性判据，**4/10**（#60~#63 全绿；ga-acceptance 在 main 最近 3 连 success）。继续合并别红即可 |

## 5. 状态同步（本清单随批完成的）

| # | 事项 | 处理 |
| --- | --- | --- |
| S1 | roadmap §8.3 的 2.1-B / 2.1-C 行停在「已规划，待开工」 | **本批已同步**（两份 roadmap 均改） |
| S2 | 2.1-B / 2.1-C 的 goal-mode 提示词未跟踪 | **本批落档** |
| S3 | 平台季度计划（`MetaPlatform-调整优化方案执行计划-2026-09-17.md`）未跟踪 | **仍是维护者在途文档，不代提交**；§8.2 的 11 个新批次号仍待它接纳 |
| S4 | 2.1-A 验收文档的三处小缺陷（B8 行重复 / §5.4 括号未闭合 / §5.4「9 条」与 §5.5「11 条」口径不一致） | 未修，留给下次动该文件时顺手 |

## 6. 建议的下一步顺序

1. **`MP-MCP-TENANT-SECURITY-01`**（§1——带着 2.1-C §5.7 的实测输入去做；做完「续跑到底」才真正成立）
2. **D1 oasdiff 名义覆盖**（契约保护是空心的，越晚修越危险）
3. **E5 / O2**（被动观察项，无需主动做）
4. 其余按 `MP-STAGING-GATE-01` / `MP-QA-BASELINE-01` 的排期走
