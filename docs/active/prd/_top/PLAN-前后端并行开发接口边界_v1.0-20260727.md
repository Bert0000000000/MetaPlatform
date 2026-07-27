# 前后端并行开发接口边界规范

> **版本**: v1.0 | **日期**: 2026-07-27
>
> **目的**: 在后端服务尚未就绪时，确保前端能够独立开发、独立测试、独立部署；后端可以并行按接口契约实现，不被前端阻塞。
>
> **核心原则**: **接口契约先行，Mock 兜底实现，并行解耦**
>
> **关联文档**:
> - docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md
> - docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md

---

## 1. 总体策略

### 1.1 并行开发模型

```
┌─────────────────────────────────────────────────────────────────┐
│                      接口契约（API-CONTRACT）                     │
│           - 141 个端点 + 统一响应格式 + 鉴权约定                    │
│           - 前后端共同维护，作为单一真相源                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                  ▼
┌──────────────────────┐        ┌──────────────────────┐
│  前端（独立开发）      │        │  后端（独立开发）       │
│  - 调用真实后端时      │  ────► │  - 按契约实现 controller│
│  - BFF 不可达时       │        │  - 单元测试 + 契约测试  │
│  - 降级到 Mock 数据   │        │  - 联调测试            │
└──────────────────────┘        └──────────────────────┘
```

### 1.2 关键约定

| 项 | 约定 |
|---|---|
| **接口契约先行** | API-CONTRACT.md 在前后端编码前最终确认，端点、路径、方法、请求/响应 schema 不得随意改动 |
| **Mock 兜底** | 前端每个 API 调用都有 Mock 兜底逻辑（catch 异常时返回 FALLBACK 数据），后端未就绪时不影响功能 |
| **解耦开发** | 前端不需要后端代码即可在本地完整运行；后端不需要前端代码即可独立测试 |
| **集成联调** | 前后端各自完成单元测试后，进行契约测试（验证响应格式）、端到端测试（验证业务流） |
| **就绪检查** | 后端每个端点上线前，必须通过：单元测试 + 契约测试 + 集成测试 |

---

## 2. 前端开发规范

### 2.1 API 调用规范

**位置**：所有 API 调用统一收敛在 `apps/{app}/src/api/*.ts` 与 `packages/shared/src/api/*.ts`

**模式**：
```typescript
// 推荐模式：try/catch + Mock 兜底
import { apiClient } from './client';

export async function listTemplates(params?: { keyword?: string; category?: string }): Promise<TemplateItem[]> {
  try {
    return await apiClient.get('/v1/apphub/templates', { params });
  } catch (error) {
    // Mock 兜底：仅在 BFF 不可达时使用
    console.warn('[apphub.templates] BFF 不可达，使用 mock 数据', error);
    return MOCK_TEMPLATES.filter(/* 按 params 过滤 */);
  }
}
```

**禁止**：
- 直接在组件中写 `axios.get()` 调用
- 在组件中硬编码 URL 字符串
- 不带类型注解的调用
- 没有 try/catch 的直接调用

### 2.2 类型契约

每个 API 调用必须有 TypeScript 接口定义：

```typescript
// apps/{app}/src/types/index.ts
export interface AppItem {
  appId: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE';
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
```

**禁止**：`any`、`as any`、`@ts-ignore` 出现在 API 调用附近。

### 2.3 Mock 兜底数据规范

- Mock 数据放在 `apps/{app}/src/mock/` 或 `apps/{app}/src/data/`
- Mock 数据**结构必须与 API 契约一致**（snake_case ↔ camelCase 转换在 API 层处理）
- Mock 数据应覆盖：空数据态、单条数据态、多条数据态、异常态

**示例**：
```typescript
// apps/apphub/src/data/templates.ts
export const MOCK_TEMPLATES: TemplateItem[] = [
  { templateId: 'tpl_001', name: '采购申请', category: 'OA', ... },
  { templateId: 'tpl_002', name: '客户管理', category: 'CRM', ... },
  // 空数组场景：MOCK_TEMPLATES = []
];
```

### 2.4 前端就绪状态自检

每个前端 PR 必须通过以下检查：
- [ ] `npm run typecheck` 通过（TypeScript 严格模式）
- [ ] `npm run lint` 通过（ESLint）
- [ ] `npm run build` 成功
- [ ] 所有 API 调用有 try/catch
- [ ] 所有 Mock 数据结构与契约一致

---

## 3. 后端开发规范

### 3.1 Controller 实现规范

**位置**：`backend/{service}/src/main/java/com/metaplatform/{service}/controller/`

**模式**（Java Spring Boot 3.5 + SAA）：
```java
@RestController
@RequestMapping("/api/v1/{prefix}")
public class TemplateController {
    private final TemplateService service;
    
    @GetMapping("/templates")
    public ApiResponse<List<TemplateItem>> list(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String category
    ) {
        return ApiResponse.ok(service.listTemplates(keyword, category));
    }
}
```

**要求**：
- 路径必须与 API-CONTRACT 一致
- 必须返回统一响应包装 `ApiResponse<T>`（code=0 表示成功）
- 必须支持分页参数 `page`, `size`
- 必须注入 `X-Tenant-Id` 过滤
- 必须记录 `X-Trace-Id` 到日志

### 3.2 错误处理规范

| 场景 | HTTP Status | code | message 示例 |
|---|---|---|---|
| 成功 | 200 | 0 | "success" |
| 参数错误 | 400 | 1001 | "参数 xxx 不能为空" |
| 资源不存在 | 200 | 2001 | "模板 tpl_001 不存在" |
| 资源冲突 | 200 | 2002 | "模板已存在，请使用其他名称" |
| 未登录 | 401 | 3001 | "登录已过期，请重新登录" |
| 无权限 | 200 | 3001 | "您没有权限访问该资源" |
| 租户隔离冲突 | 200 | 3002 | "您无权访问其他租户的资源" |
| LLM 失败 | 200 | 4001 | "LLM 调用失败：xxx" |
| 业务规则违反 | 200 | 5001 | "状态机不允许该操作" |

### 3.3 数据库规范

- 主库 PostgreSQL 17
- 图库 Neo4j 5.x
- 缓存 Redis 7.4
- 向量库 Milvus 2.5（仅 TECH-RAG）
- 消息队列 Kafka 3.9（异步任务）

**强制要求**：
- 所有表必须有 `tenant_id`, `created_at`, `updated_at`, `created_by`, `updated_by`
- 所有查询必须带 `tenant_id` 过滤（除非明确跨租户）
- 软删除：`is_deleted BOOLEAN DEFAULT false`，禁止物理删除
- 大字段（如配置 JSON）放 `JSONB` 类型

### 3.4 后端就绪状态自检

每个后端端点上线前必须通过：
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 契约测试通过（与 API-CONTRACT 一致）
- [ ] 集成测试通过（含租户隔离）
- [ ] 性能测试：P99 < 500ms（普通 CRUD），P99 < 3000ms（LLM/检索）
- [ ] 错误码与前端约定一致
- [ ] 日志记录 traceId

---

## 4. 联调流程

### 4.1 阶段定义

| 阶段 | 前端状态 | 后端状态 | 测试重点 |
|---|---|---|---|
| **Phase 0：契约锁定** | 编写 API 调用 + Mock | 编写 Controller + 单元测试 | API-CONTRACT 一致性 |
| **Phase 1：本地联调** | 对接本地后端 | 本地服务启动 | 单端点功能 |
| **Phase 2：集成测试** | 联调测试环境 | 测试环境部署 | 完整业务流程 |
| **Phase 3：预发验证** | 预发环境部署 | 预发环境部署 | 端到端 + 性能 |
| **Phase 4：生产发布** | 生产发布 | 生产发布 | 灰度 + 监控 |

### 4.2 契约测试

前后端共同维护一组契约测试用例（建议放在 `backend/tests/contract/`）：

```java
@SpringBootTest
public class ApphubTemplateContractTest {
    @LocalServerPort int port;
    
    @Test
    public void testListTemplatesContract() {
        // 验证响应结构与 API-CONTRACT 一致
        // 验证 code=0 表示成功
        // 验证 data 包含 items, total, page, size, pages
    }
}
```

前端在 `apps/apphub/src/__tests__/` 提供对应的契约测试：
```typescript
import { listTemplates } from '@/api/marketplace';

describe('apphub.marketplace.contract', () => {
  it('listTemplates 应返回 TemplateItem[]', async () => {
    const result = await listTemplates({ keyword: 'OA' });
    expect(Array.isArray(result)).toBe(true);
  });
});
```

### 4.3 集成测试环境

- 前端：`https://test.metaplatform.io/`
- 后端：`https://api-test.metaplatform.io/`（经 TECH-GW 网关）
- 数据：每个开发人员独立沙箱（按 X-Dev-Id 隔离）

---

## 5. 部署与就绪条件

### 5.1 前端就绪条件（PR 合并前）

- [ ] 所有新增/修改的端点在 API-CONTRACT.md 中已更新
- [ ] Mock 数据与契约一致
- [ ] TypeScript 类型与契约一致
- [ ] 错误处理覆盖所有异常分支
- [ ] UI 集成测试通过

### 5.2 后端就绪条件（每个端点上线前）

- [ ] Controller 实现与 API-CONTRACT 一致
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 契约测试通过
- [ ] 集成测试通过
- [ ] Swagger/OpenAPI 文档已生成（前端可导入类型）
- [ ] Nacos 配置已就绪
- [ ] 日志/监控已配置（traceId, 租户, 性能）

### 5.3 联调就绪条件（端到端业务流上线前）

- [ ] 前端 + 后端在测试环境联调通过
- [ ] 完整业务流覆盖（创建 → 查询 → 更新 → 删除）
- [ ] 异常流程覆盖（401/403/404/409/500）
- [ ] 性能压测通过
- [ ] 安全审计通过（XSS、SQL 注入、CSRF）

---

## 6. 接口变更管理

### 6.1 兼容性原则

- **不破坏现有端点**：已发布的端点不得修改路径、方法、请求/响应结构
- **新增走新路径**：新功能必须用新路径（如 `/v2/...`），不修改现有路径
- **废弃流程**：先标记 `@Deprecated`，6 个月后移除

### 6.2 变更流程

1. 在 API-CONTRACT.md 中提出变更建议
2. 前后端 owner 共同评审
3. 在 `docs/reviews/` 中记录评审结论
4. 更新 API-CONTRACT.md
5. 前端代码同步更新（如需要）
6. 后端按新契约实现

### 6.3 版本演进

| 版本 | 路径 | 说明 |
|---|---|---|
| v1 | /api/v1/{prefix}/* | 当前版本 |
| v2 | /api/v2/{prefix}/* | 未来重大升级版本 |

---

## 7. 工具与基础设施

### 7.1 前端开发工具

| 工具 | 用途 |
|---|---|
| axios | HTTP 客户端（已封装在 packages/shared/src/api/client.ts） |
| TypeScript | 类型契约 |
| Vitest | 单元测试 / 契约测试 |
| ESLint + Prettier | 代码规范 |
| Mock Service Worker | 可选的高级 Mock（暂未启用） |

### 7.2 后端开发工具

| 工具 | 用途 |
|---|---|
| Spring Boot 3.5 | 框架 |
| Spring Cloud Alibaba 2025.0.0.0 | 微服务 / Nacos |
| Spring AI Alibaba 1.1.2.0 | AI 集成 |
| JUnit 5 + Mockito | 单元测试 |
| Testcontainers | 集成测试（数据库/中间件） |
| SpringDoc OpenAPI | API 文档生成 |
| Spring Cloud Contract | 契约测试（前后端共享） |

### 7.3 共享契约

| 工具 | 用途 |
|---|---|
| API-CONTRACT.md | 端点清单（人读） |
| Swagger/OpenAPI | 后端自动生成的 API 文档 |
| TypeScript 类型导出 | 前端类型生成（可从 OpenAPI 自动生成） |
| Postman/Apifox | 前后端联调测试 |

---

## 8. 时间线与里程碑

### 8.1 Phase 0：契约锁定（已完成 2026-07-27）

- [x] 扫描前端代码，汇总 141 个 API 端点
- [x] 定义统一响应格式
- [x] 定义鉴权与安全约定
- [x] 生成 API-CONTRACT.md
- [x] 生成并行开发规范

### 8.2 Phase 1：前后端并行开发（2026-07-27 ~ 2026-08-15）

- 前端：
  - [ ] 完成 6 个 PRD 主文档更新（v2.2~v2.4）
  - [ ] 完成 6 份按钮手册更新（v1.1）
  - [ ] 完成「待补交互清单」的代码实现
- 后端：
  - [ ] P0：TECH-IAM、TECH-WFE、TECH-LLMGW 接入契约
  - [ ] P0：APPHUB/COPILOT/DASHBOARD/DW 四个 controller 模块实现
  - [ ] P1：TECH-ONT、TECH-RAG、TECH-MCP 接入契约
  - [ ] P2：TECH-EA、TECH-A2A、TECH-MSG 接入契约

### 8.3 Phase 2：联调与集成（2026-08-15 ~ 2026-08-31）

- [ ] 前后端联调测试
- [ ] 契约测试通过
- [ ] 性能测试通过
- [ ] 安全审计通过

### 8.4 Phase 3：预发与生产（2026-09-01 ~ 2026-09-15）

- [ ] 预发环境部署
- [ ] 端到端业务流验证
- [ ] 灰度发布
- [ ] 全面上线

---

## 9. 常见问题

### Q1: 后端未就绪时前端如何测试？

A: 依赖 Mock 兜底。每个 API 调用都应 try/catch，BFF 不可达时返回 `MOCK_*` 数据。前端可在本地完全独立运行。

### Q2: 后端如何知道前端期望的响应格式？

A: 参考 API-CONTRACT.md 4. 响应规范 与各模块 PRD 的「数据模型」章节。也可由前端提供 OpenAPI Schema，后端导入生成 DTO。

### Q3: 接口变更需要走什么流程？

A: 见本文档 §6.2 变更流程。简单变更（新增字段）可直接在 API-CONTRACT.md 中更新；破坏性变更（删除字段、改类型）需评审。

### Q4: 如何处理跨服务的接口？

A: 通过 TECH-GW 网关统一入口，不允许前端直接调用具体服务。所有 `/api/v1/{prefix}/*` 都经网关分发。

### Q5: 如何处理异步任务（如文档处理）？

A: 同步任务：HTTP 阻塞等待；异步任务：返回 `taskId`，前端订阅 SSE 或轮询 `GET /api/v1/{prefix}/tasks/{taskId}`。详见 API-CONTRACT §2.1。

---

文档版本: v1.0
文档日期: 2026-07-27
关联文档: API-CONTRACT-前端接口契约清单_v1.0-20260727.md
扫描范围: metaplatform-frontend/apps/*/src/api + packages/shared/src/api
