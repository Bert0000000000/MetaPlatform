# GOAL 模式启动提示词 —— Agent 产品层 2.1-A（生产安全收口）

> **必读**：`2026-09-17-agent-product-layer-2.1-roadmap.md`（本批范围与判据在这里，**含批次号对照表 §8**）、
> `MetaPlatform-调整优化方案执行计划-2026-09-17.md`（**平台级季度计划，本批挂靠在它之下**——
> 量化准出以它为准，本批只引用不重定义）、
> `agent-product-layer-roadmap.md`、`agent-product-layer-env-facts.md`、
> `AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md`（§3 边界表——**13 条是已登记取舍，别当新账**）。
> 体例参考 `AGENT-PRODUCT-LAYER-1.1-ACCEPTANCE.md`（在 `delivery/evidence/`）。

**本批对外批次号**（`MP-*` 体系，与平台计划一致）：

```text
MP-AGENT-SANDBOX-ISOLATION-01   外部 Runtime 环境变量白名单（K8s Job 部分留 2.1-B）
MP-AUDIT-LEDGER-01              持久、可取证、带哈希链的 Agent 审计
MP-RUN-DELEGATED-IDENTITY-01    运行期委托身份（平台计划已有该批次号）
MP-TOOL-IDEMPOTENCY-01          工具调用级幂等账本
MP-AGENT-VERSIONING-01          State / Graph 版本化 + 员工不可变 Revision
MP-MAIN-GATE-01                 required check 收口 + CODEOWNERS + 修 CLAUDE.md Prettier
MP-FEATURE-REGISTRY-01          文档与版本口径订正（平台计划已有该批次号）
```

> **注意**：除 `MP-RUN-DELEGATED-IDENTITY-01` 与 `MP-FEATURE-REGISTRY-01` 外，
> 其余 5 个是**本文件新提的建议编号**，尚未被平台计划接纳。开工前若平台计划维护者
> 已另行编号，**以那里的为准**。

你是自主执行工程师。**七条任务按依赖并行/串行**；每条做完跑验证并 commit，
最后输出报告 + **本批的 `AGENT-PRODUCT-LAYER-2.1-A-ACCEPTANCE.md`**。

## GOAL

把五条生产性质从「机制存在」变成「**有判据、可复现、能拦住**」：

```text
副作用最多一次 / 权限撤销后不能扩权 / 审计可取证 / 外部进程不泄漏宿主 / 门禁真拦
```

**本批不扩功能面**。新员工类型、新图节点、新编排能力都不做。

## 锁死决策

- **A-4 第一个做**：其余是可靠性/治理问题，**只有它是当下就在生效的凭据暴露面**
  （`runtimes/claude_code.py:190` `env = {**os.environ, **self._env}`）
- **A-2 必须先出 ADR**：2.0 的 B-1「要做的条件」写明「动 llmgw / MCP 协议面之前要先有 ADR」。
  **不写 ADR 不许动这两处**
- **不落原始 Bearer**（1.9 立的硬约束）：delegation 只存
  `run_id / granted_by / envelope / expires_at`，**没有凭据**
- **A-3 的幂等键固定为** `run_id + task_id + tool_call_id`——**不要**另发明一套
- **A-6 的 Snapshot 不可变**：Run / SubTask **永远引用 Snapshot**，不读可变 Profile 最新值
- **A-5 的核心是拆 job**：格式红灯可以拦合并，但**不该让真正的验收整体缺失**
  （现状 Prettier 一红，`mate-platform/tests` 等 **4 个 step 全 skipped**）
- **A-7 只做口径订正，不夹带**：三处 Sprint 1A 说法（`CLAUDE.md:6` /
  `architecture-implementation.md:12,167,853` / `V1.0-RELEASE-PLAN.md:175,220`）
  **以 `git log` 与验收证据为准**，不要猜测
- **复用既有**：审计投递用**平台既有 Outbox**；delegation 优先 **Keycloak token exchange**；
  连接池 `psycopg[binary,pool]` **已声明**。**别自研**（用户 2026-09-16 定的原则：
  能用强大的功能就不要自研，自研需正面理由）

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`（**首跑记基线，此后不得低于 357**）；
代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；
从 main 开 `feat/agent-product-layer-2.1-a`；中文加 `PYTHONIOENCODING=utf-8`。

**新增 HTTP 面必须先进契约**（规则 #1）：审计查询 / event log / runtime 配置类端点，
要同步登记 `docs/active/delivery/REQUIREMENT-MATRIX.yaml`——**反向也查**
（矩阵里有而契约没有同样报错）。

**三个会咬到自己的钩子**（本地先行一遍，比 CI 转一圈便宜）：

- `detect-private-key` 比 gitleaks 更宽——**测试注释里都不能有私钥头连写**，样本按片段拼
- `forbid_skip_tests` 禁 `skip` / `skipif` / `xfail`，**放行 `importorskip`**
- `Lint (ruff)` 跑的是 `ruff format`，不只是 `check`；改 `contracts/**/*.yaml` 会被 `prettier` 咬

## 七条

| # | 任务 | 判据（可复现） |
| --- | --- | --- |
| **A-4** | 外部 Runtime 环境变量白名单 | 断言子进程 env **不含** DSN / Service Secret / Keycloak 配置；`{**os.environ, ...}` 被替换 |
| **A-1** | 持久审计（Outbox + 哈希链） | 重启后可查；多副本合并一致；**篡改可检出**；跨租户查询被拒 |
| **A-2** | Run Delegation Token（**先 ADR**） | 重启续跑**以用户身份**过 llmgw / MCP；**权限撤销后旧 run 不能扩权**；快照断言原始 Bearer 零落库 |
| **A-3** | ToolInvocation 幂等账本 | 工具执行**任意时刻** kill → 恢复后**副作用最多一次**（带计数的假外部系统作桩） |
| **A-6** | State / Graph / Profile 版本化 | 旧 checkpoint fixture → 新代码读取 → 恢复 → **结果一致**；Run 中途改员工定义**本轮行为不变** |
| **A-5** | 门禁收口 | `main` **连续 10 次合并** required 全绿；GA 的 `mate-platform/tests` **真跑过**（非 skipped） |
| **A-7** | 文档与版本口径订正 | 三处口径与 `git log` 对得上；`pyproject.toml` 版本不再是 `0.1.0` / 不再写「1.0」 |

## 准出（五条，全过才算收口）

```text
1. 进程在工具执行任意时刻被 kill → 恢复后业务副作用最多一次
2. 用户权限被撤销 → 旧 Run 不能继续扩权执行
3. 任何审批 → 重启后仍可查完整记录（审计可取证、可检篡改）
4. 外部 CLI 子进程 → 看不到任何宿主凭据
5. main → 连续 10 次合并全部 required check 通过
```

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

基线 **357 passed / 0 skipped**，本批**只升不降**。
A-5 的 required check 收紧**必须用临时探针验证真卡住再 revert**（1.6 的做法，见 `5b81e97a` → `e6b17de0`）。

## 报告

七条结果 + 回归数字 + commits + PR + 本批 `*-ACCEPTANCE.md`，以及**发现但未做的建议**
（含：动 MCP 协议面时**连带复核 2.0 的 B-10 `tenant_switch_enabled`**）。

## 边界

**不扩功能面**；2.1-B / 2.1-C 的条目（lease / event log / 连接池 / 会话↔run / ADR-0065）**本批不碰**；
**Temporal 的 Sprint 1A 完成度存在文档矛盾**（见规划 §1.2）——**不能拿「容器在跑」当已上线证据**，
若本批要根据它做判断，**先把 A-7 做完**；secret 不进 git。
