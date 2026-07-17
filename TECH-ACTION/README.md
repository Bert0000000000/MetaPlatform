# TECH-ACTION - Action Engine 服务

## 模块类型

TECH 模块

## 作用

动作执行引擎，负责 Mate Platform 中 Action 定义的注册、版本管理、发布/禁用生命周期控制，以及同步 HTTP 动作的调用、执行记录与审计。Action 是连接本体语义、工作流、规则引擎与外部业务系统的可执行能力单元。

## 上游依赖

- `TECH-ONT`：动作语义定义与本体概念引用
- `TECH-WFE`：工作流执行时的动作调用编排
- `TECH-RULE`：规则触发后的动作执行委托

## 下游消费

- `APP-APPHUB`：低代码应用构建时引用平台动作能力
- `APP-SUPERAI`：超级 AI 通过 Action 调用外部工具与内部服务
- `TECH-AGENT`：Agent 运行时调用 Action 完成工具执行
- `TECH-MCP`：通过 MCP 协议对外暴露 Action 工具

## 目录结构

```
TECH-ACTION/
├── README.md              # 本文件
├── pom.xml                # Maven 构建配置
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/action/
│   │   │   ├── ActionApplication.java                       # Spring Boot 入口
│   │   │   ├── common/                                      # 通用工具类
│   │   │   │   ├── ApiResponse.java
│   │   │   │   ├── PageResponse.java
│   │   │   │   ├── ErrorCode.java
│   │   │   │   ├── TenantContext.java
│   │   │   │   ├── TraceContext.java
│   │   │   │   └── TraceFilter.java
│   │   │   ├── exception/                                   # 异常处理
│   │   │   │   ├── ActionException.java
│   │   │   │   └── GlobalExceptionHandler.java
│   │   │   ├── definition/                                  # Action 定义管理
│   │   │   │   ├── controller/ActionDefinitionController.java
│   │   │   │   ├── service/ActionDefinitionService.java
│   │   │   │   ├── repository/ActionDefinitionRepository.java
│   │   │   │   ├── entity/ActionDefinitionEntity.java
│   │   │   │   └── dto/
│   │   │   └── execution/                                   # 动作执行
│   │   │       ├── controller/ExecutionController.java
│   │   │       ├── service/HttpExecutionService.java
│   │   │       ├── repository/ExecutionRepository.java
│   │   │       ├── entity/ExecutionEntity.java
│   │   │       └── dto/
│   │   └── resources/
│   │       ├── application.yml                              # 主配置
│   │       ├── application-dev.yml                          # 开发环境配置
│   │       └── db/migration/V1__init_action_schema.sql      # Flyway 初始化脚本
│   └── test/
│       ├── java/com/metaplatform/action/
│       │   ├── definition/controller/ActionDefinitionControllerTest.java
│       │   ├── definition/service/ActionDefinitionServiceTest.java
│       │   └── execution/service/HttpExecutionServiceTest.java
│       └── resources/application.yml                        # 测试配置
└── docs/                                                    # 模块内部文档
```

## 本地开发

### 环境要求

- JDK 21
- Maven 3.9+

### 编译与测试

```bash
# 完整构建并运行测试
mvn clean verify

# 跳过测试快速打包
mvn clean package -DskipTests

# 仅运行单元测试
mvn test
```

### 启动服务（开发环境）

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

开发环境使用 H2 内存数据库，默认端口 `8104`，可通过 `http://localhost:8104/h2-console` 访问数据库控制台。

### 主要 API

- Action 定义 CRUD：`/api/v1/action/definitions`
  - `POST /definitions` - 创建
  - `GET /definitions` - 分页列表
  - `GET /definitions/{id}` - 详情
  - `PUT /definitions/{id}` - 更新
  - `DELETE /definitions/{id}` - 删除
  - `POST /definitions/{id}/publish` - 发布
  - `POST /definitions/{id}/disable` - 禁用
- 动作同步执行：`POST /api/v1/action/executions/sync`

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
- [规范文档](../../docs/003-SPEC/)
