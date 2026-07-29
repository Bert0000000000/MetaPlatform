# Swagger / OpenAPI 集成指南

> **版本**: v1.0 | **日期**: 2026-07-27
> **目的**: 提供 Swagger UI + 后端 springdoc-openapi + 前端 openapi-typescript 的完整集成方案

---

## 1. 工具栈总览

| 工具 | 用途 | 阶段 |
|---|---|---|
| **OpenAPI 3.0 Spec** | API 契约单一真相源 | 阶段 1（已完成） |
| **Swagger UI** | 交互式 API 文档 | 阶段 2 |
| **Prism** | Mock 服务 | 阶段 3 |
| **springdoc-openapi** | 后端 Java 自动生成 DTO + Swagger | 阶段 4（后端） |
| **openapi-typescript** | 前端 TypeScript 类型生成 | 阶段 5（前端） |
| **Spectral** | Spec 规范校验 | 阶段 6（CI） |

---

## 2. 当前进度

- [x] **阶段 1**: 生成 OpenAPI 3.0 Spec（`docs/api/openapi.yaml`，130KB，141 端点）
- [ ] 阶段 2: 部署 Swagger UI（需用户确认）
- [ ] 阶段 3: 部署 Prism Mock（需用户确认）
- [ ] 阶段 4: 后端 springdoc-openapi 集成（需后端服务就绪）
- [ ] 阶段 5: 前端 openapi-typescript 集成（可立即启动）
- [ ] 阶段 6: CI Spectral 校验（与阶段 2 并行）

---

## 3. 阶段 2：Swagger UI 部署

### 3.1 Docker 方式（推荐）

```bash
# 启动 Swagger UI 容器
docker run -d \
  --name mate-swagger-ui \
  -p 8080:8080 \
  -e SWAGGER_JSON=/api/openapi.yaml \
  -v $(pwd)/docs/api/openapi.yaml:/api/openapi.yaml:ro \
  swaggerapi/swagger-ui:v5.17.14

# 访问 http://localhost:8080
```

### 3.2 集成到 Spring Boot 后端

```java
// 后端 pom.xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.6.0</version>
</dependency>

// application.yml
springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
    operations-sorter: alpha
    tags-sorter: alpha

// 访问 http://localhost:8000/swagger-ui.html
```

### 3.3 前端集成（Vite）

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
});

// 在 apps/web 中挂载 Swagger UI
// pnpm add swagger-ui-dist
// 在某个路由下渲染 Swagger UI
```

---

## 4. 阶段 3：Prism Mock 服务

### 4.1 启动 Mock

```bash
# 安装
npm install -g @stoplight/prism-cli

# 启动 Mock（监听 4010 端口）
prism mock docs/api/openapi.yaml --port 4010
```

### 4.2 前端配置切换

```typescript
// metaplatform-frontend/packages/shared/src/config/apiConfig.ts
const API_BASE = process.env.NODE_ENV === 'production'
  ? '/api/v1'  // 生产：TECH-GW
  : process.env.VITE_USE_MOCK === 'true'
    ? 'http://localhost:4010'  // 本地 Mock
    : '/api/v1';  // 本地真实后端
```

### 4.3 启动脚本

```json
// package.json
{
  "scripts": {
    "mock": "prism mock docs/api/openapi.yaml --port 4010",
    "dev:mock": "VITE_USE_MOCK=true pnpm dev",
    "dev": "pnpm dev"
  }
}
```

---

## 5. 阶段 4：后端 springdoc-openapi 集成

### 5.1 完整 Controller 示例

```java
package com.metaplatform.apphub.controller;

import com.metaplatform.apphub.dto.AppDto;
import com.metaplatform.apphub.dto.CreateAppRequest;
import com.metaplatform.apphub.service.AppService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/v1/apphub/apps")
@Tag(name = "apphub", description = "应用中心")
@SecurityRequirement(name = "BearerAuth")
public class AppController {
    
    private final AppService service;
    
    public AppController(AppService service) {
        this.service = service;
    }
    
    @GetMapping
    @Operation(summary = "应用列表", description = "分页查询应用列表")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "成功"),
        @ApiResponse(responseCode = "401", description = "未登录")
    })
    public ApiResponse<PageResponse<AppDto>> list(
        @Parameter(description = "搜索关键字") @RequestParam(required = false) String keyword,
        @Parameter(description = "应用分组") @RequestParam(required = false) String group,
        @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.ok(service.list(keyword, group, page, size));
    }
    
    @PostMapping
    @Operation(summary = "创建应用")
    public ApiResponse<AppDto> create(
        @io.swagger.v3.oas.annotations.parameters.RequestBody(
            required = true,
            content = @Content(schema = @Schema(implementation = CreateAppRequest.class))
        )
        @Valid @RequestBody CreateAppRequest request
    ) {
        return ApiResponse.ok(service.create(request));
    }
}
```

### 5.2 DTO 用 Schema 注解

```java
package com.metaplatform.apphub.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
@Schema(description = "创建应用请求")
public class CreateAppRequest {
    
    @Schema(description = "应用名", example = "采购管理", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank
    @Size(min = 1, max = 64)
    private String name;
    
    @Schema(description = "应用编码", example = "purchase_app")
    @NotBlank
    @Pattern(regexp = "^[a-zA-Z][a-zA-Z0-9_]{0,63}$")
    private String code;
    
    @Schema(description = "应用分组")
    @Size(max = 32)
    private String group = "default";
    
    @Schema(description = "应用描述")
    @Size(max = 512)
    private String description;
}
```

### 5.3 启动应用后

访问 `http://localhost:8000/swagger-ui.html` 即可看到自动生成的 API 文档。

访问 `http://localhost:8000/v3/api-docs` 即可拿到 OpenAPI 3.0 JSON Spec（可与 `docs/api/openapi.yaml` 对比）。

### 5.4 配置说明

```yaml
# application.yml
springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
    operations-sorter: alpha
    tags-sorter: alpha
    display-request-duration: true
  packages-to-scan: com.metaplatform
  default-produces-media-type: application/json
  default-consumes-media-type: application/json
```

---

## 6. 阶段 5：前端 openapi-typescript 集成

### 6.1 安装

```bash
cd metaplatform-frontend
pnpm add -D openapi-typescript
```

### 6.2 生成类型

```bash
npx openapi-typescript ../docs/api/openapi.yaml -o packages/shared/src/api/types.generated.ts
```

### 6.3 自动生成（package.json）

```json
{
  "scripts": {
    "gen:api": "openapi-typescript ../docs/api/openapi.yaml -o packages/shared/src/api/types.generated.ts",
    "prebuild": "pnpm gen:api"
  }
}
```

### 6.4 使用生成的类型

```typescript
// packages/shared/src/api/index.ts
import type { paths, components } from './types.generated';

// 类型导出
export type App = components['schemas']['App'];
export type CreateAppRequest = components['schemas']['CreateAppRequest'];
export type ListAppsResponse = paths['/v1/apphub/apps']['get']['responses']['200']['content']['application/json'];

// 类型化 API 客户端
import { apiClient } from './client';

export async function listApps(params: paths['/v1/apphub/apps']['get']['parameters']['query']): Promise<...> {
  // ...
}
```

### 6.5 完整类型化 client 示例

```typescript
// packages/shared/src/api/typed-client.ts
import type { paths } from './types.generated';
import axios from 'axios';

type Path<M extends 'get' | 'post' | 'put' | 'delete' | 'patch'> = {
  [P in keyof paths]: paths[P] extends { [K in M]?: any } ? P : never
}[keyof paths];

type RequestParams<P extends string, M extends 'get' | 'post' | 'put' | 'delete' | 'patch'> =
  paths[P] extends { [K in M]: { parameters?: any; requestBody?: any } }
    ? paths[P][M]
    : never;

export async function request<P extends Path<M>, M extends 'get' | 'post' | 'put' | 'delete' | 'patch'>(
  path: P,
  method: M,
  params?: RequestParams<P, M>['parameters'],
  body?: RequestParams<P, M>['requestBody']
): Promise<any> {
  return apiClient.request({ url: path, method, params, data: body });
}

// 使用
const apps = await request('/v1/apphub/apps', 'get', { query: { keyword: 'test' } });
```

---

## 7. 阶段 6：CI Spectral 校验

### 7.1 安装

```bash
pnpm add -D @stoplight/spectral-cli
```

### 7.2 规则文件

```yaml
# .spectral.yaml
extends: spectral:oas
rules:
  operation-tag-defined: error
  operation-description: warning
  info-license: error
  info-contact: warning
  oas3-api-servers: error
  no-eval-in-markdown: error
```

### 7.3 CI 集成

```yaml
# .github/workflows/api-lint.yml
name: API Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @stoplight/spectral-cli
      - run: spectral lint docs/api/openapi.yaml
```

---

## 8. 实施时间表

| 阶段 | 工作量 | 前置依赖 |
|---|---|---|
| 阶段 2 Swagger UI 部署 | 0.5 人天 | Docker |
| 阶段 3 Prism Mock 部署 | 0.5 人天 | Node.js |
| 阶段 4 后端 springdoc 集成 | 2-3 人天 | 后端项目就绪 |
| 阶段 5 前端类型生成 | 1 人天 | 立即可做 |
| 阶段 6 CI Spectral 校验 | 0.5 人天 | CI 平台 |

**合计**: 4.5-5.5 人天

---

## 9. 建议优先级

| 优先级 | 阶段 | 理由 |
|---|---|---|
| P0 | 阶段 5 前端类型生成 | 立即可做，提升前端类型安全 |
| P0 | 阶段 3 Prism Mock | 前端无后端时可独立开发 |
| P1 | 阶段 2 Swagger UI | 文档即代码 |
| P1 | 阶段 6 CI Spectral | CI 阶段拦截 |
| P2 | 阶段 4 springdoc | 等后端就绪后做 |

---

## 10. 关联文档

- `docs/api/openapi.yaml` —— 完整 OpenAPI Spec（130KB，141 端点）
- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` —— 原 Markdown 契约
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md` —— 并行开发规范
- `docs/prd/APP-*/PRD-APP-*-详细规范_v1.0-20260727.md` —— 详细规范

---

## 11. 待确认事项

请确认以下问题后我开始执行阶段 2 之后的实施：

1. **是否立即生成前端 TypeScript 类型**（阶段 5）？
2. **是否启动 Prism Mock 服务**（阶段 3）？需要 Prism 安装在本地
3. **是否启动 Swagger UI**（阶段 2）？需要 Docker
4. **后端 springdoc 集成**（阶段 4）等后端就绪后再做？