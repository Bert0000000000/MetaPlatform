# MetaPlatform Docker Profiles 使用指南

## 为什么用 profiles?

原 `docker compose up` 会启动 **30+ 个服务**，在 16GB 笔记本上必卡。
改成按需 profile 后，日常开发只起需要的几个服务，**内存占用从 ~14G 降到 ~2-3G**。

---

## Profiles 一览

| Profile | 包含服务 | 典型场景 | 预估内存 |
|---|---|---|---|
| `infra` | postgres, redis, minio, milvus, neo4j, traefik | 任何后端开发的基础 | ~3G |
| `iam` | + keycloak, mate-tech-iam, mate-auth-service | 改鉴权/SSO | +1.5G |
| `events` | + kafka, rabbitmq, nacos | 改消息总线/事件流 | +1.5G |
| `ai` | + ragflow, lightrag | 文档解析/GraphRAG | +2.3G |
| `obs` | + loki, prometheus, grafana, otel, promtail | 调试可观测性 | +1.5G |
| `workflow` | + flowable, kie-server | 改 BPMN/规则引擎 | +1.5G |
| `rag` | infra + mate-tech-rag | 改 RAG 检索 | +0.5G |
| `agent` | infra + mate-tech-agent | 改 Agent 编排 | +0.5G |
| `kb` | infra + mate-app-kb | 改 KB 业务 | +0.5G |
| `llmgw` | infra + mate-tech-llmgw | 改 LLM 网关 | +0.5G |
| `ont` | infra(graph) + mate-tech-ont | 改 Ontology | +0.5G |
| `msg` | infra + events + mate-tech-msg | 改消息中心 | +0.5G |
| `mcp` | infra + mate-tech-mcp | 改 MCP 协议 | +0.5G |
| `gateway` | infra + mate-api-gateway | 改 API 网关 | +0.5G |
| `full` | **所有服务** | CI / 冒烟测试 | ~14G+ |

> 每个 Python 服务（`rag/agent/kb/...`）都有同名 profile，可以单独起。

---

## 推荐工作流

### 1. 改 Python 后端（最常见）—— **强烈推荐 Python 裸跑**

```powershell
# 只起基础设施（postgres/redis/minio/milvus 等）
.\start-dev.ps1 -Profile rag

# Python 服务用本机 venv + uvicorn --reload 跑（毫秒级热重载，省 5G 内存）
cd mate-platform-backend
.\.venv\Scripts\Activate.ps1
uvicorn services.rag.main:app --reload --port 8001
```

### 2. 改 IAM / 鉴权

```powershell
docker compose --profile iam up -d
```

### 3. 改前端 / 联调

```powershell
# 前端项目独立部署，只连后端服务（API 网关已经暴露在 :8100）
docker compose --profile gateway up -d
cd metaplatform-frontend
pnpm dev
```

### 4. 全量冒烟测试（CI）

```powershell
docker compose --profile full up -d
```

---

## 命令速查

```powershell
# 查看所有 profile
docker compose config --profiles

# 看哪些服务会启动
docker compose --profile rag config --services

# 起服务
docker compose --profile rag up -d

# 看内存
.\start-dev.ps1 -Status
# 或：
docker stats --no-stream

# 停掉所有
.\start-dev.ps1 -Stop
# 或：
docker compose down

# 完全清理（含数据卷）
docker compose down -v
```

---

## 交互菜单

不记得 profile 名？直接：

```powershell
.\start-dev.ps1
```

会弹出菜单（1=RAG, 2=Agent, ...）。

---

## 内存限制

每个服务都有 `mem_limit` 和 `mem_reservation`，超限会被 Docker OOM kill。
调整单个服务：

```yaml
# docker-compose.override.yml
services:
  mate-tech-rag:
    mem_limit: 1g
    mem_reservation: 512m
```

---

## 排查卡顿

```powershell
# 1) 看谁在吃内存
docker stats --no-stream --format "{{.MemPerc}}`t{{.Name}}" | Sort-Object -Descending

# 2) 看 WSL2 整体占用
wsl -e free -h

# 3) 临时降低 WSL2 上限（编辑 ~/.wslconfig）
memory=6GB

# 4) 找不需要的服务停掉
docker compose --profile <不必要的> down

# 5) 终极：清掉所有未用的
docker system prune -a
```
