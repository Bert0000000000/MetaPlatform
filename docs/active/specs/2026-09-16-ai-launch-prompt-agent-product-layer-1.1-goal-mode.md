# GOAL 模式启动提示词 —— Agent 产品层 1.1

> **开工前必读**：`docs/active/specs/2026-09-16-agent-product-layer-env-facts.md`（踩坑卡）＋ ADR-0066 §3.3（任务 4 设计原文）。
> 1.0 已在 main：服务 `mate-tech-agent-team`（8013，`/api/v1/agent-team/*`）。

你是自主执行工程师。按任务 1→5 推进，每任务**先写 failing tests 再实现**，完成后跑验证并 commit，最后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

让 MCP 中心能对外当 MCP 服务端（Codex 能接入、各自落在自己的租户）；把 1.0 绕开 MCP 的本体工具收回总线；员工身份落库；落地权限包络衰减（子 ⊆ 上级）。

## 锁死决策

- 首个外部客户端 = **Codex**
- 权限衰减与 MCP 对外**一起做**
- 包络**链根 = 发起用户**（非父 agent，ADR-0066 §3.3）
- **不扩权即免审，扩权才审**；提权授权只限本次任务
- MCP 协议面按**认证到的客户端租户**解析，取代写死的 `default`
- 本体工具收回总线，且进包络判定
- 员工身份 = 提示词 + 技能清单 + 工具白名单，本次加落库
- **不用 `interrupt()`；不用裸 dict 作状态 schema**（1.0 教训）

## 硬约束

不绕过 13 硬规则（tenant 守门 / 禁裸 httpx / production 禁 fallback / secret 不进 git）；只用 `mate-platform-backend/.venv`，首跑记基线且此后不得低于；网络走代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开 `feat/agent-product-layer-1.1`；契约先行；中文输出加 `PYTHONIOENCODING=utf-8`。

## 任务 1 · MCP 对外可服务

- **1a** `MateMcpProtocol` 改为从**认证上下文**取租户（现写死 `default`），静态工具面同样按租户过滤
- **1b** `clients_repo.py` 从内存字典改 PG 落库，走 `require_tenant`
- **1c** MCP 本体代理改**逐请求令牌透传**；`ontology_toolbox.py` 改为经 MCP 调用，删直连旁路

**判据**：外部客户端带 `sk-mcp-*` 接入只看到自己租户的工具；本体工具经总线可调；跨租户负例（A 看不到 B 的动态工具）通过。

## 任务 2 · 接入 Codex（真实打通）

按踩坑卡的形状写 `~/.codex/config.toml` 片段，让 Codex 经 **streamable-http + `bearer_token_env_var`** 接入并真正调通一个工具（建议 `ont_object_query`）；用 `enabled_tools` 演示过滤。
**判据**：能列出工具、成功调用一次、越权工具被过滤；配置与调用记录落档。

## 任务 3 · 员工身份落库（ADR-0066 S0）

`profiles.py` 现无 ORM 无建表 → 改 PG：身份三要素 + 权限包络字段。
**判据**：建员工 → 重启仍在；跨租户不可见。

## 任务 4 · 权限包络衰减

包络 = `(tools, action_rids, kb_ids, markings)`；不变量 **子 ⊆ 发起用户**。派活时子集检查：不扩权放行（不产 proposal）；扩权**转 proposal 人审**，授权只限该任务。
**这是全系统唯一安全关键路径，须有专门 negative 矩阵。**
**判据**：越权被拒（403 或转 proposal，写明理由）；只收窄放行；跨租户负例。

## 任务 5 · 深度闸门

加 `max_depth`（**默认 3**，对齐 Codex / Claude Code）。
**判据**：第 4 层被拒；第 3 层放行。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

任务 1/2 改完**重建 MCP 镜像**并用真实容器验证（不能只跑单测）；1.0 链路不得回归。

## 报告

任务 1~5 各自验证结果 + 1.0 回归 + 基线→最终 + commits + PR + 遗留与建议。

## 边界

不接 Claude Code / dsh；不做双向消息 / 沙箱分级 / 复杂图 / A2A；不重写本体引擎 / SkillHub。
建表不用服务角色（RLS 静默失效）；隔离断言不用 `meta`（假通过）；不碰他人在途文件；secret 不进 git。
