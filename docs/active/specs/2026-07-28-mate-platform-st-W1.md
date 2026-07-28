# W1 子任务卡（ST）：项目骨架 + Swagger/OpenAPI

> **源任务卡**：[tasks-W1.md](./2026-07-27-mate-platform-tasks-W1.md)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S1（2026-07-28 ~ 2026-08-10）
> **里程碑**：M1 上半
> **ST 总数**：99（覆盖 37 张 TC）
> **颗粒度**：0.5–4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [W1-1 monorepo 骨架](#w1-1-monorepo-骨架)
- [W1-2 Swagger 三件套](#w1-2-swagger-三件套)
- [W1-3 IAM OpenAPI 初稿](#w1-3-iam-openapi-初稿)
- [W1-4 Knowledge OpenAPI 初稿](#w1-4-knowledge-openapi-初稿)
- [W1-5 Ontology OpenAPI 初稿](#w1-5-ontology-openapi-初稿)
- [W1-6 CI 校验流水线](#w1-6-ci-校验流水线)
- [W1-7 OpenAPI ↔ Pydantic 对齐](#w1-7-openapi--pydantic-对齐)

---
## W1-1 monorepo 骨架（7 TC → 19 ST）

### TC-1.1.1 uv 初始化 + pyproject.toml（4h → 4 ST）

#### ST-1.1.1.1 创建空目录并 uv init --workspace

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | mate-platform-backend/（新建空目录） |
| 涉及命令 | uv init --workspace |
| 前置 ST | — |
| 输出 commit | chore: init uv workspace (ST-1.1.1.1) |

**目标**：空目录里跑 uv init --workspace，生成 pyproject.toml 雏形。

**改动清单**：
1. mkdir mate-platform-backend && cd mate-platform-backend
2. uv init --workspace 生成根 pyproject.toml
3. 提交空目录结构

**DoD**：
- [ ] ls mate-platform-backend/ 看到 pyproject.toml + .gitignore（uv 生成）
- [ ] git status clean

---

#### ST-1.1.1.2 根 pyproject.toml 加 [tool.uv] workspace 声明

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | mate-platform-backend/pyproject.toml |
| 前置 ST | ST-1.1.1.1 |
| 输出 commit | chore: declare workspace members |

**目标**：让 workspace 知道 apps/* 和 libs/* 是成员。

**改动清单**：
1. 编辑 pyproject.toml，新增 [tool.uv] section
2. 写 workspace = { members = [apps/*, libs/*] }
3. 写 requires-python = >=3.12

**DoD**：
- [ ] uv sync 不报错
- [ ] uv workspace list 输出含 apps/hello、libs/common

---

#### ST-1.1.1.3 配置 ruff（pyproject.toml）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | pyproject.toml [tool.ruff] section |
| 前置 ST | ST-1.1.1.2 |
| 输出 commit | chore: ruff config (ST-1.1.1.3) |

**目标**：固化 ruff 规则。

**改动清单**：
1. 加 [tool.ruff] 配置块
2. line-length=100、target-version=py312
3. select=[E,F,I,N,UP,B,SIM,RUF]

**DoD**：
- [ ] uv run ruff check . 无 error
- [ ] uv run ruff format --check . 无 diff

---

#### ST-1.1.1.4 配置 pyright + pytest

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | pyproject.toml [tool.pyright] / [tool.pytest.ini_options] |
| 前置 ST | ST-1.1.1.3 |
| 输出 commit | chore: pyright + pytest config |

**目标**：固化类型检查 + 测试配置。

**改动清单**：
1. 加 [tool.pyright]: strict=true、pythonVersion=3.12、reportMissingTypeStubs=true
2. 加 [tool.pytest.ini_options]: testpaths=[tests]、addopts=-q --cov=apps --cov=libs --cov-fail-under=80
3. 故意写 print(x) 验证 ruff 拦下

**DoD**：
- [ ] uv run pyright 在 hello app 上无 error
- [ ] uv run pytest --collect-only 不报错
- [ ] 故意 print 被 ruff 拦下

---
### TC-1.1.2 目录结构（2h → 3 ST）

#### ST-1.1.2.1 创建 apps/{hello,sample}/ 骨架

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/hello/pyproject.toml、apps/sample/pyproject.toml |
| 前置 ST | ST-1.1.1.2 |
| 输出 commit | chore: scaffold apps/{hello,sample} |

**改动清单**：
1. cd apps && uv init --package hello
2. uv init --package sample
3. 各自生成 src/<name>/__init__.py

**DoD**：
- [ ] tree apps/ 显示两个包结构

---

#### ST-1.1.2.2 创建 libs/{common,openapi-schemas,infra-contracts}/

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | libs/{common,openapi-schemas,infra-contracts}/pyproject.toml |
| 前置 ST | ST-1.1.2.1 |
| 输出 commit | chore: scaffold libs/* |

**改动清单**：
1. 对三个库目录分别 uv init --package <name>
2. 每个含 src/<name>/__init__.py

**DoD**：
- [ ] tree libs/ 显示三个包

---

#### ST-1.1.2.3 创建 tests/{unit,integration,e2e}/ + docs/{adr,runbooks}/ + scripts/

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.2 |
| 工时 | 0.7h | 角色 | Backend |
| 目标文件 | tests/{unit,integration,e2e}/、docs/{adr,runbooks}/、scripts/{setup,ci,dev}/ |
| 前置 ST | ST-1.1.2.2 |
| 输出 commit | chore: scaffold tests + docs + scripts |

**改动清单**：
1. mkdir -p tests/{unit,integration,e2e} 每个含 __init__.py
2. mkdir -p docs/{adr,runbooks} scripts/{setup,ci,dev}
3. 每个目录加 .gitkeep
4. docs/adr/0001-record-architecture-decisions.md（adr 模板）

**DoD**：
- [ ] tree docs/ scripts/ 输出符合 ADR-0001 模板

---

### TC-1.1.3 pre-commit hooks（2h → 3 ST）

#### ST-1.1.3.1 写 .pre-commit-config.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | .pre-commit-config.yaml |
| 前置 ST | ST-1.1.1.4 |
| 输出 commit | chore: pre-commit config |

**改动清单**：
1. 引入 pre-commit-hooks（v4.6）
2. 引入 astral-sh/ruff-pre-commit（v0.4+）
3. 引入 RobertCraigie/pyright-pre-commit（v0.1+）

**DoD**：
- [ ] pre-commit run --all-files 全绿

---

#### ST-1.1.3.2 install-hooks 脚本（cross-platform）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | scripts/setup/install-hooks.sh + install-hooks.ps1 |
| 前置 ST | ST-1.1.3.1 |
| 输出 commit | chore: install-hooks scripts |

**改动清单**：
1. install-hooks.sh：检查 pre-commit 是否在 PATH
2. install-hooks.ps1：PowerShell 镜像
3. 都跑 pre-commit install

**DoD**：
- [ ] 在干净机器跑 bash install-hooks.sh → hooks 已安装

---

#### ST-1.1.3.3 README 开发流程章节

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | README.md |
| 前置 ST | ST-1.1.3.2 |
| 输出 commit | docs: dev workflow section |

**改动清单**：
1. README 加 ## 开发流程 段落
2. 列 uv sync → pre-commit install → uv run pytest
3. 引用 install-hooks.sh

**DoD**：
- [ ] grep README 看到 pre-commit 引用

---
### TC-1.1.4 CI 基础流水线（4h → 5 ST）

#### ST-1.1.4.1 .github/workflows/python.yml 框架

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.4 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml |
| 前置 ST | ST-1.1.1.2 |
| 输出 commit | ci: python pipeline skeleton |

**改动清单**：
1. on: pull_request, push: branches: [main]
2. 矩阵 python-version: [3.12]
3. actions/checkout@v4 + actions/setup-python@v5 + install uv

**DoD**：
- [ ] PR 触发 workflow 出现

---

#### ST-1.1.4.2 lint job（ruff）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.4 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml（新增 job） |
| 前置 ST | ST-1.1.4.1 |
| 输出 commit | ci: ruff job |

**改动清单**：
1. job lint: uv sync + uv run ruff check . + uv run ruff format --check .

**DoD**：
- [ ] ruff check 通过；故意坏格式被拦下

---

#### ST-1.1.4.3 type job（pyright）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.4 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml（新增 job） |
| 前置 ST | ST-1.1.4.2 |
| 输出 commit | ci: pyright job |

**改动清单**：
1. job type: uv run pyright

**DoD**：
- [ ] pyright 无 error

---

#### ST-1.1.4.4 test job（pytest + codecov）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.4 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml（新增 job） |
| 前置 ST | ST-1.1.4.3 |
| 输出 commit | ci: pytest with coverage |

**改动清单**：
1. job test: uv run pytest --cov + codecov/codecov-action@v4
2. secret CODECOV_TOKEN 配置

**DoD**：
- [ ] codecov 报告上传成功

---

#### ST-1.1.4.5 cache ~/.cache/uv

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.4 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml（修改所有 job） |
| 前置 ST | ST-1.1.4.4 |
| 输出 commit | ci: uv cache |

**改动清单**：
1. 加 actions/cache@v4：path=~/.cache/uv、key=hash uv.lock

**DoD**：
- [ ] 第二次跑（增量）≤ 60s

---

### TC-1.1.5 README + CONTRIBUTING + .gitignore + .editorconfig（2h → 4 ST）

#### ST-1.1.5.1 README.md 主体

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.5 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | README.md |
| 前置 ST | — |
| 输出 commit | docs: README |

**改动清单**：
1. 写项目定位 / 目录结构 / 本地启动命令
2. 加 CI 状态徽章（codecov + GitHub Actions badge）
3. 引用 docs/runbooks/

**DoD**：
- [ ] 新人按 README 30min 内 uv sync && uv run pytest

---

#### ST-1.1.5.2 CONTRIBUTING.md（分支 + commit 规范）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | CONTRIBUTING.md |
| 前置 ST | ST-1.1.5.1 |
| 输出 commit | docs: CONTRIBUTING |

**改动清单**：
1. 分支策略：trunk-based + feature branch（feat/<scope>）
2. Commit 规范：Conventional Commits

**DoD**：
- [ ] 引用 Conventional Commits 1.0

---

#### ST-1.1.5.3 .gitignore（Python + uv + IDE + OS）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.5 |
| 工时 | 0.3h | 角色 | Backend |
| 目标文件 | .gitignore |
| 前置 ST | ST-1.1.5.2 |
| 输出 commit | chore: gitignore |

**改动清单**：
1. Python: __pycache__、*.pyc、.pytest_cache、.ruff_cache
2. uv: .venv、uv.lock（不忽略）
3. IDE: .vscode/（保留 settings.json）、.idea/
4. OS: .DS_Store、Thumbs.db

**DoD**：
- [ ] git status 不显示 .venv/ 或 __pycache__/

---

#### ST-1.1.5.4 .editorconfig

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.5 |
| 工时 | 0.2h | 角色 | Backend |
| 目标文件 | .editorconfig |
| 前置 ST | ST-1.1.5.3 |
| 输出 commit | chore: editorconfig |

**改动清单**：
1. charset=utf-8、indent_style=space、indent_size=4
2. end_of_line=lf、insert_final_newline=true

**DoD**：
- [ ] 写一个空 .py，VSCode 自动应用规则

---
### TC-1.1.6 vscode 配置（1h → 2 ST）

#### ST-1.1.6.1 .vscode/settings.json + extensions.json

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.6 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | .vscode/settings.json、.vscode/extensions.json |
| 前置 ST | ST-1.1.1.4 |
| 输出 commit | chore: vscode settings |

**改动清单**：
1. settings.json：默认 linter=ruff、formatter=ruff、[python].pyright.enabled=true
2. extensions.json：推荐 Ruff、Pyright、Even Better TOML

**DoD**：
- [ ] 打开未装插件的 vscode 弹推荐安装

---

#### ST-1.1.6.2 .vscode/launch.json（debug hello）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.6 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | .vscode/launch.json |
| 前置 ST | ST-1.1.6.1 |
| 输出 commit | chore: vscode launch |

**改动清单**：
1. 配置 name: hello: uvicorn、type: python、module: uvicorn
2. args: [hello.main:app, --reload, --port, 8001]

**DoD**：
- [ ] F5 启动 hello，断点命中

---

### TC-1.1.7 baseline Hello World app 跑通（4h → 4 ST）

#### ST-1.1.7.1 apps/hello/pyproject.toml 加 fastapi 依赖

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.7 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/hello/pyproject.toml |
| 前置 ST | TC-1.1.2 |
| 输出 commit | feat(hello): deps (ST-1.1.7.1) |

**改动清单**：
1. dependencies = [fastapi>=0.110, uvicorn[standard]>=0.27]
2. uv lock 更新

**DoD**：
- [ ] uv sync --package hello 安装 fastapi

---

#### ST-1.1.7.2 FastAPI app + 两个端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.7 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/hello/src/hello/main.py |
| 前置 ST | ST-1.1.7.1 |
| 输出 commit | feat(hello): main app |

**改动清单**：
1. app = FastAPI(title=Hello)
2. @app.get(/healthz) 返回 {status: ok}
3. @app.get(/hello/{name}) 返回 {message: hello {name}}

**DoD**：
- [ ] uv run --package hello uvicorn hello.main:app --port 8001 启动
- [ ] curl localhost:8001/healthz 200 + JSON

---

#### ST-1.1.7.3 pytest 测试两个端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.7 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/hello/tests/test_main.py |
| 前置 ST | ST-1.1.7.2 |
| 输出 commit | test(hello): endpoints |

**改动清单**：
1. from fastapi.testclient import TestClient
2. test_healthz_returns_ok、test_hello_world_returns_greeting

**DoD**：
- [ ] uv run --package hello pytest 2 passed

---

#### ST-1.1.7.4 Dockerfile 多阶段构建 + docker-compose service

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.1.7 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/hello/Dockerfile、docker-compose.yml |
| 前置 ST | ST-1.1.7.3 |
| 输出 commit | feat(hello): container |

**改动清单**：
1. Dockerfile：stage1 python:3.12 + uv install、stage2 python:3.12-slim + copy app
2. docker-compose.yml 加 hello service：build context、port 8001
3. CMD [uvicorn, hello.main:app, --host, 0.0.0.0, --port, 8001]

**DoD**：
- [ ] docker compose up hello healthy + curl localhost:8001/healthz 200

---
## W1-2 Swagger 三件套（5 TC → 13 ST）

### TC-1.2.1 docker-compose 加 swagger 三服务（2h → 3 ST）

#### ST-1.2.1.1 swagger-editor service

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.1 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | docker-compose.yml |
| 前置 ST | TC-1.1.7 |
| 输出 commit | dev: swagger-editor |

**改动清单**：
1. swaggerapi/swagger-editor 镜像，端口 8081
2. 挂载 ./openapi:/app（只读）
3. depends_on: hello

**DoD**：
- [ ] docker compose up swagger-editor healthy

---

#### ST-1.2.1.2 swagger-ui service

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.1 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | docker-compose.yml |
| 前置 ST | ST-1.2.1.1 |
| 输出 commit | dev: swagger-ui |

**改动清单**：
1. swaggerapi/swagger-ui 镜像，端口 8082
2. env SWAGGER_JSON=/openapi/index.yaml

**DoD**：
- [ ] curl localhost:8082 返回 swagger-ui HTML

---

#### ST-1.2.1.3 prism mock service

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.1 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | docker-compose.yml |
| 前置 ST | ST-1.2.1.2 |
| 输出 commit | dev: prism mock |

**改动清单**：
1. stoplight/prism:4 镜像，端口 4010
2. command mock -p 4010 -s /openapi/index.yaml
3. mount openapi 目录

**DoD**：
- [ ] docker compose up prism healthy

---

### TC-1.2.2 初始 openapi 目录结构（1h → 3 ST）

#### ST-1.2.2.1 openapi/index.yaml 顶层

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.2 |
| 工时 | 0.3h | 角色 | Backend |
| 目标文件 | openapi/index.yaml |
| 前置 ST | — |
| 输出 commit | docs(openapi): index top |

**改动清单**：
1. 写 openapi: 3.1.0、info.title、servers=[{url:/}]
2. 引用 paths/_index.yaml、components.yaml

**DoD**：
- [ ] redocly lint openapi/index.yaml 通过

---

#### ST-1.2.2.2 openapi/paths/ + openapi/schemas/ 空目录

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.2 |
| 工时 | 0.2h | 角色 | Backend |
| 目标文件 | openapi/paths/.gitkeep、openapi/schemas/.gitkeep |
| 前置 ST | ST-1.2.2.1 |
| 输出 commit | docs(openapi): dirs |

**DoD**：
- [ ] tree openapi/ 显示两个空目录

---

#### ST-1.2.2.3 openapi/.redocly.yaml lint 配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/.redocly.yaml |
| 前置 ST | ST-1.2.2.2 |
| 输出 commit | docs(openapi): redocly config |

**改动清单**：
1. 配 lint: extends: [recommended]
2. 加 info-license: off（v1 不强制）
3. 配 oasVersion: 3.1

**DoD**：
- [ ] npx @redocly/cli lint openapi/index.yaml 通过

---

### TC-1.2.3 验证 prism mock 响应（1h → 2 ST）

#### ST-1.2.3.1 openapi/paths/healthz.yaml 示例

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/paths/healthz.yaml |
| 前置 ST | TC-1.2.1 |
| 输出 commit | docs(openapi): healthz path |

**改动清单**：
1. 定义 path /healthz：GET operation
2. response 200：application/json schema inline
3. openapi/index.yaml 用  引入

**DoD**：
- [ ] swagger-ui 渲染 /healthz

---

#### ST-1.2.3.2 端到端 mock 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | （仅命令执行，无新文件） |
| 前置 ST | ST-1.2.3.1 |
| 输出 commit | chore(openapi): verify prism |

**改动清单**：
1. docker compose restart prism
2. curl http://localhost:4010/healthz → mock JSON
3. curl http://localhost:4010/notdeclared → 404

**DoD**：
- [ ] 已声明 path 返回 mock；未声明 path 404

---
### TC-1.2.4 swagger-ui 渲染验证（1h → 2 ST）

#### ST-1.2.4.1 浏览器截图归档

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.4 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | docs/screenshots/swagger-ui.png |
| 前置 ST | TC-1.2.3 |
| 输出 commit | docs: swagger-ui screenshot |

**改动清单**：
1. 浏览器开 http://localhost:8082
2. 截图（手测即可）归档

**DoD**：
- [ ] 截图文件存在

---

#### ST-1.2.4.2 docs/runbooks/dev.md 加 swagger 引用

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.4 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | docs/runbooks/dev.md |
| 前置 ST | ST-1.2.4.1 |
| 输出 commit | docs: swagger reference |

**改动清单**：
1. 加 ## API 设计 段落
2. 链 http://localhost:8082 + http://localhost:8081

**DoD**：
- [ ] grep dev.md 看到 swagger-ui URL

---

### TC-1.2.5 README 写明如何使用（1h → 2 ST）

#### ST-1.2.5.1 docs/runbooks/swagger.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | docs/runbooks/swagger.md |
| 前置 ST | TC-1.2.4 |
| 输出 commit | docs: swagger runbook |

**改动清单**：
1. 启动命令：docker compose up swagger-editor swagger-ui prism
2. 编辑命令（编辑器 URL）
3. 校验命令（redocly lint）
4. mock 命令（curl）

**DoD**：
- [ ] 文档完整列出 4 类操作

---

#### ST-1.2.5.2 README 链 swagger runbook

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.2.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | README.md |
| 前置 ST | ST-1.2.5.1 |
| 输出 commit | docs: README swagger link |

**改动清单**：
1. README 加 API 设计入口 段落
2. 链 docs/runbooks/swagger.md

**DoD**：
- [ ] grep README 看到 swagger.md 引用

---

## W1-3 IAM OpenAPI 初稿（5 TC → 14 ST）

### TC-1.3.1 定义 IAM 核心模型（4h → 5 ST）

#### ST-1.3.1.1 user.yaml schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/schemas/iam/user.yaml |
| 前置 ST | TC-1.2.2 |
| 输出 commit | docs(openapi): iam user schema |

**改动清单**：
1. 定义 User: id (uuid)、email、displayName、status (enum: active/suspended)、tenantId、createdAt
2. required: [id, email, displayName, status, tenantId]

**DoD**：
- [ ] swagger-ui 能展开 User

---

#### ST-1.3.1.2 role.yaml + realm.yaml schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/schemas/iam/role.yaml、openapi/schemas/iam/realm.yaml |
| 前置 ST | ST-1.3.1.1 |
| 输出 commit | docs(openapi): iam role+realm |

**改动清单**：
1. role: id、name、composite、clientRole
2. realm: id、displayName、enabled

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.3.1.3 client.yaml + tenant.yaml schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/schemas/iam/client.yaml、openapi/schemas/iam/tenant.yaml |
| 前置 ST | ST-1.3.1.2 |
| 输出 commit | docs(openapi): iam client+tenant |

**改动清单**：
1. client: id、secret、redirectUris、webOrigins
2. tenant: id、name、status、ownerId

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.3.1.4 error.yaml + 4A/4B/4C 分类

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/iam/error.yaml |
| 前置 ST | ST-1.3.1.3 |
| 输出 commit | docs(openapi): iam error schema |

**改动清单**：
1. 定义 ErrorResponse: code (string)、message、traceId
2. code 用前缀：4A 鉴权、4B 业务、4C 参数、5X 系统

**DoD**：
- [ ] error.yaml 渲染 + code 字段说明完整

---
#### ST-1.3.1.5 5 个 schema 全量 lint

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | （仅校验） |
| 前置 ST | ST-1.3.1.4 |
| 输出 commit | （无 commit，验证用） |

**DoD**：
- [ ] redocly lint openapi/schemas/iam/*.yaml 全绿

---

### TC-1.3.2 写 10 个核心端点（6h → 5 ST）

#### ST-1.3.2.1 租户 CRUD 端点（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/iam/tenants.yaml |
| 前置 ST | TC-1.3.1 |
| 输出 commit | docs(openapi): iam tenants paths |

**改动清单**：
1. POST /api/v1/iam/tenants 创建
2. GET /api/v1/iam/tenants 列表
3. GET /api/v1/iam/tenants/{id} 详情
4. PATCH /api/v1/iam/tenants/{id} 更新
5. DELETE /api/v1/iam/tenants/{id} 删除

**DoD**：
- [ ] 5 端点齐 + 含 request/response 示例

---

#### ST-1.3.2.2 用户 + 角色绑定（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/iam/users.yaml、openapi/paths/iam/roles.yaml |
| 前置 ST | ST-1.3.2.1 |
| 输出 commit | docs(openapi): iam user+role paths |

**改动清单**：
1. POST/GET /api/v1/iam/users
2. PUT/DELETE /api/v1/iam/users/{id}/roles
3. POST/GET /api/v1/iam/roles

**DoD**：
- [ ] 4 端点齐

---

#### ST-1.3.2.3 认证端点（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/iam/auth.yaml |
| 前置 ST | ST-1.3.2.2 |
| 输出 commit | docs(openapi): iam auth paths |

**改动清单**：
1. POST /api/v1/iam/auth/login 用户名密码登录
2. POST /api/v1/iam/auth/refresh 刷新 token
3. POST /api/v1/iam/auth/logout 注销
4. GET /api/v1/iam/auth/me 当前用户信息

**DoD**：
- [ ] 4 端点齐 + 含 401/403 响应

---

#### ST-1.3.2.4 权限校验端点（1 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/paths/iam/auth.yaml（追加） |
| 前置 ST | ST-1.3.2.3 |
| 输出 commit | docs(openapi): iam check path |

**改动清单**：
1. POST /api/v1/iam/auth/check 权限校验

**DoD**：
- [ ] 端点齐

---

#### ST-1.3.2.5 全量端点 lint

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | （仅校验） |
| 前置 ST | ST-1.3.2.4 |
| 输出 commit | （无 commit） |

**DoD**：
- [ ] 10 端点齐，lint 全绿

---

### TC-1.3.3 swagger-cli lint 通过（1h → 2 ST）

#### ST-1.3.3.1 scripts/lint-openapi.sh

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | scripts/lint-openapi.sh |
| 前置 ST | TC-1.3.2 |
| 输出 commit | chore: lint-openapi script |

**改动清单**：
1. swagger-cli bundle openapi/index.yaml -o /tmp/_oas.json -t yaml
2. swagger-cli lint /tmp/_oas.json

**DoD**：
- [ ] 退出码 0

---

#### ST-1.3.3.2 lint 脚本接进 TC-1.6.1

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | （修改 ST-1.6.1.x 创建的 workflow） |
| 前置 ST | ST-1.3.3.1 + TC-1.6.1 |
| 输出 commit | ci: use lint-openapi script |

**DoD**：
- [ ] CI openapi-lint job 绿

---

### TC-1.3.4 错误响应 schema 统一（2h → 2 ST）

#### ST-1.3.4.1 components.responses.ErrorResponse

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/components.yaml |
| 前置 ST | TC-1.3.1 |
| 输出 commit | docs(openapi): error response |

**改动清单**：
1. 加 responses.ErrorResponse 引用 iam/error.yaml

**DoD**：
- [ ] components.yaml 含 ErrorResponse

---

#### ST-1.3.4.2 ADR-0002 错误码分类 + 全量替换 inline error

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | docs/adr/0002-error-code-taxonomy.md、所有 paths |
| 前置 ST | ST-1.3.4.1 |
| 输出 commit | docs: error ADR + refactor |

**改动清单**：
1. 写 ADR-0002：4A 鉴权 / 4B 业务 / 4C 参数 / 5X 系统
2. grep paths，把 inline error schema 替换为 

**DoD**：
- [ ] ADR-0002 合并 + grep 无 inline error

---
### TC-1.3.5 IAM Pydantic 模型对齐初稿（4h → 3 ST）

#### ST-1.3.5.1 scripts/generate-pydantic.sh（IAM 部分）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | scripts/generate-pydantic.sh |
| 前置 ST | TC-1.7.1 |
| 输出 commit | feat(schemas): gen script |

**改动清单**：
1. 写 datamodel-codegen 命令（IAM 子集）
2. 输出到 libs/openapi-schemas/src/openapi_schemas/iam/

**DoD**：
- [ ] 生成 5 个 Pydantic 模型

---

#### ST-1.3.5.2 手工修正生成结果

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/iam/*.py |
| 前置 ST | ST-1.3.5.1 |
| 输出 commit | feat(iam): pydantic models |

**改动清单**：
1. Union 类型简化（Optional 字段调整）
2. 加 model_config = ConfigDict(from_attributes=True)
3. 提交生成文件（不要只 commit generator config）

**DoD**：
- [ ] pyright 无 error

---

#### ST-1.3.5.3 IAM schema roundtrip 测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.3.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/tests/test_iam_schemas.py |
| 前置 ST | ST-1.3.5.2 |
| 输出 commit | test(iam): roundtrip |

**改动清单**：
1. 每个 schema 一个 roundtrip 测试（构造 → 序列化 → 反序列化 → 断言相等）
2. fixture 含最小有效 payload

**DoD**：
- [ ] 5 schema 测试全绿

---

## W1-4 Knowledge OpenAPI 初稿（5 TC → 14 ST）

### TC-1.4.1 Knowledge 核心模型（4h → 4 ST）

#### ST-1.4.1.1 knowledge-base.yaml + document.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/kb/knowledge-base.yaml、openapi/schemas/kb/document.yaml |
| 前置 ST | TC-1.2.2 |
| 输出 commit | docs(openapi): kb kb+doc |

**改动清单**：
1. KnowledgeBase: id、name、description、embeddingModel、chunkStrategy
2. Document: id、kbId、status、sourceUri、metadata

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.4.1.2 chunk.yaml + embedding.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/kb/chunk.yaml、openapi/schemas/kb/embedding.yaml |
| 前置 ST | ST-1.4.1.1 |
| 输出 commit | docs(openapi): kb chunk+embed |

**改动清单**：
1. Chunk: id、documentId、ordinal、text、tokens、metadata
2. Embedding: chunkId、model、vector、dim

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.4.1.3 retrieval-request.yaml + retrieval-response.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/kb/retrieval-request.yaml、openapi/schemas/kb/retrieval-response.yaml |
| 前置 ST | ST-1.4.1.2 |
| 输出 commit | docs(openapi): kb retrieval schema |

**改动清单**：
1. RetrievalRequest: query、topK、mode (vector/bm25/hybrid)、filter
2. RetrievalResponse: results (array of {chunkId, score, text, documentId})

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.4.1.4 KB schema 全量 lint

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | （仅校验） |
| 前置 ST | ST-1.4.1.3 |
| 输出 commit | （无 commit） |

**DoD**：
- [ ] redocly lint openapi/schemas/kb/*.yaml 全绿

---

### TC-1.4.2 核心端点（6h → 4 ST）

#### ST-1.4.2.1 KB CRUD 端点（5 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/kb/bases.yaml |
| 前置 ST | TC-1.4.1 |
| 输出 commit | docs(openapi): kb bases paths |

**改动清单**：
1. POST/GET /api/v1/kb/bases
2. GET/PATCH/DELETE /api/v1/kb/bases/{id}

**DoD**：
- [ ] 5 端点齐

---

#### ST-1.4.2.2 文档生命周期端点（6 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/kb/documents.yaml |
| 前置 ST | ST-1.4.2.1 |
| 输出 commit | docs(openapi): kb documents paths |

**改动清单**：
1. POST/GET /api/v1/kb/bases/{id}/documents
2. GET/DELETE /api/v1/kb/documents/{id}
3. GET /api/v1/kb/documents/{id}/chunks
4. POST /api/v1/kb/documents/{id}/retry

**DoD**：
- [ ] 6 端点齐

---
#### ST-1.4.2.3 检索端点（2 端点含 SSE）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/kb/search.yaml |
| 前置 ST | ST-1.4.2.2 |
| 输出 commit | docs(openapi): kb search paths |

**改动清单**：
1. POST /api/v1/kb/search：request RetrievalRequest、response RetrievalResponse
2. POST /api/v1/kb/search/stream：response text/event-stream

**DoD**：
- [ ] 2 端点齐 + SSE 注 text/event-stream

---

#### ST-1.4.2.4 KB 统计与健康（2 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/paths/kb/stats.yaml |
| 前置 ST | ST-1.4.2.3 |
| 输出 commit | docs(openapi): kb stats paths |

**改动清单**：
1. GET /api/v1/kb/stats
2. GET /api/v1/kb/health

**DoD**：
- [ ] 2 端点齐

---

### TC-1.4.3 swagger-cli lint 通过（1h → 2 ST）

#### ST-1.4.3.1 KB 子集 lint

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | （仅校验） |
| 前置 ST | TC-1.4.2 |
| 输出 commit | （无 commit） |

**DoD**：
- [ ] KB 子集 lint 通过

---

#### ST-1.4.3.2 KB lint 接进 CI（增量）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | .github/workflows/openapi.yml |
| 前置 ST | ST-1.4.3.1 + TC-1.6.1 |
| 输出 commit | ci: kb lint path |

**DoD**：
- [ ] CI 中 KB 子集 lint job 绿

---

### TC-1.4.4 异步任务端点（3h → 3 ST）

#### ST-1.4.4.1 task.yaml schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/kb/task.yaml |
| 前置 ST | TC-1.4.1 |
| 输出 commit | docs(openapi): kb task schema |

**改动清单**：
1. Task: id、type、status (queued/running/success/failed)、progress、resultUrl

**DoD**：
- [ ] schema 渲染

---

#### ST-1.4.4.2 /api/v1/kb/tasks/{id} 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/paths/kb/tasks.yaml |
| 前置 ST | ST-1.4.4.1 |
| 输出 commit | docs(openapi): kb tasks path |

**改动清单**：
1. GET /api/v1/kb/tasks/{id}：response Task

**DoD**：
- [ ] 端点齐

---

#### ST-1.4.4.3 knowledge-base.yaml 加 taskWebhookUrl 字段

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/kb/knowledge-base.yaml |
| 前置 ST | ST-1.4.4.2 |
| 输出 commit | docs(openapi): kb webhook field |

**改动清单**：
1. 加 taskWebhookUrl: string (uri, optional) 字段
2. 配 example

**DoD**：
- [ ] webhook 字段有 example

---

### TC-1.4.5 KB Pydantic 模型对齐初稿（4h → 3 ST）

#### ST-1.4.5.1 KB schema generate-pydantic

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | scripts/generate-pydantic.sh（追加 KB 部分） |
| 前置 ST | TC-1.7.1 |
| 输出 commit | feat(schemas): gen kb |

**DoD**：
- [ ] 生成 KB 5 个 Pydantic 模型

---

#### ST-1.4.5.2 手工修正 KB 模型

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/kb/*.py |
| 前置 ST | ST-1.4.5.1 |
| 输出 commit | feat(kb): pydantic models |

**DoD**：
- [ ] pyright 无 error

---

#### ST-1.4.5.3 KB schema roundtrip 测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.4.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/tests/test_kb_schemas.py |
| 前置 ST | ST-1.4.5.2 |
| 输出 commit | test(kb): roundtrip |

**DoD**：
- [ ] 5 schema 测试全绿

---
## W1-5 Ontology OpenAPI 初稿（5 TC → 10 ST）

### TC-1.5.1 Ontology 核心模型（2h → 3 ST）

#### ST-1.5.1.1 ontology.yaml + class.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/schemas/ont/ontology.yaml、openapi/schemas/ont/class.yaml |
| 前置 ST | TC-1.2.2 |
| 输出 commit | docs(openapi): ont ontology+class |

**改动清单**：
1. Ontology: id、version、namespace、prefixes
2. OClass: id、label、parent、properties

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.5.1.2 property.yaml + instance.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/schemas/ont/property.yaml、openapi/schemas/ont/instance.yaml |
| 前置 ST | ST-1.5.1.1 |
| 输出 commit | docs(openapi): ont property+instance |

**改动清单**：
1. OProperty: id、label、domain、range、cardinality
2. OInstance: id、classId、values

**DoD**：
- [ ] 两个 schema 渲染

---

#### ST-1.5.1.3 relation.yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/schemas/ont/relation.yaml |
| 前置 ST | ST-1.5.1.2 |
| 输出 commit | docs(openapi): ont relation |

**改动清单**：
1. ORelation: id、type、from、to、props

**DoD**：
- [ ] schema 渲染

---

### TC-1.5.2 核心端点（4h → 3 ST）

#### ST-1.5.2.1 本体管理 + 类属性端点（8 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | openapi/paths/ont/ontology.yaml、openapi/paths/ont/class.yaml、openapi/paths/ont/property.yaml |
| 前置 ST | TC-1.5.1 |
| 输出 commit | docs(openapi): ont ontology+class+property paths |

**改动清单**：
1. POST/GET /api/v1/ont/ontologies
2. GET/PATCH/DELETE /api/v1/ont/ontologies/{id}
3. POST/GET /api/v1/ont/classes
4. POST/GET /api/v1/ont/properties

**DoD**：
- [ ] 8 端点齐

---

#### ST-1.5.2.2 实例 + 关系端点（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/paths/ont/instance.yaml、openapi/paths/ont/relation.yaml |
| 前置 ST | ST-1.5.2.1 |
| 输出 commit | docs(openapi): ont instance+relation paths |

**改动清单**：
1. POST/GET /api/v1/ont/instances
2. POST/GET /api/v1/ont/relations

**DoD**：
- [ ] 4 端点齐

---

#### ST-1.5.2.3 SPARQL + explain 端点（2 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/paths/ont/sparql.yaml |
| 前置 ST | ST-1.5.2.2 |
| 输出 commit | docs(openapi): ont sparql paths |

**改动清单**：
1. POST /api/v1/ont/sparql：body {query, mode (SELECT/INSERT/DELETE)}
2. POST /api/v1/ont/sparql/explain：返回执行计划 + 估计成本

**DoD**：
- [ ] 2 端点齐 + 含 SPARQL 模式示例

---

### TC-1.5.3 swagger-cli lint 通过（1h → 1 ST）

#### ST-1.5.3.1 ONT lint 接进 CI

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.3 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | .github/workflows/openapi.yml |
| 前置 ST | TC-1.5.2 + TC-1.6.1 |
| 输出 commit | ci: ont lint path |

**DoD**：
- [ ] CI ONT 子集 lint job 绿

---

### TC-1.5.4 兼容 OWL 2 注解（2h → 2 ST）

#### ST-1.5.4.1 各 schema 加 annotations 字段

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | openapi/schemas/ont/{class,property,instance}.yaml |
| 前置 ST | TC-1.5.1 |
| 输出 commit | docs(openapi): ont annotations |

**改动清单**：
1. 加 annotations: object 字段
2. description 解释 OWL 映射

**DoD**：
- [ ] annotations 字段存在于 3 个 model

---

#### ST-1.5.4.2 ADR-0003 OWL 字段映射策略

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | docs/adr/0003-owl-annotations.md |
| 前置 ST | ST-1.5.4.1 |
| 输出 commit | docs: owl ADR |

**DoD**：
- [ ] ADR-0003 合并

---

### TC-1.5.5 ONT Pydantic 模型对齐初稿（3h → 2 ST）

#### ST-1.5.5.1 ONT schema generate + 修正

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/ont/*.py |
| 前置 ST | TC-1.7.1 |
| 输出 commit | feat(ont): pydantic models |

**DoD**：
- [ ] pyright 无 error

---

#### ST-1.5.5.2 ONT schema roundtrip 测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.5.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/tests/test_ont_schemas.py |
| 前置 ST | ST-1.5.5.1 |
| 输出 commit | test(ont): roundtrip |

**DoD**：
- [ ] 5 schema 测试全绿

---
## W1-6 CI 校验流水线（5 TC → 11 ST）

### TC-1.6.1 openapi-lint workflow（2h → 3 ST）

#### ST-1.6.1.1 workflow 文件 + lint job

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.1 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/openapi.yml |
| 前置 ST | TC-1.2.2 + TC-1.3.3 |
| 输出 commit | ci: openapi lint workflow |

**改动清单**：
1. on: pull_request, push: branches: [main]
2. job lint：actions/setup-node@v4 + npx swagger-cli bundle + swagger-cli lint

**DoD**：
- [ ] PR 触发 openapi-lint job

---

#### ST-1.6.1.2 breaking change job（oasdiff）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.1 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/openapi.yml（追加 job） |
| 前置 ST | ST-1.6.1.1 |
| 输出 commit | ci: oasdiff breaking |

**改动清单**：
1. job breaking：oasdiff breaking <base> <head>，base 来自 origin/branch-name

**DoD**：
- [ ] 删除字段时被标红

---

#### ST-1.6.1.3 cache npm

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.1 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/openapi.yml |
| 前置 ST | ST-1.6.1.2 |
| 输出 commit | ci: cache npm |

**改动清单**：
1. 加 actions/cache@v4：path=~/.npm、key=hash package-lock.json

**DoD**：
- [ ] 第二次跑 ≤ 30s

---

### TC-1.6.2 python-lint workflow（1h → 2 ST）

#### ST-1.6.2.1 ruff 独立 job

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.2 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml（独立 ruff job） |
| 前置 ST | TC-1.1.4 |
| 输出 commit | ci: ruff separate job |

**改动清单**：
1. 把 ruff 步骤从 TC-1.1.4 中抽出独立 job python-lint

**DoD**：
- [ ] python-lint job 独立绿

---

#### ST-1.6.2.2 pyright 独立 job

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.2 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml |
| 前置 ST | ST-1.6.2.1 |
| 输出 commit | ci: pyright separate job |

**DoD**：
- [ ] python-type job 独立绿

---

### TC-1.6.3 python-test workflow（2h → 2 ST）

#### ST-1.6.3.1 pytest with cov

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.3 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml |
| 前置 ST | TC-1.1.4 |
| 输出 commit | ci: pytest cov-fail-under=80 |

**改动清单**：
1. 追加 --cov-fail-under=80
2. 上报 codecov

**DoD**：
- [ ] 故意删测试，CI 阻断

---

#### ST-1.6.3.2 codecov token + badge

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.3 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml、README.md |
| 前置 ST | ST-1.6.3.1 |
| 输出 commit | ci: codecov badge |

**改动清单**：
1. secret CODECOV_TOKEN 配置
2. README 加 codecov badge

**DoD**：
- [ ] README 看到 codecov badge

---

### TC-1.6.4 docker-build workflow（2h → 2 ST）

#### ST-1.6.4.1 hello 镜像构建 workflow

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.4 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/docker.yml |
| 前置 ST | TC-1.1.7 |
| 输出 commit | ci: docker build hello |

**改动清单**：
1. on: push: branches: [main]（仅 main）
2. step docker/build-push-action@v5

**DoD**：
- [ ] main 触发后镜像 push 到 ghcr.io

---

#### ST-1.6.4.2 多架构构建（amd64 + arm64）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.4 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/docker.yml |
| 前置 ST | ST-1.6.4.1 |
| 输出 commit | ci: docker multi-arch |

**改动清单**：
1. platforms: linux/amd64,linux/arm64
2. 用 docker/setup-qemu-action + docker/setup-buildx-action

**DoD**：
- [ ] ghcr.io 镜像含 manifest list

---

### TC-1.6.5 PR 模板 + CODEOWNERS（1h → 2 ST）

#### ST-1.6.5.1 .github/PULL_REQUEST_TEMPLATE.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | .github/PULL_REQUEST_TEMPLATE.md |
| 前置 ST | — |
| 输出 commit | docs: PR template |

**改动清单**：
1. 模板：变更说明 / 影响范围 / 测试 / DoD 自检 / 关联 issue

**DoD**：
- [ ] 创建 PR 时自动加载模板

---

#### ST-1.6.5.2 .github/CODEOWNERS

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.6.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | .github/CODEOWNERS |
| 前置 ST | ST-1.6.5.1 |
| 输出 commit | docs: CODEOWNERS |

**改动清单**：
1. apps/iam/*  @xxx、apps/kb/*  @yyy、apps/ont/*  @zzz
2. 通用 owners: /docs/  @docs-team

**DoD**：
- [ ] 改 IAM 文件触发对应 reviewer

---
## W1-7 OpenAPI ↔ Pydantic 模型对齐（5 TC → 16 ST）

### TC-1.7.1 共享 schemas 目录设计（2h → 4 ST）

#### ST-1.7.1.1 libs/openapi-schemas/pyproject.toml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/pyproject.toml |
| 前置 ST | TC-1.1.2 |
| 输出 commit | feat(schemas): pyproject |

**改动清单**：
1. dependencies = [pydantic>=2.6]
2. name = openapi-schemas

**DoD**：
- [ ] uv sync --package openapi-schemas 安装 pydantic

---

#### ST-1.7.1.2 libs/openapi-schemas/src/openapi_schemas/__init__.py

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.1 |
| 工时 | 0.3h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/__init__.py |
| 前置 ST | ST-1.7.1.1 |
| 输出 commit | feat(schemas): init |

**改动清单**：
1. from openapi_schemas import iam, kb, ont

**DoD**：
- [ ] uv run python -c from openapi_schemas import iam 成功

---

#### ST-1.7.1.3 libs/openapi-schemas/src/openapi_schemas/common/

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.1 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/common/{page.py,error.py,id.py} |
| 前置 ST | ST-1.7.1.2 |
| 输出 commit | feat(schemas): common types |

**改动清单**：
1. Page[T]: items、total、page、page_size
2. ErrorResponse: code、message、traceId
3. ID: NewType(str, ID) 用于 UUID

**DoD**：
- [ ] 3 个共用类型可导入

---

#### ST-1.7.1.4 ADR-0004 为什么单源（OpenAPI）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | docs/adr/0004-single-source-openapi.md |
| 前置 ST | ST-1.7.1.3 |
| 输出 commit | docs: ADR single source |

**DoD**：
- [ ] ADR-0004 合并

---

### TC-1.7.2 自动化生成脚本（3h → 4 ST）

#### ST-1.7.2.1 scripts/generate-pydantic.sh

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | scripts/generate-pydantic.sh |
| 前置 ST | TC-1.7.1 |
| 输出 commit | feat(schemas): gen script |

**改动清单**：
1. datamodel-codegen 完整命令
2. 输出到 libs/openapi-schemas/src/openapi_schemas/

**DoD**：
- [ ] 命令退出码 0 + 生成 Pydantic 模型

---

#### ST-1.7.2.2 scripts/generate-pydantic.ps1 镜像

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | scripts/generate-pydantic.ps1 |
| 前置 ST | ST-1.7.2.1 |
| 输出 commit | feat(schemas): gen script win |

**DoD**：
- [ ] PowerShell 版本可执行

---

#### ST-1.7.2.3 scripts/regen-and-check.sh

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | scripts/regen-and-check.sh |
| 前置 ST | ST-1.7.2.2 |
| 输出 commit | feat(schemas): regen-and-check |

**改动清单**：
1. 跑 generate-pydantic.sh
2. git diff --exit-code，若非空则 exit 1

**DoD**：
- [ ] 干净仓 exit 0；改 OpenAPI 后 exit 1

---

#### ST-1.7.2.4 regen-and-check 文档

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | docs/runbooks/schemas.md |
| 前置 ST | ST-1.7.2.3 |
| 输出 commit | docs: schemas runbook |

**DoD**：
- [ ] runbook 描述使用场景

---

### TC-1.7.3 CI 中加对齐校验（2h → 3 ST）

#### ST-1.7.3.1 model-align workflow job

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.3 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | .github/workflows/openapi.yml（追加 job） |
| 前置 ST | TC-1.7.2 |
| 输出 commit | ci: model-align |

**改动清单**：
1. job model-align：跑 bash scripts/regen-and-check.sh
2. 失败阻止 merge

**DoD**：
- [ ] model-align job 失败时 PR 阻断

---

#### ST-1.7.3.2 model-align 必跑分支限制

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.3 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/openapi.yml |
| 前置 ST | ST-1.7.3.1 |
| 输出 commit | ci: model-align on PR |

**改动清单**：
1. if: github.event_name == pull_request

**DoD**：
- [ ] PR 触发；push 不触发

---

#### ST-1.7.3.3 model-align 错误提示优化

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.3 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/openapi.yml |
| 前置 ST | ST-1.7.3.2 |
| 输出 commit | ci: model-align message |

**改动清单**：
1. 失败时 echo Run bash scripts/regen-and-check.sh locally and commit diff

**DoD**：
- [ ] 日志中可见修复提示

---
### TC-1.7.4 三模块 Pydantic 模型实现（6h → 3 ST）

#### ST-1.7.4.1 IAM + KB 模型合入主干

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/{iam,kb}/*.py |
| 前置 ST | TC-1.3.5 + TC-1.4.5 |
| 输出 commit | feat(schemas): iam+kb |

**DoD**：
- [ ] pyright 无 error

---

#### ST-1.7.4.2 ONT 模型合入主干

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/ont/*.py |
| 前置 ST | TC-1.5.5 |
| 输出 commit | feat(schemas): ont |

**DoD**：
- [ ] pyright 无 error

---

#### ST-1.7.4.3 三模块统一测试 + 覆盖率

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.4 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/tests/ |
| 前置 ST | ST-1.7.4.2 |
| 输出 commit | test(schemas): all modules |

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

### TC-1.7.5 示例接口实现 + 测试（4h → 2 ST）

#### ST-1.7.5.1 apps/hello 用 HelloRequest/Response

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/hello/src/hello/main.py |
| 前置 ST | TC-1.7.4 |
| 输出 commit | feat(hello): generated schemas |

**改动清单**：
1. 在 openapi/schemas/hello/ 加 HelloRequest、HelloResponse
2. /hello 端点接收 HelloRequest、返回 HelloResponse
3. 故意传非法 payload，验证 422

**DoD**：
- [ ] 合法 payload 200；非法 payload 422 + ErrorResponse

---

#### ST-1.7.5.2 swagger-ui 端到端联调

| 字段 | 值 |
|---|---|
| 所属 TC | TC-1.7.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | （仅端到端验证） |
| 前置 ST | ST-1.7.5.1 |
| 输出 commit | （无 commit） |

**DoD**：
- [ ] swagger-ui Try it out 调用通过

---

## W1 ST 完成度检查表

| W1-n | 路线图 ID | 关键路径 | TC 数 | ST 数 | 路线图工时 | ST 总工时 | 状态 |
|---|---|---|---|---|---|---|---|
| W1-1 | §4 W1-1 | 是 | 7 | 19 | 2d | ~22h | 🔴 未启动 |
| W1-2 | §4 W1-2 | 否 | 5 | 12 | 2d | ~9h | 🔴 未启动 |
| W1-3 | §4 W1-3 | 否 | 5 | 13 | 2d | ~16h | 🔴 未启动 |
| W1-4 | §4 W1-4 | 否 | 5 | 14 | 2d | ~17h | 🔴 未启动 |
| W1-5 | §4 W1-5 | 否 | 5 | 10 | 1d | ~11h | 🔴 未启动 |
| W1-6 | §4 W1-6 | 是 | 5 | 11 | 1d | ~10h | 🔴 未启动 |
| W1-7 | §4 W1-7 | 是 | 5 | 16 | 3d | ~22h | 🔴 未启动 |
| **合计** | — | — | **37** | **95** | **~13d** | **~107h** | **🔴 未启动** |

> **关键路径 ST 约 46 张**（W1-1 + W1-6 + W1-7），必须在 S1 内合入。

---

## W1 Sprint S1 排程（ST 视角）

> 每回合（~2-4h）执行 2-4 张连续 ST。

### Day 1（项目骨架 + CI）

| 时段 | 重点 ST | 工时 |
|---|---|---|
| Day 1 上午 | ST-1.1.1.1 → ST-1.1.1.4 | 3h |
| Day 1 下午 | ST-1.1.2.1 → ST-1.1.2.3 + ST-1.1.3.1 | 3h |

### Day 2（CI 完整 + 文档）

| 时段 | 重点 ST | 工时 |
|---|---|---|
| Day 2 上午 | ST-1.1.4.1 → ST-1.1.4.5 | 3h |
| Day 2 下午 | ST-1.1.5.1 → ST-1.1.5.4 + ST-1.1.6.1 → ST-1.1.6.2 | 3h |

### Day 3（Hello app）

| 时段 | 重点 ST | 工时 |
|---|---|---|
| Day 3 上午 | ST-1.1.7.1 → ST-1.1.7.4 | 4h |
| Day 3 下午 | ST-1.1.3.2 → ST-1.1.3.3 + ST-1.2.1.1 → ST-1.2.1.3 | 4h |

### Day 4（Swagger + OpenAPI 目录）

| 时段 | 重点 ST | 工时 |
|---|---|---|
| Day 4 上午 | ST-1.2.2.1 → ST-1.2.2.3 | 1h |
| Day 4 下午 | ST-1.2.3.1 → ST-1.2.5.2（Swagger 验证 + 文档） | 4h |

### Day 5（IAM + KB + ONT OpenAPI）

| 时段 | 重点 ST | 工时 |
|---|---|---|
| Day 5 上午 | ST-1.3.1.1 → ST-1.3.1.5 + ST-1.3.2.1 → ST-1.3.2.5 | 7h |
| Day 5 下午 | ST-1.4.1.1 → ST-1.4.2.4 + ST-1.5.1.1 → ST-1.5.2.3 | 7h |

### Day 6-7（CI 完整化 + Pydantic 对齐）

| 时段 | 重点 ST | 工时 |
|---|---|---|
| Day 6 上午 | ST-1.4.3.1 → ST-1.4.5.3 + ST-1.5.3.1 → ST-1.5.5.2 | 8h |
| Day 6 下午 | ST-1.6.1.1 → ST-1.6.5.2 | 6h |
| Day 7 上午 | ST-1.7.1.1 → ST-1.7.2.4（共享 schemas + 生成脚本） | 5h |
| Day 7 下午 | ST-1.7.3.1 → ST-1.7.3.3 + ST-1.7.4.1 → ST-1.7.4.3 + ST-1.7.5.1 → ST-1.7.5.2 | 8h |

> **关键路径 ST**（必须 Day 1-3 合入）：ST-1.1.1.*、ST-1.1.4.*、ST-1.1.7.*、ST-1.7.1.*、ST-1.7.2.*、ST-1.7.3.*

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W1 TC（37 张）拆出 ST（95 张） | 单回合执行避免 Token 超限，TC 4-24h 仍过大 |
