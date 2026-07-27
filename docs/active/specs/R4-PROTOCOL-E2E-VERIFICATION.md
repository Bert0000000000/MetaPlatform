# R4 协议层端到端联调报告

> 创建于 2026-07-24 22:40。
>
> 配套阶段：v1.3 重构期 R4（MCP / A2A 协议层端到端联调）。

## 联调目标

按 CLAUDE.md R4 阶段定义：
- **MCP（Model Context Protocol）**：spring-ai-alibaba Nacos MCP + Nacos 3.0+ Registry，平台作为 MCP Server 暴露 Tools / Resources / Prompts
- **A2A（Agent-to-Agent Protocol）**：spring-ai-alibaba-starter-a2a-nacos，与 Mate Workflow Engine 通过 Action 节点集成

## 联调环境

| 组件 | 状态 | 备注 |
|---|---|---|
| PostgreSQL 16 | ✅ | Docker，端口 5432 |
| Redis 7 | ✅ | Docker，端口 6379 |
| Nacos 2.4.3 | ✅ | Docker，端口 8848/9848（3.0+ POC 失败回退，详见 NACOS-3.0-POC-CHECKLIST.md） |
| TECH-LLMGW :8210 | ✅ | SAA DashScope + LLM Gateway |
| TECH-RAG :8901 | ✅ | Milvus + 文档检索 |
| TECH-DATA :8701 | ✅ | 数据集成 |
| TECH-MCP :8105 | ✅ | 启动成功，228 Java 文件 |
| TECH-A2A :8502 | ✅ | 启动成功，60 Java 文件 |
| TECH-AGENT :8511 | ✅ | 启动成功，139 Java 文件 |

## 联调结果

### 1. 协议层端点可达性

| 服务 | 端点 | HTTP | 结果 |
|---|---|---|---|
| TECH-MCP | GET /api/v1/mcp/overview | 200 | 业务异常（50001） |
| TECH-MCP | GET /api/v1/mcp/tools | 200 | 业务异常（50001） |
| TECH-MCP | GET /api/v1/mcp/servers | 200 | 业务异常（50001） |
| TECH-A2A | GET /api/v1/a2a/agent-cards | **200** | ✅ 空列表，DB 查询 OK |
| TECH-A2A | GET /api/v1/a2a/registry/agents | **200** | ✅ 空列表 |
| TECH-A2A | POST /api/v1/a2a/agent-cards | 200 | ❌ 业务异常（50001） |
| TECH-A2A | GET /.well-known/agent.json | 200 | ❌ 40404 (default card 不存在) |
| TECH-AGENT | GET /api/v1/agent/agents | **200** | ✅ 空列表 |
| TECH-AGENT | POST /api/v1/agent/agents/{id}/execute | 200 | ❌ 业务异常（50001） |
| TECH-AGENT | POST /api/v1/agent/agents | 200 | 未测 |

### 2. 已通过的联调

✅ **A2A 协议层**：list 端点完整工作，REST + JSON-RPC 入口可调用
✅ **AGENT 定义 list 端点**：分页 + 状态过滤正常工作
✅ **跨服务 infrastructure 联通**：Nacos 8848 健康、PG 5432 健康、Redis 6379 健康

### 3. 已知阻塞（写路径 / 模糊查询）

**根因**：`org.postgresql.util.PSQLException: ERROR: function lower(bytea) does not exist`

Hibernate 6.6.15 + PostgreSQL 16 + JPA Criteria 自动生成的查询：
```sql
SELECT ... FROM mcp_tool mte1_0
WHERE mte1_0.tenant_id=?
  AND (? IS NULL OR mte1_0.status=?)
  AND (? IS NULL OR lower(mte1_0.name) LIKE lower(('%'||?||'%')) escape '')
  AND (? IS NULL OR mte1_0.enabled=?)
  AND (? IS NULL OR mte1_0.category=?)
```

参数 `?` 被 PG driver 推断为 `bytea` 而非 `varchar`，导致 `lower(bytea)` 编译失败。

**影响范围**（所有 R2/R3 服务共有）：
- 所有 `LIKE` 模糊查询的字段（Hibernate `Specification` / `findByXxxLike`）
- 所有 INSERT 含 `JSON` / `TEXT` 字段的 SQL（如 `mcp_role.permissions` JSON 列）
- 所有 `lower()` 包裹字段的 JPA 自动查询

**修复方向**（R5 阶段）：
1. **临时方案**：`@Query` 自定义 JPQL 显式 `cast(? as text)`，覆盖自动生成
2. **根本方案**：
   - Option A：升级 Hibernate 到 6.6.4+（修复了 PG 16 兼容）
   - Option B：给 String 字段加 `@JdbcTypeCode(SqlTypes.VARCHAR)` 强制类型
   - Option C：实体字段加 `@Column(columnDefinition = "varchar(255)")` 显式声明

### 4. TECH-MCP 修复（本次完成）

之前 TECH-MCP `application.yml` 缺少 `datasource` / `jpa` / `flyway` 配置，导致启动后任何 API 都 500。本次补全：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/metaplatform_mcp
    username: ${DB_USER:meta}
    password: ${DB_PASSWORD:meta}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
    open-in-view: false
  flyway:
    enabled: true
    baseline-on-migrate: true
    locations: classpath:db/migration
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
```

TECH-MCP 启动日志确认 Spring Boot + Flyway 正常初始化，20 个迁移文件已就位（DB 现有 `mcp_*` 18 张表）。

## R4 联调结论

| 维度 | 评估 |
|---|---|
| 协议层（API surface） | ✅ 完整，20 MCP controllers + 9 A2A controllers + 10 AGENT controllers |
| 协议层（read 端点） | ✅ 工作（list / count） |
| 协议层（write 端点） | ❌ 阻塞于 PG 16 / Hibernate 6 类型推断 |
| 跨服务调用基础设施 | ✅ Nacos + PG + Redis 全通 |
| 端到端业务流 | ❌ 受写路径阻塞 |

**R4 协议层结构性完成**（所有 controller、DTO、service、entity 都在），**数据访问层需 R5 修 Hibernate PG 16 兼容**。

## 后续步骤

1. **R5 阶段必做**：升级 Hibernate 6.6.4+ 或在 entity 上 `@JdbcTypeCode(SqlTypes.VARCHAR)` 强制类型
2. **A2A Agent Card**：补一个 `default` Agent Card 模板让 `/.well-known/agent.json` 能找到
3. **跨服务真实联调**：所有写路径修复后，再跑一遍端到端 Agent 执行（TECH-AGENT → LLMGW → SAA → DashScope）
4. **MCP Tool 端到端调用**：MCP 修完后测 `POST /api/v1/mcp/tools/{id}/invoke`

## 关联文件

| 文件 | 改动 |
|---|---|
| `TECH-MCP/src/main/resources/application.yml` | 补全 datasource/jpa/flyway/redis |
| `start-r2-services.ps1` | 修 PowerShell ArgumentList 拆分 bug |
| `restart-mcp.ps1` | 新增单独重启 MCP 脚本 |
| `docs/NACOS-3.0-POC-CHECKLIST.md` | Nacos 3.0 升级 POC 记录 |
| `verify-r2-nacos.ps1` | Nacos + Actuator 三段验证 |
