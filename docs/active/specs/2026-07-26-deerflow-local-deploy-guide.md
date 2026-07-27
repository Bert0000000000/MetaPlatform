# DeerFlow 本地部署实战指南

> 版本：v1.0 · 2026-07-26
> 出处：`production-integration-design` §4 子方案 · Docker Hub 无 bytedance/deer-flow 镜像
> 结论：**DeerFlow 必须本地 build**，无捷径

---

## 0. 事实前提

| 项 | 真相 |
|---|---|
| Docker Hub `bytedance/deer-flow` 镜像 | ❌ 不存在（403 Forbidden） |
| Quay.io deerflow 镜像 | ❌ 搜索无结果 |
| DeerFlow Helm chart | ✓ 在 `deploy/helm/deer-flow` |
| DeerFlow Dockerfile | ✓ 在 `backend/Dockerfile`（multi-stage） |
| 公开 pre-built image | ❌ 没有——所有服务 build 自源码 |
| 推荐部署路径 | ✓ `make docker-init && make docker-start` |

**唯一可行路径**：git clone DeerFlow 源码 + 走项目自带 `scripts/docker.sh`。

---

## 1. 一次性 Setup（已完成 / 本会话里做的）

```bash
cd C:\Users\houuu
git clone --depth 1 https://github.com/bytedance/deer-flow.git
```

DeerFlow 已 clone 到 `C:\Users\houuu\deer-flow\`（验证：里面已有 `Makefile` / `backend/Dockerfile` / `docker/docker-compose-dev.yaml`）。

---

## 2. 启动 DeerFlow（5-15 分钟 first build）

```bash
cd C:\Users\houuu\deer-flow
copy config.example.yaml config.yaml
# 编辑 config.yaml 填你的 LLM API key（OpenAI / DashScope / vLLM 等）

# 预拉 sandbox image（一次性）
make docker-init

# Build + Start 全部服务
make docker-start
```

Docker Compose 项目名 `deer-flow-dev` 会在以下端口暴露：

| 服务 | 端口 | 说明 |
|---|---|---|
| nginx | **2026** | 入口；`localhost:2026/api/*` 路由到 gateway |
| gateway | 8001 | DeerFlow Gateway API（容器内 ClusterIP） |
| frontend | 3000 | Next.js dev UI（容器内） |
| redis | 6379 | DeerFlow 内部 Stream Bridge |
| provisioner | 可选 | 仅当 config.yaml 用 provisioner 模式 |

---

## 3. 验证 DeerFlow 起来了

```bash
# 看 4-5 个容器状态
docker ps --filter label=com.docker.compose.project=deer-flow-dev

# 看 nginx 入口的 health
curl http://localhost:2026/api/health

# 看 gateway 直连
curl http://localhost:2026/api/threads/test/runs
```

预期：返回 401 / 403 / 404 / 405 都 OK（说明 nginx → gateway 链路通）；返回 5xx 则失败需要修。

---

## 4. MetaPlatform 与 DeerFlow 通信拓扑

```
                          Docker Desktop host (Windows)
                          ┌─────────────────────────────────────────────┐
                          │                                             │
                          │   MetaPlatform docker-compose                │
                          │   ┌─────────────────────────────────┐       │
                          │   │ TECH-AGENT (Spring Boot)         │       │
                          │   │ :8080  → /agent/runs/*          │       │
                          │   │                                │       │
                          │   │ DEER_FLOW_GATEWAY_URL=          │       │
                          │   │  http://host.docker.internal:   │       │
                          │   │  2026/api                       │       │
                          │   └────────────┬────────────────────┘       │
                          │                │ host.docker.internal       │
                          │   ┌────────────▼────────────────────┐       │
                          │   │ browser @ localhost:9200          │       │
                          │   └────────────┬────────────────────┘       │
                          │                │                               │
       MetaPlatform   ─────┘                └────── deer-flow-dev ──────
       docker-compose                              docker-compose
       (postgres/redis/nacos/                     (redis / frontend /
        minio/milvus/kafka/                        gateway / nginx)
        rabbitmq/loki/promtail)                   暴露 localhost:2026
```

**关键：两套 docker-compose 共享 host network。
TECH-AGENT 通过 `host.docker.internal:2026` 访问 DeerFlow。
浏览器通过 `localhost:2026` 直连 DeerFlow nginx。**

---

## 5. 配置 TECH-AGENT 指 DeerFlow

`TECH-AGENT/src/main/resources/application.yml` 至少要加：

```yaml
deerflow:
  gateway-url: http://host.docker.internal:2026/api
  internal-token: ${DEER_FLOW_INTERNAL_TOKEN:meta-platform-dev-internal-token-2026}
  owner-user-id: ${DEER_FLOW_OWNER_USER_ID:deerflow-internal-owner}
  request-timeout-ms: 30000
  stream-timeout-ms: 60000
  reconnect-timeout-ms: 60000
```

> 关键：必须是 `host.docker.internal`（**不**是 `localhost`）—— TECH-AGENT 在 Docker 容器内跑，访问 host 上的 nginx 必须用 host.docker.internal。

---

## 6. 一键验证脚本

跑 DeerFlow + MetaPlatform 都在 Docker 里后，可执行以下：

```bash
# 1. 浏览器访问 http://localhost:9200/superai（前端 dev mode）

# 2. 用 curl 模拟前端调 SuperAI
curl -X POST http://localhost:9200/api/v1/agent/context/build \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

预期：从 TECH-AGENT 收到 → 转发到 DeerFlow Gateway → 返回 Envelope。

---

## 7. 故障排查

| 现象 | 排查 |
|---|---|
| `make docker-start` 卡在 `uv sync` | 网络问题，导出 `UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple` 后重试 |
| `npm install -g @larksuite/cli` 失败 | 导出 `NPM_REGISTRY=https://registry.npmmirror.com` 后重试 |
| nginx 502 Bad Gateway | gateway 容器还没 ready，等 30-60s 或 `docker logs -f deer-flow-gateway` |
| `host.docker.internal` 不工作 | Docker Desktop → Settings → "Allow host network" 勾上 |
| TECH-AGENT 连不上 DeerFlow | 检查 `deerflow.gateway-url` 配置；用 `curl http://host.docker.internal:2026/api/health` 验证 |

---

## 8. 与现有 MetaPlatform docker-compose.yml 关系

**不需要改 MetaPlatform 的 docker-compose.yml**。
DeerFlow 用它自己的 compose（项目名 `deer-flow-dev`）独立跑。
两套通过 host.docker.internal + 各自 localhost 端口通信。

唯一重叠：**redis**（两边都有），但端口都是 6379 — 因为两套 compose 用不同 docker bridge 网络，所以不冲突。