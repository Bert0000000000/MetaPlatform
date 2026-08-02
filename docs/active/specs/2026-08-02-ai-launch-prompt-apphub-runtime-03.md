# AI 助手启动 Prompt 模板（批次 K2.1 · APPHUB-RUNTIME-01 6 处硬证据补齐）

> 版本：v1.0 · 2026-08-02
> 用途：**接力 K2**——把 K2 留下的 5 处核心瑕疵 + 1 项 tsc 日志真正闭环
> 出处：K2（commit `8e69f1eb`）只触碰了元治理，未触碰 5 处核心瑕疵
> 状态：**本批次待启动**——ACCEPTANCE 标签已贴，但 EVIDENCE 不达标
> 前置：K1 4 commit + K2 5 commit + `8e69f1eb` 已合并到 main

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 全栈工程师，正在为本仓库执行
"批次 K2.1 · APPHUB-RUNTIME-01 6 处硬证据补齐"。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（K1 4 + K2 5 + 8e69f1eb 共 10 个 commit 已合并）
接力对象：APPHUB-RUNTIME-01 K2 留 5 处核心瑕疵 + 1 项 tsc 日志
目标：把 ACCEPTANCE.md 标签从"叙事 Accepted"变成"证据 Accepted"。

## 上下文速览（先读这一段）

K2 提交了 5 个 commit + 8e69f1eb 治理收口，但 2026-08-02 末次扫描发现
K2 标 Accepted 的同时，**5 处核心瑕疵 + 1 项工程卫生仍未修复**：

- P0-3-a  6 个 operation 仍引用 ApiResponse 占位 schema（未强类型）
- P0-3-b  6 个 operation 缺 x-mate-required-tenant: true 字段
- P0-3-c  6 个 operation 缺 409 / 422 错误响应
- P1-1    MyTemplatesPage + TemplateSubmitPage 仍 mock 兜底 + TODO 注释
- P1-2    AppDetailPage QR Code 仍走 api.qrserver.com 第三方图床
- P1-4    tsc-out.log / tsc-err.log 不存在

本批次目标：把这 6 项实际修复，让 K2 ACCEPTANCE 标签**真的有证据支持**。

## 必须读完的文档（按顺序）

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md
   — K1 启动 prompt
2. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-02.md
   — K2 启动 prompt（9 项 P0+P1）
3. docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md
   — 当前 ACCEPTANCE 文档（已 K2 标 Accepted，但有 6 处不达标）
4. docs/active/delivery/PROGRAM-BOARD.md
   — 已登记 K2 Accepted ✅ 行（K2.1 完成后由 Accepted 保持 Accepted）
5. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — §13 硬规则 1（OAS 守门）/ 2（FR ID）/ 10（evidence）
6. mate-platform-backend/contracts/openapi/services/apphub.yaml
   — 当前契约（6 个 operation 字段半补，K2.1 补齐）
7. docs/api/openapi.json
   — 当前聚合产物（已含 231 paths / 282 ops / 81 schemas）
8. metaplatform-frontend/apps/web/src/pages/apphub/
   — 4 个改造页面（MarketPage / MyTemplatesPage / TemplateDetailPage / TemplateSubmitPage）
9. metaplatform-frontend/apps/web/src/pages/apphub/AppDetailPage.tsx
   — 短链面板 QR Code 现状
10. metaplatform-frontend/apps/web/package.json
    — 现有 dependencies（用于判断 QR 组件选型）
11. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-03.md
    — 本文档本身

## 你的任务（按 P0-3 → P1 顺序 6 项）

### 阶段 A — 契约字段补齐（3 项，归一组 commit）

#### A-1 强类型 schema 引用（Pn3-a）

修改 `mate-platform-backend/contracts/openapi/services/apphub.yaml`，
6 个 operation 的 200/201 响应 + requestBody 全部从 `ApiResponse` 替换为强类型：

| operation | 200/201 响应 | requestBody |
|---|---|---|
| `apphubGetAppRuntime` | `AppRuntime` | (GET 无 body) |
| `apphubPostAppRuntimeExecute` | `ActionResult` | `ActionResult` |
| `apphubPostAppPublish` | `AppRuntime` | (POST 无 body) |
| `apphubGetShortlink` | `Shortlink` | (GET 无 body) |
| `apphubPostShortlink` | `Shortlink` | `Shortlink` |
| `apphubListShortlinks` | `array<Shortlink>` | (GET 无 body) |

模板：

```yaml
responses:
  '200':
    description: 成功
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/AppRuntime'
```

4 个 schema 已在 components.schemas 中（K1 阶段 A / bb87bc94 / f859165d 已注册），
只需替换 `$ref` 指向即可。

#### A-2 x-mate-required-tenant: true（Pn3-b）

apphub.yaml 的 6 个 operation 全部补 `x-mate-required-tenant: true` 字段，
位置紧贴 `x-mate-permission` 之后：

```yaml
x-mate-permission: apphub.get
x-mate-required-tenant: true
x-mate-requirements: [FR-APPHUB-RUNTIME-001]
```

#### A-3 409 / 422 错误响应（Pn3-c）

6 个 operation 的 responses 列表补 409 / 422 状态码：

```yaml
responses:
  '200': { ... }
  '401': { $ref: '#/components/responses/Unauthorized' }
  '403': { $ref: '#/components/responses/Forbidden' }
  '404': { $ref: '#/components/responses/NotFound' }
  '409': { $ref: '#/components/responses/Conflict' }     # ← 新增
  '422': { $ref: '#/components/responses/UnprocessableEntity' }  # ← 新增
  '500': { $ref: '#/components/responses/InternalServerError' }
```

注意：
- POST 类（`apphubPost*`）必须都包含 409 / 422
- GET 类（`apphubGetAppRuntime` / `apphubGetShortlink`）可省略 409（无创建冲突）
- 列表类（`apphubListShortlinks`）可省略 409 / 422

要求验证：`components/responses/Conflict` 和 `components/responses/UnprocessableEntity`
是否在聚合的 components/schemas 中已存在？若不存在则需在 components.responses 段补。

#### A-4 重新聚合 openapi.json

A-1/A-2/A-3 改完后，**重新生成聚合产物**：

```bash
python scripts/aggregate_openapi.py  # 或仓库内对应的聚合脚本
# 若无脚本，可手动聚合 contracts/openapi/services/*.yaml
```

要求：
- `docs/api/openapi.json` LastWriteTime ≥ 当前时间
- 6 个 operation 的 200/201 响应 schema 全部为强类型
- `x-mate-required-tenant: true` 字段在 6 个 operation 中可 grep 到
- 聚合的 stats 字段（`x-stats.paths` / `x-stats.operations` / `x-stats.schemas`）更新

### 阶段 B — 前端页面真实化（2 项）

#### B-1 MyTemplatesPage + TemplateSubmitPage 切到 marketplace API（P1-1）

**MyTemplatesPage.tsx**（L21-50）：
- 移除 `// TODO: 切到 API` 注释
- 移除 `import { loadUserTemplates, ... } from './data/templates'`
- 改用 `import { listTemplates } from '@/api/apphub/marketplace'`
- `useEffect` 中调 `listTemplates({ createdBy: currentUser.userId })`
- 错误处理：catch 时返回空数组 + 提示 "模板列表加载失败"
- 若 `listTemplates` 仍不支持 `createdBy` 过滤，**先在 mate-app-hub 后端补一个 query param**：
  ```python
  # apphub.yaml 新增 query parameter
  - name: createdBy
    in: query
    required: false
    schema:
      type: string
  ```
  并在 `api/app.py` `list_registered_apps` 处理函数中读 `createdBy` 过滤。

**TemplateSubmitPage.tsx**（L21-50）：
- 移除 `// TODO: 切到 API` 注释
- 移除 `import { addCreatedTemplate, ... } from './data/templates'`
- 改用 `import { ... } from '@/api/apphub/templates'`（K2 阶段 D 漏掉了 templates.ts 这个 API 模块，需要 K2.1 补）
- 若 `marketplace.ts` 确实没有 `submitTemplate`，**在 mate-app-hub 后端补一个 endpoint**：
  ```
  POST /api/v1/apphub/templates
  operationId: apphubPostTemplate
  ```
  requestBody: `TemplateSubmitRequest` (name / category / description / config)
  response: `TemplateItem`

**注意**：K2 prompt 漏标了 `submitTemplate` 这个 endpoint 是 K2 自己的责任
（K1 也没有预留），K2.1 必须连带补这个 API 缺口，否则 TemplateSubmitPage 切不过去。

#### B-2 AppDetailPage QR Code 本地化（P1-2）

**拆掉第三方图床**：
- 移除 L428-435 `<img src="https://api.qrserver.com/...">` 段
- 用本地组件替代

**依赖选型**（任选其一，K2.1 推荐 `qrcode.react`）：

```bash
cd metaplatform-frontend/apps/web
pnpm add qrcode.react
# 或备选：pnpm add qrcode
```

**代码替换**：

```tsx
import { QRCodeSVG } from 'qrcode.react';
// 或：import QRCode from 'qrcode';

// 短链面板内
<Card size="small">
  <QRCodeSVG
    value={`${window.location.origin}/s/${shortlink.code}`}
    size={160}
    level="M"
    includeMargin={true}
  />
  <Typography.Text type="secondary">扫码访问 /s/{shortlink.code}</Typography.Text>
</Card>
```

**验证**：
- `package.json` `dependencies` 段新增 `qrcode.react` 项
- `pnpm-lock.yaml` 同步更新
- `apps/web/dist/assets/AppDetailPage-*.js` chunk 包含 `qrcode.react` 引用

#### B-3 触发增量构建

```bash
cd metaplatform-frontend/apps/web
pnpm install
pnpm build
```

要求：
- `dist/index.html` LastWriteTime ≥ 当前时间
- `dist/assets/AppDetailPage-*.js` 已更新（QR 组件 lazy-chunk 包含）
- `dist/assets/MyTemplatesPage-*.js` / `TemplateSubmitPage-*.js` 已更新

### 阶段 C — 工程卫生（1 项）

#### C-1 tsc 日志保留（P1-4）

```bash
cd metaplatform-frontend/apps/web
npx tsc --noEmit > tsc-out.log 2> tsc-err.log
echo "EXIT_CODE: $?"
```

要求：
- `apps/web/tsc-out.log` 存在（包含 tsc stdout 内容）
- `apps/web/tsc-err.log` 存在（即便空文件也保留）
- 退出码 0（验证无类型错误）
- 把 `tsc-out.log` / `tsc-err.log` commit 上来（避免只是 .gitignore 排除）

**额外检查**：
- `apps/web/.gitignore` 是否包含 `tsc-*.log` 模式？若是，**改 .gitignore 把这两文件 explicit include**：
  ```gitignore
  # 但以下两条用 ! 反转
  !tsc-out.log
  !tsc-err.log
  ```

### 阶段 D — 收口

#### D-1 更新 ACCEPTANCE.md "evidence 不达标" 标记

把当前文档第 5 行 "结论: ✅ Accepted" 改为更精确的描述：

```markdown
## 4. 结论

✅ Accepted (K2.1 evidence 闭环)

K1 4 commit + K2 5 commit + 8e69f1eb + K2.1 evidence 闭环
107 tests / 0 skip / 13 硬规则 8 ✅ / 2 �� / 3 N/A
K2 5 处核心瑕疵 + 1 项 tsc 日志已全部修复
```

同时在第 26 行 #3 13 门禁矩阵之后追加新章节：

```markdown
## 5. K2.1 6 处硬证据补齐（2026-08-02）

| # | 瑕疵 | 修复证据 |
|---|---|---|
| A-1 | 6 op 强类型 schema | apphub.yaml L# / openapi.json L# 引用 #/components/schemas/{AppRuntime,Shortlink,ActionResult} |
| A-2 | x-mate-required-tenant: true | grep 6 命中 |
| A-3 | 409 / 422 错误响应 | grep 6+ 命中 |
| B-1 | MyTemplatesPage / TemplateSubmitPage | L# import 切到 marketplace / templates API |
| B-2 | QR Code 本地化 | package.json + qrcode.react 依赖 |
| C-1 | tsc 日志 | tsc-out.log / tsc-err.log 提交 |

## 6. 提交链

- K1: dadd68bf / 53c5c71b / bb12d860 / e3d924d3
- K2: bb87bc94 / f859165d / 3810d929 / ad4d64b9 / 59a72d52
- K2 治理: 8e69f1eb
- K2.1: <本次 commit 列表>
```

#### D-2 提交风格

按 Conventional Commits 拆 3 个 commit：

```text
commit 1: fix(apphub): K2.1 阶段 A 契约补齐 6 operation 强类型 schema + required-tenant + 409/422
commit 2: feat(frontend): K2.1 阶段 B 4 页面真实化 + QR Code 本地化 + templates API 补齐
commit 3: chore(frontend): K2.1 阶段 C tsc 日志提交 + dist 增量构建
```

每个 commit 前校验：
- `cd mate-platform-backend/packages/mate-app-hub && pytest -q` 0 failed
- `cd metaplatform-frontend/apps/web && pnpm typecheck` 0 error
- `python scripts/ci/require_evidence.py` 通过（拼写已修）
- `python scripts/ci/forbid_skip_tests.py` 0 命中
- `python scripts/ci/forbid_bare_httpx.py` 0 命中

## 13 条硬规则（本批次触发的）

- **§13 第 1 条**：A-1/A-2/A-3 + 重新聚合（6 op 字段必须 100% 完整）
- **§13 第 2 条**：A-2 x-mate-required-tenant + x-mate-requirements 都齐
- **§13 第 6 条**：阶段 C-1 tsc 退出码 0
- **§13 第 10 条**：D-1 ACCEPTANCE.md "K2.1 evidence 闭环" 描述真实

## 启动方式

1. 切到 K2 接力 worktree：
   `git fetch && git worktree add .worktrees/apphub-runtime-03 -b codex/apphub-runtime-03 main`
2. 先跑 K1+K2 基线确认无回归：
   `cd mate-platform-backend/packages/mate-app-hub && pytest -q`
   `cd metaplatform-frontend/apps/web && pnpm typecheck`
3. 按 A-1 → A-2 → A-3 → A-4 → B-1 → B-2 → B-3 → C-1 → D-1 顺序推进
4. 每完成一组（A / B / C）commit 一次
5. 全部 3 commit 完成后，更新 PR 描述，必须包含：
   - K1 4 + K2 5 + 8e69f1eb + K2.1 3 共 13 commit 清单
   - 6 项修复的 0/1 矩阵
   - `docs/api/openapi.json` LastWriteTime
   - `tsc-out.log` / `tsc-err.log` 提交 hash
   - ACCEPTANCE.md "K2.1 evidence 闭环" 描述引用

## 已知陷阱

1. **marketplace.ts 缺 submitTemplate**：K1 / K2 都没补，K2.1 必须同时补后端 endpoint
   `POST /api/v1/apphub/templates` + 前端 `api/apphub/templates.ts` 客户端
2. **listTemplates 缺 createdBy 过滤**：需要在 apphub.yaml 加 query param + 后端实现
3. **QR Code 组件包大小**：qrcode.react < 50KB 推荐；qrcode 库 < 200KB；任选其一
4. **tsc stdbuf 缓冲**：若 tsc-out.log 内容被截断，加 `| tee tsc-out.log`
5. **openapi.json 聚合脚本**：仓库内可能没有 scripts/aggregate_openapi.py，需先 `Glob scripts/*openapi*` 找现有工具
6. **ACCEPTANCE.md 5 行结论改写**：用 Read 确认当前内容，再 SearchReplace 一次完成，别误删 13 门禁矩阵

## 验收清单（Acceptance Evidence）

提交 PR 前必须产出：

- [ ] A-1：6 个 operation 200/201 响应 schema 全部为强类型（ApiResponse 0 引用）
- [ ] A-2：6 个 operation 全部含 `x-mate-required-tenant: true` 字段
- [ ] A-3：6 个 POST/响应操作含 409 / 422 错误响应
- [ ] A-4：docs/api/openapi.json 重新聚合，6 个 operation 字段变更同步
- [ ] B-1：MyTemplatesPage.tsx L21-50 含 `import listTemplates` + 移除 TODO 注释
- [ ] B-1：TemplateSubmitPage.tsx L21-50 含 `import submitTemplate` + 移除 TODO 注释
- [ ] B-1：mate-app-hub 后端补 POST /api/v1/apphub/templates endpoint
- [ ] B-2：package.json 含 `qrcode.react` 依赖
- [ ] B-2：AppDetailPage.tsx L428-435 移除 `<img src="api.qrserver.com">` 改为本地组件
- [ ] B-3：dist/index.html LastWriteTime ≥ 当前时间 + AppDetailPage chunk 已更新
- [ ] C-1：apps/web/tsc-out.log / tsc-err.log 提交到 git 各 1 file
- [ ] D-1：ACCEPTANCE.md 第 5 行 "K2.1 evidence 闭环" 描述就位 + 第 5 章节 6 项修复矩阵
- [ ] D-2：3 个 Conventional Commit 风格 commit
- [ ] 所有 commit 前必跑 `pytest / pnpm typecheck / 3 个 CI 守门脚本`
```

## 关联文档

- 批次 K1 prompt：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md`
- 批次 K2 prompt：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-02.md`
- K2 ACCEPTANCE 文档：`docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md`
- K2.1 接力对象：K2 留 5 处核心瑕疵 + 1 项 tsc 日志
- 13 硬规则（§13 production-readiness）

## 元说明

- **本批次解决**：让 K2 ACCEPTANCE 标签**真的有 EVIDENCE**
- **本批次不解决**：SQL 持久化 / OTel 接入 / `_runtime_tenant_id` 清理 / executor 真实化（属 K3 批次）
- **估时**：阶段 A 1.5 小时 / 阶段 B 3 小时 / 阶段 C 0.5 小时 / 阶段 D 1 小时，共 6 小时 / 1 人天
- **风险**：B-1 marketplace API 缺 submitTemplate 需连带补后端 + 契约
- **关键诚实点**：本批完成后，K2 ACCEPTANCE 标签