# metaplatform-app-service

> **MetaPlatform 应用中心独立微服务** — Java 21 + Spring Boot 3 + PostgreSQL
>
> **版本**：v1.0.1「Forge+Flow」 — Sprint 0 + Sprint 1 已落地
>
> **端口**：8092（生产）/ random（测试）
>
> **设计依据**：[docs/v1.0.x/v1.0.1/05-app-service-architecture.md](../docs/v1.0.x/v1.0.1/05-app-service-architecture.md)

---

## ✨ 这是什么

应用中心（v1.0.1）的**领域微服务**。提供：

- 应用（App）的 CRUD + 跨租户隔离 + 乐观锁
- 对象（AppObject）的 CRUD + 字段语义 + 动态业务表（DDL）
- 表单（AppForm）的 CRUD + 发布状态机
- 8 张元数据表（Flyway 管理）+ 8 张动态业务表（运行时 created）
- AOP 自动审计 + TenantContext 跨租户上下文
- OpenAPI 3.0 文档自动生成（springdoc）

## 🛠 技术栈（与仓库整体一致）

| 维度 | 选型 | 理由 |
|------|------|------|
| 运行时 | **Java 21** | 与 `metaplatform-ontology-engine`、`metaplatform-platform-base`、`metaplatform-process-engine` 等核心服务同栈 |
| 框架 | **Spring Boot 3.2.5** | 与 ontology-engine Spring Boot 3 完全一致 |
| ORM | **Spring Data JPA + Hibernate 6** | 简单 CRUD，开发效率 |
| 数据库 | **PostgreSQL 16（生产）/ H2 in-memory（测试）** | 同栈 |
| 迁移 | **Flyway 10** | 已落地 V1 脚本 |
| API 文档 | **springdoc-openapi 2.3** | Swagger UI 自动 |
| 测试 | **Spring Boot Test + JUnit 5** | Service / Controller 集成测试 |

## 🏛 与整体架构的一致性

1. **业务域层（Java 21）**：`metaplatform-app-service` 属于业务域，与 ontology-engine 同栈
2. **微服务**：独立部署，符合 9 层架构 L2-1 业务对象层
3. **跨租户隔离**：复用 ontology-engine 的 TenantContext 设计模式
4. **审计日志**：AOP 自动拦截 + MDC 注入 traceId
5. **动态表所有权**：原 Node 版规定的 ontology-engine 物理建表，已调整为**app-service 自己管理**（详见 `docs/v1.0.x/v1.0.1/05-app-service-architecture.md §3.1 ARCHITECTURE_NOTE`）

## 📁 目录结构

```
metaplatform-app-service/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/appservice/
│   │   │   ├── AppServiceApplication.java        # 主入口
│   │   │   ├── api/error/                          # ApiException / ApiResponse / GlobalExceptionHandler
│   │   │   ├── config/                             # AppServiceProperties
│   │   │   ├── security/                           # TenantContext + TenantAndTraceFilter
│   │   │   ├── domain/
│   │   │   │   ├── audit/                          # AuditLog + AuditInterceptor (AOP)
│   │   │   │   ├── app/                            # 应用领域
│   │   │   │   ├── object/                         # 对象领域
│   │   │   │   ├── form/                           # 表单领域
│   │   │   │   ├── ontology/                       # ontology-engine 客户端
│   │   │   │   └── dynamic/                        # 动态建表服务
│   │   └── resources/
│   │       ├── application.yml                     # 生产配置
│   │       └── db/migration/
│   │           └── V1__init_schema.sql             # Flyway 初始化
│   └── test/
│       ├── java/com/metaplatform/appservice/
│       │   ├── domain/app/AppControllerTest.java
│       │   ├── domain/object/AppObjectControllerTest.java
│       │   └── domain/form/AppFormControllerTest.java
│       └── resources/
│           └── application-test.yml                # 测试 profile（H2 + in-memory）
```

## 🚀 如何运行

### 本地启动（生产模式，PostgreSQL）

```bash
# 0. 启动 PostgreSQL（项目根目录下 PostgreSQL 配置由 docker-compose 提供；若没有则用 H2 dev profile）
# 1. 启动 ontology-engine（可选，Sprint 0 暂时 mock）
# 2. 编译打包
mvn clean package -DskipTests
# 3. 启动
java -jar target/metaplatform-app-service-1.0.1-SNAPSHOT.jar
```

### 本地启动（开发模式，H2）

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
# H2 in-memory + Flyway 自动跑迁移
```

### 测试

```bash
mvn test
# 应输出 Tests run: 11, Failures: 0, Errors: 0, Skipped: 0
```

## 🧪 测试覆盖

| 用例 | 状态 |
|------|------|
| `AppControllerTest.shouldCreateListGetUpdateArchiveApp` | ✅ |
| `AppControllerTest.shouldRejectDuplicateCode` | ✅ |
| `AppControllerTest.shouldRejectInvalidCode` | ✅ |
| `AppControllerTest.shouldIsolateCrossTenant` | ✅ |
| `AppObjectControllerTest.shouldCreateObjectAndLinkOntology` | ✅ |
| `AppObjectControllerTest.shouldRejectDuplicateObjectCode` | ✅ |
| `AppObjectControllerTest.shouldRejectUnknownFieldType` | ✅ |
| `AppObjectControllerTest.shouldNotAllowChangingFields` | ✅ |
| `AppFormControllerTest.shouldCreatePublishForm` | ✅ |
| `AppFormControllerTest.shouldRejectDuplicateFormCode` | ✅ |
| `AppFormControllerTest.shouldRejectPublishedFormEdit` | ✅ |

## 📊 关键设计决策

| # | 决策 | 原因 |
|---|------|------|
| 1 | Java 21 + Spring Boot 3（不是 Node） | 与 ontology-engine、platform-base 等核心服务同栈；架构一致性 |
| 2 | PostgreSQL（不是 SQLite/H2） | 多租户/高并发；与 ontology-engine 一致 |
| 3 | Flyway 迁移（不是 jpa.hibernate.ddl-auto=create） | 生产环境必须可控、可追溯 |
| 4 | AOP 自动审计（AOP aspects） | 关注点分离，避免每条路由手工埋点 |
| 5 | TenantContext ThreadLocal + Filter 注入 | 与 ontology-engine 一致，强制每条 SQL 都带 tenant |
| 6 | 动态表由 app-service 自管 | 经过 ontology-engine 源码调研得知它不发 DDL（详见 ARCHITECTURE_NOTE） |
| 7 | 跨服务客户端使用 Profile @Profile | test profile 用 InMemoryOntologyClient，生产用 RestOntologyClient |

## 🔄 与已删除的 Node 版脚手架的关系

v1.0.1 Sprint 0 期间曾经用 Node.js + TypeScript 实施过一个 **28 文件、95 测试**的脚手架，
**该版本已于 2026-07-10 推倒重做为本 Java 工程**：
- 与现有 ontology-engine / platform-base 等 8 个 Java 服务同栈
- 重新实现 14 个 main 类 + 8 张表迁移 + 3 套件测试
- 沿用 Node 版的领域划分（apps/objects/forms/dynamic/audit/ontology 等子包）
- 删除 Node 版的 Express middleware / better-sqlite3 / TypeScript stub 等

详见 [docs/v1.0.x/v1.0.1/05-app-service-architecture.md 末尾的 ARCHITECTURE_NOTE](../docs/v1.0.x/v1.0.1/05-app-service-architecture.md)

## 📞 接口契约

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/apps` | 应用列表（active） |
| POST | `/api/apps` | 新建应用 |
| GET | `/api/apps/{id}` | 应用详情 |
| PUT | `/api/apps/{id}` | 更新（带 version 乐观锁） |
| DELETE | `/api/apps/{id}` | 软删 |
| GET | `/api/apps/{appId}/objects` | 对象列表 |
| POST | `/api/apps/{appId}/objects` | 新建对象（含 ontology 注册 + 动态建表） |
| GET | `/api/apps/{appId}/objects/{oid}` | 对象详情 |
| PUT | `/api/apps/{appId}/objects/{oid}` | 更新（不允许改 fields） |
| DELETE | `/api/apps/{appId}/objects/{oid}` | 删除（drop data table） |
| GET | `/api/apps/{appId}/forms` | 表单列表 |
| POST | `/api/apps/{appId}/forms` | 新建表单 |
| GET | `/api/apps/{appId}/forms/{fid}` | 表单详情 |
| PUT | `/api/apps/{appId}/forms/{fid}` | 编辑表单（草稿状态） |
| POST | `/api/apps/{appId}/forms/{fid}/publish` | 发布表单 |

完整 OpenAPI 文档：启动后访问 `http://localhost:8092/swagger-ui.html`

## 🔮 Sprint 2+ 待接入

- [ ] **Sprint 2**：submit / list / csv（Form 数据提交与查询）
- [ ] **Sprint 3**：workflow / approval / todo（简单流程 + 审批）
- [ ] **Sprint 4**：JWT 鉴权 + RBAC + 字段权限
- [ ] **Sprint 5**：与 ontology-engine 真实端点联调
- [ ] **Sprint 6**：性能压测（k6）+ 安全测试

---

最后更新：2026-07-10
