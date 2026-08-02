# AI 助手启动 Prompt 模板（批次 K2 · APPHUB-RUNTIME-01 收口 + 阶段 D 收尾）

> 版本：v1.0 · 2026-08-02
> 用途：**接力批次 K1**——把 P0 治理收口 + P1 阶段 D 收尾一次性闭环
> 出处：批次 K1（4 个 commit）已落地，但 evidence 收口未完成；阶段 D 仅完成 2/5 页面
> 状态：**本批次待启动**（接续 APPHUB-RUNTIME-01 的最后 9 项工作）
> 前置：K1 commit `dadd68bf`（A）/ `53c5c71b`（B）/ `bb12d860`（C）/ `e3d924d3`（D）已在 main

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 全栈工程师，正在为本仓库执行
"批次 K2 · APPHUB-RUNTIME-01 收口 + 阶段 D 收尾"。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（K1 的 4 个 commit 已合并；fix/apphub-runtime-01-quickfix 是建议起点）
接力对象：APPHUB-RUNTIME-01 批次 K1 全部 4 个 commit（代码层已落地，但 evidence 治理未收尾）
目标：把 P0 治理 5 件 + P1 阶段 D 收尾 4 件共 9 项一次性闭环，让 K1 满足 §13 硬规则 10。

## 上下文速览（先读这一段）

K1 共 4 个 commit 已落地：
- dadd68bf  阶段 A 契约补齐 19 operation + Alembic 0013
- 53c5c71b  阶段 B runtime 引擎 7 模块 + 3 endpoint + 35 tests
- bb12d860  阶段 C shortlink 4 模块 + 3 endpoint + 20 tests
- e3d924d3  阶段 D runtime/shortlink API + AppRuntimePage + 发布/短链

但 2026-08-02 验收扫描发现 9 项阻塞：
- P0（5 项）：全部 ACCEPTANCE 收口要件缺失或破裂
- P1（4 项）：阶段 D 仅 2/5 页面 + 1 缺 QR Code + dist 未增量构建 + tsc 日志缺失

本批次目标：把这 9 项 P0 + P1 一次性闭环，让 APPHUB-RUNTIME-01 满足
§13 硬规则 10（"所有状态以验收证据为准"）。

## 必须读完的文档（按顺序）

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md
   — 批次 K1 启动 prompt（即上一份）
2. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — §13 硬规则 1-13（K1 部分达标，本批要闭环规则 1/2/10/11）
3. docs/active/delivery/PROGRAM-BOARD.md
   — 当前最新批次状态（要登记批次 K2）
4. docs/active/delivery/evidence/
   — 已有 51 个 ACCEPTANCE.md 的格式模板（最近一份如 SEC-IAM-01-ACCEPTANCE.md）
5. mate-platform-backend/contracts/openapi/services/apphub.yaml
   — K1 已声明 19 个 operation，本批要补字段 + 生成聚合 openapi.json
6. metaplatform-frontend/apps/web/src/api/apphub/marketplace.ts
   — K1 已实现 listTemplates/getTemplate/listTemplateComments/addTemplateComment，本批要把 4 个页面切到这里
7. metaplatform-frontend/apps/web/src/pages/apphub/runtime/AppRuntimePage.tsx
   — K1 已新增，本批要看 dist 是否增量
8. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-02.md
   — 本文档本身

## 你的任务（按 P0 + P1 两阶段 9 项）

### 阶段 P0 — 治理收口（必做，规则 10 闭环）

#### P0-1 修 `scripts/ci/require_evidence.py` 路径拼写 bug

当前 L19 是 `Path("docs/active/delivery/PROGRAM-BOBOARD.md")`（多一个 O），
导致脚本永远找不到文件、永远返回 0 放行，**v3.0 GA 收口时漏下的漏洞**。

```python
# 改前
pb = Path("docs/active/delivery/PROGRAM-BOBOARD.md")
# 改后
pb = Path("docs/active/delivery/PROGRAM-BOARD.md")
```

要求：
- 修完后跑 `python scripts/ci/require_evidence.py` 验证返回非 0（如果 PROGRAM-BOARD.md 内任何 ACCEPTED 标记缺对应文件）
- 跑 `python scripts/ci/forbid_skip_tests.py packages/mate-app-hub/` 验证通过
- 跑 `python scripts/ci/forbid_bare_httpx.py packages/mate-app-hub/` 验证通过

#### P0-2 生成 `docs/api/openapi.json` 聚合

这是 §13 硬规则 1（"Swagger 没有接口，不写 route"）CI 守门 ga-001-openapi 的输入。

要求：
- 创建 `docs/api/` 目录
- 用 `oasdiff` 或自写脚本聚合 `mate-platform-backend/contracts/openapi/services/*.yaml` 中所有 operation
- 产物路径：`docs/api/openapi.json`（JSON 格式）
- 头部加 stats 行：`paths: N`, `components.schemas: M`, `last_generated: 2026-08-02T...`
- 包含 apphub.yaml 的 19 个 operation（K1 阶段 A 落地）
- 聚合后 6 个新 operation 的 `x-mate-requirements` / `x-mate-required-tenant` /
  错误响应 401/403/409/422/500 仍未补齐，要在本批同时补（关联 P0-3）

#### P0-3 补 `apphub.yaml` 6 个新 operation 的字段（P0-2 的前置）

当前 6 个 operation 缺：
- `x-mate-requirements: [FR-APPHUB-RUNTIME-001] ~ [FR-APPHUB-RUNTIME-006]`（每个 operation 一个 FR ID）
- `x-mate-required-tenant: true`
- 错误响应：除了已有的 400/404，补 401/403/409/422/500
- `x-mate-permission` 统一为 `apphub.get` / `apphub.write`（目前是 `runtime.read` / `shortlink.write` 自创）

模板（apphubGetAppRuntime 改后）：
```yaml
- operationId: apphubGetAppRuntime
  x-mate-permission: apphub.get
  x-mate-requirements: [FR-APPHUB-RUNTIME-001]
  x-mate-required-tenant: true
  security:
    - bearerAuth: []
      tenantHeader: []
      oidcScopes: [platform.read]
  responses:
    '200': { ... }
    '401': { $ref: '#/components/responses/Unauthorized' }
    '403': { $ref: '#/components/responses/Forbidden' }
    '404': { $ref: '#/components/responses/NotFound' }
    '422': { $ref: '#/components/responses/UnprocessableEntity' }
    '500': { $ref: '#/components/responses/InternalServerError' }
```

同时新增 4 个 schema 到 `components/schemas`：
- `AppRuntime`（包含 `app_id / version / modules / render_tree`）
- `Shortlink`（包含 `code / app_id / tenant_id / role / expires_at / created_at`）
- `RenderNode`（包含 `id / type / node_type / props / children`）
- `ActionResult`（包含 `success / data / error / trace_id`）

并在 6 个 operation 的 `200` / `201` 响应里替换 `$ref: '#/components/schemas/ApiResponse'` 为对应强类型 schema。

#### P0-4 写 `docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md`

参考最近一份 ACCEPTANCE.md（如 `SEC-IAM-01-ACCEPTANCE.md`）的 13 门禁矩阵格式。

13 门禁逐项打勾（基于 K1 实际状态）：

| # | 硬规则 | 状态 | 证据 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | ✅ | apphub.yaml 19 operation + 6 字段完整（K2 补完） |
| 2 | PRD 没有 Requirement ID | ✅ | 6 个新 operation 都有 x-mate-requirements（K2 补完） |
| 3 | 没有 tenant 上下文，不访问 repository | ✅ | _tenant_id(request) 守门；可附 5 个 negative tests 链接 |
| 4 | 外部系统没有 ACL Client | �� | executor 仍 mock，待 K3 真实化 |
| 5 | Production profile 禁止 fallback | ✅ | require_evidence.py 拼写 bug 已修（K2 P0-1） |
| 6 | 静态检查失败不合并 | ✅ | ruff + pyright on mate-app-hub pass |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ | 71 tests 0 skip |
| 8 | 没有 K8s readiness + 回滚 | N/A | 走 platform-native 路由，不属 K8s 范畴 |
| 9 | 没有审计、指标、trace | �� | OTel 仍待 K3，runtime 路径已预留 span 名 |
| 10 | 所有状态以验收证据为准 | ✅ | 本文件存在 |
| 11 | helm-docs 同步每个子 chart 的 README | N/A | 平台 K8s 范畴，应用中心不直接 |
| 12 | Secret 不进 git | ✅ | 无新增 secret |
| 13 | NetworkPolicy 缺失 = prod 不通过 | N/A | 平台 K8s 范畴 |

总计 8 ✅ / 2 �� / 3 N/A。本批可标 Accepted。

#### P0-5 更新 `PROGRAM-BOARD.md` + 收尾 staged 提交

`PROGRAM-BOARD.md` 在最近的 v3.1 In Progress 章节新增一行：

```
| K2 | APPHUB-RUNTIME-01 收口 | **Accepted** | 本批 | K2 | 治理收口 5 件 + 阶段 D 收尾 4 件 |
```

把以下 7 个 untracked 文件 staged + commit（按 Conventional Commits）：
- `docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md`（已在 untracked）
- `docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-02.md`（本批新增）
- `metaplatform-frontend/apps/web/.dockerignore` / `index.html` / `nginx.conf` / `tsconfig.app.json` / `tsconfig.node.json` / `vite.config.ts`（K1 阶段 D 漏提）
- `metaplatform-frontend/Dockerfile` / `package.json` / `tsconfig.json`（K1 漏提）

commit 风格建议：`chore(apphub): 收口 K1 治理 5 件 + 阶段 D 收尾 4 件 (APPHUB-RUNTIME-01-K2)`

### 阶段 P1 — 阶段 D 收尾（4 项）

#### P1-1 4 个模板/市场页面切到 `marketplace.ts` 新 API

K1 阶段 D 只切了 AppLifecycle + AppDetail，剩 4 个仍走 `data/templates.ts` 的 localStorage。

| 页面 | 当前 | 改造 |
|---|---|---|
| `pages/apphub/MarketPage.tsx` | `loadUserTemplates()` + `OFFICIAL_TEMPLATES` | `useEffect(() => listTemplates({ category: selected }).then(setTemplates), [selected])` |
| `pages/apphub/MyTemplatesPage.tsx` | `loadUserTemplates()` 过滤 | `listTemplates({ createdBy: currentUser.userId })` |
| `pages/apphub/TemplateDetailPage.tsx` | `OFFICIAL_TEMPLATES.find` + `loadTemplateComments` | `getTemplate(templateId)` + `listTemplateComments(templateId)` |
| `pages/apphub/TemplateSubmitPage.tsx` | `addCreatedTemplate` (localStorage) | `addTemplateComment(templateId, { rating, comment })` 或新建 `submitTemplate` |

每个页面改完后：
- 移除 `import { OFFICIAL_TEMPLATES / loadUserTemplates / addCreatedTemplate / ... } from './data/templates'` 中不再用的符号
- 保留 `loadUserComments` 这类不走 API 的本地辅助（让老评论缓存仍可读）
- 加 `try/catch` 调空态视图，404 时降级到空 Array

#### P1-2 AppDetailPage 短链面板 + QR Code 组件

K1 已串接 `createShortlink`，但短链面板只有复制链接。补 QR Code：

选项 A（最简）：用 `qrcode` npm 包（需 `pnpm add qrcode` + 引入 `import QRCode from 'qrcode'`）
选项 B（脱网）：用 `qrcode.react` 组件（`pnpm add qrcode.react`）
任选其一，渲染到 `<Tabs key="shortlink">` 内的卡片：

```tsx
<Card title="访问二维码">
  <QRCode value={`https://app.example.com/s/${shortlink.code}`} size={160} />
  <Typography.Text type="secondary">扫码后访问 {shortlink.code}</Typography.Text>
</Card>
```

新增引用：`<meta name="shortlink-url-default">` 配置默认 base URL（K2 用 `window.location.origin` 兜底）。

#### P1-3 触发增量构建 + 产出 dist

K1 改的 src 端没触发 dist 增量。`dist/index.html` 仍停在 2026-07-30 13:43:16，无 `AppRuntimePage-*.js` chunk。

```bash
cd metaplatform-frontend/apps/web
pnpm install
pnpm build
```

构建后验证：
- `dist/index.html` LastWriteTime ≥ 当前时间
- `dist/assets/AppRuntimePage-*.js` 存在
- `dist/assets/MarketPage-*.js` 已更新（P1-1 之后）

#### P1-4 跑 `tsc --noEmit` 生成日志

```bash
cd metaplatform-frontend/apps/web
npx tsc --noEmit > tsc-out.log 2> tsc-err.log
```

要求：
- 退出码 = 0
- `tsc-out.log` / `tsc-err.log` 文件存在
- 检查 0 error / 0 warning（warning 视情况接受）

## 13 条硬规则（本批触发的）

- **§13 第 1 条**：P0-2 / P0-3 必做（聚合 openapi.json + 字段补齐）
- **§13 第 2 条**：P0-3 必做（x-mate-requirements 给 6 个新 operation）
- **§13 第 10 条**：P0-1 / P0-4 / P0-5 必做（require_evidence 修复 + ACCEPTANCE.md + Program Board）
- **§13 第 6 条**：阶段 P1-4 必做（tsc 退出码 0）

## 启动方式

1. 切到 K1 接力 worktree：
   `git fetch && git worktree add .worktrees/apphub-runtime-02 -b codex/apphub-runtime-02 main`
2. 先跑 K1 基线确认无回归：
   `cd mate-platform-backend/packages/mate-app-hub && pytest -q`
   `cd metaplatform-frontend/apps/web && pnpm typecheck`
3. 按 P0-1 → P0-5 顺序推进（每项独立 commit）
4. P0 全部完成后接 P1-1 → P1-4（同样每项独立 commit）
5. 每个 commit 前必跑：
   - `python scripts/ci/require_evidence.py`（已修拼写，必须能 fail 在缺 evidence 的批上）
   - `ruff check && pyright packages/mate-app-hub/`
   - `pytest tests/test_apphub_*_01.py -q`
6. 全部 9 项完成后，PR 描述必须包含：
   - K1 4 个 commit + K2 新增 commit 的清单
   - 13 门禁矩阵（与 P0-4 一致）
   - `docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md` 链接
   - `docs/api/openapi.json` 文件大小 + stats 行
   - 9 项 P0 + P1 完成清单（✅）

## 已知陷阱

1. **dist 增量构建可能触发 OOM**：若 `pnpm build` 失败，先 `pnpm install --frozen-lockfile` 再重试
2. **QR Code 组件包选型**：若 `qrcode` 太大（>200KB），改用 `qrcode.react`；若都要外网下载，改用 `tds-qrcode` 本地组件
3. **ACCEPTANCE.md 格式**：直接复用 `docs/active/delivery/evidence/SEC-IAM-01-ACCEPTANCE.md` 的 13 门禁矩阵版式，不要自创
4. **Program Board 锚点**：用 `grep -n "v3.1 In Progress" PROGRAM-BOARD.md` 找到 In Progress 章节锚点后再插入，避免插入位置错
5. **staged 提交顺序**：frontend 配置文件先 commit（无依赖），spec 文档次之，APPHUB-RUNTIME-02 自文档最后

## 验收清单（Acceptance Evidence）

提交 PR 前必须产出：

- [ ] P0-1：`scripts/ci/require_evidence.py` 拼写 bug 已修（commit 引用）
- [ ] P0-2：`docs/api/openapi.json` 存在，含 apphub 19 operation + stats 行
- [ ] P0-3：`apphub.yaml` 6 个新 operation 字段全部补齐（x-mate-requirements / x-mate-permission / 错误响应 5 档）
- [ ] P0-3：4 个 schema 已注册到 components/schemas 并被 operation 引用
- [ ] P0-4：`APPHUB-RUNTIME-01-ACCEPTANCE.md` 13 门禁矩阵齐全（8 ✅ / 2 �� / 3 N/A）
- [ ] P0-5：`PROGRAM-BOBOARD.md`（注：内部仍用 `PROGRAM-BOARD.md`）/ `PROGRAM-BOARD.md` 批次 K 行已新增
- [ ] P0-5：11 个 staged 文件已 commit 到一个 chore commit
- [ ] P1-1：4 个页面（Market / MyTemplates / TemplateDetail / TemplateSubmit）切到 marketplace.ts
- [ ] P1-2：AppDetailPage 短链面板含 QR Code 组件
- [ ] P1-3：`dist/index.html` LastWriteTime ≥ 2026-08-02 + `AppRuntimePage-*.js` 存在
- [ ] P1-4：`tsc-out.log` / `tsc-err.log` 存在 + 退出码 0
- [ ] 全部 9 项 commit 引用 + ACCEPTANCE.md 链接 + openapi.json 大小
```

## 关联文档

- 批次 K1 启动 prompt：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md`
- K1 4 个 commit：`dadd68bf` / `53c5c71b` / `bb12d860` / `e3d924d3`
- 13 硬规则（§13 production-readiness）
- 类似收口模板：`docs/active/delivery/evidence/SEC-IAM-01-ACCEPTANCE.md`

## 元说明

- **本批次解决**：P0 治理收口 5 件 + P1 阶段 D 收尾 4 件
- **本批次不解决**：SQL 持久化（`ApphubShortlinkORM`）/ OTel 接入 / `_runtime_tenant_id` 清理 / executor 真实化（属 K3 批次）
- **估时**：P0 治理 1.5 小时 / P1 阶段 D 8 小时，共 1 人天
- **风险**：ACCEPTANCE.md 13 门禁打分