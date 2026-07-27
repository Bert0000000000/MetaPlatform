# Nacos 3.0+ 升级与 POC 验证清单

> 创建于 2026-07-24，配套 `docker-compose.yml` 中 Nacos 由 `v2.4.3-slim` 升级到 `v3.0.1`。
>
> **依据**：CLAUDE.md 教训条目 "Nacos 3.0 引入需先做 POC"。

## 升级要点（v2.4.3 → v3.0.1）

| 项 | 2.4.3 | 3.0.1 | 备注 |
|---|---|---|---|
| 镜像 | `nacos/nacos-server:v2.4.3-slim` | `nacos/nacos-server:v3.0.1` | Docker Hub 官方 |
| HTTP 端口 | 8848 | 8848 | 不变 |
| gRPC RPC | 9848 | 9848 | 不变 |
| **gRPC Config/MCP** | 需额外 9848 复用 | **9849 独立端口** | 3.0 新增，MCP/A2A 长连接 |
| 鉴权 | `NACOS_AUTH_ENABLE` | 同名 + 强制开启 | 3.0 默认开启，关闭需显式 `false` |
| 健康检查端点 | `/nacos/v1/console/health/readiness` | 优先 `/nacos/v3/console/health/readiness` | 3.0 引入 v3 API，v1 保留兼容 |
| 默认账号 | nacos/nacos | 同上 | 升级时强制改密 |

## POC 验证顺序

### Step 1：本地启动
```bash
docker compose up -d nacos
# 等 60s，check ready
curl -sf http://localhost:8848/nacos/v3/console/health/readiness
# Console: http://localhost:8848/nacos  (nacos/nacos)
```

### Step 2：SCA 客户端连通性验证（必做）

在 `TECH-IAM` / `TECH-AGENT` 任一模块 application.yml 中确认：
```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: localhost:8848
        # 3.0 新增：gRPC 端口独立
        grpc-port: 9848
      config:
        server-addr: localhost:8848
        # 3.0 新增：Config 走 9849
        grpc-port: 9849
```

启动 `TECH-IAM`（已知有 pom.xml），日志确认：
```
[DiscoveryClient] nacos registry, DEFAULT_GROUP service-name meta-iam-server  register success
[ConfigClient] nacos config, data-id=tech-iam.yaml  received and applied
```

### Step 3：MCP/A2A 注册验证（v1.2 重点）

3.0 是 MCP/A2A 一等公民。验证方式（任选）：
```bash
# 注册一个测试 MCP Server
curl -X POST http://localhost:8848/nacos/v3/ai/mcp/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "mate-mcp-test",
    "address": "127.0.0.1",
    "port": 9100,
    "transport": "stdio"
  }'

# 查询
curl http://localhost:8848/nacos/v3/ai/mcp/list
```

### Step 4：升级失败回滚

保留 2.x 镜像备份方案：
```bash
# 回滚 2.4.3
docker tag nacos/nacos-server:v3.0.1 nacos/nacos-server:v3.0.1.bak
docker compose down nacos
sed -i 's/v3.0.1/v2.4.3-slim/' docker-compose.yml
docker compose up -d nacos
```

## 与 v1.2 架构的对接

| 模块 | 依赖 Nacos 3.0 的能力 |
|---|---|
| `TECH-MCP` | `nacos-ai/mcp` 自动注册、客户端发现 |
| `TECH-A2A` | `nacos-ai/a2a` Agent Card 注册与发现 |
| `TECH-IAM` | Config Center 集中管理 JWT 密钥 / 白名单 |
| `TECH-AGENT` | Config Center 拉取模型路由 / System Prompt 模板 |
| `TECH-LLMGW` | Config Center 管理多模型路由权重 |

## 注意事项

- **不要在生产关闭鉴权**（`NACOS_AUTH_ENABLE=false`）。本次 docker-compose 关闭是为了本地开发，CI/生产必须开启。
- **9849 端口必须暴露**：SAA Nacos MCP/A2A starter 在 3.0 上会建立长连接，Docker 容器/云上需在安全组放行。
- **Spring Cloud Alibaba 2025.0.0.0 已内置 nacos-client 3.0.3**，不需要在 pom.xml 单独指定版本。
