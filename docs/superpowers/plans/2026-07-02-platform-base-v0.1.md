# 平台底座 v0.1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 MetaPlatform 的平台底座 v0.1 —— 多租户隔离、RBAC 权限、审计日志、集成 Hub 骨架，为上层业务对象和 AI 能力提供跨切面支撑。

**Architecture:** 多租户 · Java 21 + Spring Boot 3.2 · PostgreSQL 16（主存储）· Redis 7（RBAC 缓存）· Apache Kafka 3.6（审计事件流）· DDD 分层。

**Tech Stack:**
- 后端：Java 21+、Spring Boot 3.2+、Maven
- 数据库：PostgreSQL 16+（tenant_id 列级隔离）
- 缓存：Redis 7+（RBAC 权限缓存 + Session）
- 消息队列：Apache Kafka 3.6+（审计事件流）
- 测试：JUnit 5、Testcontainers（PG/Redis/Kafka）、Mockito
- 容器化：Docker + docker-compose
- 代码规范：Conventional Commits、Checkstyle、Google Java Style

**对应 spec：** §5.2.1 L2-1 平台底座（多租户/RBAC/审计/集成）
**对应决策：** D4（租户隔离 = tenant_id 列级）、D8（RBAC + Redis 缓存）、D9（审计 = append-only PG + Kafka 双写）、D12（团队 C 并行）
**对应阶段：** 第 1 期 · Spike（T-1 ~ T0）

---

## 文件结构

```
metaplatform-platform-base/
├── pom.xml                                    # 父 POM
├── docker-compose.yml                         # 一键起 PG/Redis/Kafka
├── README.md                                  # 启动文档
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/base/
│   │   │   ├── PlatformBaseApplication.java           # Spring Boot 入口
│   │   │   ├── config/
│   │   │   │   ├── RedisConfig.java                   # Redis 连接配置
│   │   │   │   ├── KafkaConfig.java                   # Kafka 生产者配置
│   │   │   │   ├── SecurityConfig.java                # Spring Security 配置
│   │   │   │   └── TenantInterceptor.java             # 多租户拦截器
│   │   │   ├── tenant/
│   │   │   │   ├── Tenant.java                        # 租户聚合根
│   │   │   │   ├── TenantId.java                      # 强类型租户 ID
│   │   │   │   ├── TenantContext.java                 # ThreadLocal 租户上下文
│   │   │   │   ├── TenantRepository.java              # 租户仓储
│   │   │   │   └── TenantService.java                 # 租户管理服务
│   │   │   ├── rbac/
│   │   │   │   ├── Role.java                          # 角色聚合根
│   │   │   │   ├── Permission.java                    # 权限值对象
│   │   │   │   ├── UserRole.java                      # 用户-角色关联
│   │   │   │   ├── RoleRepository.java                # 角色仓储
│   │   │   │   ├── PermissionEvaluator.java           # 权限评估器
│   │   │   │   └── RbacCacheService.java              # Redis 缓存服务
│   │   │   ├── audit/
│   │   │   │   ├── AuditLog.java                      # 审计日志实体
│   │   │   │   ├── AuditLogRepository.java            # append-only PG 仓储
│   │   │   │   ├── Audited.java                       # AOP 注解
│   │   │   │   ├── AuditAspect.java                   # AOP 切面
│   │   │   │   └── AuditEventPublisher.java           # Kafka 事件发布
│   │   │   ├── integration/
│   │   │   │   ├── Connector.java                     # 连接器抽象
│   │   │   │   ├── RestConnector.java                 # REST 连接器实现
│   │   │   │   ├── FieldMapping.java                  # 字段映射值对象
│   │   │   │   ├── ConnectorRegistry.java             # 连接器注册表
│   │   │   │   └── IntegrationService.java            # 集成服务
│   │   │   └── interfaces/
│   │   │       └── rest/
│   │   │           ├── TenantController.java          # 租户 API
│   │   │           ├── RoleController.java            # 角色 API
│   │   │           ├── AuditController.java           # 审计查询 API
│   │   │           ├── IntegrationController.java     # 集成 API
│   │   │           └── dto/
│   │   │               ├── CreateTenantRequest.java
│   │   │               ├── CreateRoleRequest.java
│   │   │               ├── AuditLogResponse.java
│   │   │               └── ConnectorConfigRequest.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   │           ├── V1__init_platform_base.sql
│   │           ├── V2__rbac_tables.sql
│   │           └── V3__audit_tables.sql
│   └── test/
│       └── java/com/metaplatform/base/
│           ├── tenant/
│           │   ├── TenantTest.java
│           │   └── TenantServiceTest.java
│           ├── rbac/
│           │   ├── RoleTest.java
│           │   ├── PermissionEvaluatorTest.java
│           │   └── RbacCacheServiceTest.java
│           ├── audit/
│           │   ├── AuditAspectTest.java
│           │   └── AuditLogRepositoryIT.java
│           ├── integration/
│           │   ├── RestConnectorTest.java
│           │   └── IntegrationServiceTest.java
│           └── interfaces/
│               ├── TenantControllerTest.java
│               └── RoleControllerTest.java
└── docs/
    └── api/
        └── openapi.yaml                       # REST API 契约
```

---

## Task 1: 仓库初始化

**Files:**
- Create: `metaplatform-platform-base/pom.xml`
- Create: `metaplatform-platform-base/docker-compose.yml`
- Create: `metaplatform-platform-base/README.md`
- Create: `metaplatform-platform-base/.gitignore`

- [ ] **Step 1.1: 初始化 Git 仓库**

```bash
cd metaplatform-platform-base
git init
git checkout -b main
```

- [ ] **Step 1.2: 写父 POM**

`pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.metaplatform</groupId>
    <artifactId>metaplatform-platform-base</artifactId>
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
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
        <testcontainers.version>1.19.7</testcontainers.version>
    </properties>

    <dependencies>
        <!-- Spring Boot starters -->
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
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-aop</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Database -->
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

        <!-- Kafka -->
        <dependency>
            <groupId>org.springframework.kafka</groupId>
            <artifactId>spring-kafka</artifactId>
        </dependency>

        <!-- Jackson -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>testcontainers</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>kafka</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            <plugin>
                <groupId>org.flywaydb</groupId>
                <artifactId>flyway-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 1.3: 写 docker-compose**

`docker-compose.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: mp-base-postgres
    ports:
      - "5434:5432"
    environment:
      POSTGRES_DB: platform_base
      POSTGRES_USER: base
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-base-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: mp-base-redis
    ports:
      - "6380:6379"
    volumes:
      - redis-base-data:/data

  kafka:
    image: apache/kafka:3.6.1
    container_name: mp-base-kafka
    ports:
      - "9094:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'

volumes:
  pg-base-data:
  redis-base-data:
```

- [ ] **Step 1.4: 写 application.yml**

`src/main/resources/application.yml`：

```yaml
server:
  port: 8082

spring:
  application:
    name: platform-base
  datasource:
    url: jdbc:postgresql://localhost:5434/platform_base
    username: base
    password: metaplatform
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
  data:
    redis:
      host: localhost
      port: 6380
  kafka:
    bootstrap-servers: localhost:9094
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer

platform:
  rbac:
    cache-ttl-seconds: 300
  audit:
    topic: platform.audit.events
  tenant:
    header-name: X-Tenant-Id

logging:
  level:
    com.metaplatform.base: DEBUG
```

- [ ] **Step 1.5: 写 README 和 .gitignore**

`README.md`：

```markdown
# MetaPlatform 平台底座 v0.1

Spike 期交付物。详细 plan 见 `docs/superpowers/plans/2026-07-02-platform-base-v0.1.md`。

## 启动

```bash
docker-compose up -d
./mvnw spring-boot:run
```

## 端口

- PostgreSQL: localhost:5434
- Redis: localhost:6380
- Kafka: localhost:9094
- 本服务: localhost:8082
```

`.gitignore`：

```
target/
.idea/
*.iml
.vscode/
.DS_Store
*.log
```

- [ ] **Step 1.6: 启动基础设施并验证**

```bash
docker-compose up -d
docker ps
```

Expected: 看到 3 个容器运行（postgres/redis/kafka）

- [ ] **Step 1.7: 提交**

```bash
git add .
git commit -m "chore: initialize platform base module with maven, docker-compose"
```

---

## Task 2: 租户聚合根 — Tenant / TenantId

**Files:**
- Create: `src/main/java/com/metaplatform/base/tenant/TenantId.java`
- Create: `src/main/java/com/metaplatform/base/tenant/Tenant.java`
- Test: `src/test/java/com/metaplatform/base/tenant/TenantTest.java`

- [ ] **Step 2.1: 写 TenantId 强类型 ID**

```java
package com.metaplatform.base.tenant;

import java.util.Objects;
import java.util.UUID;

public record TenantId(UUID value) {
    public TenantId {
        Objects.requireNonNull(value, "TenantId value must not be null");
    }

    public static TenantId newId() {
        return new TenantId(UUID.randomUUID());
    }

    public static TenantId of(String s) {
        return new TenantId(UUID.fromString(s));
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
```

- [ ] **Step 2.2: 写 Tenant 测试**

`TenantTest.java`：

```java
package com.metaplatform.base.tenant;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TenantTest {

    @Test
    void shouldCreateTenant() {
        Tenant t = new Tenant(TenantId.newId(), "Acme Corp", "acme", true);
        assertEquals("Acme Corp", t.name());
        assertEquals("acme", t.slug());
        assertTrue(t.isActive());
    }

    @Test
    void shouldRejectNullId() {
        assertThrows(NullPointerException.class,
            () -> new Tenant(null, "name", "slug", true));
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new Tenant(TenantId.newId(), "", "slug", true));
    }

    @Test
    void shouldRejectBlankSlug() {
        assertThrows(IllegalArgumentException.class,
            () -> new Tenant(TenantId.newId(), "name", "", true));
    }

    @Test
    void shouldRejectSlugWithSpaces() {
        assertThrows(IllegalArgumentException.class,
            () -> new Tenant(TenantId.newId(), "name", "has space", true));
    }

    @Test
    void shouldDeactivateTenant() {
        Tenant t = new Tenant(TenantId.newId(), "Acme", "acme", true);
        Tenant deactivated = t.deactivate();
        assertFalse(deactivated.isActive());
        assertEquals(t.id(), deactivated.id());
    }

    @Test
    void shouldActivateTenant() {
        Tenant t = new Tenant(TenantId.newId(), "Acme", "acme", false);
        Tenant activated = t.activate();
        assertTrue(activated.isActive());
    }
}
```

- [ ] **Step 2.3: 运行测试 — 确认失败**

```bash
./mvnw test -Dtest=TenantTest
```

Expected: 编译失败（Tenant 类不存在）

- [ ] **Step 2.4: 写 Tenant 聚合根**

```java
package com.metaplatform.base.tenant;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "tenants")
public class Tenant {

    @EmbeddedId
    private TenantId id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Tenant() {} // JPA

    public Tenant(TenantId id, String name, String slug, boolean active) {
        this.id = Objects.requireNonNull(id, "id");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("tenant name must not be blank");
        }
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("tenant slug must not be blank");
        }
        if (slug.contains(" ")) {
            throw new IllegalArgumentException("tenant slug must not contain spaces");
        }
        this.name = name;
        this.slug = slug;
        this.active = active;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public TenantId id() { return id; }
    public String name() { return name; }
    public String slug() { return slug; }
    public boolean isActive() { return active; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }

    public Tenant deactivate() {
        return new Tenant(this.id, this.name, this.slug, false);
    }

    public Tenant activate() {
        return new Tenant(this.id, this.name, this.slug, true);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Tenant tenant)) return false;
        return Objects.equals(id, tenant.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

- [ ] **Step 2.5: 跑测试 — 确认通过**

```bash
./mvnw test -Dtest=TenantTest
```

Expected: 7 个测试全通过

- [ ] **Step 2.6: 提交**

```bash
git add src/main/java/com/metaplatform/base/tenant/TenantId.java \
        src/main/java/com/metaplatform/base/tenant/Tenant.java \
        src/test/java/com/metaplatform/base/tenant/TenantTest.java
git commit -m "feat(tenant): add Tenant aggregate root with TenantId"
```

---

## Task 3: 多租户隔离 — TenantContext + TenantInterceptor

**Files:**
- Create: `src/main/java/com/metaplatform/base/tenant/TenantContext.java`
- Create: `src/main/java/com/metaplatform/base/config/TenantInterceptor.java`
- Create: `src/main/java/com/metaplatform/base/tenant/TenantRepository.java`
- Create: `src/main/java/com/metaplatform/base/tenant/TenantService.java`

- [ ] **Step 3.1: 写 TenantContext（ThreadLocal）**

```java
package com.metaplatform.base.tenant;

public final class TenantContext {

    private static final ThreadLocal<TenantId> CONTEXT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(TenantId tenantId) {
        CONTEXT.set(tenantId);
    }

    public static TenantId get() {
        TenantId id = CONTEXT.get();
        if (id == null) {
            throw new IllegalStateException("TenantContext not set. Ensure TenantInterceptor is active.");
        }
        return id;
    }

    public static TenantId getOrNull() {
        return CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
```

- [ ] **Step 3.2: 写 TenantInterceptor**

```java
package com.metaplatform.base.config;

import com.metaplatform.base.tenant.TenantContext;
import com.metaplatform.base.tenant.TenantId;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class TenantInterceptor implements HandlerInterceptor {

    private final String headerName;

    public TenantInterceptor(@Value("${platform.tenant.header-name:X-Tenant-Id}") String headerName) {
        this.headerName = headerName;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String tenantId = request.getHeader(headerName);
        if (tenantId == null || tenantId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return false;
        }
        try {
            TenantContext.set(TenantId.of(tenantId));
        } catch (IllegalArgumentException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return false;
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        TenantContext.clear();
    }
}
```

- [ ] **Step 3.3: 注册拦截器到 WebMvcConfig**

```java
package com.metaplatform.base.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantInterceptor tenantInterceptor;

    public WebMvcConfig(TenantInterceptor tenantInterceptor) {
        this.tenantInterceptor = tenantInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantInterceptor)
                .addPathPatterns("/api/**");
    }
}
```

- [ ] **Step 3.4: 写 TenantRepository 和 TenantService**

```java
package com.metaplatform.base.tenant;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    Optional<Tenant> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
```

```java
package com.metaplatform.base.tenant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class TenantService {

    private final TenantRepository repository;

    public TenantService(TenantRepository repository) {
        this.repository = repository;
    }

    public Tenant create(String name, String slug) {
        if (repository.existsBySlug(slug)) {
            throw new IllegalArgumentException("Tenant slug already exists: " + slug);
        }
        Tenant tenant = new Tenant(TenantId.newId(), name, slug, true);
        return repository.save(tenant);
    }

    @Transactional(readOnly = true)
    public Tenant findById(TenantId id) {
        return repository.findById(id.value())
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<Tenant> findAll() {
        return repository.findAll();
    }

    public Tenant deactivate(TenantId id) {
        Tenant tenant = findById(id);
        return repository.save(tenant.deactivate());
    }

    public Tenant activate(TenantId id) {
        Tenant tenant = findById(id);
        return repository.save(tenant.activate());
    }
}
```

- [ ] **Step 3.5: 写 Flyway 迁移 V1**

`src/main/resources/db/migration/V1__init_platform_base.sql`：

```sql
-- 租户表
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(active);
```

- [ ] **Step 3.6: 提交**

```bash
git add src/main/java/com/metaplatform/base/tenant/ \
        src/main/java/com/metaplatform/base/config/TenantInterceptor.java \
        src/main/java/com/metaplatform/base/config/WebMvcConfig.java \
        src/main/resources/db/migration/V1__init_platform_base.sql
git commit -m "feat(tenant): add TenantContext, TenantInterceptor, and multi-tenant isolation"
```

---

## Task 4: RBAC 权限模型 — Role / Permission / UserRole

**Files:**
- Create: `src/main/java/com/metaplatform/base/rbac/Permission.java`
- Create: `src/main/java/com/metaplatform/base/rbac/Role.java`
- Create: `src/main/java/com/metaplatform/base/rbac/UserRole.java`
- Test: `src/test/java/com/metaplatform/base/rbac/RoleTest.java`

- [ ] **Step 4.1: 写 Permission 值对象**

```java
package com.metaplatform.base.rbac;

import java.util.Objects;

public record Permission(
    String resource,
    String action
) {
    public Permission {
        if (resource == null || resource.isBlank()) {
            throw new IllegalArgumentException("resource must not be blank");
        }
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("action must not be blank");
        }
    }

    public String toKey() {
        return resource + ":" + action;
    }

    public static Permission of(String resource, String action) {
        return new Permission(resource, action);
    }
}
```

- [ ] **Step 4.2: 写 Role 聚合根**

```java
package com.metaplatform.base.rbac;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private boolean systemRole; // 系统预置角色不可删除

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_id"))
    @AttributeOverrides({
        @AttributeOverride(name = "resource", column = @Column(name = "resource")),
        @AttributeOverride(name = "action", column = @Column(name = "action"))
    })
    private Set<Permission> permissions = new HashSet<>();

    protected Role() {} // JPA

    public Role(UUID tenantId, String name, String description, boolean systemRole) {
        this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("role name must not be blank");
        }
        this.name = name;
        this.description = description;
        this.systemRole = systemRole;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public boolean isSystemRole() { return systemRole; }
    public Set<Permission> getPermissions() { return Collections.unmodifiableSet(permissions); }

    public void addPermission(Permission permission) {
        permissions.add(permission);
    }

    public void removePermission(Permission permission) {
        permissions.remove(permission);
    }

    public boolean hasPermission(Permission permission) {
        return permissions.contains(permission);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Role role)) return false;
        return Objects.equals(id, role.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

- [ ] **Step 4.3: 写 UserRole 关联实体**

```java
package com.metaplatform.base.rbac;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "user_roles", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "user_id", "role_id"})
})
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(nullable = false, updatable = false)
    private Instant assignedAt;

    @Column(nullable = false)
    private UUID assignedBy;

    protected UserRole() {} // JPA

    public UserRole(UUID tenantId, UUID userId, Role role, UUID assignedBy) {
        this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
        this.userId = Objects.requireNonNull(userId, "userId");
        this.role = Objects.requireNonNull(role, "role");
        this.assignedBy = Objects.requireNonNull(assignedBy, "assignedBy");
        this.assignedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getUserId() { return userId; }
    public Role getRole() { return role; }
    public Instant getAssignedAt() { return assignedAt; }
    public UUID getAssignedBy() { return assignedBy; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserRole ur)) return false;
        return Objects.equals(id, ur.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

- [ ] **Step 4.4: 写 Role 测试**

`RoleTest.java`：

```java
package com.metaplatform.base.rbac;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class RoleTest {

    @Test
    void shouldCreateRole() {
        Role r = new Role(UUID.randomUUID(), "admin", "Administrator", true);
        assertEquals("admin", r.getName());
        assertTrue(r.isSystemRole());
        assertTrue(r.getPermissions().isEmpty());
    }

    @Test
    void shouldAddPermission() {
        Role r = new Role(UUID.randomUUID(), "editor", "Editor", false);
        r.addPermission(Permission.of("object-type", "read"));
        r.addPermission(Permission.of("object-type", "write"));
        assertEquals(2, r.getPermissions().size());
    }

    @Test
    void shouldCheckPermission() {
        Role r = new Role(UUID.randomUUID(), "viewer", "Viewer", false);
        r.addPermission(Permission.of("object-instance", "read"));
        assertTrue(r.hasPermission(Permission.of("object-instance", "read")));
        assertFalse(r.hasPermission(Permission.of("object-instance", "delete")));
    }

    @Test
    void shouldRemovePermission() {
        Role r = new Role(UUID.randomUUID(), "temp", "Temp", false);
        Permission p = Permission.of("report", "export");
        r.addPermission(p);
        assertTrue(r.hasPermission(p));
        r.removePermission(p);
        assertFalse(r.hasPermission(p));
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new Role(UUID.randomUUID(), "", "desc", false));
    }

    @Test
    void shouldRejectNullTenantId() {
        assertThrows(NullPointerException.class,
            () -> new Role(null, "role", "desc", false));
    }
}
```

- [ ] **Step 4.5: 跑测试**

```bash
./mvnw test -Dtest=RoleTest
```

Expected: 6 个测试全通过

- [ ] **Step 4.6: 写 Flyway 迁移 V2**

`src/main/resources/db/migration/V2__rbac_tables.sql`：

```sql
-- 角色表
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(64) NOT NULL,
    description VARCHAR(256),
    system_role BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

-- 角色-权限关联表
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    PRIMARY KEY (role_id, resource, action)
);

-- 用户-角色关联表
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID NOT NULL,
    UNIQUE (tenant_id, user_id, role_id)
);

CREATE INDEX idx_user_roles_tenant_user ON user_roles(tenant_id, user_id);
```

- [ ] **Step 4.7: 提交**

```bash
git add src/main/java/com/metaplatform/base/rbac/ \
        src/test/java/com/metaplatform/base/rbac/RoleTest.java \
        src/main/resources/db/migration/V2__rbac_tables.sql
git commit -m "feat(rbac): add Role, Permission, UserRole domain model"
```

---

## Task 5: RBAC 缓存 — RbacCacheService + PermissionEvaluator

**Files:**
- Create: `src/main/java/com/metaplatform/base/rbac/RbacCacheService.java`
- Create: `src/main/java/com/metaplatform/base/rbac/PermissionEvaluator.java`
- Create: `src/main/java/com/metaplatform/base/rbac/RoleRepository.java`
- Test: `src/test/java/com/metaplatform/base/rbac/PermissionEvaluatorTest.java`
- Test: `src/test/java/com/metaplatform/base/rbac/RbacCacheServiceTest.java`

- [ ] **Step 5.1: 写 RoleRepository**

```java
package com.metaplatform.base.rbac;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    List<Role> findByTenantId(UUID tenantId);

    @Query("SELECT r FROM UserRole ur JOIN ur.role r WHERE ur.tenantId = :tenantId AND ur.userId = :userId")
    List<Role> findRolesByUser(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
}
```

```java
package com.metaplatform.base.rbac;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    List<UserRole> findByTenantIdAndUserId(UUID tenantId, UUID userId);

    void deleteByTenantIdAndUserIdAndRoleId(UUID tenantId, UUID userId, UUID roleId);
}
```

- [ ] **Step 5.2: 写 RbacCacheService（Redis 缓存）**

```java
package com.metaplatform.base.rbac;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class RbacCacheService {

    private static final String KEY_PREFIX = "rbac:permissions:";

    private final StringRedisTemplate redisTemplate;
    private final long cacheTtlSeconds;

    public RbacCacheService(StringRedisTemplate redisTemplate,
                            @Value("${platform.rbac.cache-ttl-seconds:300}") long cacheTtlSeconds) {
        this.redisTemplate = redisTemplate;
        this.cacheTtlSeconds = cacheTtlSeconds;
    }

    /**
     * 缓存用户的权限集合。key: rbac:permissions:{tenantId}:{userId}
     * value: resource:action 的 Set
     */
    public void cachePermissions(String tenantId, String userId, Set<Permission> permissions) {
        String key = buildKey(tenantId, userId);
        Set<String> permissionKeys = permissions.stream()
                .map(Permission::toKey)
                .collect(Collectors.toSet());
        redisTemplate.delete(key);
        if (!permissionKeys.isEmpty()) {
            redisTemplate.opsForSet().add(key, permissionKeys.toArray(new String[0]));
        }
        redisTemplate.expire(key, cacheTtlSeconds, TimeUnit.SECONDS);
    }

    /**
     * 查询缓存中用户是否拥有指定权限
     */
    public Boolean hasPermission(String tenantId, String userId, Permission permission) {
        String key = buildKey(tenantId, userId);
        return redisTemplate.opsForSet().isMember(key, permission.toKey());
    }

    /**
     * 获取缓存中用户的所有权限 key
     */
    public Set<String> getCachedPermissionKeys(String tenantId, String userId) {
        String key = buildKey(tenantId, userId);
        Set<String> members = redisTemplate.opsForSet().members(key);
        return members != null ? members : Set.of();
    }

    /**
     * 使缓存失效
     */
    public void evict(String tenantId, String userId) {
        String key = buildKey(tenantId, userId);
        redisTemplate.delete(key);
    }

    private String buildKey(String tenantId, String userId) {
        return KEY_PREFIX + tenantId + ":" + userId;
    }
}
```

- [ ] **Step 5.3: 写 PermissionEvaluator**

```java
package com.metaplatform.base.rbac;

import com.metaplatform.base.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class PermissionEvaluator {

    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RbacCacheService cacheService;

    public PermissionEvaluator(RoleRepository roleRepository,
                               UserRoleRepository userRoleRepository,
                               RbacCacheService cacheService) {
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.cacheService = cacheService;
    }

    /**
     * 检查用户是否拥有指定权限
     */
    public boolean hasPermission(UUID userId, String resource, String action) {
        Permission permission = Permission.of(resource, action);
        String tenantId = TenantContext.get().toString();

        // 1. 先查缓存
        Boolean cached = cacheService.hasPermission(tenantId, userId.toString(), permission);
        if (cached != null) {
            return cached;
        }

        // 2. 缓存未命中，查数据库
        List<Role> roles = roleRepository.findRolesByUser(
                TenantContext.get().value(), userId);

        Set<Permission> allPermissions = roles.stream()
                .flatMap(r -> r.getPermissions().stream())
                .collect(Collectors.toSet());

        // 3. 写入缓存
        cacheService.cachePermissions(tenantId, userId.toString(), allPermissions);

        return allPermissions.contains(permission);
    }

    /**
     * 获取用户所有权限
     */
    public Set<Permission> getUserPermissions(UUID userId) {
        String tenantId = TenantContext.get().toString();

        // 尝试从缓存获取
        Set<String> cached = cacheService.getCachedPermissionKeys(tenantId, userId.toString());
        if (!cached.isEmpty()) {
            return cached.stream()
                    .map(k -> {
                        String[] parts = k.split(":", 2);
                        return Permission.of(parts[0], parts[1]);
                    })
                    .collect(Collectors.toSet());
        }

        // 查数据库
        List<Role> roles = roleRepository.findRolesByUser(
                TenantContext.get().value(), userId);

        Set<Permission> allPermissions = roles.stream()
                .flatMap(r -> r.getPermissions().stream())
                .collect(Collectors.toSet());

        // 写入缓存
        cacheService.cachePermissions(tenantId, userId.toString(), allPermissions);

        return allPermissions;
    }
}
```

- [ ] **Step 5.4: 写 PermissionEvaluator 测试**

`PermissionEvaluatorTest.java`：

```java
package com.metaplatform.base.rbac;

import com.metaplatform.base.tenant.TenantContext;
import com.metaplatform.base.tenant.TenantId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionEvaluatorTest {

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private RbacCacheService cacheService;

    private PermissionEvaluator evaluator;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        evaluator = new PermissionEvaluator(roleRepository, userRoleRepository, cacheService);
        TenantContext.set(new TenantId(tenantId));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldReturnTrueFromCache() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("object-type", "read"))).thenReturn(true);

        assertTrue(evaluator.hasPermission(userId, "object-type", "read"));

        verifyNoInteractions(roleRepository);
    }

    @Test
    void shouldReturnFalseFromCache() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("object-type", "delete"))).thenReturn(false);

        assertFalse(evaluator.hasPermission(userId, "object-type", "delete"));

        verifyNoInteractions(roleRepository);
    }

    @Test
    void shouldFallbackToDatabaseOnCacheMiss() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("report", "export"))).thenReturn(null);

        Role role = new Role(tenantId, "exporter", "Exporter", false);
        role.addPermission(Permission.of("report", "export"));

        when(roleRepository.findRolesByUser(tenantId, userId)).thenReturn(List.of(role));

        assertTrue(evaluator.hasPermission(userId, "report", "export"));

        verify(cacheService).cachePermissions(eq(tenantId.toString()), eq(userId.toString()), any());
    }

    @Test
    void shouldReturnFalseWhenNoRoles() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("anything", "do"))).thenReturn(null);

        when(roleRepository.findRolesByUser(tenantId, userId)).thenReturn(List.of());

        assertFalse(evaluator.hasPermission(userId, "anything", "do"));
    }
}
```

- [ ] **Step 5.5: 跑测试**

```bash
./mvnw test -Dtest=PermissionEvaluatorTest
```

Expected: 4 个测试全通过

- [ ] **Step 5.6: 配置 RedisConfig**

```java
package com.metaplatform.base.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}
```

- [ ] **Step 5.7: 提交**

```bash
git add src/main/java/com/metaplatform/base/rbac/ \
        src/main/java/com/metaplatform/base/config/RedisConfig.java \
        src/test/java/com/metaplatform/base/rbac/PermissionEvaluatorTest.java
git commit -m "feat(rbac): add RbacCacheService with Redis and PermissionEvaluator"
```

---

## Task 6: 审计日志 — AuditLog + AuditRepository（append-only PG）

**Files:**
- Create: `src/main/java/com/metaplatform/base/audit/AuditLog.java`
- Create: `src/main/java/com/metaplatform/base/audit/AuditLogRepository.java`
- Create: `src/main/resources/db/migration/V3__audit_tables.sql`
- Test: `src/test/java/com/metaplatform/base/audit/AuditLogRepositoryIT.java`

- [ ] **Step 6.1: 写 AuditLog 实体**

```java
package com.metaplatform.base.audit;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String action; // CREATE, UPDATE, DELETE, READ

    @Column(nullable = false)
    private String resourceType; // e.g., "object-type", "object-instance"

    @Column(nullable = false)
    private String resourceId;

    @Column(columnDefinition = "jsonb")
    private String details; // JSON 格式的变更详情

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    private String ipAddress;
    private String userAgent;

    protected AuditLog() {} // JPA

    public AuditLog(UUID tenantId, UUID userId, String action, String resourceType,
                    String resourceId, String details, String ipAddress, String userAgent) {
        this.tenantId = tenantId;
        this.userId = userId;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.details = details;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.timestamp = Instant.now();
    }

    // Getters
    public Long getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getUserId() { return userId; }
    public String getAction() { return action; }
    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
    public String getDetails() { return details; }
    public Instant getTimestamp() { return timestamp; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
}
```

- [ ] **Step 6.2: 写 AuditLogRepository（只读，append-only）**

```java
package com.metaplatform.base.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /**
     * 只允许 INSERT，不允许 UPDATE/DELETE（通过 service 层约束）
     */

    Page<AuditLog> findByTenantIdAndUserIdOrderByTimestampDesc(
            UUID tenantId, UUID userId, Pageable pageable);

    Page<AuditLog> findByTenantIdAndResourceTypeAndResourceIdOrderByTimestampDesc(
            UUID tenantId, String resourceType, String resourceId, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId " +
           "AND a.timestamp BETWEEN :from AND :to ORDER BY a.timestamp DESC")
    Page<AuditLog> findByTenantAndTimeRange(
            @Param("tenantId") UUID tenantId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId " +
           "AND a.action = :action ORDER BY a.timestamp DESC")
    Page<AuditLog> findByTenantAndAction(
            @Param("tenantId") UUID tenantId,
            @Param("action") String action,
            Pageable pageable);
}
```

- [ ] **Step 6.3: 写 Flyway 迁移 V3**

`src/main/resources/db/migration/V3__audit_tables.sql`：

```sql
-- 审计日志表（append-only，不设 UPDATE/DELETE 权限）
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent VARCHAR(256)
);

-- 索引
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(tenant_id, user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(tenant_id, timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action);

-- 创建只读角色（禁止 UPDATE/DELETE audit_logs）
-- 这是 DDL 级别的 append-only 保障
-- REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
```

- [ ] **Step 6.4: 写集成测试**

`AuditLogRepositoryIT.java`：

```java
package com.metaplatform.base.audit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Testcontainers
class AuditLogRepositoryIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("audit_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void overrideProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private AuditLogRepository repository;

    @Test
    void shouldSaveAuditLog() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        AuditLog log = new AuditLog(
                tenantId, userId, "CREATE", "object-type", "ot-123",
                "{\"name\":\"Customer\"}", "127.0.0.1", "TestAgent");

        AuditLog saved = repository.save(log);

        assertNotNull(saved.getId());
        assertEquals(tenantId, saved.getTenantId());
        assertEquals("CREATE", saved.getAction());
        assertNotNull(saved.getTimestamp());
    }

    @Test
    void shouldQueryByTenantAndUser() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        repository.save(new AuditLog(tenantId, userId, "CREATE", "object-type", "ot-1",
                null, null, null));
        repository.save(new AuditLog(tenantId, userId, "UPDATE", "object-type", "ot-1",
                null, null, null));
        repository.save(new AuditLog(UUID.randomUUID(), userId, "CREATE", "object-type", "ot-2",
                null, null, null));

        var result = repository.findByTenantIdAndUserIdOrderByTimestampDesc(
                tenantId, userId, org.springframework.data.domain.PageRequest.of(0, 10));

        assertEquals(2, result.getTotalElements());
    }
}
```

- [ ] **Step 6.5: 跑集成测试**

```bash
./mvnw test -Dtest=AuditLogRepositoryIT
```

Expected: 2 个测试全通过

- [ ] **Step 6.6: 提交**

```bash
git add src/main/java/com/metaplatform/base/audit/AuditLog.java \
        src/main/java/com/metaplatform/base/audit/AuditLogRepository.java \
        src/main/resources/db/migration/V3__audit_tables.sql \
        src/test/java/com/metaplatform/base/audit/AuditLogRepositoryIT.java
git commit -m "feat(audit): add AuditLog entity with append-only PG repository"
```

---

## Task 7: 审计日志 — AOP @Audited 切面 + Kafka 事件发布

**Files:**
- Create: `src/main/java/com/metaplatform/base/audit/Audited.java`
- Create: `src/main/java/com/metaplatform/base/audit/AuditAspect.java`
- Create: `src/main/java/com/metaplatform/base/audit/AuditEventPublisher.java`
- Test: `src/test/java/com/metaplatform/base/audit/AuditAspectTest.java`

- [ ] **Step 7.1: 写 @Audited 注解**

```java
package com.metaplatform.base.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记在方法上，AOP 切面会自动记录审计日志。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    String action();
    String resourceType();
    String resourceIdSpEL() default ""; // SpEL 表达式，从返回值或参数中提取 resourceId
}
```

- [ ] **Step 7.2: 写 AuditEventPublisher（Kafka）**

```java
package com.metaplatform.base.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AuditEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(AuditEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public AuditEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                               @Value("${platform.audit.topic:platform.audit.events}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    /**
     * 发布审计事件到 Kafka（异步，fire-and-forget）
     */
    public void publish(AuditLog auditLog) {
        Map<String, Object> event = Map.of(
                "auditId", auditLog.getId() != null ? auditLog.getId() : 0,
                "tenantId", auditLog.getTenantId().toString(),
                "userId", auditLog.getUserId().toString(),
                "action", auditLog.getAction(),
                "resourceType", auditLog.getResourceType(),
                "resourceId", auditLog.getResourceId(),
                "timestamp", auditLog.getTimestamp().toString(),
                "details", auditLog.getDetails() != null ? auditLog.getDetails() : "{}"
        );

        kafkaTemplate.send(topic, auditLog.getTenantId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish audit event to Kafka: {}", ex.getMessage(), ex);
                    } else {
                        log.debug("Audit event published to topic={}, partition={}, offset={}",
                                result.getRecordMetadata().topic(),
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }
}
```

- [ ] **Step 7.3: 写 AuditAspect**

```java
package com.metaplatform.base.audit;

import com.metaplatform.base.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
@Order(1) // 确保在事务之后执行
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);
    private static final ExpressionParser parser = new SpelExpressionParser();

    private final AuditLogRepository auditLogRepository;
    private final AuditEventPublisher eventPublisher;
    private final HttpServletRequest request;

    public AuditAspect(AuditLogRepository auditLogRepository,
                       AuditEventPublisher eventPublisher,
                       HttpServletRequest request) {
        this.auditLogRepository = auditLogRepository;
        this.eventPublisher = eventPublisher;
        this.request = request;
    }

    @Around("@annotation(audited)")
    public Object audit(ProceedingJoinPoint joinPoint, Audited audited) throws Throwable {
        Object result = joinPoint.proceed();

        try {
            UUID tenantId = TenantContext.get().value();
            UUID userId = getCurrentUserId();
            String resourceId = resolveResourceId(audited.resourceIdSpEL(), joinPoint, result);

            String details = buildDetails(joinPoint, result);

            AuditLog auditLog = new AuditLog(
                    tenantId,
                    userId,
                    audited.action(),
                    audited.resourceType(),
                    resourceId,
                    details,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent")
            );

            // 1. 写 PG（append-only）
            AuditLog saved = auditLogRepository.save(auditLog);

            // 2. 发 Kafka 事件（异步）
            eventPublisher.publish(saved);

        } catch (Exception e) {
            // 审计日志失败不应影响业务
            log.error("Failed to create audit log: {}", e.getMessage(), e);
        }

        return result;
    }

    private UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UUID userId) {
            return userId;
        }
        return UUID.fromString("00000000-0000-0000-0000-000000000000"); // system
    }

    private String resolveResourceId(String spel, ProceedingJoinPoint joinPoint, Object result) {
        if (spel == null || spel.isBlank()) {
            return "unknown";
        }
        try {
            EvaluationContext context = new StandardEvaluationContext();
            // 将方法参数绑定到 SpEL 上下文
            MethodSignature sig = (MethodSignature) joinPoint.getSignature();
            String[] paramNames = sig.getParameterNames();
            Object[] args = joinPoint.getArgs();
            for (int i = 0; i < paramNames.length; i++) {
                ((StandardEvaluationContext) context).setVariable(paramNames[i], args[i]);
            }
            // 将返回值设为 root
            return parser.parseExpression(spel).getValue(context, result, String.class);
        } catch (Exception e) {
            log.warn("Failed to resolve resourceId from SpEL '{}': {}", spel, e.getMessage());
            return "unknown";
        }
    }

    private String buildDetails(ProceedingJoinPoint joinPoint, Object result) {
        // v0.1 简化：只记录方法名和参数类型
        return String.format("{\"method\":\"%s\",\"resultType\":\"%s\"}",
                joinPoint.getSignature().getName(),
                result != null ? result.getClass().getSimpleName() : "void");
    }
}
```

- [ ] **Step 7.4: 写 AuditAspect 测试**

`AuditAspectTest.java`：

```java
package com.metaplatform.base.audit;

import com.metaplatform.base.tenant.TenantContext;
import com.metaplatform.base.tenant.TenantId;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private AuditEventPublisher eventPublisher;

    @Mock
    private HttpServletRequest request;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    private AuditAspect auditAspect;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        auditAspect = new AuditAspect(auditLogRepository, eventPublisher, request);
        TenantContext.set(new TenantId(tenantId));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldSaveAuditLogOnAnnotatedMethod() throws Throwable {
        // 模拟被 @Audited 标注的方法
        when(joinPoint.proceed()).thenReturn("result-id");
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getName()).thenReturn("createObjectType");
        when(methodSignature.getParameterNames()).thenReturn(new String[]{"request"});
        when(joinPoint.getArgs()).thenReturn(new Object[]{"req-data"});

        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("User-Agent")).thenReturn("JUnit");

        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 模拟 @Audited 注解
        Audited audited = mock(Audited.class);
        when(audited.action()).thenReturn("CREATE");
        when(audited.resourceType()).thenReturn("object-type");
        when(audited.resourceIdSpEL()).thenReturn("#result");

        Object result = auditAspect.audit(joinPoint, audited);

        verify(auditLogRepository, times(1)).save(any(AuditLog.class));
        verify(eventPublisher, times(1)).publish(any(AuditLog.class));
    }

    @Test
    void shouldNotFailWhenAuditLogSaveFails() throws Throwable {
        when(joinPoint.proceed()).thenReturn("result");
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getName()).thenReturn("test");
        when(methodSignature.getParameterNames()).thenReturn(new String[]{});
        when(joinPoint.getArgs()).thenReturn(new Object[]{});
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("User-Agent")).thenReturn("JUnit");

        when(auditLogRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        Audited audited = mock(Audited.class);
        when(audited.action()).thenReturn("CREATE");
        when(audited.resourceType()).thenReturn("test");
        when(audited.resourceIdSpEL()).thenReturn("");

        // 不应抛出异常
        Object result = auditAspect.audit(joinPoint, audited);
        verify(joinPoint).proceed();
    }
}
```

- [ ] **Step 7.5: 跑测试**

```bash
./mvnw test -Dtest=AuditAspectTest
```

Expected: 2 个测试全通过

- [ ] **Step 7.6: 提交**

```bash
git add src/main/java/com/metaplatform/base/audit/Audited.java \
        src/main/java/com/metaplatform/base/audit/AuditAspect.java \
        src/main/java/com/metaplatform/base/audit/AuditEventPublisher.java \
        src/test/java/com/metaplatform/base/audit/AuditAspectTest.java
git commit -m "feat(audit): add @Audited AOP aspect with Kafka event publishing"
```

---

## Task 8: 集成 Hub 骨架 — Connector + RestConnector + FieldMapping

**Files:**
- Create: `src/main/java/com/metaplatform/base/integration/Connector.java`
- Create: `src/main/java/com/metaplatform/base/integration/FieldMapping.java`
- Create: `src/main/java/com/metaplatform/base/integration/RestConnector.java`
- Create: `src/main/java/com/metaplatform/base/integration/ConnectorRegistry.java`
- Create: `src/main/java/com/metaplatform/base/integration/IntegrationService.java`
- Test: `src/test/java/com/metaplatform/base/integration/RestConnectorTest.java`

- [ ] **Step 8.1: 写 Connector 抽象接口**

```java
package com.metaplatform.base.integration;

import java.util.List;
import java.util.Map;

/**
 * 集成连接器抽象。每个连接器对接一个外部系统。
 */
public interface Connector {

    /** 连接器唯一标识 */
    String id();

    /** 连接器类型：REST, GRPC, JDBC, etc. */
    String type();

    /** 测试连接是否可用 */
    boolean testConnection();

    /** 拉取数据 */
    List<Map<String, Object>> pull(PullRequest request);

    /** 推送数据 */
    PushResult push(PushRequest request);

    record PullRequest(
        String endpoint,
        Map<String, String> headers,
        Map<String, String> queryParams,
        FieldMapping fieldMapping
    ) {}

    record PushRequest(
        String endpoint,
        Map<String, String> headers,
        Map<String, Object> payload,
        FieldMapping fieldMapping
    ) {}

    record PushResult(
        boolean success,
        int statusCode,
        String responseBody,
        String errorMessage
    ) {}
}
```

- [ ] **Step 8.2: 写 FieldMapping 值对象**

```java
package com.metaplatform.base.integration;

import java.util.Collections;
import java.util.Map;

/**
 * 字段映射：外部系统字段名 -> 平台内部字段名。
 * 例如：{"external_name": "name", "ext_email": "email"}
 */
public record FieldMapping(Map<String, String> mappings) {

    public FieldMapping {
        if (mappings == null) {
            mappings = Collections.emptyMap();
        }
        mappings = Collections.unmodifiableMap(mappings);
    }

    public static FieldMapping of(Map<String, String> mappings) {
        return new FieldMapping(mappings);
    }

    public static FieldMapping empty() {
        return new FieldMapping(Map.of());
    }

    /**
     * 将外部字段名转换为内部字段名
     */
    public String toInternal(String externalField) {
        return mappings.getOrDefault(externalField, externalField);
    }

    /**
     * 将内部字段名转换为外部字段名
     */
    public String toExternal(String internalField) {
        return mappings.entrySet().stream()
                .filter(e -> e.getValue().equals(internalField))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(internalField);
    }

    /**
     * 转换整个数据 map（外部字段名 -> 内部字段名）
     */
    public Map<String, Object> transformInbound(Map<String, Object> externalData) {
        var result = new java.util.HashMap<String, Object>();
        externalData.forEach((key, value) -> {
            String internalKey = toInternal(key);
            result.put(internalKey, value);
        });
        return result;
    }

    /**
     * 转换整个数据 map（内部字段名 -> 外部字段名）
     */
    public Map<String, Object> transformOutbound(Map<String, Object> internalData) {
        var result = new java.util.HashMap<String, Object>();
        internalData.forEach((key, value) -> {
            String externalKey = toExternal(key);
            result.put(externalKey, value);
        });
        return result;
    }
}
```

- [ ] **Step 8.3: 写 RestConnector 实现**

```java
package com.metaplatform.base.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

public class RestConnector implements Connector {

    private static final Logger log = LoggerFactory.getLogger(RestConnector.class);

    private final String connectorId;
    private final String baseUrl;
    private final RestTemplate restTemplate;

    public RestConnector(String connectorId, String baseUrl, RestTemplate restTemplate) {
        this.connectorId = connectorId;
        this.baseUrl = baseUrl;
        this.restTemplate = restTemplate;
    }

    @Override
    public String id() {
        return connectorId;
    }

    @Override
    public String type() {
        return "REST";
    }

    @Override
    public boolean testConnection() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(baseUrl, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("Connection test failed for connector {}: {}", connectorId, e.getMessage());
            return false;
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> pull(PullRequest request) {
        String url = buildUrl(request.endpoint(), request.queryParams());
        HttpHeaders headers = buildHeaders(request.headers());

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<Map[]> response = restTemplate.exchange(
                url, HttpMethod.GET, entity, Map[].class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return List.of();
        }

        FieldMapping mapping = request.fieldMapping();
        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> item : response.getBody()) {
            results.add(mapping.transformInbound(item));
        }
        return results;
    }

    @Override
    public PushResult push(PushRequest request) {
        String url = buildUrl(request.endpoint(), Map.of());
        HttpHeaders headers = buildHeaders(request.headers());
        headers.setContentType(MediaType.APPLICATION_JSON);

        FieldMapping mapping = request.fieldMapping();
        Map<String, Object> transformedPayload = mapping.transformOutbound(request.payload());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(transformedPayload, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);
            return new PushResult(
                    response.getStatusCode().is2xxSuccessful(),
                    response.getStatusCode().value(),
                    response.getBody(),
                    null
            );
        } catch (Exception e) {
            return new PushResult(false, 0, null, e.getMessage());
        }
    }

    private String buildUrl(String endpoint, Map<String, String> queryParams) {
        StringBuilder sb = new StringBuilder(baseUrl);
        if (!endpoint.startsWith("/")) sb.append("/");
        sb.append(endpoint);

        if (queryParams != null && !queryParams.isEmpty()) {
            sb.append("?");
            queryParams.forEach((k, v) -> sb.append(k).append("=").append(v).append("&"));
            sb.setLength(sb.length() - 1); // 去掉最后的 &
        }
        return sb.toString();
    }

    private HttpHeaders buildHeaders(Map<String, String> headers) {
        HttpHeaders httpHeaders = new HttpHeaders();
        if (headers != null) {
            headers.forEach(httpHeaders::add);
        }
        return httpHeaders;
    }
}
```

- [ ] **Step 8.4: 写 ConnectorRegistry**

```java
package com.metaplatform.base.integration;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ConnectorRegistry {

    private final Map<String, Connector> connectors = new ConcurrentHashMap<>();

    public void register(Connector connector) {
        connectors.put(connector.id(), connector);
    }

    public Connector get(String connectorId) {
        Connector connector = connectors.get(connectorId);
        if (connector == null) {
            throw new IllegalArgumentException("Connector not found: " + connectorId);
        }
        return connector;
    }

    public List<Connector> listAll() {
        return List.copyOf(connectors.values());
    }

    public void unregister(String connectorId) {
        connectors.remove(connectorId);
    }
}
```

- [ ] **Step 8.5: 写 IntegrationService**

```java
package com.metaplatform.base.integration;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class IntegrationService {

    private final ConnectorRegistry registry;

    public IntegrationService(ConnectorRegistry registry) {
        this.registry = registry;
    }

    public boolean testConnector(String connectorId) {
        return registry.get(connectorId).testConnection();
    }

    public List<Map<String, Object>> pullData(String connectorId, Connector.PullRequest request) {
        return registry.get(connectorId).pull(request);
    }

    public Connector.PushResult pushData(String connectorId, Connector.PushRequest request) {
        return registry.get(connectorId).push(request);
    }

    public List<Connector> listConnectors() {
        return registry.listAll();
    }
}
```

- [ ] **Step 8.6: 写 RestConnector 测试**

`RestConnectorTest.java`：

```java
package com.metaplatform.base.integration;

import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RestConnectorTest {

    @Test
    void shouldTransformPullDataWithFieldMapping() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RestConnector connector = new RestConnector("crm", "https://api.example.com", restTemplate);

        FieldMapping mapping = FieldMapping.of(Map.of(
                "ext_name", "name",
                "ext_email", "email"
        ));

        Map<String, Object> raw = Map.of("ext_name", "Alice", "ext_email", "alice@example.com", "extra", "ignored");
        ResponseEntity<Map[]> response = new ResponseEntity<>(new Map[]{raw}, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map[].class)))
                .thenReturn(response);

        List<Map<String, Object>> results = connector.pull(new Connector.PullRequest(
                "/contacts", Map.of("Authorization", "Bearer token"), Map.of(), mapping));

        assertEquals(1, results.size());
        assertEquals("Alice", results.get(0).get("name"));
        assertEquals("alice@example.com", results.get(0).get("email"));
    }

    @Test
    void shouldTransformPushDataWithFieldMapping() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RestConnector connector = new RestConnector("crm", "https://api.example.com", restTemplate);

        FieldMapping mapping = FieldMapping.of(Map.of(
                "name", "ext_name",
                "email", "ext_email"
        ));

        ResponseEntity<String> response = new ResponseEntity<>("OK", HttpStatus.CREATED);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(response);

        Connector.PushResult result = connector.push(new Connector.PushRequest(
                "/contacts", Map.of(), Map.of("name", "Bob", "email", "bob@example.com"), mapping));

        assertTrue(result.success());
        assertEquals(201, result.statusCode());
    }

    @Test
    void shouldReturnFalseOnConnectionTestFailure() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RestConnector connector = new RestConnector("fail", "https://invalid.example.com", restTemplate);

        when(restTemplate.getForEntity(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        assertFalse(connector.testConnection());
    }
}
```

- [ ] **Step 8.7: 跑测试**

```bash
./mvnw test -Dtest=RestConnectorTest
```

Expected: 3 个测试全通过

- [ ] **Step 8.8: 提交**

```bash
git add src/main/java/com/metaplatform/base/integration/ \
        src/test/java/com/metaplatform/base/integration/RestConnectorTest.java
git commit -m "feat(integration): add Connector abstraction with RestConnector and FieldMapping"
```

---

## Task 9: REST API — TenantController + RoleController

**Files:**
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/TenantController.java`
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/RoleController.java`
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/dto/CreateTenantRequest.java`
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/dto/CreateRoleRequest.java`
- Test: `src/test/java/com/metaplatform/base/interfaces/rest/TenantControllerTest.java`

- [ ] **Step 9.1: 写 DTO**

`CreateTenantRequest.java`：

```java
package com.metaplatform.base.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateTenantRequest(
    @NotBlank String name,
    @NotBlank String slug
) {}
```

`CreateRoleRequest.java`：

```java
package com.metaplatform.base.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CreateRoleRequest(
    @NotBlank String name,
    String description,
    List<PermissionSpec> permissions
) {
    public record PermissionSpec(
        @NotBlank String resource,
        @NotBlank String action
    ) {}
}
```

- [ ] **Step 9.2: 写 TenantController**

```java
package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.audit.Audited;
import com.metaplatform.base.interfaces.rest.dto.CreateTenantRequest;
import com.metaplatform.base.tenant.Tenant;
import com.metaplatform.base.tenant.TenantId;
import com.metaplatform.base.tenant.TenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @PostMapping
    @Audited(action = "CREATE", resourceType = "tenant", resourceIdSpEL = "#result[id]")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateTenantRequest request) {
        Tenant tenant = tenantService.create(request.name(), request.slug());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(tenant));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> findById(@PathVariable String id) {
        Tenant tenant = tenantService.findById(TenantId.of(id));
        return ResponseEntity.ok(toResponse(tenant));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> findAll() {
        List<Map<String, Object>> tenants = tenantService.findAll().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(tenants);
    }

    @PutMapping("/{id}/deactivate")
    @Audited(action = "DEACTIVATE", resourceType = "tenant", resourceIdSpEL = "#id")
    public ResponseEntity<Map<String, Object>> deactivate(@PathVariable String id) {
        Tenant tenant = tenantService.deactivate(TenantId.of(id));
        return ResponseEntity.ok(toResponse(tenant));
    }

    @PutMapping("/{id}/activate")
    @Audited(action = "ACTIVATE", resourceType = "tenant", resourceIdSpEL = "#id")
    public ResponseEntity<Map<String, Object>> activate(@PathVariable String id) {
        Tenant tenant = tenantService.activate(TenantId.of(id));
        return ResponseEntity.ok(toResponse(tenant));
    }

    private Map<String, Object> toResponse(Tenant t) {
        return Map.of(
                "id", t.id().toString(),
                "name", t.name(),
                "slug", t.slug(),
                "active", t.isActive(),
                "createdAt", t.createdAt().toString(),
                "updatedAt", t.updatedAt().toString()
        );
    }
}
```

- [ ] **Step 9.3: 写 RoleController**

```java
package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.audit.Audited;
import com.metaplatform.base.interfaces.rest.dto.CreateRoleRequest;
import com.metaplatform.base.rbac.*;
import com.metaplatform.base.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    public RoleController(RoleRepository roleRepository, UserRoleRepository userRoleRepository) {
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
    }

    @PostMapping
    @Audited(action = "CREATE", resourceType = "role", resourceIdSpEL = "#result[body][id]")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateRoleRequest request) {
        UUID tenantId = TenantContext.get().value();
        Role role = new Role(tenantId, request.name(), request.description(), false);

        if (request.permissions() != null) {
            for (CreateRoleRequest.PermissionSpec spec : request.permissions()) {
                role.addPermission(Permission.of(spec.resource(), spec.action()));
            }
        }

        Role saved = roleRepository.save(role);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listByTenant() {
        UUID tenantId = TenantContext.get().value();
        List<Map<String, Object>> roles = roleRepository.findByTenantId(tenantId).stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(roles);
    }

    @GetMapping("/{roleId}")
    public ResponseEntity<Map<String, Object>> findById(@PathVariable UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));
        return ResponseEntity.ok(toResponse(role));
    }

    @DeleteMapping("/{roleId}")
    @Audited(action = "DELETE", resourceType = "role", resourceIdSpEL = "#roleId")
    public ResponseEntity<Void> delete(@PathVariable UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));
        if (role.isSystemRole()) {
            throw new IllegalArgumentException("Cannot delete system role");
        }
        roleRepository.delete(role);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roleId}/users/{userId}")
    @Audited(action = "ASSIGN_ROLE", resourceType = "user-role", resourceIdSpEL = "#roleId")
    public ResponseEntity<Void> assignRole(@PathVariable UUID roleId, @PathVariable UUID userId) {
        UUID tenantId = TenantContext.get().value();
        UUID assignedBy = UUID.randomUUID(); // TODO: 从 SecurityContext 获取

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));

        UserRole userRole = new UserRole(tenantId, userId, role, assignedBy);
        userRoleRepository.save(userRole);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{roleId}/users/{userId}")
    @Audited(action = "REVOKE_ROLE", resourceType = "user-role", resourceIdSpEL = "#roleId")
    public ResponseEntity<Void> revokeRole(@PathVariable UUID roleId, @PathVariable UUID userId) {
        UUID tenantId = TenantContext.get().value();
        userRoleRepository.deleteByTenantIdAndUserIdAndRoleId(tenantId, userId, roleId);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toResponse(Role r) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId().toString());
        map.put("tenantId", r.getTenantId().toString());
        map.put("name", r.getName());
        map.put("description", r.getDescription());
        map.put("systemRole", r.isSystemRole());
        map.put("permissions", r.getPermissions().stream()
                .map(p -> Map.of("resource", p.resource(), "action", p.action()))
                .toList());
        return map;
    }
}
```

- [ ] **Step 9.4: 写 TenantController 测试**

`TenantControllerTest.java`：

```java
package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.config.TenantInterceptor;
import com.metaplatform.base.tenant.Tenant;
import com.metaplatform.base.tenant.TenantId;
import com.metaplatform.base.tenant.TenantService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TenantController.class)
class TenantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TenantService tenantService;

    @MockBean
    private TenantInterceptor tenantInterceptor;

    @Test
    void shouldCreateTenant() throws Exception {
        TenantId id = TenantId.newId();
        Tenant tenant = new Tenant(id, "Acme", "acme", true);
        when(tenantService.create("Acme", "acme")).thenReturn(tenant);

        mockMvc.perform(post("/api/v1/tenants")
                        .contentType("application/json")
                        .content("{\"name\":\"Acme\",\"slug\":\"acme\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme"))
                .andExpect(jsonPath("$.slug").value("acme"));
    }

    @Test
    void shouldListTenants() throws Exception {
        Tenant t1 = new Tenant(TenantId.newId(), "Acme", "acme", true);
        Tenant t2 = new Tenant(TenantId.newId(), "Beta", "beta", true);
        when(tenantService.findAll()).thenReturn(List.of(t1, t2));

        mockMvc.perform(get("/api/v1/tenants"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }
}
```

- [ ] **Step 9.5: 跑测试**

```bash
./mvnw test -Dtest=TenantControllerTest
```

Expected: 2 个测试全通过

- [ ] **Step 9.6: 提交**

```bash
git add src/main/java/com/metaplatform/base/interfaces/rest/ \
        src/test/java/com/metaplatform/base/interfaces/rest/TenantControllerTest.java
git commit -m "feat(api): add TenantController and RoleController REST APIs"
```

---

## Task 10: REST API — AuditController + IntegrationController

**Files:**
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/AuditController.java`
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/IntegrationController.java`
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/dto/AuditLogResponse.java`
- Create: `src/main/java/com/metaplatform/base/interfaces/rest/dto/ConnectorConfigRequest.java`

- [ ] **Step 10.1: 写 DTO**

`AuditLogResponse.java`：

```java
package com.metaplatform.base.interfaces.rest.dto;

import java.time.Instant;

public record AuditLogResponse(
    Long id,
    String tenantId,
    String userId,
    String action,
    String resourceType,
    String resourceId,
    String details,
    Instant timestamp,
    String ipAddress
) {}
```

`ConnectorConfigRequest.java`：

```java
package com.metaplatform.base.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record ConnectorConfigRequest(
    @NotBlank String id,
    @NotBlank String type,  // REST, GRPC, JDBC
    @NotBlank String baseUrl,
    Map<String, String> headers,
    Map<String, String> fieldMapping
) {}
```

- [ ] **Step 10.2: 写 AuditController**

```java
package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.audit.AuditLog;
import com.metaplatform.base.audit.AuditLogRepository;
import com.metaplatform.base.interfaces.rest.dto.AuditLogResponse;
import com.metaplatform.base.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

    private final AuditLogRepository auditLogRepository;

    public AuditController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    public ResponseEntity<Page<AuditLogResponse>> query(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UUID tenantId = TenantContext.get().value();
        PageRequest pageRequest = PageRequest.of(page, size);

        Page<AuditLog> result;
        if (userId != null) {
            result = auditLogRepository.findByTenantIdAndUserIdOrderByTimestampDesc(
                    tenantId, UUID.fromString(userId), pageRequest);
        } else if (resourceType != null && resourceId != null) {
            result = auditLogRepository.findByTenantIdAndResourceTypeAndResourceIdOrderByTimestampDesc(
                    tenantId, resourceType, resourceId, pageRequest);
        } else if (from != null && to != null) {
            result = auditLogRepository.findByTenantAndTimeRange(tenantId, from, to, pageRequest);
        } else if (action != null) {
            result = auditLogRepository.findByTenantAndAction(tenantId, action, pageRequest);
        } else {
            result = auditLogRepository.findByTenantAndTimeRange(
                    tenantId, Instant.now().minus(java.time.Duration.ofDays(7)), Instant.now(), pageRequest);
        }

        return ResponseEntity.ok(result.map(this::toResponse));
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getTenantId().toString(),
                log.getUserId().toString(),
                log.getAction(),
                log.getResourceType(),
                log.getResourceId(),
                log.getDetails(),
                log.getTimestamp(),
                log.getIpAddress()
        );
    }
}
```

- [ ] **Step 10.3: 写 IntegrationController**

```java
package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.integration.*;
import com.metaplatform.base.interfaces.rest.dto.ConnectorConfigRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/integrations")
public class IntegrationController {

    private final ConnectorRegistry registry;
    private final IntegrationService integrationService;

    public IntegrationController(ConnectorRegistry registry, IntegrationService integrationService) {
        this.registry = registry;
        this.integrationService = integrationService;
    }

    @PostMapping("/connectors")
    public ResponseEntity<Map<String, Object>> registerConnector(
            @Valid @RequestBody ConnectorConfigRequest request) {
        RestTemplate restTemplate = new RestTemplate();
        RestConnector connector = new RestConnector(request.id(), request.baseUrl(), restTemplate);
        registry.register(connector);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", connector.id(),
                "type", connector.type(),
                "baseUrl", request.baseUrl(),
                "status", "registered"
        ));
    }

    @GetMapping("/connectors")
    public ResponseEntity<List<Map<String, Object>>> listConnectors() {
        List<Map<String, Object>> connectors = integrationService.listConnectors().stream()
                .map(c -> Map.of(
                        "id", c.id(),
                        "type", c.type()
                ))
                .toList();
        return ResponseEntity.ok(connectors);
    }

    @PostMapping("/connectors/{id}/test")
    public ResponseEntity<Map<String, Object>> testConnector(@PathVariable String id) {
        boolean connected = integrationService.testConnector(id);
        return ResponseEntity.ok(Map.of(
                "connectorId", id,
                "connected", connected
        ));
    }

    @DeleteMapping("/connectors/{id}")
    public ResponseEntity<Void> unregisterConnector(@PathVariable String id) {
        registry.unregister(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 10.4: 提交**

```bash
git add src/main/java/com/metaplatform/base/interfaces/rest/AuditController.java \
        src/main/java/com/metaplatform/base/interfaces/rest/IntegrationController.java \
        src/main/java/com/metaplatform/base/interfaces/rest/dto/AuditLogResponse.java \
        src/main/java/com/metaplatform/base/interfaces/rest/dto/ConnectorConfigRequest.java
git commit -m "feat(api): add AuditController and IntegrationController"
```

---

## Task 11: Spring Boot 入口 + SecurityConfig + 应用配置

**Files:**
- Create: `src/main/java/com/metaplatform/base/PlatformBaseApplication.java`
- Create: `src/main/java/com/metaplatform/base/config/SecurityConfig.java`
- Create: `src/main/java/com/metaplatform/base/config/KafkaConfig.java`

- [ ] **Step 11.1: 写 Spring Boot 入口**

```java
package com.metaplatform.base;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories
public class PlatformBaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(PlatformBaseApplication.class, args);
    }
}
```

- [ ] **Step 11.2: 写 SecurityConfig（v0.1 简化版，不做完整 JWT）**

```java
package com.metaplatform.base.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * v0.1: 禁用 CSRF + Session，所有 /api/** 放行。
     * 后续版本接入 JWT/OAuth2。
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session
                    .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/api/**").permitAll()
                    .requestMatchers("/actuator/**").permitAll()
                    .anyRequest().authenticated())
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable);

        return http.build();
    }
}
```

- [ ] **Step 11.3: 写 KafkaConfig**

```java
package com.metaplatform.base.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Value("${platform.audit.topic:platform.audit.events}")
    private String auditTopic;

    @Bean
    public NewTopic auditTopic() {
        return TopicBuilder.name(auditTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
```

- [ ] **Step 11.4: 提交**

```bash
git add src/main/java/com/metaplatform/base/PlatformBaseApplication.java \
        src/main/java/com/metaplatform/base/config/SecurityConfig.java \
        src/main/java/com/metaplatform/base/config/KafkaConfig.java
git commit -m "chore: add Spring Boot entry point with SecurityConfig and KafkaConfig"
```

---

## Task 12: 端到端验证 — 构建、启动、手动测试

- [ ] **Step 12.1: 编译整个项目**

```bash
cd metaplatform-platform-base
./mvnw clean compile
```

Expected: BUILD SUCCESS

- [ ] **Step 12.2: 跑全部单元测试**

```bash
./mvnw test
```

Expected: 所有测试通过

- [ ] **Step 12.3: 启动基础设施**

```bash
docker-compose up -d
sleep 15
docker ps
```

Expected: 3 个容器运行

- [ ] **Step 12.4: 启动应用**

```bash
./mvnw spring-boot:run
```

Expected: 应用启动成功，Flyway 执行 3 个迁移

- [ ] **Step 12.5: 手动测试 — 创建租户**

```bash
curl -X POST http://localhost:8082/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "slug": "acme"}'
```

Expected: 201 Created

```json
{
  "id": "...",
  "name": "Acme Corp",
  "slug": "acme",
  "active": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

- [ ] **Step 12.6: 手动测试 — 创建角色**

```bash
curl -X POST http://localhost:8082/api/v1/roles \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "admin",
    "description": "Administrator",
    "permissions": [
      {"resource": "object-type", "action": "read"},
      {"resource": "object-type", "action": "write"},
      {"resource": "object-type", "action": "delete"}
    ]
  }'
```

Expected: 201 Created

- [ ] **Step 12.7: 手动测试 — 查询审计日志**

```bash
curl http://localhost:8082/api/v1/audit?X-Tenant-Id=<tenant-id>
```

Expected: 审计日志列表包含刚才的操作

- [ ] **Step 12.8: 打包**

```bash
./mvnw clean package -DskipTests
```

Expected: `target/metaplatform-platform-base-0.1.0-SNAPSHOT.jar` 生成

- [ ] **Step 12.9: Docker 打包**

创建 `Dockerfile`：

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
```

```bash
docker build -t metaplatform/platform-base:0.1.0 .
```

- [ ] **Step 12.10: 最终提交**

```bash
git add .
git commit -m "chore: add Dockerfile and finalize platform base v0.1"
```

---

## 验收标准

| # | 验收项 | 验证方法 |
|---|--------|----------|
| 1 | 多租户隔离：所有查询自动附加 tenant_id | 创建两个租户，各自数据互不可见 |
| 2 | RBAC：角色 + 权限 + Redis 缓存 | 创建角色、分配权限、检查缓存命中 |
| 3 | 审计日志：append-only PG + Kafka 事件 | 任意 CRUD 操作后查询审计日志 |
| 4 | 集成 Hub：REST 连接器 + 字段映射 | 注册外部连接器，执行 pull/push |
| 5 | 全部单元测试通过 | `./mvnw test` |
| 6 | 应用可启动 | `./mvnw spring-boot:run` |
| 7 | Docker 镜像可构建 | `docker build` |
