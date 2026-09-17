# GOAL 模式启动提示词 —— Agent 产品层 2.0（收尾 + 会话页整合）

> **必读**：`agent-product-layer-roadmap.md`、`agent-product-layer-env-facts.md`、
> `AGENT-PRODUCT-LAYER-1.1-ACCEPTANCE.md`（体例，在 `delivery/evidence/`）。
> 1.0~1.9 已在 main（→ `2a74df8d`）。

你是自主执行工程师。**两轨互不阻塞，能并行就并行**；每轨做完跑验证并 commit，最后输出报告。

## GOAL

**轨 A 收尾**（只动 `docs/`）：落档 / 统一验收 / 边界表 / 状态同步。
**轨 B 会话页整合**（只动前端）：**会话能调 Agent 产品层全部能力** + **历史之上常驻调度可视化区域**。

## 锁死决策

- **落档是硬要求**：工作目录有 **11 个未跟踪文档**（踩坑卡 / 路线图 / 能力面方案 / **9 个 goal-mode 提示词**）——此前只提交过 1.0 定义与 1.2 提示词
- **验收如实**：未做**显式写成未做**；`AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` 覆盖 **1.0~1.9**
- **边界表**每条写「为什么留着 + 要做的条件」
- **ADR-0065 如实**（Proposed 就写 Proposed，**别升格**）
- **轨 B 核心 = 两套调度表示合一**：会话现走**老 copilot stream**（调度散在每条消息里），工作台走 **agent-team run**（任务图）——**会话要能驱动 Agent 产品层**
- **调度可视化在历史之上常驻**：任务图 + 员工状态 + 波次是**一个区域**，不再散在消息里
- **复用既有**：Semi + `AgentTeamRunPage` 的任务图/员工表；证据用**同一个 `EvidenceRenderer`**（1.6 已定）
- **不改后端语义**；**不让 LangChain 类型漏进契约**
- **并行**：轨 A 只碰 `docs/`+`CLAUDE.md`；轨 B 只碰 `pages/superai/`+`api/`（**零交集**）

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`（首跑记基线，此后不得低于）；代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开 `feat/agent-product-layer-2.0`；中文加 `PYTHONIOENCODING=utf-8`。
**两个钩子**：`detect-private-key` 比 gitleaks 更宽（注释里也别写私钥头连写）；`forbid_skip_tests` 禁 `skip`/`skipif`/`xfail`，放行 `importorskip`。
**前端验证**：dev server 9250；**dev 模式 Semi Button 的 onClick 是 noop**，交互按钮用**原生 `<button>`**。

## 轨 A · 四件

1. **落档 11 个文档**：逐个 `git add`（**不用 `-A`**）；**过时的先更新到与代码一致再提交**
2. **统一验收**：1.0~1.9 每版一行（版本 / 主题 / commit / 判据结果 / 自标边界）
3. **边界表**：至少覆盖 1.8（续跑无令牌 / CLI 未登录）、1.9 四条（续跑无用户令牌 / 取消粘性 / 跨副本取消不回话 / 认领靠 TTL）、更早的（ADR-0065 / v6）
4. **状态同步**：`CLAUDE.md` / `roadmap` / ADR-0065

**判据**：`git status` 不再有那 11 个 `??`；验收九版全覆盖且每条有出处；边界表可追溯；三处口径与 `git log` 对得上。

## 轨 B · 会话页整合

1. **会话能用 Agent 全部能力**：一句话 → 拆任务图 → 派数字员工 → 真实执行 → 停人工确认
2. **历史之上常驻调度可视化**：任务图 / 员工状态 / 波次 / 终态
3. 证据与交付物沿用既有渲染器（**不另造**）

**判据**：浏览器里一句话 → **上方实时显示任务图与员工状态** → 停闸门 → 确认后完成；**刷新后视图能从 `GET /runs/{id}` 恢复**。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

后端**不得回归**（基线 **357 passed / 0 skipped**）——轨 A 不改代码，理应零变化。
轨 B **必须浏览器实跑**（不是只跑单测）。

## 报告

两轨结果 + 回归数字 + commits + PR + **发现但未做的建议**。

## 边界

**不新增后端功能**；ADR-0065 与 v6 另立批次；secret 不进 git。
