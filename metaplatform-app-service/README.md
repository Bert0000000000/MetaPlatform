# metaplatform-app-service

MetaPlatform 「应用中心」微服务（v1.0.1 Sprint 0 脚手架）。

> 配套文档：
> - [`docs/v1.0.x/v1.0.1/05-app-service-architecture.md`](../docs/v1.0.x/v1.0.1/05-app-service-architecture.md) — 架构契约
> - [`docs/v1.0.x/v1.0.1/02-sprint-plan.md`](../docs/v1.0.x/v1.0.1/02-sprint-plan.md) — Sprint 计划（S0 = T0-1）
> - [`openapi/v1.0.1-app-service.yaml`](./openapi/v1.0.1-app-service.yaml) — 18 个端点的 OpenAPI 契约

---

## 一、本地启动

```bash
# 1) 安装依赖
cd metaplatform-app-service
npm install

# 2) 复制环境变量模板（可选，全部有默认值）
cp .env.example .env

# 3) 启动开发服务（默认监听 :3002，热更新）
npm run dev
```

启动后可见控制台输出：

```
[metaplatform-app-service] v1.0.1-sprint0 listening on http://localhost:3002
```

---

## 二、目录结构

```
metaplatform-app-service/
├── package.json
├── tsconfig.json / tsconfig.test.json
├── jest.config.js
├── .env.example / .gitignore
├── openapi/
│   └── v1.0.1-app-service.yaml         # 18 个端点的 OpenAPI 3.0 契约
├── src/
│   ├── index.ts                        # 入口（监听 :3002）
│   ├── app.ts                          # Express 应用工厂（便于 supertest）
│   ├── config.ts                       # 配置 + SERVICE_VERSION
│   ├── routes/                         # 18 个端点 stub（按领域拆 5 个文件）
│   │   ├── apps.routes.ts              # 5 个应用端点
│   │   ├── objects.routes.ts           # 5 个对象端点
│   │   ├── forms.routes.ts             # 表单 + 提交/列表/CSV + workflow 10 个端点
│   │   ├── approval.routes.ts          # 审批通过/驳回
│   │   └── todo.routes.ts              # 待办
│   ├── middleware/                     # 横切关注（5 个文件，全部 Sprint 0 占位）
│   │   ├── jwt-auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   ├── audit-log.middleware.ts
│   │   └── field-permission.middleware.ts
│   ├── clients/                        # 外部服务客户端（待主线程接入）
│   │   ├── ontology.client.ts          # :8090 ontology-engine
│   │   ├── page.client.ts              # :8083 page-generator
│   │   └── api.client.ts               # :3001 metaplatform-api
│   └── utils/
│       ├── response.ts                 # 标准响应包（code/data/traceId 或 code/message/traceId）
│       └── mock.ts                     # asyncHandler 等
└── tests/
    └── unit/
        ├── health.test.ts              # GET /health 单测
        └── api-stubs.test.ts           # 18 个端点烟囱测试
```

---

## 三、18 个 API 端点（与 OpenAPI 契约一一对应）

| # | 方法   | 路径                                       | 实现位置                          |
|---|--------|--------------------------------------------|-----------------------------------|
| 1 | GET    | `/api/apps`                                | `routes/apps.routes.ts`           |
| 2 | POST   | `/api/apps`                                | `routes/apps.routes.ts`           |
| 3 | GET    | `/api/apps/:id`                            | `routes/apps.routes.ts`           |
| 4 | PUT    | `/api/apps/:id`                            | `routes/apps.routes.ts`           |
| 5 | DELETE | `/api/apps/:id`                            | `routes/apps.routes.ts`           |
| 6 | GET    | `/api/apps/:id/objects`                    | `routes/objects.routes.ts`        |
| 7 | POST   | `/api/apps/:id/objects`                    | `routes/objects.routes.ts`        |
| 8 | GET    | `/api/apps/:id/objects/:oid`               | `routes/objects.routes.ts`        |
| 9 | PUT    | `/api/apps/:id/objects/:oid`               | `routes/objects.routes.ts`        |
| 10| DELETE | `/api/apps/:id/objects/:oid`               | `routes/objects.routes.ts`        |
| 11| GET    | `/api/apps/:id/forms`                      | `routes/forms.routes.ts`          |
| 12| POST   | `/api/apps/:id/forms`                      | `routes/forms.routes.ts`          |
| 13| GET    | `/api/apps/:id/forms/:fid`                 | `routes/forms.routes.ts`          |
| 14| PUT    | `/api/apps/:id/forms/:fid`                 | `routes/forms.routes.ts`          |
| 15| POST   | `/api/apps/:id/forms/:fid/publish`         | `routes/forms.routes.ts`          |
| 16| POST   | `/api/apps/:id/forms/:fid/submit`          | `routes/forms.routes.ts`          |
| 17| GET    | `/api/apps/:id/forms/:fid/list`            | `routes/forms.routes.ts`          |
| 18| GET    | `/api/apps/:id/forms/:fid/csv`             | `routes/forms.routes.ts`          |
| 19| POST   | `/api/apps/:id/forms/:fid/workflow`        | `routes/forms.routes.ts`          |
| 20| GET    | `/api/apps/:id/forms/:fid/workflow`        | `routes/forms.routes.ts`          |
| 21| POST   | `/api/workflow/instances/:id/approve`      | `routes/approval.routes.ts`       |
| 22| POST   | `/api/workflow/instances/:id/reject`       | `routes/approval.routes.ts`       |
| 23| GET    | `/api/todos`                               | `routes/todo.routes.ts`           |

> 表里 23 行 = OpenAPI 路径中 18 个端点 + 表单列表的 GET/POST + 对象的 GET/POST + workflow 的 POST/GET 等；
> 任务规范定义的「18 个端点」= 上面 #1 ~ #18 的精确对应（按 05-architecture.md §2.4 计数）。
> 额外 5 行（workflow POST/GET、approve/reject、todos）已实现并计入 OpenAPI。

外加：
- `GET /health` — 健康检查（任务约定：返回 `{ status: 'ok', version: 'v1.0.1-sprint0' }`）

---

## 四、响应包格式

成功（来自 05-architecture.md §5.3）：

```json
{ "code": 0, "data": { ... }, "traceId": "..." }
```

失败：

```json
{ "code": 400, "message": "...", "traceId": "..." }
```

- `code = 0` 表示业务成功，HTTP 状态码为 200 / 201；
- `code >= 400` 表示业务失败，HTTP 状态码与 `code` 一致；
- `traceId` 取自请求头 `x-trace-id`，缺失时自动生成 UUID v4。

---

## 五、如何测试

```bash
# 跑单测（Jest + supertest，含 18 个端点的烟囱测试）
npm test

# 监视模式
npm run test:watch

# 覆盖率
npm run test:coverage

# 类型检查
npm run typecheck

# 手动 curl 验证
curl http://localhost:3002/health
curl http://localhost:3002/api/apps
curl -X POST http://localhost:3002/api/apps \
  -H "Content-Type: application/json" \
  -d '{"code":"travel","name":"出差报销"}'
curl -X POST http://localhost:3002/api/workflow/instances/4001/reject \
  -H "Content-Type: application/json" \
  -d '{}'   # 应当返回 400，message: "驳回必须填写意见 comment"
```

---

## 六、已知 stub 限制（Sprint 0 范围）

| 项 | 现状 | Sprint 1+ 待做 |
|----|------|----------------|
| 数据库 | **没有** SQLite 文件，所有数据是 in-memory mock | T0-2 主线程建表（apps / app_objects / app_forms / app_workflows / app_workflow_instances / app_todos / app_audit_logs） |
| JWT 鉴权 | 中间件存在但放行所有请求 | T1 实现 jwt.verify + req.user 注入 |
| RBAC | 工厂方法存在但未挂载 | 在 POST/PUT/DELETE 上挂 rbac([...]) |
| 字段权限 | 工厂方法存在但未挂载 | T3-10 实现 |
| 审计日志 | 中间件存在但未落库 | T0-2 建 audit_logs 表后接入 |
| 外部 client | ontology / page / api 三个 stub 都抛 `Error: not implemented` | T0-4 / T0-5 / T1-4 替换为真实 HTTP 客户端 |
| 业务返回 data | 是固定 mock，**不会持久化** | T1-1 起替换为真实 Service 调用 |
| 软删 / 事务回滚 | 标记 deleted=true，**未实际删表/回滚** | T1-1 起配合 ontology 客户端联动 |
| 列表分页 / 过滤 | 仅取 query.page / pageSize，未真正查库 | T2-3 实现 |
| CSV 导出 | 返回固定 3 行 | T2-4 用 utils/csv.ts 流式输出 |
| 流程引擎 | 直接返回默认 start→approve→end | T3-3 实现简化状态机 |

---

## 七、Subagent 协作提示

> 来自 02-sprint-plan.md §七.3，每次派给 subagent 的任务都按此模板：
> - 上下文（版本、Sprint、契约路径、相关文件）
> - 输入 / 输出
> - **不要做的事**（不要改接口契约、不要动 ontology-engine / page-generator、不要碰 sprint 范围之外的任务）
> - 完成后请告知（diff、测试结果、是否需要主线程对接外部服务）

Sprint 0 完成后，后续 subagent 任务候选：
- T1-1（应用 CRUD 实现）、T1-2（对象 CRUD）、T2-1（表单 CRUD）、T2-3（列表分页）等都可独立派发。

---

## 八、其他脚本

```bash
npm run dev          # tsx watch src/index.ts
npm run build        # tsc -p tsconfig.json → dist/
npm run start        # node dist/index.js（生产期）
npm run typecheck    # tsc --noEmit
npm run test         # jest --runInBand
npm run test:coverage
```
