# Mate Platform 开发交付进度（Baseline Report v0.1）

> **日期**：2026-07-28 | **基线日期**：2026-07-28 | **状态**：M1 启动 / W1-1.7 已落地

---

## 1. 本轮交付（2026-07-28）

### 1.1 修复
- ✅ **packages/mate-common**：4 个文件中文乱码修复（UTF-8 重写 + BOM 移除）
- ✅ **根 pyproject.toml**：uvloop/uvicorn[standard] 加 sys_platform != 'win32' 条件标记（Windows 编译失败）
- ✅ **根 uff.toml**：移除 RUF002/RUF003（中文括号）、TC001/TC002/TC003（moved-import）噪音；保持严格 lint

### 1.2 新增代码
| 路径 | 行数 | 说明 |
|---|---|---|
| packages/mate-tech-rag/pyproject.toml | 23 | workspace 成员，引用 mate-common |
| packages/mate-tech-rag/src/mate_tech_rag/__init__.py | 3 | 包元数据 |
| packages/mate-tech-rag/src/mate_tech_rag/api/__init__.py | 1 | API 子包 |
| packages/mate-tech-rag/src/mate_tech_rag/api/schemas.py | 49 | HealthResponse / RetrievalRequest / ChunkHit / RetrievalResponse |
| packages/mate-tech-rag/src/mate_tech_rag/api/retrieval.py | 32 | 占位检索（p95 < 5ms）+ fake_chunk 工厂 |
| packages/mate-tech-rag/src/mate_tech_rag/api/app.py | 33 | FastAPI 应用工厂 + healthz + search 端点 |
| 	ests/test_mate_tech_rag.py | 80 | 6 个测试（healthz / search / 422 校验 / chunk 工厂 / mate_common 异常） |
| Dockerfile | 47 | 多阶段 builder + runtime（python:3.12-slim + uv） |
| .dockerignore | 30 | 排除 .venv / tests / docs / IDE 等 |

### 1.3 验证结果

#### Python 单测（host）
`
$ pytest tests/test_mate_tech_rag.py -q
6 passed, 10 warnings in 0.15s
`

#### Docker 镜像构建
`
$ docker build -t mate-tech-rag:dev .
... 20 stages ...
Successfully tagged mate-tech-rag:dev
IMAGE: mate-tech-rag:dev   DISK USAGE: 968MB   CONTENT SIZE: 212MB
`

#### Docker 容器运行
`
$ docker run -d --name mate-tech-rag -p 8001:8001 mate-tech-rag:dev
$ docker logs mate-tech-rag
INFO:     Started server process [1]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
`

#### 端到端验证
| 端点 | 请求 | 响应 | 验证 |
|---|---|---|---|
| GET /healthz | — | 200 {"status":"ok","service":"mate-tech-rag","version":"0.1.0"} | ✅ |
| POST /api/v1/rag/search | {"query":"docker test","top_k":3} | 200 {"query":"docker test","hits":[],"total":0,"latency_ms":0} | ✅ |
| POST /api/v1/rag/search | {"query":"","top_k":3} | 422（Pydantic 验证） | ✅ |
| GET /openapi.json | — | 200, 3403 bytes, 含 /healthz + /api/v1/rag/search | ✅ |
| GET /docs | — | 200, Swagger UI HTML | ✅ |

#### 资源占用
`
CONTAINER ID   NAME            CPU %   MEM USAGE / LIMIT     MEM %
fe63a9f575c1   mate-tech-rag   0.09%   36.34MiB / 31.28GiB   0.11%
`

---

## 2. 关键路径进展

按路线图（docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md）的关键路径：
`
W1-1 → W2-3 → W3-3 → W4-3 → W5-6 → W5-7 → W5-8 → W7-6
`

| TC | 状态 | 备注 |
|---|---|---|
| TC-1.1.1 uv 初始化 + pyproject | ✅ | 已存在（前置） |
| TC-1.1.2 目录结构 | ✅ | 已存在 packages/services/contracts/rules |
| TC-1.1.4 CI 流水线 | ⚠️ | 未在本机配置（CI 环境） |
| TC-1.1.5 README + CONTRIBUTING | ⚠️ | 部分（README 存在但中文乱码待补） |
| **TC-1.1.7 Hello World baseline** | ✅ | mate-tech-rag FastAPI 跑通 + Docker 化 |
| TC-1.2.x Swagger 三件套 | 🔴 | 未做（要 docker-compose 集成） |
| TC-1.3.x IAM OpenAPI | 🔴 | 未做 |
| TC-1.4.x KB OpenAPI | 🔴 | 未做 |
| TC-1.5.x Ontology OpenAPI | 🔴 | 未做 |
| TC-1.6.x CI 流水线 | 🔴 | 未做（CI 环境） |
| **TC-1.7.x OpenAPI ↔ Pydantic 对齐** | ✅ 部分 | mate-tech-rag schemas 用 Pydantic v2 严格模式 + mate_common 共享基类 |

---

## 3. 下轮优先（按关键路径）

| 优先级 | TC | 范围 | 工时 |
|---|---|---|---|
| P0 | TC-2.1.1 psycopg 接入 + 连接池 | W2 基础设施 | 4h |
| P0 | TC-2.1.6 docker-compose 加 4 个服务 | W2 基础设施 | 4h |
| P0 | TC-5.6.2 Embedding 模型集成 | W5 RAG 关键路径 | 4h |
| P1 | TC-2.1.2 ~ TC-2.1.5 neo4j/milvus/minio 接入 | W2 基础设施 | 12h |
| P1 | TC-5.6.3 Milvus 向量入库 | W5 RAG | 4h |
| P1 | TC-5.6.4 检索（向量 + 全文 hybrid） | W5 RAG 关键路径 | 6h |
| P2 | TC-1.3.1 IAM OpenAPI schema | W1 契约 | 4h |
| P2 | TC-1.4.1 KB OpenAPI schema | W1 契约 | 4h |
| P2 | TC-1.5.1 Ontology OpenAPI schema | W1 契约 | 2h |

---

## 4. 待解决问题

| 问题 | 原因 | 解法 |
|---|---|---|
| uv sync editable mode 在多阶段 Docker build 中失效 | 镜像内 mate_* 目录在第一次 sync 时尚未注册为可发现 | Dockerfile 中 cp -r packages/mate-*/src/mate_* 到 venv site-packages |
| 部分 packages（mate-app-kb 等）只有空目录无 pyproject | 历史未完成 | 不影响当前服务（仅 mate-tech-rag 在 docker 中运行） |
| 根 docker-compose.yml 未加 mate-tech-rag service | W4 范围 | 下轮加入 compose/mate-tech-rag.yml 子文件 |
| CI（GitHub Actions）未配置 | 需联网 | 跳到 CI 阶段做 |
| pytest 覆盖率门槛 | 需更多测试 | 当前 6 测试覆盖核心路径，TC-2.4.3 实施时引入 pytest --cov-fail-under=80 |

---

## 5. 已知 fixture 状态

- 镜像 mate-tech-rag:dev 已 build（968MB 磁盘 / 212MB 内容）
- 容器 mate-tech-rag 当前在跑（端口 8001，36MiB 内存）
- 如需停止：docker stop mate-tech-rag
- 如需重启：docker start mate-tech-rag
- 如需重建：docker build -t mate-tech-rag:dev .

---

## 6. 引用

- 路线图：docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md
- 任务卡体系：docs/active/specs/2026-07-27-mate-platform-task-breakdown.md
- 技术架构：docs/active/specs/2026-07-27-mate-platform-technical-architecture.md
- W1 任务卡：docs/active/specs/2026-07-27-mate-platform-tasks-W1.md（TC-1.1.7 = Hello World，本轮完成）