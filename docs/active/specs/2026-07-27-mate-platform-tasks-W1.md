# W1 任务卡：项目骨架 + Swagger/OpenAPI

> **源交付项**：[路线图 §4 W1](./2026-07-27-mate-platform-delivery-roadmap.md#w1---项目骨架--swaggeropenapi)
> **总览**：[Task Breakdown](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S1（2026-07-28 ~ 2026-08-10）
> **里程碑**：M1 上半
> **任务卡总数**：37

---

## 目录

- [W1-1 建 `mate-platform-backend/` monorepo](#w1-1-建-mate-platform-backend-monorepo)
- [W1-2 Swagger 三件套集成](#w1-2-swagger-三件套集成)
- [W1-3 IAM OpenAPI 初稿](#w1-3-iam-openapi-初稿)
- [W1-4 Knowledge OpenAPI 初稿](#w1-4-knowledge-openapi-初稿)
- [W1-5 Ontology OpenAPI 初稿](#w1-5-ontology-openapi-初稿)
- [W1-6 CI 校验流水线](#w1-6-ci-校验流水线)
- [W1-7 OpenAPI ↔ Pydantic 模型对齐](#w1-7-openapi--pydantic-模型对齐)

---

## W1-1 建 `mate-platform-backend/` monorepo

> **路线图工时**：2d | **拆出 TC 数**：7 | **关键路径**：是

### TC-1.1.1 uv 初始化 + pyproject.toml

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | — |
| **可并行 TC** | TC-1.6.1、TC-1.1.5 |
| **输出 PR** | `chore: init uv workspace` |
| **关键路径** | 是 |

**目标**：在 `mate-platform-backend/` 下用 `uv` 初始化 workspace，产出 `pyproject.toml`（含 ruff/pyright/pytest 配置）。

**输入产物**：空目录 `mate-platform-backend/`。

**实现步骤**：
1. `cd mate-platform-backend && uv init --workspace`
2. 编写根 `pyproject.toml`：声明 `[tool.uv]` workspace 成员 `["apps/*", "libs/*"]`
3. 加 `[tool.ruff]`：line-length=100、target-version="py312"、select=["E","F","I","N","UP","B","SIM","RUF"]
4. 加 `[tool.pyright]`：strict=true、pythonVersion="3.12"、reportMissingTypeStubs=true
5. 加 `[tool.pytest.ini_options]`：testpaths=["tests"]、addopts="-q --cov=apps --cov=libs --cov-fail-under=80"

**DoD 验证清单**：
- [ ] `uv sync` 在空仓库一次性成功
- [ ] `uv run ruff check .` 无 warning
- [ ] `uv run pyright` 无 error
- [ ] `uv run pytest --collect-only` 不报错

---

### TC-1.1.2 目录结构（apps/libs/tests/docs/scripts）

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.1 |
| **可并行 TC** | TC-1.1.3 |
| **输出 PR** | `chore: scaffold monorepo tree` |
| **关键路径** | 是 |

**目标**：建立标准 monorepo 目录结构。

**输入产物**：TC-1.1.1 后的 `pyproject.toml`。

**实现步骤**：
1. 创建 `apps/{hello,sample}/`（先用 hello 跑通）
2. 创建 `libs/{common,openapi-schemas,infra-contracts}/`
3. 创建 `tests/{unit,integration,e2e}/`
4. 创建 `docs/{adr,runbooks}/`
5. 创建 `scripts/{setup,ci,dev}/`
6. 每个 `apps/*/pyproject.toml` 用 `uv init --package` 生成

**DoD 验证清单**：
- [ ] 目录树符合 ADR-0001 模板
- [ ] 每个 `apps/*` 都能 `uv sync` 独立运行
- [ ] `tree -L 3 -I '.venv|__pycache__|node_modules'` 输出符合预期

---

### TC-1.1.3 预提交 hooks（pre-commit）

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.1 |
| **可并行 TC** | TC-1.1.2 |
| **输出 PR** | `chore: add pre-commit hooks` |

**目标**：本地提交前自动跑 ruff + pyright + 文件尾换行。

**实现步骤**：
1. 写 `.pre-commit-config.yaml`，引入 `pre-commit-hooks`、`astral-sh/ruff-pre-commit`、`RobertCraigie/pyright-pre-commit`
2. 写 `scripts/setup/install-hooks.sh`（Windows 用 `install-hooks.ps1`）
3. 在 `README.md` 写"开发流程"章节

**DoD 验证清单**：
- [ ] `pre-commit run --all-files` 全绿
- [ ] 故意写 `print("xx")` 后 commit，会被 hook 拦下

---

### TC-1.1.4 CI 基础流水线（lint + type + test）

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.1.1、TC-1.1.2 |
| **可并行 TC** | TC-1.6.1 ~ TC-1.6.5 |
| **输出 PR** | `ci: add python pipeline` |
| **关键路径** | 是 |

**目标**：PR 触发基础 Python 流水线，3 个 job（lint/type/test）。

**实现步骤**：
1. 写 `.github/workflows/python.yml`
2. job `lint`：`uv sync` + `uv run ruff check` + `uv run ruff format --check`
3. job `type`：`uv run pyright`
4. job `test`：`uv run pytest --cov` + `codecov upload`
5. 矩阵：python-version=["3.12"]

**DoD 验证清单**：
- [ ] PR 触发 3 job 全绿
- [ ] cache `~/.cache/uv` 命中（≤ 60s 增量）

---

### TC-1.1.5 README + CONTRIBUTING + .gitignore + .editorconfig

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | — |
| **可并行 TC** | TC-1.1.1、TC-1.1.3 |
| **输出 PR** | `docs: bootstrap project docs` |

**目标**：新人 30 分钟能跑通。

**实现步骤**：
1. `README.md`：项目定位、目录结构、本地启动命令、CI 状态徽章
2. `CONTRIBUTING.md`：分支策略（trunk-based + feature branch）、commit 规范（Conventional Commits）
3. `.gitignore`：Python + uv + IDE + OS
4. `.editorconfig`：charset=utf-8、indent_style=space、indent_size=4

**DoD 验证清单**：
- [ ] 新人按 README 在干净机器上 30 分钟内 `uv sync && uv run pytest`

---

### TC-1.1.6 vscode 配置（settings/extensions/launch）

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.1 |
| **可并行 TC** | TC-1.1.5 |
| **输出 PR** | `chore: add vscode config` |

**目标**：打开仓库即有正确配置。

**实现步骤**：
1. `.vscode/settings.json`：开启 ruff 格式化、pyright in editor
2. `.vscode/extensions.json`：推荐 Ruff、Pyright、Even Better TOML
3. `.vscode/launch.json`：debug 当前 `apps/hello`

**DoD 验证清单**：
- [ ] 在未装插件的 vscode 中打开，弹推荐安装

---

### TC-1.1.7 baseline Hello World app 跑通

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.2、TC-1.1.4 |
| **可并行 TC** | — |
| **输出 PR** | `feat(hello): baseline app` |
| **关键路径** | 是 |

**目标**：用 `apps/hello` 跑通"建包 + 路由 + 测试 + 启动"全链路。

**实现步骤**：
1. `apps/hello/pyproject.toml` 声明依赖 `fastapi`、`uvicorn`
2. `apps/hello/src/hello/main.py`：FastAPI app + `GET /healthz` + `GET /hello/{name}`
3. `apps/hello/tests/test_main.py`：pytest 覆盖两个端点
4. `apps/hello/Dockerfile`：多阶段构建（uv → runtime）
5. `docker-compose.yml` 加 `hello` 服务（端口 8001）

**DoD 验证清单**：
- [ ] `uv run --package hello uvicorn hello.main:app` 启动成功
- [ ] `curl localhost:8001/healthz` 返回 `{"status":"ok"}`
- [ ] `curl localhost:8001/hello/world` 返回 `{"message":"hello world"}`
- [ ] `uv run --package hello pytest` 全绿
- [ ] `docker compose up hello` 容器可访问

---

## W1-2 Swagger 三件套集成

> **路线图工时**：2d | **拆出 TC 数**：5 | **关键路径**：否

### TC-1.2.1 docker-compose.yml 加 swagger-editor/ui/prism 服务

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-1.2.2 |
| **输出 PR** | `dev: add swagger stack` |

**目标**：本地一键启动 Swagger Editor / UI / Prism。

**实现步骤**：
1. `docker-compose.yml` 新增 services：
   - `swagger-editor`：swaggerapi/swagger-editor 端口 8081
   - `swagger-ui`：swaggerapi/swagger-ui 端口 8082，SWAGGER_JSON=/openapi/index.yaml
   - `prism`：stoplight/prism:4 端口 8083，命令 `mock -p 4010 -s /openapi/index.yaml`
2. `./openapi` 目录挂到容器 `/openapi`
3. 网络 `mate-net` 内互通

**DoD 验证清单**：
- [ ] `docker compose up swagger-editor swagger-ui prism` 全绿
- [ ] 三服务 `docker compose ps` 均 `healthy`

---

### TC-1.2.2 初始 openapi 目录结构

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | — |
| **可并行 TC** | TC-1.2.1 |
| **输出 PR** | `docs(openapi): scaffold` |

**目标**：建立 `openapi/` 规范目录。

**实现步骤**：
1. `openapi/index.yaml` 顶层：openapi=3.1.0、info.title="Mate Platform"、servers=[{url:"/"}]
2. `openapi/paths/` 预留空目录
3. `openapi/schemas/` 预留空目录
4. `openapi/components.yaml` 预留 securitySchemes
5. `openapi/.redocly.yaml` 配 lint 规则

**DoD 验证清单**：
- [ ] swagger-ui 能渲染 index.yaml
- [ ] `redocly lint openapi/index.yaml` 无 error

---

### TC-1.2.3 验证 prism mock 响应

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.2.1、TC-1.2.2 |
| **可并行 TC** | — |
| **输出 PR** | `chore(openapi): verify prism` |

**目标**：prism 容器能根据 OpenAPI 给出 mock 响应。

**实现步骤**：
1. 在 `openapi/paths/healthz.yaml` 加示例 path `/healthz`
2. `openapi/index.yaml` 用 `$ref` 引入
3. `docker compose restart prism`
4. `curl http://localhost:8083/healthz` 验证

**DoD 验证清单**：
- [ ] prism 对已声明 path 返回 mock JSON
- [ ] prism 对未声明 path 返回 404

---

### TC-1.2.4 swagger-ui 渲染验证

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.2.3 |
| **可并行 TC** | — |
| **输出 PR** | `chore(openapi): verify ui` |

**目标**：浏览器能打开 swagger-ui 并看到 endpoint 列表。

**实现步骤**：
1. 浏览器开 `http://localhost:8082`
2. 截图归档到 `docs/screenshots/swagger-ui.png`
3. 在 `docs/runbooks/dev.md` 加引用

**DoD 验证清单**：
- [ ] UI 列出所有 path
- [ ] "Try it out" 按钮可用

---

### TC-1.2.5 README 写明如何使用

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.2.4 |
| **可并行 TC** | — |
| **输出 PR** | `docs: swagger usage` |

**目标**：新人能照 README 一行命令启动。

**实现步骤**：
1. `docs/runbooks/swagger.md`：写启动 / 编辑 / 校验 / mock 命令
2. `README.md` 加 "API 设计入口"段落，链到 `docs/runbooks/swagger.md`

**DoD 验证清单**：
- [ ] 新人照文档 5 分钟内启动 swagger-ui

---

## W1-3 IAM OpenAPI 初稿

> **路线图工时**：2d | **拆出 TC 数**：5 | **关键路径**：否

### TC-1.3.1 定义 IAM 核心模型

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.2.2 |
| **可并行 TC** | TC-1.3.2 |
| **输出 PR** | `docs(openapi): iam schemas` |

**目标**：在 `openapi/schemas/iam/` 定义 5 个核心 model。

**实现步骤**：
1. `user.yaml`：User（含 id、email、displayName、status、tenantId、createdAt）
2. `role.yaml`：Role（含 id、name、composite、clientRole）
3. `realm.yaml`：Realm（含 id、displayName、enabled）
4. `client.yaml`：Client（含 id、secret、redirectUris、webOrigins）
5. `tenant.yaml`：Tenant（含 id、name、status、ownerId）
6. `error.yaml`：ErrorResponse（code、message、traceId）

**DoD 验证清单**：
- [ ] swagger-ui 能展开所有 schema
- [ ] `redocly lint` 无 error
- [ ] 每个 schema 含 description 与 example

---

### TC-1.3.2 写 10 个核心端点

| 字段 | 值 |
|---|---|
| **预估工时** | 6h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.3.1 |
| **可并行 TC** | TC-1.3.3 |
| **输出 PR** | `docs(openapi): iam paths` |

**目标**：在 `openapi/paths/iam/` 覆盖以下端点：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/iam/tenants` | POST/GET | 创建/列表 |
| `/api/v1/iam/tenants/{id}` | GET/PATCH/DELETE | CRUD |
| `/api/v1/iam/users` | POST/GET | 创建/列表 |
| `/api/v1/iam/users/{id}/roles` | PUT/DELETE | 角色绑定 |
| `/api/v1/iam/roles` | POST/GET | 角色 CRUD |
| `/api/v1/iam/auth/login` | POST | 用户名密码登录 |
| `/api/v1/iam/auth/refresh` | POST | 刷新 token |
| `/api/v1/iam/auth/logout` | POST | 注销 |
| `/api/v1/iam/auth/me` | GET | 当前用户信息 |
| `/api/v1/iam/auth/check` | POST | 权限校验 |

**DoD 验证清单**：
- [ ] 10 端点均带 request/response 示例
- [ ] 错误响应统一引用 ErrorResponse
- [ ] 4xx/5xx 响应码规范

---

### TC-1.3.3 swagger-cli lint 通过

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.3.2 |
| **可并行 TC** | — |
| **输出 PR** | `ci(openapi): iam lint` |

**目标**：本地 + CI 跑 `swagger-cli lint` 全绿。

**实现步骤**：
1. 写 `scripts/lint-openapi.sh`：`swagger-cli bundle openapi/index.yaml -o /tmp/_oas.json -t yaml && swagger-cli lint /tmp/_oas.json`
2. 本地跑一次确认通过
3. 把命令接进 TC-1.6.1 流水线

**DoD 验证清单**：
- [ ] `scripts/lint-openapi.sh` 退出码 0
- [ ] CI 中 `openapi-lint` job 绿

---

### TC-1.3.4 错误响应 schema 统一

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.3.1 |
| **可并行 TC** | TC-1.3.2 |
| **输出 PR** | `docs(openapi): error schema` |

**目标**：所有 4xx/5xx 复用 `components.responses.ErrorResponse`。

**实现步骤**：
1. `openapi/components.yaml` 加 `responses.ErrorResponse`
2. 所有 path 的 4xx/5xx 用 `$ref: '#/components/responses/ErrorResponse'`
3. 写 ADR-0002：错误码分类（4A 鉴权、4B 业务、4C 参数、5X 系统）

**DoD 验证清单**：
- [ ] grep 全仓，路径无 inline error schema
- [ ] ADR-0002 合并

---

### TC-1.3.5 与 W1-7 Pydantic 模型对齐初稿

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.3.2、TC-1.7.1 |
| **可并行 TC** | TC-1.4.5、TC-1.5.5 |
| **输出 PR** | `feat(iam): pydantic models draft` |
| **关键路径** | 是 |

**目标**：用 `datamodel-code-generator` 从 `openapi/schemas/iam/` 生成 Pydantic v2 模型到 `libs/openapi-schemas/src/iam/`。

**实现步骤**：
1. 写 `scripts/generate-pydantic.sh`：`datamodel-codegen --input openapi/schemas/iam/... --output libs/openapi-schemas/src/iam/`
2. 人工修正生成结果（如 Union 简化）
3. 写 `tests/test_iam_schemas.py`：序列化/反序列化 roundtrip
4. 提交生成文件（不要只 commit generator config）

**DoD 验证清单**：
- [ ] `uv run --package openapi-schemas pytest` 全绿
- [ ] CI 中 `models-gen` job 校验"生成结果 == 仓库现有"

---

## W1-4 Knowledge OpenAPI 初稿

> **路线图工时**：2d | **拆出 TC 数**：5 | **关键路径**：否

### TC-1.4.1 Knowledge 核心模型

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.2.2 |
| **可并行 TC** | TC-1.3.1 |
| **输出 PR** | `docs(openapi): kb schemas` |

**目标**：5 个核心 model。

**实现步骤**：
1. `knowledge-base.yaml`：KB（id、name、description、embeddingModel、chunkStrategy）
2. `document.yaml`：Document（id、kbId、status、sourceUri、metadata）
3. `chunk.yaml`：Chunk（id、documentId、ordinal、text、tokens、metadata）
4. `embedding.yaml`：Embedding（chunkId、model、vector、dim）
5. `retrieval-request.yaml` / `retrieval-response.yaml`

**DoD 验证清单**：
- [ ] swagger-ui 渲染
- [ ] `redocly lint` 绿

---

### TC-1.4.2 核心端点

| 字段 | 值 |
|---|---|
| **预估工时** | 6h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.4.1 |
| **可并行 TC** | TC-1.4.3 |
| **输出 PR** | `docs(openapi): kb paths` |

**目标**：12 个端点（CRUD + 检索 + 文档生命周期）。

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/kb/bases` | POST/GET | 知识库 CRUD |
| `/api/v1/kb/bases/{id}` | GET/PATCH/DELETE | 单个 KB |
| `/api/v1/kb/bases/{id}/documents` | POST/GET | 文档上传/列表 |
| `/api/v1/kb/documents/{id}` | GET/DELETE | 文档详情/删除 |
| `/api/v1/kb/documents/{id}/chunks` | GET | 分块列表 |
| `/api/v1/kb/documents/{id}/retry` | POST | 重试失败分块 |
| `/api/v1/kb/search` | POST | 检索 |
| `/api/v1/kb/search/stream` | POST | 流式检索（SSE） |
| `/api/v1/kb/embeddings/rebuild` | POST | 重建向量 |
| `/api/v1/kb/embeddings/{id}` | GET | 单条 embedding |
| `/api/v1/kb/stats` | GET | 统计 |
| `/api/v1/kb/health` | GET | 健康检查 |

**DoD 验证清单**：
- [ ] 12 端点齐
- [ ] SSE 端点注明 `text/event-stream`

---

### TC-1.4.3 swagger-cli lint 通过

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.4.2 |
| **可并行 TC** | — |
| **输出 PR** | `ci(openapi): kb lint` |

**目标**：KB 模块 lint 绿。

**实现步骤**：同 TC-1.3.3，针对 KB 路径。

**DoD 验证清单**：
- [ ] CI 中 KB 子集 lint 通过

---

### TC-1.4.4 异步任务端点（webhook/poll）

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.4.1 |
| **可并行 TC** | TC-1.4.2 |
| **输出 PR** | `docs(openapi): kb async tasks` |

**目标**：补齐 `/api/v1/kb/tasks/{id}` 与 webhook 回调。

**实现步骤**：
1. `task.yaml` schema：Task（id、type、status、progress、resultUrl）
2. `/api/v1/kb/tasks/{id}` GET：查询任务状态
3. 文档说明：可选 `X-Webhook-URL` header
4. 在 `knowledge-base.yaml` 加 `taskWebhookUrl` 配置

**DoD 验证清单**：
- [ ] 任务查询端点完整
- [ ] Webhook 配置有 example

---

### TC-1.4.5 与 W1-7 Pydantic 对齐初稿

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.4.2、TC-1.7.1 |
| **可并行 TC** | TC-1.3.5、TC-1.5.5 |
| **输出 PR** | `feat(kb): pydantic models draft` |
| **关键路径** | 是 |

**目标**：生成 KB 的 Pydantic 模型 + 单测。

**实现步骤**：同 TC-1.3.5。

**DoD 验证清单**：
- [ ] `uv run --package openapi-schemas pytest -k kb` 绿
- [ ] roundtrip 测试覆盖所有 schema

---

## W1-5 Ontology OpenAPI 初稿

> **路线图工时**：1d | **拆出 TC 数**：5 | **关键路径**：否

### TC-1.5.1 Ontology 核心模型

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.2.2 |
| **可并行 TC** | TC-1.3.1、TC-1.4.1 |
| **输出 PR** | `docs(openapi): ont schemas` |

**目标**：5 个核心 model。

**实现步骤**：
1. `ontology.yaml`：Ontology（id、version、namespace、prefixes）
2. `class.yaml`：OClass（id、label、parent、properties）
3. `property.yaml`：OProperty（id、label、domain、range、cardinality）
4. `instance.yaml`：OInstance（id、classId、values）
5. `relation.yaml`：ORelation（id、type、from、to、props）

**DoD 验证清单**：
- [ ] swagger-ui 渲染
- [ ] `redocly lint` 绿

---

### TC-1.5.2 核心端点（CRUD + SPARQL）

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.5.1 |
| **可并行 TC** | — |
| **输出 PR** | `docs(openapi): ont paths` |

**目标**：10 个端点（覆盖 CRUD + 查询）。

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/ont/ontologies` | POST/GET | 列表/创建 |
| `/api/v1/ont/ontologies/{id}` | GET/PATCH/DELETE | 详情 |
| `/api/v1/ont/classes` | POST/GET | 类 |
| `/api/v1/ont/properties` | POST/GET | 属性 |
| `/api/v1/ont/instances` | POST/GET | 实例 |
| `/api/v1/ont/relations` | POST/GET | 关系 |
| `/api/v1/ont/sparql` | POST | SPARQL 查询 |
| `/api/v1/ont/sparql/explain` | POST | 查询计划 |

**DoD 验证清单**：
- [ ] 10 端点齐
- [ ] SPARQL 端点含 SELECT/INSERT/DELETE 模式示例

---

### TC-1.5.3 swagger-cli lint 通过

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.5.2 |
| **可并行 TC** | — |
| **输出 PR** | `ci(openapi): ont lint` |

**DoD 验证清单**：
- [ ] CI 绿

---

### TC-1.5.4 兼容 OWL 2 注解

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.5.1 |
| **可并行 TC** | TC-1.5.2 |
| **输出 PR** | `docs(openapi): owl annotations` |

**目标**：在 `class/property/instance` schema 中保留 OWL 注解字段（rdfs:label、skos:prefLabel、owl:deprecated）。

**实现步骤**：
1. 在每个 schema 加 `annotations: object` 字段
2. 在 ADR-0003 写明 OWL 字段映射策略

**DoD 验证清单**：
- [ ] `annotations` 字段存在于所有 model
- [ ] ADR-0003 合并

---

### TC-1.5.5 与 W1-7 Pydantic 对齐初稿

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.5.2、TC-1.7.1 |
| **可并行 TC** | TC-1.3.5、TC-1.4.5 |
| **输出 PR** | `feat(ont): pydantic models draft` |
| **关键路径** | 是 |

**DoD 验证清单**：
- [ ] 生成模型 + 单测齐
- [ ] roundtrip 通过

---

## W1-6 CI 校验流水线

> **路线图工时**：1d | **拆出 TC 数**：5 | **关键路径**：是

### TC-1.6.1 openapi-lint workflow

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.2.2、TC-1.3.3 |
| **可并行 TC** | TC-1.6.2、TC-1.6.3 |
| **输出 PR** | `ci: openapi lint` |
| **关键路径** | 是 |

**目标**：GitHub Actions 跑 `swagger-cli lint` + `oasdiff breaking`。

**实现步骤**：
1. `.github/workflows/openapi.yml`
2. job `lint`：`swagger-cli bundle` + `swagger-cli lint`
3. job `breaking`：`oasdiff breaking <base> <head>`，base 来自 `origin/${{ github.base_ref }}`
4. cache `~/.npm`（swagger-cli 走 npx）

**DoD 验证清单**：
- [ ] 故意改坏 OpenAPI，PR 阻断
- [ ] 删除字段时被 oasdiff 标红

---

### TC-1.6.2 python-lint workflow

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.1.4 |
| **可并行 TC** | TC-1.6.1 |
| **输出 PR** | `ci: python lint` |

**目标**：单跑 ruff + pyright（与 TC-1.1.4 分开，便于失败定位）。

**DoD 验证清单**：
- [ ] `python-lint` job 独立绿

---

### TC-1.6.3 python-test workflow（含覆盖率门槛）

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.1.4 |
| **可并行 TC** | TC-1.6.1 |
| **输出 PR** | `ci: python test with cov` |

**DoD 验证清单**：
- [ ] `pytest --cov-fail-under=80` 绿
- [ ] codecov 上传成功

---

### TC-1.6.4 docker-build workflow（基础镜像）

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | — |
| **输出 PR** | `ci: docker build` |

**目标**：构建 `hello` 镜像并 push 到 ghcr.io（仅 main 分支）。

**DoD 验证清单**：
- [ ] main 触发后 ghcr.io 有新 tag
- [ ] 多架构（linux/amd64、linux/arm64）支持

---

### TC-1.6.5 PR 模板 + CODEOWNERS

| 字段 | 值 |
|---|---|
| **预估工时** | 1h |
| **负责人角色** | Backend |
| **前置 TC** | — |
| **可并行 TC** | TC-1.6.1 ~ TC-1.6.4 |
| **输出 PR** | `docs: pr template + codeowners` |

**实现步骤**：
1. `.github/PULL_REQUEST_TEMPLATE.md`：变更说明 / 影响范围 / 测试 / DoD 自检
2. `.github/CODEOWNERS`：IAM=@xxx、KB=@yyy、ONT=@zzz

**DoD 验证清单**：
- [ ] 改 IAM 文件会触发对应 reviewer

---

## W1-7 OpenAPI ↔ Pydantic 模型对齐

> **路线图工时**：3d | **拆出 TC 数**：5 | **关键路径**：是

### TC-1.7.1 共享 schemas 目录设计

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.2 |
| **可并行 TC** | TC-1.6.1 |
| **输出 PR** | `feat(schemas): shared package` |
| **关键路径** | 是 |

**目标**：在 `libs/openapi-schemas/` 建共享包。

**实现步骤**：
1. `libs/openapi-schemas/pyproject.toml`：依赖 `pydantic>=2.6`
2. `src/openapi_schemas/__init__.py`：暴露 `iam`、`kb`、`ont` 三个子包
3. `src/openapi_schemas/common/`：共用（Page、ErrorResponse、ID）
4. ADR-0004：写入"为什么单源（OpenAPI）"

**DoD 验证清单**：
- [ ] `uv add libs/openapi-schemas` 在 `apps/hello` 可用
- [ ] ADR-0004 合并

---

### TC-1.7.2 自动化生成脚本

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.7.1 |
| **可并行 TC** | TC-1.7.3 |
| **输出 PR** | `feat(schemas): codegen script` |
| **关键路径** | 是 |

**目标**：从 OpenAPI 自动生成 Pydantic v2 模型。

**实现步骤**：
1. `scripts/generate-pydantic.sh`：
   ```bash
   datamodel-codegen \
     --input openapi/index.yaml \
     --input-file-type openapi \
     --output libs/openapi-schemas/src/openapi_schemas/ \
     --output-model-type pydantic_v2.BaseModel \
     --use-schema-description \
     --use-field-description \
     --target-python-version 3.12
   ```
2. 提供 `scripts/generate-pydantic.ps1` 镜像
3. 写 `scripts/regen-and-check.sh`：生成 → `git diff`，若非空则报错

**DoD 验证清单**：
- [ ] `./scripts/regen-and-check.sh` 在干净仓 exit 0
- [ ] 改 OpenAPI 后，CI 跑 `regen-and-check` 失败

---

### TC-1.7.3 CI 中加对齐校验

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.7.2 |
| **可并行 TC** | TC-1.6.3 |
| **输出 PR** | `ci: model alignment check` |
| **关键路径** | 是 |

**目标**：每次 PR 都校验 Pydantic 模型与 OpenAPI 同步。

**DoD 验证清单**：
- [ ] `model-align` job 失败时阻止 merge

---

### TC-1.7.4 三模块 Pydantic 模型实现

| 字段 | 值 |
|---|---|
| **预估工时** | 6h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.3.5、TC-1.4.5、TC-1.5.5 |
| **可并行 TC** | — |
| **输出 PR** | `feat(schemas): all modules` |
| **关键路径** | 是 |

**目标**：合入 IAM/KB/ONT 全部 Pydantic 模型 + 单测。

**DoD 验证清单**：
- [ ] `uv run --package openapi-schemas pytest` 覆盖率 ≥ 80%

---

### TC-1.7.5 示例接口实现 + 测试

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.7.4 |
| **可并行 TC** | — |
| **输出 PR** | `feat(hello): use generated schemas` |
| **关键路径** | 是 |

**目标**：在 `apps/hello` 用一份生成的 schema 串通 request/response。

**实现步骤**：
1. `/hello` 端点接收 `HelloRequest`、返回 `HelloResponse`
2. 故意传非法 payload，验证 422
3. swagger-ui "Try it out" 调用通过

**DoD 验证清单**：
- [ ] `curl` 合法 / 非法 payload 分别正确返回
- [ ] 422 响应符合 ErrorResponse 规范

---

## W1 完成度检查表

| W1-n | 路线图 ID | 关键路径 | 路线图工时 | TC 数 | 状态 |
|---|---|---|---|---|---|
| W1-1 | §4 W1-1 | 是 | 2d | 7 | 未启动 |
| W1-2 | §4 W1-2 | 否 | 2d | 5 | 未启动 |
| W1-3 | §4 W1-3 | 否 | 2d | 5 | 未启动 |
| W1-4 | §4 W1-4 | 否 | 2d | 5 | 未启动 |
| W1-5 | §4 W1-5 | 否 | 1d | 5 | 未启动 |
| W1-6 | §4 W1-6 | 是 | 1d | 5 | 未启动 |
| W1-7 | §4 W1-7 | 是 | 3d | 5 | 未启动 |
| **合计** | — | — | **~13d** | **37** | **未启动** |

---

## Sprint S1 建议排程

| 周 | 重点 TC | 备注 |
|---|---|---|
| W1 D1-D2 | TC-1.1.1 ~ TC-1.1.4 | 后端骨架 + CI 基线 |
| W1 D3-D4 | TC-1.1.5 ~ TC-1.1.7、TC-1.6.5 | 文档 + Hello 跑通 |
| W1 D5 | TC-1.2.1 ~ TC-1.2.5 | Swagger 三件套上线 |
| W2 D1-D2 | TC-1.3.1 ~ TC-1.3.4 | IAM OpenAPI |
| W2 D3-D4 | TC-1.4.1 ~ TC-1.4.4、TC-1.5.1 ~ TC-1.5.4 | KB + ONT OpenAPI |
| W2 D5 | TC-1.6.1 ~ TC-1.6.4 | CI 完整化 |
| W2 D6-D7 | TC-1.7.1 ~ TC-1.7.5 | Pydantic 对齐 + 示例 |

> 注：实际开发应允许 ±20% 浮动，关键路径卡需在 2 周内全部合入。

---

## 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-07-27 | v1.0 初稿 | 配合 Task Breakdown 总览建立 W1 任务卡 |

