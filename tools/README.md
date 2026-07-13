# MetaPlatform 开发工具 (tools/)

本目录存放开发辅助脚本。

## 后端服务启动

### metaplatform-api (Node.js + Express + SQLite) — port 3001

**Trae IDE 沙箱无法启动 Node 进程**（仅允许 vite 启动）。必须在 system cmd 启动。

#### 启动
双击 `start-node-api.bat`，或在 cmd 跑：
```cmd
tools\start-node-api.bat
```

输出：
- 端口 3001 监听中
- 日志路径: `metaplatform-api\logs\node-api-3001.log`
- 进程 PID 文件: `metaplatform-api\logs\node-api-3001.pid`

#### 停止
双击 `stop-node-api.bat`：
```cmd
tools\stop-node-api.bat
```

#### 验证
浏览器访问 http://localhost:3001/health

#### 故障排查
| 现象 | 原因 | 修复 |
|---|---|---|
| 端口 3001 已被占用 | 旧进程未杀 | 跑 `stop-node-api.bat` |
| node.exe 找不到 | PATH 不对 | 安装 Node.js 18+ |
| 启动后立即退出 | 看 `node-api-3001.err.log` | 通常是缺少依赖，`cd metaplatform-api && npm install` |

## 前端服务 (vite) — port 5173

由 Trae IDE 自动管理（`npm run dev` + HMR）。

代理配置见 `metaplatform-frontend/vite.config.ts`：
- `/api/auth/*` → 3001 (Node)
- `/api/apps*` → 3001 (Node)
- `/api/versions/*` → 3001 (Node)
- `/api/objects/*` → 3001 (Node)
- `/api/dynamic-tables/*` → 3001 (Node)
- `/api/admin/*` → 3001 (Node)
- `/api/lookup/*` → 3001 (Node)
- `/api/forms/*` → 3001 (Node)
- `/actuator/*` → 8092 (Spring)
- `/api/admin/security/*` → 8092 (Spring)
- `/api/admin/tenants/*` → 8092 (Spring)
- `/api/ontology/*` → 8092 (Spring)

## 后端 Spring (metaplatform-app-service) — port 8092

由 Trae IDE 自动管理（`./gradlew bootRun`）。

## 完整 Docker 栈 (9 服务) — 端口 3001/5432/6379/7687/9200/9000/9001/9092/8081/8123

完整生产栈 (PostgreSQL/Redis/Neo4j/Elasticsearch/MinIO/Kafka/Flowable/ClickHouse + api/frontend)。
**资源消耗 ~8GB RAM, ~15GB disk**。

**Trae IDE 沙箱拦截 docker binary**（同 node 一样）。必须 system cmd 启动。

### 启动
```cmd
tools\start-docker-stack.bat
```
脚本会：
1. 检查 docker + Docker Desktop daemon
2. `docker compose up -d` (9 服务)
3. 等待 healthcheck (60s)
4. 输出容器状态 + 端口检查

### 停止
```cmd
tools\stop-docker-stack.bat
```
注：默认 `docker compose down` 不删数据卷。删数据：`docker compose down -v`

### 服务清单

| 服务 | 端口 | 用途 | 镜像 |
|---|---|---|---|
| `mp-postgres` | 5432 | PostgreSQL 16 主库 | postgres:16-alpine |
| `mp-redis` | 6379 | 缓存 + pub/sub | redis:7-alpine |
| `mp-neo4j` | 7687/7474 | 图数据库 (Phase 2) | neo4j:5.20 |
| `mp-elasticsearch` | 9200 | 全文搜索 (Phase 2) | elasticsearch:8.13.4 |
| `mp-minio` | 9000/9001 | 对象存储 (Phase 2) | minio/minio:latest |
| `mp-kafka` | 9092 | 事件总线 (Phase 2) | apache/kafka:3.7.0 |
| `mp-flowable-rest` | 8081 | BPMN 引擎 | flowable/flowable-rest:8.0.0 |
| `mp-clickhouse` | 8123/9000 | OLAP (Phase 3) | clickhouse:24.3 |
| `mp-api` | 3001 | metaplatform-api 容器化 | 本地 Dockerfile |
| `mp-frontend` | 80 | 前端 nginx | 本地 Dockerfile |

### 验证
```cmd
docker compose ps
docker compose logs -f mp-api
curl http://localhost:3001/health
```

### 故障排查
| 现象 | 原因 | 修复 |
|---|---|---|
| `docker daemon 未运行` | Docker Desktop 未启动 | 系统托盘 → Start Docker Desktop |
| `port 5432 already in use` | 本地有 PG 服务 | 停止本地 PG 或改端口 |
| `mp-api unhealthy` | 依赖未 ready | 看 `docker compose logs mp-api`，通常是 `mp-postgres` healthcheck 没过 |
| `mp-kafka` 反复重启 | 内存不足 | Docker Desktop → Settings → Resources → 内存 >= 8GB |
