# Mate Platform - API Reference (Swagger UI)

把 11 个服务的 OpenAPI 3.1 契约聚合到**单一入口**。

## 启动方式

任选其一（任选其一即可，建议方式 1）：

### 方式 1：Python 内置 HTTP 服务器（零依赖）

```powershell
cd docs\swagger
python -m http.server 8200
# 浏览器访问 http://localhost:8200
```

### 方式 2：Node http-server（如果有 Node）

```powershell
npx http-server docs\swagger -p 8200 -c-1
```

### 方式 3：docker compose 添加 swagger-ui 服务（推荐长期方案）

参见下面 "Docker 集成" 小节。

## 入口

| 路径 | 作用 |
|---|---|
| `/` | Swagger UI 聚合页（顶部下拉切服务） |
| `/specs/<service>.yaml` | 单服务 OpenAPI 3.1 yaml |
| `/specs/iam.yaml` | mate-tech-iam（60+ 接口） |
| `/specs/gateway.yaml` | api-gateway |
| `/specs/auth-service.yaml` | auth-service |
| `/specs/{rag,agent,app-kb,llmgw,ont,mcp,msg,obs}.yaml` | 其余 8 个微服务 |

## 与 FastAPI 内置 /docs 的关系

每个 Python 服务 `uvicorn main:app` 启动后自带：
- `GET /docs`     Swagger UI（服务自己的）
- `GET /redoc`    Redoc UI
- `GET /openapi.json`  OpenAPI 3.1 JSON（自动生成）

聚合页是**契约快照**（OpenAPI yaml 文件），用于：
- 跨服务查看 API 总览
- 不启动后端也能看接口文档
- 与前端联调前的契约评审

## 校验

```bash
# 校验所有 yaml 是否合法 OpenAPI 3.1
npx @redocly/cli lint docs/swagger/specs/*.yaml

# CI 推荐：oasdiff 检测 breaking change
oasdiff diff specs/main.yaml specs/feature.yaml
```

## Docker 集成（推荐补到 docker-compose.yml）

```yaml
  swagger-ui:
    image: swaggerapi/swagger-ui:latest
    container_name: mate-swagger-ui
    ports:
      - "8200:8080"
    environment:
      URLS: >-
        [
          {url: "/configs/iam.yaml",          name: "mate-tech-iam"},
          {url: "/configs/auth-service.yaml", name: "auth-service"},
          {url: "/configs/gateway.yaml",      name: "api-gateway"},
          {url: "/configs/rag.yaml",          name: "mate-tech-rag"},
          {url: "/configs/agent.yaml",        name: "mate-tech-agent"},
          {url: "/configs/app-kb.yaml",       name: "mate-app-kb"},
          {url: "/configs/llmgw.yaml",        name: "mate-tech-llmgw"},
          {url: "/configs/ont.yaml",          name: "mate-tech-ont"},
          {url: "/configs/mcp.yaml",          name: "mate-tech-mcp"},
          {url: "/configs/msg.yaml",          name: "mate-tech-msg"},
          {url: "/configs/obs.yaml",          name: "mate-tech-obs"}
        ]
    volumes:
      - ./docs/swagger/specs:/usr/share/nginx/html/configs:ro
    profiles: [docs, full]
```

启动：`docker compose --profile docs up -d swagger-ui`，访问 http://localhost:8200
