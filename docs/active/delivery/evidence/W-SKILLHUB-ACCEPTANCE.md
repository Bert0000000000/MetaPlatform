# SKILL HUB + 三 HUB 归组修正：验收证据

> 批次：MCP 服务中心三 HUB 概念修正（SKILL / MCP / A2A）· 日期：2026-08-12
> 决策：用户明确「SKILL=SKILL HUB（公开 SKILL 上传/下载/安装）」「MCP=MCP HUB（Server 状态/调度）」「A2A=内外 Agent 注册中心（内部数字员工 + 外部 Agent 发现）」
> 工作目录：`mate-platform-backend` + `metaplatform-frontend`

## 1. 一句话验收

**按用户概念修正 MCP 服务中心：SKILL tab 从「复用 MCP 工具注册表」改为真正的 SKILL HUB（backend marketplace 新增 skill kind，前端公开 SKILL 上传/下载/安装）；MCP tab 聚焦 Server 状态/调度；A2A tab 成为内外 Agent 注册中心（新增内部数字员工页）。前端浏览器实测三 HUB 渲染 + 切换正常，backend 7 测试全绿。**

## 2. Backend：marketplace skill kind

| 文件 | 改动 |
|---|---|
| `marketplace/skillhub/store.py` | **新增** `SkillHubStore`（SQL 表 `skillhub_skills` + 内存兜底），`Skill`/`SkillORM`，`register_skill` installer 对接 |
| `marketplace/skillhub/api.py` | **新增** 6 端点：上传/浏览/详情/下载/安装/删除（scope 门禁 + 租户可见性） |
| `marketplace/jobs/installer_skill.py` | **新增** `SkillInstaller(kind="skill")` |
| `marketplace/jobs/orchestrator.py` | skill 分支（`mp_client.skill`） |
| `marketplace/api/browse.py` `installed.py` | kind 校验加 `skill` |
| `mate-app-hub/marketplace.py` | skillhub router 挂载（`/api/v1/marketplace/skills/*`） |
| `contracts/openapi/services/marketplace.yaml` | 7 处 kind enum 加 `skill` + 4 条 skillhub 路径 + Skill/SkillUpload schema |

## 3. Frontend：三 HUB + SKILL HUB 页面

| 文件 | 改动 |
|---|---|
| `api/mcphub/skills.ts` | **新增** skillhub client（list/upload/get/download/install/delete） |
| `pages/mcp/SkillHubPage.tsx` | **新增** SKILL HUB 页：公开 SKILL 列表 + 上传 Modal + 下载/安装/删除按钮 |
| `pages/mcp/A2aInternalAgentsPage.tsx` | **新增** 内部数字员工页（连 dw employees） |
| `packages/shared/src/config/platformMenu.ts` | mcphub 归组修正：SKILL=skill-hub；MCP=overview/tools/servers/clients/debugger/resources/prompts/权限/审计/监控/IDE；A2A=internal-agents/external-agents/integrations/trusts/collaborations |
| `pages/mcp/McpCenterLayout.tsx` | tab 标签改为 **SKILL HUB / MCP HUB / A2A 注册中心** + 路径归组 + 默认页 |
| `apps/web/src/App.tsx` | 加 `/mcp/skill-hub`、`/mcp/internal-agents` 路由；index 指向 skill-hub |

## 4. 测试证据

```
$ pytest packages/mate-platform/tests/test_skillhub_api.py
7 passed   # 上传/浏览/下载/私有隔离/安装计数/搜索/删除权限/installer 注册
$ pytest packages/mate-platform/tests packages/mate-app-hub/tests
399 passed # 无回归
$ tsc --noEmit -p apps/web/tsconfig.json
0 errors
```

## 5. 浏览器实测（vite dev）

- `/mcp/skill-hub` → tablist 显示 **SKILL HUB / MCP HUB / A2A 注册中心**，SKILL HUB 页渲染（上传按钮 + 表格列）
- 点「A2A 注册中心」→ `/mcp/internal-agents` → 渲染 7 个内置数字员工（应用构建师/数据产品师/知识管理员/本体建模师/安全合规官/流程工程师等，含编码/角色/状态）
- 后端未起时 SKILL HUB 列表 404 → 页面优雅降级（提示信息）
- tsc 干净

## 6. 已知缺口

- SKILL 上传/下载/安装 backend 已就绪；前端「上传 Modal」已连 API（后端未起时 404，起整栈后可用）
- SKILL 的「已安装管理」未做专用页（`install` 只计数；已安装技能与 `marketplace/installed` 的 skill 记录后续接）
- `author_tenant`/`created_at` 后端返回 snake_case，前端接口已对齐
- marketplace skill 的 OCI 上传/下载（走完整 marketplace install 管线）留后续——skillhub store 是当前落地形态

## 7. 补充：SKILL 已安装管理（2026-08-12）

- **Backend**：`skillhub/store.py` 加 `SkillInstallORM`（表 `skillhub_installs`，PK `(skill_id, tenant_id)`）+ `install(tenant_id, skill_id)`（计数 + 记租户安装）+ `installed_skill_ids` / `is_installed`；API 加 `GET /skills/installed`（当前租户已安装清单）。
- **Frontend**：SkillHubPage 改为双 tab「公开市场 / 已安装」，已安装 tab 展示本租户安装过的 SKILL；`api/mcphub/skills.ts` 加 `listInstalledSkills`。
- **契约**：marketplace.yaml 加 `/skills/installed`（`listInstalledSkills`）。
- **测试**：`test_installed_list_per_tenant`（安装后租户 A 可见、租户 B 不可见）；skillhub 全量 **8 passed**；合并套件 **641 passed**；tsc 干净；浏览器实测双 tab 渲染。
- 原「已安装管理未做」缺口已闭合。
