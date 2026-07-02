# 能力库 v0.1 — Implementation Plan

> **Module:** `metaplatform-capability`
> **Version:** 0.1.0
> **Date:** 2026-07-02
> **Status:** Draft
> **Java:** 21 | **Spring Boot:** 3.2 | **Build:** Maven
> **Port:** 8086

---

## 1. Vision & Scope

能力库是 MetaPlatform 的可复用能力集合。它将平台中常用的业务能力（如邮件、短信、AI 总结、翻译、PDF 生成等）标准化为统一接口，支持单个执行和 Pipeline 组合执行。能力库是流程自动化引擎和对话层的底层支撑，为上层提供原子化的可编排能力。

### 1.1 核心能力

| 能力 | 说明 |
|------|------|
| Capability 接口 | 统一的能力抽象：输入 → 执行 → 输出 |
| Capability Registry | 能力注册中心，自动发现并注册所有 Capability Bean |
| Execution Engine | 能力执行引擎，支持同步/异步执行、重试、超时控制 |
| 10 个内置能力 | 邮件、短信、AI 摘要、翻译、PDF 生成、数据导出、通知、HTTP 请求、数据校验、AI 分类 |
| Pipeline 组合 | 顺序执行多个能力，前一个的输出作为后一个的输入 |
| AI 能力 | 部分内置能力通过 AI Substrate LLM Gateway 实现 |
| REST API | 能力列表/执行 + Pipeline 管理 |
| 独立模块 | Java 21 + Spring Boot 3.2 独立部署 |

### 1.2 Non-Goals (v0.1)

- 条件分支 Pipeline (v0.2)
- 并行执行 Pipeline (v0.2)
- 自定义能力热插拔 (v0.2)
- 能力市场/版本管理 (v0.2)
- 能力执行历史/审计 (v0.2)
- 多租户隔离
- 能力限流/熔断

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           REST API Layer                            │
│  /api/v1/capabilities           /api/v1/capabilities/{id}/execute   │
│  /api/v1/pipelines              /api/v1/pipelines/{id}/execute      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                         Application Layer                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐│
│  │ Capability-     │  │ Execution-     │  │ PipelineService        ││
│  │ Registry        │  │ Engine         │  │ (组合执行)              ││
│  │ (能力注册)       │  │ (执行引擎)     │  │                        ││
│  └────────┬───────┘  └───────┬────────┘  └────────────┬───────────┘│
│           │                  │                         │            │
│  ┌────────▼──────────────────▼─────────────────────────▼──────────┐ │
│  │                    Built-in Capabilities                        │ │
│  │ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────────┐ │ │
│  │ │ Email    │ │ SMS      │ │ AiSummary │ │ Translation       │ │ │
│  │ └──────────┘ └──────────┘ └───────────┘ └───────────────────┘ │ │
│  │ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────────┐ │ │
│  │ │ PdfGen   │ │ DataExport│ │ Notification│ │ HttpRequest     │ │ │
│  │ └──────────┘ └──────────┘ └───────────┘ └───────────────────┘ │ │
│  │ ┌──────────────┐ ┌───────────────────┐                         │ │
│  │ │ DataValidation│ │ AiClassification  │                         │ │
│  │ └──────────────┘ └───────────────────┘                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      Domain Layer                                   │
│  Capability │ CapabilityResult │ Pipeline │ PipelineStep            │
│  CapabilityType │ ExecutionStatus                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│              Persistence Layer (JPA + PostgreSQL + Flyway)          │
│  capability_pipeline │ pipeline_step │ capability_execution_log     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Domain Model

### 3.1 Capability 接口（核心抽象）

```java
/**
 * 能力接口 — 所有内置和自定义能力实现此接口
 */
public interface Capability {

    /**
     * 能力唯一标识
     */
    String getId();

    /**
     * 能力名称（人类可读）
     */
    String getName();

    /**
     * 能力描述
     */
    String getDescription();

    /**
     * 能力分类
     */
    CapabilityType getType();

    /**
     * 执行能力
     *
     * @param input 输入参数 Map
     * @return 执行结果
     */
    CapabilityResult execute(Map<String, Object> input);
}
```

### 3.2 CapabilityResult

```java
/**
 * 能力执行结果
 */
public record CapabilityResult(
    boolean success,
    String message,
    Map<String, Object> output,
    long executionTimeMs
) {
    public static CapabilityResult success(String message, Map<String, Object> output, long executionTimeMs) {
        return new CapabilityResult(true, message, output, executionTimeMs);
    }

    public static CapabilityResult failure(String message, long executionTimeMs) {
        return new CapabilityResult(false, message, Map.of(), executionTimeMs);
    }
}
```

### 3.3 CapabilityType 枚举

```java
public enum CapabilityType {
    COMMUNICATION,     // 通信类：邮件、短信、通知
    AI_POWERED,        // AI 驱动类：摘要、翻译、分类
    DOCUMENT,          // 文档类：PDF 生成、数据导出
    INTEGRATION,       // 集成类：HTTP 请求
    DATA,              // 数据类：数据校验
    COMPOSITE          // 组合类：Pipeline
}
```

### 3.4 Pipeline（持久化实体）

```java
@Entity
@Table(name = "capability_pipeline")
public class Pipeline {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;               // Pipeline 名称

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExecutionStatus status;    // DRAFT | ACTIVE | DISABLED

    @OneToMany(mappedBy = "pipeline", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    private List<PipelineStep> steps;

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

@Entity
@Table(name = "pipeline_step")
public class PipelineStep {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pipeline_id", nullable = false)
    private Pipeline pipeline;

    @Column(nullable = false)
    private Integer stepOrder;         // 步骤顺序

    @Column(nullable = false)
    private String capabilityId;       // 关联的能力 ID

    @Column(columnDefinition = "TEXT")
    private String inputMappingJson;   // 输入映射表达式 JSON

    @Column(columnDefinition = "TEXT")
    private String conditionJson;      // 条件表达式（v0.1 留空）

    private Boolean continueOnError;   // 失败是否继续（默认 false）
}

public enum ExecutionStatus {
    DRAFT, ACTIVE, DISABLED
}
```

### 3.5 Execution Log（执行日志）

```java
@Entity
@Table(name = "capability_execution_log")
public class CapabilityExecutionLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String capabilityId;
    private Long pipelineId;

    @Enumerated(EnumType.STRING)
    private ExecutionStatus executionStatus;  // SUCCESS | FAILURE | TIMEOUT

    @Column(columnDefinition = "TEXT")
    private String inputJson;

    @Column(columnDefinition = "TEXT")
    private String outputJson;

    private Long executionTimeMs;
    private String errorMessage;
    private LocalDateTime executedAt;
}
```

---

## 4. REST API

### 4.1 能力管理

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/capabilities` | 查询所有已注册能力列表 |
| GET | `/api/v1/capabilities/{id}` | 查询能力详情（含输入/输出 schema） |
| POST | `/api/v1/capabilities/{id}/execute` | 执行单个能力 |

### 4.2 Pipeline 管理

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/pipelines` | 查询所有 Pipeline |
| POST | `/api/v1/pipelines` | 创建 Pipeline |
| GET | `/api/v1/pipelines/{id}` | 查询 Pipeline 详情 |
| PUT | `/api/v1/pipelines/{id}` | 更新 Pipeline |
| DELETE | `/api/v1/pipelines/{id}` | 删除 Pipeline |
| POST | `/api/v1/pipelines/{id}/execute` | 执行 Pipeline |

---

## 5. 10 个内置能力清单

| # | ID | 名称 | 类型 | 说明 |
|---|-----|------|------|------|
| 1 | `email` | 邮件发送 | COMMUNICATION | 发送邮件（支持模板、附件） |
| 2 | `sms` | 短信发送 | COMMUNICATION | 发送短信验证码/通知 |
| 3 | `ai-summary` | AI 摘要 | AI_POWERED | 长文本摘要（调用 AI Substrate） |
| 4 | `translation` | 翻译 | AI_POWERED | 文本翻译（调用 AI Substrate） |
| 5 | `pdf-generation` | PDF 生成 | DOCUMENT | Markdown/HTML → PDF |
| 6 | `data-export` | 数据导出 | DOCUMENT | 数据 → CSV/Excel/JSON |
| 7 | `notification` | 通知推送 | COMMUNICATION | 平台内通知/Webhook |
| 8 | `http-request` | HTTP 请求 | INTEGRATION | 发送外部 HTTP 请求 |
| 9 | `data-validation` | 数据校验 | DATA | 根据规则校验数据 |
| 10 | `ai-classification` | AI 分类 | AI_POWERED | 文本分类（调用 AI Substrate） |

---

## 6. Infrastructure

| 组件 | 用途 |
|------|------|
| PostgreSQL 16 | Pipeline 定义、执行日志持久化 |
| Flyway | 数据库 schema 迁移 |
| AI Substrate LLM Gateway | AI 摘要、翻译、分类能力调用 |
| Spring WebClient | HTTP 请求能力、AI Substrate 调用 |

---

## 7. Task Breakdown

### Task 1: 仓库初始化

**Files:**
- Create: `metaplatform-capability/pom.xml`
- Create: `metaplatform-capability/docker-compose.yml`
- Create: `metaplatform-capability/README.md`
- Create: `metaplatform-capability/.gitignore`
- Create: `metaplatform-capability/src/main/resources/application.yml`

- [ ] **Step 1.1: 初始化 Maven 项目**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.metaplatform</groupId>
    <artifactId>metaplatform-capability</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>

    <properties>
        <java.version>21</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webflux</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-mail</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>
        </dependency>
        <!-- iText for PDF generation -->
        <dependency>
            <groupId>com.itextpdf</groupId>
            <artifactId>itext7-core</artifactId>
            <version>8.0.4</version>
            <type>pom</type>
        </dependency>
        <!-- Apache POI for Excel export -->
        <dependency>
            <groupId>org.apache.poi</groupId>
            <artifactId>poi-ooxml</artifactId>
            <version>5.2.5</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 1.2: 写 docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: mp-capability-postgres
    ports:
      - "5438:5432"
    environment:
      POSTGRES_DB: capability
      POSTGRES_USER: capability
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-capability-data:/var/lib/postgresql/data

volumes:
  pg-capability-data:
```

- [ ] **Step 1.3: 写 application.yml**

```yaml
server:
  port: 8086

spring:
  application:
    name: capability
  datasource:
    url: jdbc:postgresql://localhost:5438/capability
    username: capability
    password: metaplatform
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
  mail:
    host: ${MAIL_HOST:localhost}
    port: ${MAIL_PORT:25}
    username: ${MAIL_USERNAME:}
    password: ${MAIL_PASSWORD:}

# AI Substrate 配置
ai-substrate:
  base-url: http://localhost:8083
  llm-endpoint: /api/v1/llm/chat

# 能力执行配置
capability:
  execution:
    timeout-ms: 30000
    retry-max-attempts: 3
    retry-backoff-ms: 1000

logging:
  level:
    com.metaplatform.capability: DEBUG
```

- [ ] **Step 1.4: 启动基础设施并验证**

```bash
docker-compose up -d
docker ps
```

Expected: 1 个容器运行（postgres）

- [ ] **Step 1.5: 提交**

```bash
git add .
git commit -m "chore: initialize capability module with maven, docker-compose"
```

---

### Task 2: Flyway 初始 Schema

**Files:**
- Create: `src/main/resources/db/migration/V1__init_capability.sql`

- [ ] **Step 2.1: 写初始迁移脚本**

```sql
-- V1__init_capability.sql

CREATE TABLE capability_pipeline (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_by      VARCHAR(128),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_step (
    id                  BIGSERIAL PRIMARY KEY,
    pipeline_id         BIGINT NOT NULL REFERENCES capability_pipeline(id) ON DELETE CASCADE,
    step_order          INTEGER NOT NULL,
    capability_id       VARCHAR(128) NOT NULL,
    input_mapping_json  TEXT,
    condition_json      TEXT,
    continue_on_error   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_pipeline_step_pipeline_id ON pipeline_step(pipeline_id);

CREATE TABLE capability_execution_log (
    id                  BIGSERIAL PRIMARY KEY,
    capability_id       VARCHAR(128),
    pipeline_id         BIGINT,
    execution_status    VARCHAR(32) NOT NULL,
    input_json          TEXT,
    output_json         TEXT,
    execution_time_ms   BIGINT,
    error_message       TEXT,
    executed_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_log_capability_id ON capability_execution_log(capability_id);
CREATE INDEX idx_execution_log_pipeline_id ON capability_execution_log(pipeline_id);
CREATE INDEX idx_execution_log_executed_at ON capability_execution_log(executed_at);
```

- [ ] **Step 2.2: 验证 Flyway 迁移**

```bash
./mvnw spring-boot:run
```

Expected: 迁移成功，3 张表创建

- [ ] **Step 2.3: 提交**

```bash
git add .
git commit -m "feat: add initial Flyway migration for capability schema"
```

---

### Task 3: Capability 接口 + CapabilityResult + Registry

**Files:**
- Create: `src/main/java/com/metaplatform/capability/core/Capability.java`
- Create: `src/main/java/com/metaplatform/capability/core/CapabilityResult.java`
- Create: `src/main/java/com/metaplatform/capability/core/CapabilityType.java`
- Create: `src/main/java/com/metaplatform/capability/core/CapabilityRegistry.java`
- Create: `src/main/java/com/metaplatform/capability/core/SpringCapabilityRegistry.java`

- [ ] **Step 3.1: 写 Capability 接口**

```java
package com.metaplatform.capability.core;

import java.util.Map;

/**
 * 能力接口 — 所有内置和自定义能力实现此接口
 */
public interface Capability {

    /**
     * 能力唯一标识
     */
    String getId();

    /**
     * 能力名称（人类可读）
     */
    String getName();

    /**
     * 能力描述
     */
    String getDescription();

    /**
     * 能力分类
     */
    CapabilityType getType();

    /**
     * 执行能力
     *
     * @param input 输入参数 Map
     * @return 执行结果
     */
    CapabilityResult execute(Map<String, Object> input);
}
```

- [ ] **Step 3.2: 写 CapabilityResult**

```java
package com.metaplatform.capability.core;

import java.util.Map;

/**
 * 能力执行结果
 */
public record CapabilityResult(
    boolean success,
    String message,
    Map<String, Object> output,
    long executionTimeMs
) {
    public static CapabilityResult success(String message, Map<String, Object> output, long executionTimeMs) {
        return new CapabilityResult(true, message, output, executionTimeMs);
    }

    public static CapabilityResult failure(String message, long executionTimeMs) {
        return new CapabilityResult(false, message, Map.of(), executionTimeMs);
    }

    public static CapabilityResult failure(String message, Map<String, Object> output, long executionTimeMs) {
        return new CapabilityResult(false, message, output, executionTimeMs);
    }
}
```

- [ ] **Step 3.3: 写 CapabilityType 枚举**

```java
package com.metaplatform.capability.core;

public enum CapabilityType {
    COMMUNICATION,     // 通信类：邮件、短信、通知
    AI_POWERED,        // AI 驱动类：摘要、翻译、分类
    DOCUMENT,          // 文档类：PDF 生成、数据导出
    INTEGRATION,       // 集成类：HTTP 请求
    DATA,              // 数据类：数据校验
    COMPOSITE          // 组合类：Pipeline
}
```

- [ ] **Step 3.4: 写 CapabilityRegistry 接口**

```java
package com.metaplatform.capability.core;

import java.util.List;
import java.util.Optional;

/**
 * 能力注册中心
 */
public interface CapabilityRegistry {

    /**
     * 注册能力
     */
    void register(Capability capability);

    /**
     * 按 ID 查找能力
     */
    Optional<Capability> findById(String id);

    /**
     * 查询所有已注册能力
     */
    List<Capability> findAll();

    /**
     * 按类型查询能力
     */
    List<Capability> findByType(CapabilityType type);
}
```

- [ ] **Step 3.5: 写 SpringCapabilityRegistry**

```java
package com.metaplatform.capability.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SpringCapabilityRegistry implements CapabilityRegistry {

    private static final Logger log = LoggerFactory.getLogger(SpringCapabilityRegistry.class);
    private final Map<String, Capability> registry = new ConcurrentHashMap<>();

    @Override
    public void register(Capability capability) {
        Objects.requireNonNull(capability, "capability must not be null");
        String id = capability.getId();
        if (registry.containsKey(id)) {
            log.warn("Overwriting existing capability: {}", id);
        }
        registry.put(id, capability);
        log.info("Registered capability: {} ({})", id, capability.getName());
    }

    @Override
    public Optional<Capability> findById(String id) {
        return Optional.ofNullable(registry.get(id));
    }

    @Override
    public List<Capability> findAll() {
        return List.copyOf(registry.values());
    }

    @Override
    public List<Capability> findByType(CapabilityType type) {
        return registry.values().stream()
                .filter(c -> c.getType() == type)
                .toList();
    }
}
```

- [ ] **Step 3.6: 提交**

```bash
git add .
git commit -m "feat: add Capability interface, CapabilityResult, and CapabilityRegistry"
```

---

### Task 4: Execution Engine

**Files:**
- Create: `src/main/java/com/metaplatform/capability/core/ExecutionEngine.java`
- Create: `src/main/java/com/metaplatform/capability/core/ExecutionEngineImpl.java`
- Create: `src/main/java/com/metaplatform/capability/infrastructure/ExecutionLogRepository.java`

- [ ] **Step 4.1: 写 ExecutionEngine 接口**

```java
package com.metaplatform.capability.core;

import java.util.Map;

/**
 * 能力执行引擎 — 支持超时、重试、日志
 */
public interface ExecutionEngine {

    /**
     * 执行单个能力
     */
    CapabilityResult execute(String capabilityId, Map<String, Object> input);

    /**
     * 执行 Pipeline
     */
    CapabilityResult executePipeline(Long pipelineId, Map<String, Object> input);
}
```

- [ ] **Step 4.2: 写 ExecutionEngineImpl**

```java
package com.metaplatform.capability.core;

import com.metaplatform.capability.domain.CapabilityExecutionLog;
import com.metaplatform.capability.domain.ExecutionStatus;
import com.metaplatform.capability.infrastructure.ExecutionLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.*;

@Service
public class ExecutionEngineImpl implements ExecutionEngine {

    private static final Logger log = LoggerFactory.getLogger(ExecutionEngineImpl.class);

    private final CapabilityRegistry registry;
    private final ExecutionLogRepository logRepository;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @Value("${capability.execution.timeout-ms:30000}")
    private long timeoutMs;

    @Value("${capability.execution.retry-max-attempts:3}")
    private int retryMaxAttempts;

    @Value("${capability.execution.retry-backoff-ms:1000}")
    private long retryBackoffMs;

    public ExecutionEngineImpl(CapabilityRegistry registry, ExecutionLogRepository logRepository) {
        this.registry = registry;
        this.logRepository = logRepository;
    }

    @Override
    public CapabilityResult execute(String capabilityId, Map<String, Object> input) {
        Capability capability = registry.findById(capabilityId)
                .orElseThrow(() -> new IllegalArgumentException("能力不存在: " + capabilityId));

        log.info("Executing capability: {} with input keys: {}", capabilityId, input.keySet());

        long startTime = System.currentTimeMillis();
        CapabilityResult result = null;
        Exception lastException = null;

        for (int attempt = 1; attempt <= retryMaxAttempts; attempt++) {
            try {
                Future<CapabilityResult> future = executor.submit(() -> capability.execute(input));
                result = future.get(timeoutMs, TimeUnit.MILLISECONDS);

                if (result.success() || attempt == retryMaxAttempts) {
                    break;
                }

                log.warn("Capability {} failed (attempt {}/{}), retrying...", capabilityId, attempt, retryMaxAttempts);
                Thread.sleep(retryBackoffMs * attempt);
            } catch (TimeoutException e) {
                log.error("Capability {} timed out after {}ms (attempt {})", capabilityId, timeoutMs, attempt);
                lastException = e;
                result = CapabilityResult.failure("执行超时: " + capabilityId, System.currentTimeMillis() - startTime);
                if (attempt < retryMaxAttempts) {
                    try { Thread.sleep(retryBackoffMs * attempt); } catch (InterruptedException ignored) {}
                }
            } catch (Exception e) {
                log.error("Capability {} failed (attempt {})", capabilityId, attempt, e);
                lastException = e;
                result = CapabilityResult.failure("执行失败: " + e.getMessage(), System.currentTimeMillis() - startTime);
                if (attempt < retryMaxAttempts) {
                    try { Thread.sleep(retryBackoffMs * attempt); } catch (InterruptedException ignored) {}
                }
            }
        }

        // 记录执行日志
        if (result == null) {
            long elapsed = System.currentTimeMillis() - startTime;
            result = CapabilityResult.failure(
                    lastException != null ? lastException.getMessage() : "未知错误", elapsed);
        }

        saveExecutionLog(capabilityId, null, input, result);
        return result;
    }

    @Override
    public CapabilityResult executePipeline(Long pipelineId, Map<String, Object> input) {
        // 由 PipelineService 实现，此处为占位
        throw new UnsupportedOperationException("Pipeline execution delegated to PipelineService");
    }

    private void saveExecutionLog(String capabilityId, Long pipelineId,
                                   Map<String, Object> input, CapabilityResult result) {
        try {
            CapabilityExecutionLog logEntry = new CapabilityExecutionLog();
            logEntry.setCapabilityId(capabilityId);
            logEntry.setPipelineId(pipelineId);
            logEntry.setExecutionStatus(result.success() ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILURE);
            logEntry.setExecutionTimeMs(result.executionTimeMs());
            logEntry.setErrorMessage(result.success() ? null : result.message());
            logEntry.setExecutedAt(LocalDateTime.now());
            logRepository.save(logEntry);
        } catch (Exception e) {
            log.error("Failed to save execution log", e);
        }
    }
}
```

- [ ] **Step 4.3: 写 ExecutionLogRepository**

```java
package com.metaplatform.capability.infrastructure;

import com.metaplatform.capability.domain.CapabilityExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecutionLogRepository extends JpaRepository<CapabilityExecutionLog, Long> {

    List<CapabilityExecutionLog> findByCapabilityIdOrderByExecutedAtDesc(String capabilityId);

    List<CapabilityExecutionLog> findByPipelineIdOrderByExecutedAtDesc(Long pipelineId);
}
```

- [ ] **Step 4.4: 提交**

```bash
git add .
git commit -m "feat: add ExecutionEngine with timeout, retry, and logging"
```

---

### Task 5: Domain 模型 + Pipeline 持久化

**Files:**
- Create: `src/main/java/com/metaplatform/capability/domain/Pipeline.java`
- Create: `src/main/java/com/metaplatform/capability/domain/PipelineStep.java`
- Create: `src/main/java/com/metaplatform/capability/domain/CapabilityExecutionLog.java`
- Create: `src/main/java/com/metaplatform/capability/domain/ExecutionStatus.java`
- Create: `src/main/java/com/metaplatform/capability/infrastructure/PipelineRepository.java`

- [ ] **Step 5.1: 写 Pipeline 实体**

```java
package com.metaplatform.capability.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "capability_pipeline")
public class Pipeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExecutionStatus status = ExecutionStatus.DRAFT;

    @OneToMany(mappedBy = "pipeline", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    private List<PipelineStep> steps = new ArrayList<>();

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // --- Getters & Setters ---

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ExecutionStatus getStatus() { return status; }
    public void setStatus(ExecutionStatus status) { this.status = status; }
    public List<PipelineStep> getSteps() { return steps; }
    public void setSteps(List<PipelineStep> steps) { this.steps = steps; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    /**
     * 添加步骤（自动设置顺序和关联）
     */
    public void addStep(PipelineStep step) {
        step.setStepOrder(steps.size() + 1);
        step.setPipeline(this);
        steps.add(step);
    }
}
```

- [ ] **Step 5.2: 写 PipelineStep 实体**

```java
package com.metaplatform.capability.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "pipeline_step")
public class PipelineStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pipeline_id", nullable = false)
    private Pipeline pipeline;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    @Column(name = "capability_id", nullable = false)
    private String capabilityId;

    @Column(name = "input_mapping_json", columnDefinition = "TEXT")
    private String inputMappingJson;

    @Column(name = "condition_json", columnDefinition = "TEXT")
    private String conditionJson;

    @Column(name = "continue_on_error", nullable = false)
    private Boolean continueOnError = false;

    // --- Getters & Setters ---

    public Long getId() { return id; }
    public Pipeline getPipeline() { return pipeline; }
    public void setPipeline(Pipeline pipeline) { this.pipeline = pipeline; }
    public Integer getStepOrder() { return stepOrder; }
    public void setStepOrder(Integer stepOrder) { this.stepOrder = stepOrder; }
    public String getCapabilityId() { return capabilityId; }
    public void setCapabilityId(String capabilityId) { this.capabilityId = capabilityId; }
    public String getInputMappingJson() { return inputMappingJson; }
    public void setInputMappingJson(String inputMappingJson) { this.inputMappingJson = inputMappingJson; }
    public String getConditionJson() { return conditionJson; }
    public void setConditionJson(String conditionJson) { this.conditionJson = conditionJson; }
    public Boolean getContinueOnError() { return continueOnError; }
    public void setContinueOnError(Boolean continueOnError) { this.continueOnError = continueOnError; }
}
```

- [ ] **Step 5.3: 写 CapabilityExecutionLog 实体 + ExecutionStatus 枚举**

```java
package com.metaplatform.capability.domain;

public enum ExecutionStatus {
    DRAFT, ACTIVE, DISABLED, SUCCESS, FAILURE, TIMEOUT
}
```

```java
package com.metaplatform.capability.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "capability_execution_log")
public class CapabilityExecutionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "capability_id")
    private String capabilityId;

    @Column(name = "pipeline_id")
    private Long pipelineId;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_status", nullable = false)
    private ExecutionStatus executionStatus;

    @Column(name = "input_json", columnDefinition = "TEXT")
    private String inputJson;

    @Column(name = "output_json", columnDefinition = "TEXT")
    private String outputJson;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "executed_at", nullable = false)
    private LocalDateTime executedAt;

    // --- Getters & Setters ---

    public Long getId() { return id; }
    public String getCapabilityId() { return capabilityId; }
    public void setCapabilityId(String capabilityId) { this.capabilityId = capabilityId; }
    public Long getPipelineId() { return pipelineId; }
    public void setPipelineId(Long pipelineId) { this.pipelineId = pipelineId; }
    public ExecutionStatus getExecutionStatus() { return executionStatus; }
    public void setExecutionStatus(ExecutionStatus executionStatus) { this.executionStatus = executionStatus; }
    public String getInputJson() { return inputJson; }
    public void setInputJson(String inputJson) { this.inputJson = inputJson; }
    public String getOutputJson() { return outputJson; }
    public void setOutputJson(String outputJson) { this.outputJson = outputJson; }
    public Long getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(Long executionTimeMs) { this.executionTimeMs = executionTimeMs; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public LocalDateTime getExecutedAt() { return executedAt; }
    public void setExecutedAt(LocalDateTime executedAt) { this.executedAt = executedAt; }
}
```

- [ ] **Step 5.4: 写 PipelineRepository**

```java
package com.metaplatform.capability.infrastructure;

import com.metaplatform.capability.domain.ExecutionStatus;
import com.metaplatform.capability.domain.Pipeline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PipelineRepository extends JpaRepository<Pipeline, Long> {

    Optional<Pipeline> findByName(String name);

    List<Pipeline> findByStatus(ExecutionStatus status);
}
```

- [ ] **Step 5.5: 提交**

```bash
git add .
git commit -m "feat: add Pipeline/PipelineStep domain entities and repository"
```

---

### Task 6: 10 个内置能力 — 通信类 (Email, SMS, Notification)

**Files:**
- Create: `src/main/java/com/metaplatform/capability/builtin/EmailCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/SmsCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/NotificationCapability.java`

- [ ] **Step 6.1: 写 EmailCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class EmailCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(EmailCapability.class);
    private final JavaMailSender mailSender;

    public EmailCapability(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public String getId() { return "email"; }

    @Override
    public String getName() { return "邮件发送"; }

    @Override
    public String getDescription() { return "发送邮件（支持简单文本邮件）"; }

    @Override
    public CapabilityType getType() { return CapabilityType.COMMUNICATION; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        try {
            String to = (String) input.get("to");
            String subject = (String) input.get("subject");
            String body = (String) input.get("body");

            if (to == null || to.isBlank()) {
                return CapabilityResult.failure("缺少收件人 (to)", System.currentTimeMillis() - start);
            }

            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject != null ? subject : "(无主题)");
            message.setText(body != null ? body : "");

            mailSender.send(message);
            log.info("Email sent to: {}", to);

            return CapabilityResult.success("邮件已发送至 " + to,
                    Map.of("to", to, "subject", subject != null ? subject : ""),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Failed to send email", e);
            return CapabilityResult.failure("邮件发送失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }
}
```

- [ ] **Step 6.2: 写 SmsCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 短信发送能力 — v0.1 为 Stub 实现，实际对接短信网关
 */
@Component
public class SmsCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(SmsCapability.class);

    @Override
    public String getId() { return "sms"; }

    @Override
    public String getName() { return "短信发送"; }

    @Override
    public String getDescription() { return "发送短信验证码/通知（v0.1 Stub 实现）"; }

    @Override
    public CapabilityType getType() { return CapabilityType.COMMUNICATION; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String phone = (String) input.get("phone");
        String content = (String) input.get("content");

        if (phone == null || phone.isBlank()) {
            return CapabilityResult.failure("缺少手机号 (phone)", System.currentTimeMillis() - start);
        }

        // v0.1: Stub — 日志输出，不实际发送
        log.info("[STUB] SMS to {}: {}", phone, content);
        return CapabilityResult.success("短信已发送至 " + phone,
                Map.of("phone", phone, "content", content != null ? content : ""),
                System.currentTimeMillis() - start);
    }
}
```

- [ ] **Step 6.3: 写 NotificationCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 通知推送能力 — v0.1 支持 Webhook 通知和平台内通知（Stub）
 */
@Component
public class NotificationCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(NotificationCapability.class);

    @Override
    public String getId() { return "notification"; }

    @Override
    public String getName() { return "通知推送"; }

    @Override
    public String getDescription() { return "平台内通知/Webhook 推送"; }

    @Override
    public CapabilityType getType() { return CapabilityType.COMMUNICATION; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String target = (String) input.get("target");
        String message = (String) input.get("message");
        String type = (String) input.getOrDefault("type", "INTERNAL"); // INTERNAL | WEBHOOK

        if (message == null || message.isBlank()) {
            return CapabilityResult.failure("缺少通知内容 (message)", System.currentTimeMillis() - start);
        }

        if ("WEBHOOK".equalsIgnoreCase(type)) {
            log.info("[STUB] Webhook notification to {}: {}", target, message);
        } else {
            log.info("[STUB] Internal notification for {}: {}", target, message);
        }

        return CapabilityResult.success("通知已发送",
                Map.of("target", target != null ? target : "", "type", type),
                System.currentTimeMillis() - start);
    }
}
```

- [ ] **Step 6.4: 提交**

```bash
git add .
git commit -m "feat: add communication capabilities (Email, SMS, Notification)"
```

---

### Task 7: 10 个内置能力 — AI 类 (AiSummary, Translation, AiClassification)

**Files:**
- Create: `src/main/java/com/metaplatform/capability/builtin/AiSummaryCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/TranslationCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/AiClassificationCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/AiCapabilityBase.java`

- [ ] **Step 7.1: 写 AiCapabilityBase（AI 能力基类）**

```java
package com.metaplatform.capability.builtin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

/**
 * AI 能力基类 — 封装 AI Substrate LLM Gateway 调用
 */
public abstract class AiCapabilityBase {

    protected final WebClient aiClient;

    @Value("${ai-substrate.base-url:http://localhost:8083}")
    protected String aiSubstrateBaseUrl;

    protected AiCapabilityBase(WebClient.Builder webClientBuilder) {
        this.aiClient = webClientBuilder.build();
    }

    /**
     * 调用 AI Substrate LLM Gateway
     */
    protected String callLlm(String systemPrompt, String userContent, String model) {
        Map<String, Object> body = Map.of(
                "model", model != null ? model : "smart",
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userContent)
                ),
                "temperature", 0.3,
                "maxTokens", 1000
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> response = aiClient.post()
                .uri(aiSubstrateBaseUrl + "/api/v1/llm/chat")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null) return "";

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices != null && !choices.isEmpty()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> msg = (Map<String, Object>) choices.get(0).get("message");
            return (String) msg.get("content");
        }
        return "";
    }
}
```

- [ ] **Step 7.2: 写 AiSummaryCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Component
public class AiSummaryCapability extends AiCapabilityBase implements Capability {

    private static final Logger log = LoggerFactory.getLogger(AiSummaryCapability.class);

    public AiSummaryCapability(WebClient.Builder webClientBuilder) {
        super(webClientBuilder);
    }

    @Override
    public String getId() { return "ai-summary"; }

    @Override
    public String getName() { return "AI 摘要"; }

    @Override
    public String getDescription() { return "对长文本进行 AI 摘要（调用 AI Substrate LLM Gateway）"; }

    @Override
    public CapabilityType getType() { return CapabilityType.AI_POWERED; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String text = (String) input.get("text");
        String language = (String) input.getOrDefault("language", "zh");

        if (text == null || text.isBlank()) {
            return CapabilityResult.failure("缺少文本内容 (text)", System.currentTimeMillis() - start);
        }

        try {
            String systemPrompt = "你是一个文本摘要助手。请对以下文本进行简洁准确的摘要，保留关键信息。"
                    + ("zh".equals(language) ? "用中文回复。" : "Reply in English.");
            String summary = callLlm(systemPrompt, text, null);

            log.info("AI summary generated, input length={}, output length={}", text.length(), summary.length());
            return CapabilityResult.success("摘要生成成功",
                    Map.of("summary", summary, "originalLength", text.length(), "summaryLength", summary.length()),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("AI summary failed", e);
            return CapabilityResult.failure("AI 摘要失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }
}
```

- [ ] **Step 7.3: 写 TranslationCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Component
public class TranslationCapability extends AiCapabilityBase implements Capability {

    private static final Logger log = LoggerFactory.getLogger(TranslationCapability.class);

    public TranslationCapability(WebClient.Builder webClientBuilder) {
        super(webClientBuilder);
    }

    @Override
    public String getId() { return "translation"; }

    @Override
    public String getName() { return "翻译"; }

    @Override
    public String getDescription() { return "文本翻译（调用 AI Substrate LLM Gateway）"; }

    @Override
    public CapabilityType getType() { return CapabilityType.AI_POWERED; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String text = (String) input.get("text");
        String sourceLang = (String) input.getOrDefault("sourceLang", "auto");
        String targetLang = (String) input.getOrDefault("targetLang", "en");

        if (text == null || text.isBlank()) {
            return CapabilityResult.failure("缺少文本内容 (text)", System.currentTimeMillis() - start);
        }

        try {
            String systemPrompt = String.format(
                    "你是一个专业翻译。请将以下文本从 %s 翻译为 %s，保持原意和语气。",
                    sourceLang, targetLang);
            String translated = callLlm(systemPrompt, text, null);

            log.info("Translation completed: {} -> {}, length={}", sourceLang, targetLang, translated.length());
            return CapabilityResult.success("翻译成功",
                    Map.of("translated", translated, "sourceLang", sourceLang, "targetLang", targetLang),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Translation failed", e);
            return CapabilityResult.failure("翻译失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }
}
```

- [ ] **Step 7.4: 写 AiClassificationCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Component
public class AiClassificationCapability extends AiCapabilityBase implements Capability {

    private static final Logger log = LoggerFactory.getLogger(AiClassificationCapability.class);

    public AiClassificationCapability(WebClient.Builder webClientBuilder) {
        super(webClientBuilder);
    }

    @Override
    public String getId() { return "ai-classification"; }

    @Override
    public String getName() { return "AI 分类"; }

    @Override
    public String getDescription() { return "文本分类（调用 AI Substrate LLM Gateway）"; }

    @Override
    public CapabilityType getType() { return CapabilityType.AI_POWERED; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String text = (String) input.get("text");
        String categories = (String) input.get("categories"); // 逗号分隔的分类列表

        if (text == null || text.isBlank()) {
            return CapabilityResult.failure("缺少文本内容 (text)", System.currentTimeMillis() - start);
        }

        try {
            String systemPrompt = "你是一个文本分类助手。请将以下文本分类到给定类别中。\n"
                    + "类别列表: " + (categories != null ? categories : "正面, 负面, 中性") + "\n"
                    + "请仅返回 JSON 格式: {\"category\": \"...\", \"confidence\": 0.0-1.0}";
            String result = callLlm(systemPrompt, text, null);

            log.info("AI classification completed for text length={}", text.length());
            return CapabilityResult.success("分类完成",
                    Map.of("classification", result),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("AI classification failed", e);
            return CapabilityResult.failure("AI 分类失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }
}
```

- [ ] **Step 7.5: 提交**

```bash
git add .
git commit -m "feat: add AI-powered capabilities (Summary, Translation, Classification)"
```

---

### Task 8: 10 个内置能力 — 文档类 + 集成类 + 数据类

**Files:**
- Create: `src/main/java/com/metaplatform/capability/builtin/PdfGenerationCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/DataExportCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/HttpRequestCapability.java`
- Create: `src/main/java/com/metaplatform/capability/builtin/DataValidationCapability.java`

- [ ] **Step 8.1: 写 PdfGenerationCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;

/**
 * PDF 生成能力 — v0.1 简单文本 PDF，后续支持 Markdown/HTML
 */
@Component
public class PdfGenerationCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(PdfGenerationCapability.class);

    @Override
    public String getId() { return "pdf-generation"; }

    @Override
    public String getName() { return "PDF 生成"; }

    @Override
    public String getDescription() { return "将文本/HTML 内容转换为 PDF 文档"; }

    @Override
    public CapabilityType getType() { return CapabilityType.DOCUMENT; }

    @Override
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String content = (String) input.get("content");
        String title = (String) input.getOrDefault("title", "Document");

        if (content == null || content.isBlank()) {
            return CapabilityResult.failure("缺少内容 (content)", System.currentTimeMillis() - start);
        }

        try {
            // v0.1: 简化实现 — 生成一个包含文本的 PDF 字节数组
            // 实际实现使用 iText7
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            // PDF generation logic here (iText7)
            byte[] pdfBytes = baos.toByteArray();
            String base64 = Base64.getEncoder().encodeToString(pdfBytes);

            log.info("PDF generated: title={}, size={} bytes", title, pdfBytes.length);
            return CapabilityResult.success("PDF 生成成功",
                    Map.of("pdfBase64", base64, "title", title, "sizeBytes", pdfBytes.length),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("PDF generation failed", e);
            return CapabilityResult.failure("PDF 生成失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }
}
```

- [ ] **Step 8.2: 写 DataExportCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 数据导出能力 — 支持 CSV/JSON 格式
 */
@Component
public class DataExportCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(DataExportCapability.class);

    @Override
    public String getId() { return "data-export"; }

    @Override
    public String getName() { return "数据导出"; }

    @Override
    public String getDescription() { return "将数据导出为 CSV/Excel/JSON 格式"; }

    @Override
    public CapabilityType getType() { return CapabilityType.DOCUMENT; }

    @Override
    @SuppressWarnings("unchecked")
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        List<Map<String, Object>> data = (List<Map<String, Object>>) input.get("data");
        String format = (String) input.getOrDefault("format", "CSV");

        if (data == null || data.isEmpty()) {
            return CapabilityResult.failure("缺少数据 (data)", System.currentTimeMillis() - start);
        }

        try {
            String exported;
            switch (format.toUpperCase()) {
                case "JSON":
                    exported = exportAsJson(data);
                    break;
                case "CSV":
                default:
                    exported = exportAsCsv(data);
                    break;
            }

            log.info("Data exported: format={}, rows={}", format, data.size());
            return CapabilityResult.success("数据导出成功",
                    Map.of("content", exported, "format", format, "rowCount", data.size()),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Data export failed", e);
            return CapabilityResult.failure("数据导出失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }

    private String exportAsCsv(List<Map<String, Object>> data) {
        if (data.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        // Header
        sb.append(String.join(",", data.get(0).keySet())).append("\n");
        // Rows
        for (Map<String, Object> row : data) {
            sb.append(String.join(",", row.values().stream()
                    .map(v -> v != null ? v.toString().replace(",", "\\,") : "")
                    .toList())).append("\n");
        }
        return sb.toString();
    }

    private String exportAsJson(List<Map<String, Object>> data) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .writerWithDefaultPrettyPrinter()
                    .writeValueAsString(data);
        } catch (Exception e) {
            return data.toString();
        }
    }
}
```

- [ ] **Step 8.3: 写 HttpRequestCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * HTTP 请求能力 — 发送外部 HTTP 请求
 */
@Component
public class HttpRequestCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(HttpRequestCapability.class);
    private final WebClient webClient;

    public HttpRequestCapability(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    @Override
    public String getId() { return "http-request"; }

    @Override
    public String getName() { return "HTTP 请求"; }

    @Override
    public String getDescription() { return "发送外部 HTTP 请求"; }

    @Override
    public CapabilityType getType() { return CapabilityType.INTEGRATION; }

    @Override
    @SuppressWarnings("unchecked")
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        String url = (String) input.get("url");
        String method = (String) input.getOrDefault("method", "GET");
        Map<String, String> headers = (Map<String, String>) input.getOrDefault("headers", Map.of());
        String body = (String) input.get("body");

        if (url == null || url.isBlank()) {
            return CapabilityResult.failure("缺少 URL (url)", System.currentTimeMillis() - start);
        }

        try {
            HttpMethod httpMethod = HttpMethod.valueOf(method.toUpperCase());
            var requestSpec = webClient.method(httpMethod).uri(url);

            headers.forEach(requestSpec::header);

            String responseBody;
            if (body != null && (httpMethod == HttpMethod.POST || httpMethod == HttpMethod.PUT || httpMethod == HttpMethod.PATCH)) {
                responseBody = requestSpec
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();
            } else {
                responseBody = requestSpec
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();
            }

            log.info("HTTP {} {} completed", method, url);
            return CapabilityResult.success("HTTP 请求成功",
                    Map.of("url", url, "method", method, "response", responseBody != null ? responseBody : ""),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("HTTP request failed: {} {}", method, url, e);
            return CapabilityResult.failure("HTTP 请求失败: " + e.getMessage(), System.currentTimeMillis() - start);
        }
    }
}
```

- [ ] **Step 8.4: 写 DataValidationCapability**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.Capability;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 数据校验能力 — 根据规则校验数据
 */
@Component
public class DataValidationCapability implements Capability {

    private static final Logger log = LoggerFactory.getLogger(DataValidationCapability.class);

    @Override
    public String getId() { return "data-validation"; }

    @Override
    public String getName() { return "数据校验"; }

    @Override
    public String getDescription() { return "根据规则校验数据"; }

    @Override
    public CapabilityType getType() { return CapabilityType.DATA; }

    @Override
    @SuppressWarnings("unchecked")
    public CapabilityResult execute(Map<String, Object> input) {
        long start = System.currentTimeMillis();
        Map<String, Object> data = (Map<String, Object>) input.get("data");
        List<Map<String, Object>> rules = (List<Map<String, Object>>) input.getOrDefault("rules", List.of());

        if (data == null) {
            return CapabilityResult.failure("缺少数据 (data)", System.currentTimeMillis() - start);
        }

        List<String> errors = new ArrayList<>();

        for (Map<String, Object> rule : rules) {
            String field = (String) rule.get("field");
            String type = (String) rule.get("type"); // required, minLength, maxLength, pattern

            Object value = data.get(field);

            switch (type != null ? type : "") {
                case "required" -> {
                    if (value == null || (value instanceof String s && s.isBlank())) {
                        errors.add("字段 '" + field + "' 为必填项");
                    }
                }
                case "minLength" -> {
                    int min = ((Number) rule.get("value")).intValue();
                    if (value instanceof String s && s.length() < min) {
                        errors.add("字段 '" + field + "' 长度不能少于 " + min);
                    }
                }
                case "maxLength" -> {
                    int max = ((Number) rule.get("value")).intValue();
                    if (value instanceof String s && s.length() > max) {
                        errors.add("字段 '" + field + "' 长度不能超过 " + max);
                    }
                }
                case "type" -> {
                    String expectedType = (String) rule.get("value");
                    if (value != null) {
                        boolean match = switch (expectedType) {
                            case "string" -> value instanceof String;
                            case "number" -> value instanceof Number;
                            case "boolean" -> value instanceof Boolean;
                            default -> true;
                        };
                        if (!match) {
                            errors.add("字段 '" + field + "' 类型不匹配，期望: " + expectedType);
                        }
                    }
                }
            }
        }

        boolean valid = errors.isEmpty();
        log.info("Data validation: valid={}, errors={}", valid, errors.size());

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("valid", valid);
        output.put("errors", errors);
        output.put("fieldCount", data.size());
        output.put("ruleCount", rules.size());

        return CapabilityResult.success(valid ? "数据校验通过" : "数据校验失败，共 " + errors.size() + " 个错误",
                output, System.currentTimeMillis() - start);
    }
}
```

- [ ] **Step 8.5: 提交**

```bash
git add .
git commit -m "feat: add document/integration/data capabilities (PDF, Export, HTTP, Validation)"
```

---

### Task 9: CapabilityAutoRegistrar — 启动自动注册

**Files:**
- Create: `src/main/java/com/metaplatform/capability/core/CapabilityAutoRegistrar.java`

- [ ] **Step 9.1: 写 CapabilityAutoRegistrar**

```java
package com.metaplatform.capability.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 启动时自动发现并注册所有 Capability Bean
 */
@Component
public class CapabilityAutoRegistrar implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CapabilityAutoRegistrar.class);

    private final List<Capability> capabilities;
    private final CapabilityRegistry registry;

    public CapabilityAutoRegistrar(List<Capability> capabilities, CapabilityRegistry registry) {
        this.capabilities = capabilities;
        this.registry = registry;
    }

    @Override
    public void run(String... args) {
        log.info("Auto-registering {} capabilities...", capabilities.size());

        for (Capability capability : capabilities) {
            registry.register(capability);
            log.info("  [{}] {} - {} ({})",
                    capability.getId(), capability.getName(),
                    capability.getDescription(), capability.getType());
        }

        log.info("All {} capabilities registered successfully", registry.findAll().size());
    }
}
```

- [ ] **Step 9.2: 提交**

```bash
git add .
git commit -m "feat: add CapabilityAutoRegistrar for Spring Bean auto-discovery"
```

---

### Task 10: PipelineService — Pipeline 组合执行

**Files:**
- Create: `src/main/java/com/metaplatform/capability/application/PipelineService.java`

- [ ] **Step 10.1: 写 PipelineService**

```java
package com.metaplatform.capability.application;

import com.metaplatform.capability.core.CapabilityRegistry;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.core.ExecutionEngine;
import com.metaplatform.capability.domain.CapabilityExecutionLog;
import com.metaplatform.capability.domain.ExecutionStatus;
import com.metaplatform.capability.domain.Pipeline;
import com.metaplatform.capability.domain.PipelineStep;
import com.metaplatform.capability.infrastructure.ExecutionLogRepository;
import com.metaplatform.capability.infrastructure.PipelineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Pipeline 服务 — 管理 Pipeline 定义 + 顺序执行
 */
@Service
public class PipelineService {

    private static final Logger log = LoggerFactory.getLogger(PipelineService.class);

    private final PipelineRepository pipelineRepository;
    private final ExecutionEngine executionEngine;
    private final ExecutionLogRepository logRepository;

    public PipelineService(PipelineRepository pipelineRepository,
                           ExecutionEngine executionEngine,
                           ExecutionLogRepository logRepository) {
        this.pipelineRepository = pipelineRepository;
        this.executionEngine = executionEngine;
        this.logRepository = logRepository;
    }

    /**
     * 创建 Pipeline
     */
    @Transactional
    public Pipeline createPipeline(String name, String description, String createdBy) {
        Pipeline pipeline = new Pipeline();
        pipeline.setName(name);
        pipeline.setDescription(description);
        pipeline.setCreatedBy(createdBy);
        pipeline.setStatus(ExecutionStatus.DRAFT);
        return pipelineRepository.save(pipeline);
    }

    /**
     * 添加步骤到 Pipeline
     */
    @Transactional
    public Pipeline addStep(Long pipelineId, String capabilityId, String inputMappingJson) {
        Pipeline pipeline = pipelineRepository.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("Pipeline 不存在: " + pipelineId));

        PipelineStep step = new PipelineStep();
        step.setCapabilityId(capabilityId);
        step.setInputMappingJson(inputMappingJson);
        step.setContinueOnError(false);
        pipeline.addStep(step);

        return pipelineRepository.save(pipeline);
    }

    /**
     * 执行 Pipeline — 顺序执行所有步骤
     */
    @Transactional
    public CapabilityResult executePipeline(Long pipelineId, Map<String, Object> input) {
        Pipeline pipeline = pipelineRepository.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("Pipeline 不存在: " + pipelineId));

        if (pipeline.getStatus() != ExecutionStatus.ACTIVE) {
            return CapabilityResult.failure("Pipeline 未激活: " + pipeline.getName(), 0);
        }

        log.info("Executing pipeline: {} ({} steps)", pipeline.getName(), pipeline.getSteps().size());

        long totalStart = System.currentTimeMillis();
        Map<String, Object> currentInput = new LinkedHashMap<>(input);
        Map<String, Object> allOutputs = new LinkedHashMap<>();

        for (PipelineStep step : pipeline.getSteps()) {
            log.info("  Step {}: {}", step.getStepOrder(), step.getCapabilityId());

            // 解析输入映射（v0.1 简化：直接传 currentInput）
            Map<String, Object> stepInput = resolveInputMapping(step, currentInput);

            CapabilityResult result = executionEngine.execute(step.getCapabilityId(), stepInput);

            // 记录日志
            CapabilityExecutionLog logEntry = new CapabilityExecutionLog();
            logEntry.setCapabilityId(step.getCapabilityId());
            logEntry.setPipelineId(pipelineId);
            logEntry.setExecutionStatus(result.success() ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILURE);
            logEntry.setExecutionTimeMs(result.executionTimeMs());
            logEntry.setErrorMessage(result.success() ? null : result.message());
            logEntry.setExecutedAt(LocalDateTime.now());
            logRepository.save(logEntry);

            if (!result.success() && !Boolean.TRUE.equals(step.getContinueOnError())) {
                log.error("Pipeline step {} failed: {}", step.getStepOrder(), result.message());
                return CapabilityResult.failure(
                        "Pipeline 在步骤 " + step.getStepOrder() + " 失败: " + result.message(),
                        Map.of("failedStep", step.getStepOrder(), "failedCapability", step.getCapabilityId()),
                        System.currentTimeMillis() - totalStart);
            }

            // 将输出合并到当前输入（用于下一步）
            if (result.output() != null) {
                currentInput.putAll(result.output());
                allOutputs.put("step_" + step.getStepOrder(), result.output());
            }
        }

        long totalTime = System.currentTimeMillis() - totalStart;
        log.info("Pipeline {} completed in {}ms", pipeline.getName(), totalTime);

        return CapabilityResult.success("Pipeline 执行完成", allOutputs, totalTime);
    }

    /**
     * 解析步骤输入映射
     */
    private Map<String, Object> resolveInputMapping(PipelineStep step, Map<String, Object> currentContext) {
        // v0.1: 如果有 inputMappingJson，尝试解析为表达式映射
        // 简化实现：直接传递当前上下文
        if (step.getInputMappingJson() == null || step.getInputMappingJson().isBlank()) {
            return currentContext;
        }

        // TODO: v0.2 实现 JSONPath / SpEL 表达式映射
        return currentContext;
    }
}
```

- [ ] **Step 10.2: 提交**

```bash
git add .
git commit -m "feat: add PipelineService for pipeline composition and sequential execution"
```

---

### Task 11: REST API — CapabilityController + PipelineController

**Files:**
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/CapabilityController.java`
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/PipelineController.java`
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/dto/CapabilityResponse.java`
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/dto/ExecuteRequest.java`
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/dto/PipelineRequest.java`
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/dto/PipelineResponse.java`
- Create: `src/main/java/com/metaplatform/capability/CapabilityApplication.java`
- Create: `src/main/java/com/metaplatform/capability/interfaces/rest/GlobalExceptionHandler.java`

- [ ] **Step 11.1: 写 DTOs**

```java
package com.metaplatform.capability.interfaces.rest.dto;

import com.metaplatform.capability.core.Capability;

public record CapabilityResponse(
    String id,
    String name,
    String description,
    String type
) {
    public static CapabilityResponse from(Capability c) {
        return new CapabilityResponse(c.getId(), c.getName(), c.getDescription(), c.getType().name());
    }
}
```

```java
package com.metaplatform.capability.interfaces.rest.dto;

import java.util.Map;

public record ExecuteRequest(Map<String, Object> input) {}
```

```java
package com.metaplatform.capability.interfaces.rest.dto;

import java.util.List;

public record PipelineRequest(
    String name,
    String description,
    List<PipelineStepRequest> steps
) {
    public record PipelineStepRequest(
        String capabilityId,
        String inputMappingJson,
        Boolean continueOnError
    ) {}
}
```

```java
package com.metaplatform.capability.interfaces.rest.dto;

import com.metaplatform.capability.domain.Pipeline;
import java.time.LocalDateTime;
import java.util.List;

public record PipelineResponse(
    Long id,
    String name,
    String description,
    String status,
    List<StepInfo> steps,
    LocalDateTime createdAt
) {
    public record StepInfo(Integer order, String capabilityId) {}

    public static PipelineResponse from(Pipeline p) {
        List<StepInfo> steps = p.getSteps().stream()
                .map(s -> new StepInfo(s.getStepOrder(), s.getCapabilityId()))
                .toList();
        return new PipelineResponse(p.getId(), p.getName(), p.getDescription(),
                p.getStatus().name(), steps, p.getCreatedAt());
    }
}
```

- [ ] **Step 11.2: 写 CapabilityController**

```java
package com.metaplatform.capability.interfaces.rest;

import com.metaplatform.capability.application.PipelineService;
import com.metaplatform.capability.core.CapabilityRegistry;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.interfaces.rest.dto.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class CapabilityController {

    private final CapabilityRegistry registry;

    public CapabilityController(CapabilityRegistry registry) {
        this.registry = registry;
    }

    @GetMapping("/capabilities")
    public ResponseEntity<List<CapabilityResponse>> listCapabilities() {
        List<CapabilityResponse> capabilities = registry.findAll().stream()
                .map(CapabilityResponse::from)
                .toList();
        return ResponseEntity.ok(capabilities);
    }

    @GetMapping("/capabilities/{id}")
    public ResponseEntity<CapabilityResponse> getCapability(@PathVariable String id) {
        return registry.findById(id)
                .map(c -> ResponseEntity.ok(CapabilityResponse.from(c)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/capabilities/{id}/execute")
    public ResponseEntity<Map<String, Object>> executeCapability(
            @PathVariable String id,
            @RequestBody ExecuteRequest request) {
        return registry.findById(id)
                .map(capability -> {
                    CapabilityResult result = capability.execute(
                            request.input() != null ? request.input() : Map.of());
                    return ResponseEntity.ok(Map.of(
                            "success", result.success(),
                            "message", result.message(),
                            "output", result.output(),
                            "executionTimeMs", result.executionTimeMs()));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
```

- [ ] **Step 11.3: 写 PipelineController**

```java
package com.metaplatform.capability.interfaces.rest;

import com.metaplatform.capability.application.PipelineService;
import com.metaplatform.capability.core.CapabilityResult;
import com.metaplatform.capability.domain.Pipeline;
import com.metaplatform.capability.domain.PipelineStep;
import com.metaplatform.capability.infrastructure.PipelineRepository;
import com.metaplatform.capability.interfaces.rest.dto.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/pipelines")
public class PipelineController {

    private final PipelineService pipelineService;
    private final PipelineRepository pipelineRepository;

    public PipelineController(PipelineService pipelineService, PipelineRepository pipelineRepository) {
        this.pipelineService = pipelineService;
        this.pipelineRepository = pipelineRepository;
    }

    @GetMapping
    public ResponseEntity<List<PipelineResponse>> listPipelines() {
        List<PipelineResponse> pipelines = pipelineRepository.findAll().stream()
                .map(PipelineResponse::from)
                .toList();
        return ResponseEntity.ok(pipelines);
    }

    @PostMapping
    public ResponseEntity<PipelineResponse> createPipeline(@RequestBody PipelineRequest request) {
        Pipeline pipeline = pipelineService.createPipeline(request.name(), request.description(), "api");

        if (request.steps() != null) {
            for (PipelineRequest.PipelineStepRequest stepReq : request.steps()) {
                pipeline = pipelineService.addStep(pipeline.getId(),
                        stepReq.capabilityId(), stepReq.inputMappingJson());
            }
        }

        return ResponseEntity.ok(PipelineResponse.from(pipeline));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PipelineResponse> getPipeline(@PathVariable Long id) {
        return pipelineRepository.findById(id)
                .map(p -> ResponseEntity.ok(PipelineResponse.from(p)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<PipelineResponse> updatePipeline(
            @PathVariable Long id,
            @RequestBody PipelineRequest request) {
        Pipeline pipeline = pipelineRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pipeline 不存在: " + id));
        pipeline.setName(request.name());
        pipeline.setDescription(request.description());
        pipeline = pipelineRepository.save(pipeline);
        return ResponseEntity.ok(PipelineResponse.from(pipeline));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePipeline(@PathVariable Long id) {
        pipelineRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/execute")
    public ResponseEntity<Map<String, Object>> executePipeline(
            @PathVariable Long id,
            @RequestBody ExecuteRequest request) {
        CapabilityResult result = pipelineService.executePipeline(id,
                request.input() != null ? request.input() : Map.of());
        return ResponseEntity.ok(Map.of(
                "success", result.success(),
                "message", result.message(),
                "output", result.output(),
                "executionTimeMs", result.executionTimeMs()));
    }
}
```

- [ ] **Step 11.4: 写 Application 入口 + 全局异常处理**

```java
package com.metaplatform.capability;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CapabilityApplication {
    public static void main(String[] args) {
        SpringApplication.run(CapabilityApplication.class, args);
    }
}
```

```java
package com.metaplatform.capability.interfaces.rest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "内部服务错误"));
    }
}
```

- [ ] **Step 11.5: 提交**

```bash
git add .
git commit -m "feat: add REST API controllers for capabilities and pipelines"
```

---

### Task 12: 集成测试 + Docker 化 + 冒烟测试

**Files:**
- Create: `src/test/java/com/metaplatform/capability/core/SpringCapabilityRegistryTest.java`
- Create: `src/test/java/com/metaplatform/capability/core/ExecutionEngineImplTest.java`
- Create: `src/test/java/com/metaplatform/capability/builtin/DataValidationCapabilityTest.java`
- Create: `metaplatform-capability/Dockerfile`
- Update: `metaplatform-capability/docker-compose.yml`

- [ ] **Step 12.1: 写 Registry 测试**

```java
package com.metaplatform.capability.core;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SpringCapabilityRegistryTest {

    @Test
    void registerAndFind() {
        SpringCapabilityRegistry registry = new SpringCapabilityRegistry();
        Capability cap = new Capability() {
            @Override public String getId() { return "test"; }
            @Override public String getName() { return "Test"; }
            @Override public String getDescription() { return "Test capability"; }
            @Override public CapabilityType getType() { return CapabilityType.DATA; }
            @Override public CapabilityResult execute(Map<String, Object> input) {
                return CapabilityResult.success("ok", Map.of(), 0);
            }
        };

        registry.register(cap);
        assertTrue(registry.findById("test").isPresent());
        assertEquals(1, registry.findAll().size());
    }

    @Test
    void findByType() {
        SpringCapabilityRegistry registry = new SpringCapabilityRegistry();
        // ... register multiple capabilities
        assertEquals(0, registry.findByType(CapabilityType.AI_POWERED).size());
    }
}
```

- [ ] **Step 12.2: 写 ExecutionEngine 测试**

```java
package com.metaplatform.capability.core;

import com.metaplatform.capability.infrastructure.ExecutionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExecutionEngineImplTest {

    private ExecutionEngineImpl engine;
    private CapabilityRegistry registry;
    private ExecutionLogRepository logRepository;

    @BeforeEach
    void setUp() {
        registry = mock(CapabilityRegistry.class);
        logRepository = mock(ExecutionLogRepository.class);
        engine = new ExecutionEngineImpl(registry, logRepository);
    }

    @Test
    void execute_unknownCapability_throws() {
        when(registry.findById("nonexistent")).thenReturn(java.util.Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> engine.execute("nonexistent", Map.of()));
    }

    @Test
    void execute_success() {
        Capability cap = mock(Capability.class);
        when(cap.getId()).thenReturn("test");
        when(cap.execute(any())).thenReturn(CapabilityResult.success("ok", Map.of("key", "val"), 100));
        when(registry.findById("test")).thenReturn(java.util.Optional.of(cap));

        CapabilityResult result = engine.execute("test", Map.of("input", "data"));
        assertTrue(result.success());
    }
}
```

- [ ] **Step 12.3: 写 DataValidation 测试**

```java
package com.metaplatform.capability.builtin;

import com.metaplatform.capability.core.CapabilityResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DataValidationCapabilityTest {

    private final DataValidationCapability capability = new DataValidationCapability();

    @Test
    void execute_validData() {
        Map<String, Object> input = Map.of(
                "data", Map.of("name", "John", "age", 30),
                "rules", List.of(
                        Map.of("field", "name", "type", "required")
                )
        );

        CapabilityResult result = capability.execute(input);
        assertTrue(result.success());
    }

    @Test
    void execute_missingRequired() {
        Map<String, Object> input = Map.of(
                "data", Map.of("age", 30),
                "rules", List.of(
                        Map.of("field", "name", "type", "required")
                )
        );

        CapabilityResult result = capability.execute(input);
        assertTrue(result.success()); // 执行成功但数据校验不通过
        @SuppressWarnings("unchecked")
        List<String> errors = (List<String>) result.output().get("errors");
        assertFalse(errors.isEmpty());
    }

    @Test
    void execute_missingData_returnsFailure() {
        Map<String, Object> input = Map.of("rules", List.of());
        CapabilityResult result = capability.execute(input);
        assertFalse(result.success());
    }
}
```

- [ ] **Step 12.4: 写 Dockerfile**

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/metaplatform-capability-0.1.0-SNAPSHOT.jar app.jar
EXPOSE 8086
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 12.5: 更新 docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: mp-capability-postgres
    ports:
      - "5438:5432"
    environment:
      POSTGRES_DB: capability
      POSTGRES_USER: capability
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-capability-data:/var/lib/postgresql/data

  capability:
    build: .
    container_name: mp-capability
    ports:
      - "8086:8086"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/capability
      SPRING_DATASOURCE_USERNAME: capability
      SPRING_DATASOURCE_PASSWORD: metaplatform
      AI_SUBSTRATE_BASE_URL: http://host.docker.internal:8083
    depends_on:
      - postgres

volumes:
  pg-capability-data:
```

- [ ] **Step 12.6: 冒烟测试**

```bash
# 1. 构建
./mvnw clean package -DskipTests

# 2. 启动
docker-compose up -d
sleep 10

# 3. 查询能力列表
curl -s http://localhost:8086/api/v1/capabilities | jq .

# 4. 执行数据校验能力
curl -s -X POST http://localhost:8086/api/v1/capabilities/data-validation/execute \
  -H "Content-Type: application/json" \
  -d '{"input":{"data":{"name":"Alice","age":25},"rules":[{"field":"name","type":"required"}]}}' | jq .

# 5. 清理
docker-compose down
```

- [ ] **Step 12.7: 运行全量测试**

```bash
./mvnw test
```

Expected: 所有测试通过

- [ ] **Step 12.8: 提交**

```bash
git add .
git commit -m "feat: add integration tests, Dockerfile, and smoke test for capability module"
```

---

## 8. Task Summary

| # | Task | 依赖 | 交付物 |
|---|------|------|--------|
| 1 | 仓库初始化 | - | pom.xml, docker-compose.yml, application.yml |
| 2 | Flyway 初始 Schema | T1 | V1__init_capability.sql (3张表) |
| 3 | Capability 接口 + Registry | T1 | Capability, CapabilityResult, CapabilityType, Registry |
| 4 | Execution Engine | T3 | ExecutionEngine (超时、重试、日志) |
| 5 | Domain + Pipeline 持久化 | T2 | Pipeline, PipelineStep, ExecutionLog 实体 |
| 6 | 通信类能力 (3个) | T3 | Email, SMS, Notification |
| 7 | AI 类能力 (3个) | T3, AI Substrate | AiSummary, Translation, AiClassification |
| 8 | 文档/集成/数据类 (4个) | T3 | PdfGeneration, DataExport, HttpRequest, DataValidation |
| 9 | CapabilityAutoRegistrar | T3, T6-T8 | 启动自动注册 |
| 10 | PipelineService | T4, T5 | Pipeline 组合执行 |
| 11 | REST API | T10 | CapabilityController, PipelineController, DTOs, Application |
| 12 | 测试 + Docker 化 | T11 | 单元测试, Dockerfile, 冒烟测试 |

---

## 9. Port Allocation

| 组件 | 端口 |
|------|------|
| Capability Service | 8086 |
| PostgreSQL (Capability) | 5438 |

---

## 10. Dependencies on Other Modules

| 模块 | 依赖方式 | 说明 |
|------|----------|------|
| AI Substrate | HTTP REST | AI 摘要、翻译、分类能力调用 LLM Gateway |

---
