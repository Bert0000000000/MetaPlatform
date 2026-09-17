# LLMGW-FALLBACK-HARDENING · 验收证据

> 日期：2026-09-17 · 分支：`feat/llmgw-fallback-hardening` · 基线：`origin/main` = `2a74df8d`
> 目标：Agent 产品层的员工**拿不到假回执** —— 上游不可用时宁可如实失败，
> 也不要一个"把指令抄回来"的假答复；同时把写死的 30s 上游超时做成可配。
> 上游设计：`docs/active/specs/2026-09-17-llmgw-fallback-hardening.md`

## 0. 测试基线 → 最终

| 项 | 值 |
| --- | --- |
| 开工基线（`mate-tech-llmgw` + `mate-tech-agent-team` + `mate-clients`） | **689 passed / 0 skipped** |
| 最终（同三套） | **698 passed / 0 skipped** |
| 差值 | **+9**（本批新增用例数） |

另跑 `mate-app-copilot`（同样经 llmgw）：**248 passed**，无回归。

## 1. 问题（一句话）

llmgw 在上游不可用时**把输入原样抄回来**冒充答复（`[stub-fallback] … Echo: …`）。
Agent 产品层的员工拿到这种产出时 `status` 仍是 `ok` —— 人看到"有结论"就信了。
这正是 1.0 立项时要消灭的**假回执**，只是成因不是缺配置。

**定性**：这**不是生产安全洞**——硬规则 #5 已用 `is_production_profile()` 把回显
挡在生产之外。本批治的是 **dev 保真度**：在本机你分不出"模型答了"和"把指令抄回来"。

## 2. 做了什么

| # | 改动 | 落点 |
| --- | --- | --- |
| 1 | `RealChatRequest` 加**可选** `allow_stub_fallback`（默认 `true`） | `mate-tech-llmgw/api/routes.py` |
| 2 | 回显闸门变三重：生产 profile · 带 tools 的决策调用 · **调用方显式关闭** | 同上 |
| 3 | **兜底链同样受管**——换条链接着编一个，等于把闸门绕过去 | 同上 |
| 4 | 上游超时 30s → 可配（`LLMGW_UPSTREAM_TIMEOUT`，默认 **90s**） | 同上 |
| 5 | `LlmgwClient` 加同名开关（默认 `true` 不改别人） | `mate-clients/llmgw/client.py` |
| 6 | agent-team 装配传 `allow_stub_fallback=False` | `mate-tech-agent-team/wiring.py` |

**契约**：`/api/v1/llmgw/chat/real` 此前**不在契约里**（代码有路由、Swagger 没有，
规则 1 的既有漂移）。本批把它正式声明（路径 + 两个 schema + operationId
`llmgwPostLlmgwChatReal` + `platform.yaml` 的 `$ref` + 追溯矩阵条目），
新字段才谈得上"契约先行"。

## 3. 判据对照

| # | 判据 | 结果 | 出处 |
| --- | --- | --- | --- |
| 1 | 超时可配，且默认值下 reasoning 模型那次调用能跑完 | ✅ 实跑日志 **0 次 timeout** | §4 |
| 2 | 员工调用**拿不到回显**：上游失败时该员工失败，产出不含 `[stub-fallback]` | ✅ 单测 + 实跑均无回显 | §4、§5 |
| 3 | **不改其它调用方的既有行为**（默认仍可回显） | ✅ 不带该字段 → 200 + `fallback:true`（回归用例） | §5 |
| 4 | 生产 profile 门没松 | ✅ `is_production_profile()` 时仍一律不回显 | §5 |

## 4. 实跑证据（容器内真跑一轮）

`POST /api/v1/agent-team/runs`（goal = "audit this month order data quality…"，
`run_id = f0c8fd4a1fa7f9a119ebd796f5dfc58d`）：

| 检查 | 结果 |
| --- | --- |
| run 终态 | `awaiting_approval`（5 子任务 / 5 员工） |
| **产出含 `[stub-fallback]` 的员工** | **0 条** |
| 员工 `status != ok` 的 | **0 条** |
| llmgw 侧 `llmgw.real.openai.timeout` | **0 次** |
| llmgw 侧 `llmgw.chat.real.fallback` | **0 次** |
| llmgw 侧 `cost.recorded`（真实调用） | 17 次 |

对比：本批之前，同样量级的员工调用会出现 `timeout` 紧接着 `fallback`，产出正文
变成回显。**现在 timeout 与 fallback 双双归零，5 名员工全是真实模型答复。**

**部署说明**：`mate-tech-llmgw` 容器**没有源码挂载**（`docker inspect … Mounts` 为空），
本轮验证用 `docker cp` 把改动送进容器 + `docker restart`；`mate-tech-agent-team`
挂了 `packages`，restart 即生效。**正式部署需要重建 llmgw 镜像**（1.3 记过的同款坑：
Dockerfile / 镜像必须跟着代码涨）。

## 5. 测试

新增 `packages/mate-tech-llmgw/tests/test_real_chat_contract.py`（6 条）：

| 用例 | 钉住什么 |
| --- | --- |
| `test_provider_with_fallback_disabled_raises` | provider 层关掉回显时**抛错**，不返回 `[stub-fallback]` |
| `test_route_without_flag_still_echoes` | **回归**：不带字段 → 行为与改动前逐字相同 |
| `test_route_allow_stub_fallback_false_fails_closed` | 路由层收 `false` → **503**，正文无回显 |
| `test_upstream_timeout_default_has_room_for_reasoning_models` | 默认值明显大于老的 30s |
| `test_upstream_timeout_is_configurable` | 环境变量能改到生效值 |
| `test_upstream_timeout_ignores_garbage` | 配错退回默认，不带崩网关 |

`packages/mate-clients/tests/test_llmgw_client.py` 新增 3 条：默认带 `true`、
关掉后请求体带 `false`、普通补全路径同样带该字段。

**未写单测的一处（如实说明）**：`wiring.py` 里那一行
`allow_stub_fallback=False` 没有单测。agent-team 的既有测试一律用
`llm_factory=lambda …: StubLlm(...)` 注入假模型，`_llm_for` 这条装配路径本来就
只由实跑覆盖。该常量由 §4 的实跑验证，**不是**由单测验证。

## 6. 13 硬规则门禁（与 `ga-acceptance.yml` 对齐）

| 门禁 job | 本轮结论 |
| --- | --- |
| `ga-001` oasdiff | 契约**新增**一条路径 + 可选字段，非破坏性 |
| `ga-002` Requirement ID | 新增 `FR-LLMGW-LLMGWPOSTLLMGWCHATREAL` 并登记矩阵 |
| `ga-003` forbid_raw_sql（规则 3） | 无新增数据访问 |
| `ga-004` forbid_bare_httpx（规则 4） | 未新增裸 httpx（改动在既有 ACL client 内） |
| `ga-005` forbid_legacy_fallback（规则 5） | **本批正是强化规则 5 的语义**：回显多了一道调用方闸门 |
| `ga-006` ruff + pyright strict | ruff 干净；pyright 按 CI 覆盖范围（`mate-platform/src` + `mate-clients/src`）**0 error** |
| `ga-007` forbid_skip_tests | 未跳过任何用例 |
| `ga-008` helm lint + kubeconform | 未触及 |
| `ga-009` OTel collector smoke | 未触及 |
| `ga-010` require_evidence（规则 10） | 本文件 |
| `ga-011` helm-docs --dry-run | 未触及 |
| `ga-012` gitleaks（规则 12） | 无密钥入库 |
| `ga-013` NetworkPolicy 覆盖 | 未触及 |

## 7. 复现命令

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-llmgw/tests packages/mate-tech-agent-team/tests packages/mate-clients/tests -q
```

```bash
cd mate-platform-backend/contracts && npm run check && cd .. && python contracts/scripts/validate_traceability.py
```

```bash
cd mate-platform-backend && .venv/Scripts/python.exe -m ruff format --check packages/mate-tech-llmgw packages/mate-clients packages/mate-tech-agent-team && .venv/Scripts/python.exe -m ruff check packages/mate-tech-llmgw packages/mate-clients packages/mate-tech-agent-team
```

## 8. 提交

| commit | 内容 |
| --- | --- |
| `6a1d4ef1` | 契约：声明 `/chat/real` + 可选 `allow_stub_fallback` |
| `2b0c5824` | 实现：三重闸门 + 超时可配 + agent-team 传 false |

## 9. 遗留与建议

1. **超时默认值 30s → 90s 是有意的行为变更**，不是无感的内部调整：不带新字段的
   调用方现在会**多等一会儿才回落**。理由是 30s 对 reasoning 模型本就不够，
   而那个"回落"给的是假答复。若要维持旧时长，设 `LLMGW_UPSTREAM_TIMEOUT=30`。
2. **llmgw 镜像要重建**才能让改动在 compose 里生效（本轮用 `docker cp` 验证）。
   建议顺手把 llmgw 也纳入"改了要重建"的清单（1.3 记的是 Dockerfile 跟不上的坑）。
3. **`/chat/real` 进契约后，`compare_runtime` 之类的比对可能暴露更多历史漂移** ——
   本轮只声明了这一条路径，其余漂移未扫。建议单开一次"契约漂移盘点"。
4. **前端仍保留回显标注**（2.0 交付的「回显 n/m」）：即便本批之后不该再有回显，
   标注是**双保险**——它标的是事实，不是"预计不会发生"。
