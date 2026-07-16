# 本体引擎 v0.1 实施计划（Spike 期）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 MetaPlatform Spike 期的本体引擎 v0.1 —— 单一真源、事件总线、版本管理，能让业务对象的所有"语义"在 Neo4j 图上持久化并通过事件总线广播变更。

**Architecture:** 单租户 · Java 21 + Spring Boot 3 · Neo4j 5 + PostgreSQL 16 双写（图为主，PG 为元数据/审计真源）· Kafka 事件总线 · Maven 多模块。

**Tech Stack:**
- 后端：Java 21+、Spring Boot 3.2+、Maven
- 图数据库：Neo4j 5.x（社区版可起步）
- 关系数据库：PostgreSQL 16+（元数据 + 审计 + 版本快照）
- 事件总线：Apache Kafka 3.6+（也支持 NATS，二选一）
- 测试：JUnit 5、Testcontainers（Neo4j/PG/Kafka 一键起）
- 容器化：Docker + docker-compose
- 代码规范：Conventional Commits、Checkstyle、Google Java Style

**对应 spec：** §5.2.2 L2-2 本体引擎 + 知识图谱
**对应决策：** D3（P3 半自动双向同步）、D7（图谱 = 本体运行时形态）、D12（团队 A 并行）
**对应阶段：** 第 1 期 · Spike（T-1 ~ T0）

---

## 文件结构

```
metaplatform-ontology-engine/
├── pom.xml                                    # 父 POM
├── docker-compose.yml                         # 一键起 Neo4j/PG/Kafka
├── README.md                                  # 启动文档
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/ontology/
│   │   │   ├── OntologyEngineApplication.java        # Spring Boot 入口
│   │   │   ├── config/
│   │   │   │   ├── Neo4jConfig.java                  # Neo4j 驱动配置
│   │   │   │   ├── KafkaConfig.java                  # 事件总线配置
│   │   │   │   └── DataSourceConfig.java             # PG 数据源
│   │   │   ├── domain/
│   │   │   │   ├── EntityType.java                   # 实体类型聚合根
│   │   │   │   ├── EntityTypeId.java                 # 强类型 ID
│   │   │   │   ├── Property.java                     # 属性值对象
│   │   │   │   ├── PropertyType.java                 # 属性类型枚举
│   │   │   │   ├── RelationType.java                 # 关系类型
│   │   │   │   ├── Cardinality.java                  # 1:1/1:N/N:M
│   │   │   │   ├── Direction.java                    # OUT/IN/BOTH
│   │   │   │   ├── EntityInstance.java               # 实体实例
│   │   │   │   ├── EntityInstanceId.java
│   │   │   │   ├── OntologyVersion.java              # 版本快照
│   │   │   │   └── event/
│   │   │   │       ├── OntologyEvent.java            # 事件基类
│   │   │   │       ├── EntityTypeCreated.java
│   │   │   │       ├── EntityTypeUpdated.java
│   │   │   │       ├── EntityTypeDeleted.java
│   │   │   │       ├── PropertyAdded.java
│   │   │   │       ├── RelationAdded.java
│   │   │   │       ├── EntityInstanceCreated.java
│   │   │   │       └── EntityInstanceUpdated.java
│   │   │   ├── application/
│   │   │   │   ├── EntityTypeService.java            # 用例编排
│   │   │   │   ├── EntityInstanceService.java
│   │   │   │   ├── OntologyQueryService.java
│   │   │   │   └── VersioningService.java
│   │   │   ├── infrastructure/
│   │   │   │   ├── neo4j/
│   │   │   │   │   ├── EntityTypeNeo4jRepository.java
│   │   │   │   │   ├── EntityInstanceNeo4jRepository.java
│   │   │   │   │   └── Neo4jTransactionManager.java
│   │   │   │   ├── postgres/
│   │   │   │   │   ├── EntityTypeMetadataRepository.java
│   │   │   │   │   ├── OntologyVersionRepository.java
│   │   │   │   │   └── AuditLogRepository.java
│   │   │   │   └── kafka/
│   │   │   │       ├── KafkaEventPublisher.java
│   │   │   │       └── EventTopicConfig.java
│   │   │   └── interfaces/
│   │   │       └── rest/
│   │   │           ├── EntityTypeController.java
│   │   │           ├── EntityInstanceController.java
│   │   │           └── dto/
│   │   │               ├── CreateEntityTypeRequest.java
│   │   │               ├── EntityTypeResponse.java
│   │   │               └── CreateEntityInstanceRequest.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   │           └── V1__init_ontology_metadata.sql
│   └── test/
│       └── java/com/metaplatform/ontology/
│           ├── domain/
│           │   ├── EntityTypeTest.java
│           │   ├── PropertyTest.java
│           │   └── RelationTypeTest.java
│           ├── application/
│           │   ├── EntityTypeServiceTest.java
│           │   ├── EntityInstanceServiceTest.java
│           │   └── VersioningServiceTest.java
│           └── integration/
│               ├── EntityTypeIntegrationTest.java
│               ├── EventPublishingIntegrationTest.java
│               └── VersioningIntegrationTest.java
└── docs/
    └── api/
        └── openapi.yaml                       # REST API 契约
```

---

## Task 1: 仓库初始化

**Files:**
- Create: `metaplatform-ontology-engine/pom.xml`
- Create: `metaplatform-ontology-engine/README.md`
- Create: `metaplatform-ontology-engine/.gitignore`
- Create: `metaplatform-ontology-engine/docker-compose.yml`

- [ ] **Step 1.1: 初始化 Git 仓库**

```bash
cd metaplatform-ontology-engine
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
    <artifactId>metaplatform-ontology-engine</artifactId>
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
        <neo4j.version>5.18.0</neo4j.version>
        <testcontainers.version>1.19.7</testcontainers.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-neo4j</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-jdbc</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.kafka</groupId>
            <artifactId>spring-kafka</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
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
            <artifactId>neo4j</artifactId>
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

- [ ] **Step 1.3: 写 docker-compose**

`docker-compose.yml`：

```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.18-community
    container_name: mp-neo4j
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/metaplatform
      NEO4J_PLUGINS: '[]'
    volumes:
      - neo4j-data:/data

  postgres:
    image: postgres:16
    container_name: mp-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ontology_meta
      POSTGRES_USER: meta
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-data:/var/lib/postgresql/data

  kafka:
    image: apache/kafka:3.6.1
    container_name: mp-kafka
    ports:
      - "9092:9092"
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
  neo4j-data:
  pg-data:
```

- [ ] **Step 1.4: 写 README 和 .gitignore**

`README.md`：

```markdown
# MetaPlatform 本体引擎 v0.1

Spike 期交付物。详细 plan 见 `docs/superpowers/plans/2026-07-02-ontology-engine-v0.1.md`。

## 启动

```bash
docker-compose up -d
./mvnw spring-boot:run
```

## 端口

- Neo4j Browser: http://localhost:7474
- PostgreSQL: localhost:5432
- Kafka: localhost:9092
- 本服务: localhost:8080
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

- [ ] **Step 1.5: 启动基础设施并验证**

```bash
docker-compose up -d
docker ps
```

Expected: 看到 3 个容器运行（neo4j/postgres/kafka）

- [ ] **Step 1.6: 提交**

```bash
git add .
git commit -m "chore: initialize ontology engine module with maven, docker-compose"
```

---

## Task 2: 领域模型 — Property（值对象）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/domain/PropertyType.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/Property.java`
- Test: `src/test/java/com/metaplatform/ontology/domain/PropertyTest.java`

- [ ] **Step 2.1: 写 PropertyType 枚举**

```java
package com.metaplatform.ontology.domain;

public enum PropertyType {
    STRING,
    INTEGER,
    LONG,
    DOUBLE,
    BOOLEAN,
    DATE,
    DATETIME,
    UUID,
    JSON,
    ENUM,
    REFERENCE
}
```

- [ ] **Step 2.2: 写 Property 值对象（先写测试）**

`PropertyTest.java`：

```java
package com.metaplatform.ontology.domain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PropertyTest {

    @Test
    void shouldCreateStringProperty() {
        Property p = new Property("name", PropertyType.STRING, "Alice");
        assertEquals("name", p.name());
        assertEquals(PropertyType.STRING, p.type());
        assertEquals("Alice", p.value());
        assertFalse(p.isRequired());
    }

    @Test
    void shouldRejectNullName() {
        assertThrows(IllegalArgumentException.class,
            () -> new Property(null, PropertyType.STRING, "x"));
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new Property("  ", PropertyType.STRING, "x"));
    }

    @Test
    void shouldRejectNullType() {
        assertThrows(IllegalArgumentException.class,
            () -> new Property("x", null, "v"));
    }

    @Test
    void shouldAcceptNullValueIfNotRequired() {
        Property p = new Property("description", PropertyType.STRING, null);
        assertNull(p.value());
    }

    @Test
    void shouldRejectNullValueIfRequired() {
        assertThrows(IllegalArgumentException.class,
            () -> new Property("name", PropertyType.STRING, null, true));
    }

    @Test
    void shouldValidateIntegerType() {
        assertThrows(IllegalArgumentException.class,
            () -> new Property("age", PropertyType.INTEGER, "not-a-number"));
    }

    @Test
    void shouldAcceptValidInteger() {
        Property p = new Property("age", PropertyType.INTEGER, 42);
        assertEquals(42, p.value());
    }
}
```

- [ ] **Step 2.3: 运行测试 — 确认失败**

```bash
./mvnw test -Dtest=PropertyTest
```

Expected: 编译失败（Property 类不存在）

- [ ] **Step 2.4: 写 Property 值对象**

```java
package com.metaplatform.ontology.domain;

import java.util.Objects;

public record Property(
    String name,
    PropertyType type,
    Object value
) {
    public Property {
        Objects.requireNonNull(name, "name");
        if (name.isBlank()) throw new IllegalArgumentException("name must not be blank");
        Objects.requireNonNull(type, "type");
    }

    public Property(String name, PropertyType type, Object value, boolean required) {
        this(name, type, value);
        if (required && value == null) {
            throw new IllegalArgumentException("required property '" + name + "' cannot be null");
        }
        validateType(name, type, value);
    }

    public boolean isRequired() {
        return false; // 简化：v0.1 不持久化 required 到 record 字段
    }

    private static void validateType(String name, PropertyType type, Object value) {
        if (value == null) return;
        switch (type) {
            case INTEGER -> {
                if (!(value instanceof Integer)) throw new IllegalArgumentException(
                    "property '" + name + "' must be Integer, got " + value.getClass().getSimpleName());
            }
            case LONG -> {
                if (!(value instanceof Long)) throw new IllegalArgumentException(
                    "property '" + name + "' must be Long, got " + value.getClass().getSimpleName());
            }
            case DOUBLE -> {
                if (!(value instanceof Double)) throw new IllegalArgumentException(
                    "property '" + name + "' must be Double, got " + value.getClass().getSimpleName());
            }
            case BOOLEAN -> {
                if (!(value instanceof Boolean)) throw new IllegalArgumentException(
                    "property '" + name + "' must be Boolean, got " + value.getClass().getSimpleName());
            }
            case STRING, ENUM -> {
                if (!(value instanceof String)) throw new IllegalArgumentException(
                    "property '" + name + "' must be String, got " + value.getClass().getSimpleName());
            }
            default -> { /* DATE/DATETIME/UUID/JSON/REFERENCE 的校验留给业务层 */ }
        }
    }
}
```

- [ ] **Step 2.5: 跑测试 — 确认通过**

```bash
./mvnw test -Dtest=PropertyTest
```

Expected: 8 个测试全通过

- [ ] **Step 2.6: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/domain/PropertyType.java \
        src/main/java/com/metaplatform/ontology/domain/Property.java \
        src/test/java/com/metaplatform/ontology/domain/PropertyTest.java
git commit -m "feat(domain): add Property value object with type validation"
```

---

## Task 3: 领域模型 — RelationType（值对象）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/domain/Cardinality.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/Direction.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/RelationType.java`
- Test: `src/test/java/com/metaplatform/ontology/domain/RelationTypeTest.java`

- [ ] **Step 3.1: 写 Cardinality 枚举**

```java
package com.metaplatform.ontology.domain;

public enum Cardinality {
    ONE_TO_ONE,
    ONE_TO_MANY,
    MANY_TO_MANY
}
```

- [ ] **Step 3.2: 写 Direction 枚举**

```java
package com.metaplatform.ontology.domain;

public enum Direction {
    OUTGOING,
    INCOMING,
    BOTH
}
```

- [ ] **Step 3.3: 写 RelationType 测试**

`RelationTypeTest.java`：

```java
package com.metaplatform.ontology.domain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RelationTypeTest {

    @Test
    void shouldCreateRelationType() {
        RelationType r = new RelationType(
            "worksFor",
            "Customer",
            "Company",
            Cardinality.MANY_TO_ONE,
            Direction.OUTGOING
        );
        assertEquals("worksFor", r.name());
        assertEquals("Customer", r.sourceEntityTypeName());
        assertEquals("Company", r.targetEntityTypeName());
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new RelationType("", "A", "B", Cardinality.ONE_TO_ONE, Direction.OUTGOING));
    }

    @Test
    void shouldRejectNullSource() {
        assertThrows(IllegalArgumentException.class,
            () -> new RelationType("r", null, "B", Cardinality.ONE_TO_ONE, Direction.OUTGOING));
    }

    @Test
    void shouldRejectNullTarget() {
        assertThrows(IllegalArgumentException.class,
            () -> new RelationType("r", "A", null, Cardinality.ONE_TO_ONE, Direction.OUTGOING));
    }
}
```

- [ ] **Step 3.4: 跑测试 — 失败**

```bash
./mvnw test -Dtest=RelationTypeTest
```

Expected: 编译失败

- [ ] **Step 3.5: 写 RelationType**

```java
package com.metaplatform.ontology.domain;

public record RelationType(
    String name,
    String sourceEntityTypeName,
    String targetEntityTypeName,
    Cardinality cardinality,
    Direction direction
) {
    public RelationType {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("relation name must not be blank");
        }
        if (sourceEntityTypeName == null || sourceEntityTypeName.isBlank()) {
            throw new IllegalArgumentException("sourceEntityTypeName must not be blank");
        }
        if (targetEntityTypeName == null || targetEntityTypeName.isBlank()) {
            throw new IllegalArgumentException("targetEntityTypeName must not be blank");
        }
        if (cardinality == null) {
            throw new IllegalArgumentException("cardinality must not be null");
        }
        if (direction == null) {
            throw new IllegalArgumentException("direction must not be null");
        }
    }
}
```

- [ ] **Step 3.6: 跑测试 — 通过**

```bash
./mvnw test -Dtest=RelationTypeTest
```

Expected: 4 个测试全通过

- [ ] **Step 3.7: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/domain/Cardinality.java \
        src/main/java/com/metaplatform/ontology/domain/Direction.java \
        src/main/java/com/metaplatform/ontology/domain/RelationType.java \
        src/test/java/com/metaplatform/ontology/domain/RelationTypeTest.java
git commit -m "feat(domain): add RelationType value object"
```

---

## Task 4: 领域模型 — EntityType（聚合根）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/domain/EntityTypeId.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/EntityType.java`
- Test: `src/test/java/com/metaplatform/ontology/domain/EntityTypeTest.java`

- [ ] **Step 4.1: 写 EntityTypeId 强类型 ID**

```java
package com.metaplatform.ontology.domain;

import java.util.Objects;
import java.util.UUID;

public record EntityTypeId(UUID value) {
    public EntityTypeId {
        Objects.requireNonNull(value, "EntityTypeId value must not be null");
    }
    public static EntityTypeId newId() {
        return new EntityTypeId(UUID.randomUUID());
    }
    public static EntityTypeId of(String s) {
        return new EntityTypeId(UUID.fromString(s));
    }
}
```

- [ ] **Step 4.2: 写 EntityType 测试**

`EntityTypeTest.java`：

```java
package com.metaplatform.ontology.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class EntityTypeTest {

    @Test
    void shouldCreateEntityType() {
        EntityType customer = new EntityType(
            EntityTypeId.newId(),
            "Customer",
            List.of(
                new Property("name", PropertyType.STRING, null, true),
                new Property("email", PropertyType.STRING, null, false)
            ),
            List.of()
        );
        assertEquals("Customer", customer.name());
        assertEquals(2, customer.properties().size());
        assertTrue(customer.findProperty("name").isPresent());
        assertTrue(customer.findProperty("phone").isEmpty());
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new EntityType(EntityTypeId.newId(), "", List.of(), List.of()));
    }

    @Test
    void shouldRejectDuplicateProperty() {
        List<Property> props = List.of(
            new Property("name", PropertyType.STRING, null, true),
            new Property("name", PropertyType.STRING, null, true)
        );
        assertThrows(IllegalArgumentException.class,
            () -> new EntityType(EntityTypeId.newId(), "Customer", props, List.of()));
    }

    @Test
    void shouldAddProperty() {
        EntityType customer = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        EntityType updated = customer.addProperty(
            new Property("email", PropertyType.STRING, null, false)
        );
        assertEquals(2, updated.properties().size());
        assertEquals(1, customer.properties().size()); // 不变性
    }

    @Test
    void shouldRejectAddingDuplicateProperty() {
        EntityType customer = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        assertThrows(IllegalArgumentException.class,
            () -> customer.addProperty(new Property("name", PropertyType.STRING, null, true)));
    }

    @Test
    void shouldAddRelation() {
        EntityType customer = new EntityType(
            EntityTypeId.newId(), "Customer", List.of(), List.of()
        );
        EntityType company = new EntityType(
            EntityTypeId.newId(), "Company", List.of(), List.of()
        );
        RelationType r = new RelationType(
            "worksFor", "Customer", "Company",
            Cardinality.MANY_TO_ONE, Direction.OUTGOING
        );
        EntityType updated = customer.addRelation(r);
        assertEquals(1, updated.relations().size());
    }
}
```

- [ ] **Step 4.3: 跑测试 — 失败**

```bash
./mvnw test -Dtest=EntityTypeTest
```

Expected: 编译失败

- [ ] **Step 4.4: 写 EntityType 聚合根**

```java
package com.metaplatform.ontology.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public record EntityType(
    EntityTypeId id,
    String name,
    List<Property> properties,
    List<RelationType> relations
) {
    public EntityType {
        Objects.requireNonNull(id, "id");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("EntityType name must not be blank");
        }
        Objects.requireNonNull(properties, "properties");
        Objects.requireNonNull(relations, "relations");
        // 不可变拷贝 + 重复检测
        properties = List.copyOf(properties);
        relations = List.copyOf(relations);
        var seen = new java.util.HashSet<String>();
        for (Property p : properties) {
            if (!seen.add(p.name())) {
                throw new IllegalArgumentException("duplicate property: " + p.name());
            }
        }
    }

    public Optional<Property> findProperty(String name) {
        return properties.stream().filter(p -> p.name().equals(name)).findFirst();
    }

    public EntityType addProperty(Property property) {
        if (findProperty(property.name()).isPresent()) {
            throw new IllegalArgumentException("property already exists: " + property.name());
        }
        var newProps = new ArrayList<>(properties);
        newProps.add(property);
        return new EntityType(id, name, newProps, relations);
    }

    public EntityType addRelation(RelationType relation) {
        var newRelations = new ArrayList<>(relations);
        newRelations.add(relation);
        return new EntityType(id, name, properties, newRelations);
    }
}
```

- [ ] **Step 4.5: 跑测试 — 通过**

```bash
./mvnw test -Dtest=EntityTypeTest
```

Expected: 6 个测试全通过

- [ ] **Step 4.6: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/domain/EntityTypeId.java \
        src/main/java/com/metaplatform/ontology/domain/EntityType.java \
        src/test/java/com/metaplatform/ontology/domain/EntityTypeTest.java
git commit -m "feat(domain): add EntityType aggregate root with immutable operations"
```

---

## Task 5: 事件基类 + 具体事件

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/domain/event/OntologyEvent.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/EntityTypeCreated.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/EntityTypeUpdated.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/EntityTypeDeleted.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/PropertyAdded.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/RelationAdded.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/EntityInstanceCreated.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/event/EntityInstanceUpdated.java`
- Test: `src/test/java/com/metaplatform/ontology/domain/event/OntologyEventTest.java`

- [ ] **Step 5.1: 写事件基类（sealed interface）**

```java
package com.metaplatform.ontology.domain.event;

import java.time.Instant;
import java.util.UUID;

public sealed interface OntologyEvent
    permits EntityTypeCreated, EntityTypeUpdated, EntityTypeDeleted,
            PropertyAdded, RelationAdded,
            EntityInstanceCreated, EntityInstanceUpdated {

    UUID eventId();
    Instant occurredAt();
    String tenantId();
    String actorId();
}
```

- [ ] **Step 5.2: 写 7 个具体事件**

```java
// EntityTypeCreated.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityType;
import java.time.Instant;
import java.util.UUID;

public record EntityTypeCreated(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityType entityType
) implements OntologyEvent {}
```

```java
// EntityTypeUpdated.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityType;
import java.time.Instant;
import java.util.UUID;

public record EntityTypeUpdated(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityType entityType, int version
) implements OntologyEvent {}
```

```java
// EntityTypeDeleted.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityTypeId;
import java.time.Instant;
import java.util.UUID;

public record EntityTypeDeleted(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityTypeId entityTypeId
) implements OntologyEvent {}
```

```java
// PropertyAdded.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.Property;
import java.time.Instant;
import java.util.UUID;

public record PropertyAdded(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityTypeId entityTypeId, Property property
) implements OntologyEvent {}
```

```java
// RelationAdded.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.RelationType;
import java.time.Instant;
import java.util.UUID;

public record RelationAdded(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityTypeId entityTypeId, RelationType relation
) implements OntologyEvent {}
```

```java
// EntityInstanceCreated.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.EntityInstance;
import java.time.Instant;
import java.util.UUID;

public record EntityInstanceCreated(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityTypeId entityTypeId, EntityInstance instance
) implements OntologyEvent {}
```

```java
// EntityInstanceUpdated.java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.EntityInstance;
import java.time.Instant;
import java.util.UUID;

public record EntityInstanceUpdated(
    UUID eventId, Instant occurredAt, String tenantId, String actorId,
    EntityTypeId entityTypeId, EntityInstance instance
) implements OntologyEvent {}
```

- [ ] **Step 5.3: 写事件基类的 sanity 测试**

`OntologyEventTest.java`：

```java
package com.metaplatform.ontology.domain.event;

import com.metaplatform.ontology.domain.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class OntologyEventTest {

    @Test
    void shouldCreateEntityTypeCreated() {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        var event = new EntityTypeCreated(
            UUID.randomUUID(), Instant.now(), "tenant-1", "user-1", et
        );
        assertEquals("Customer", event.entityType().name());
        assertEquals("tenant-1", event.tenantId());
    }
}
```

- [ ] **Step 5.4: 跑测试 — 通过**

```bash
./mvnw test -Dtest=OntologyEventTest
```

Expected: 1 个测试通过

- [ ] **Step 5.5: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/domain/event/
git commit -m "feat(domain): add 7 ontology events with sealed interface"
```

---

## 🆕 Task 5.1（v1.2 必加）：Outbox 模式（保证事件至少一次）

> **为什么必加**：v0.1 原设计是"业务事务先提交，Kafka 事件后发"。**问题**：如果 Kafka 发送失败（broker 不可用 / 网络抖动），业务事务已提交但事件丢失 → 数据栈永远收不到这条变更。
>
> **Outbox 模式**：业务事务和事件写入用**同一 PG 事务**；后台 worker 异步读 outbox 表 + 发 Kafka；保证至少一次。

**Files:**
- Create: `src/main/resources/db/migration/V2__add_outbox.sql`
- Create: `src/main/java/com/metaplatform/ontology/infrastructure/postgres/OutboxRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/infrastructure/outbox/OutboxPublisher.java`
- Test: `src/test/java/com/metaplatform/ontology/infrastructure/outbox/OutboxPublisherIT.java`

- [ ] **Step 5.1.1: 写 V2 迁移（outbox 表）**

`V2__add_outbox.sql`：

```sql
CREATE TABLE outbox_event (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    tenant_id VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    publish_attempts INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON outbox_event (next_retry_at)
    WHERE published_at IS NULL;
```

- [ ] **Step 5.1.2: 写 OutboxRepository**

```java
package com.metaplatform.ontology.infrastructure.postgres;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ontology.domain.event.OntologyEvent;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class OutboxRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public OutboxRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    /**
     * 在同一个事务中调用，把事件写入 outbox 表（不直接发 Kafka）
     */
    public void enqueue(OntologyEvent event, String topic, String aggregateType) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            jdbc.update("""
                INSERT INTO outbox_event
                  (event_id, tenant_id, topic, aggregate_type, aggregate_id, payload)
                VALUES (?, ?, ?, ?, ?, ?::jsonb)
                """,
                UUID.fromString(event.eventId().toString()),
                event.tenantId(),
                topic,
                aggregateType,
                event.eventId().toString(),
                payload
            );
        } catch (Exception e) {
            throw new RuntimeException("failed to enqueue event: " + event, e);
        }
    }

    /**
     * 后台 worker 用：拉一批未发送的事件
     */
    public List<OutboxRow> fetchUnpublished(int batchSize) {
        return jdbc.query("""
            SELECT id, event_id, tenant_id, topic, payload, publish_attempts
            FROM outbox_event
            WHERE published_at IS NULL AND next_retry_at <= NOW()
            ORDER BY id
            LIMIT ?
            FOR UPDATE SKIP LOCKED
            """,
            (rs, rowNum) -> new OutboxRow(
                rs.getLong("id"),
                UUID.fromString(rs.getString("event_id")),
                rs.getString("tenant_id"),
                rs.getString("topic"),
                rs.getString("payload"),
                rs.getInt("publish_attempts")
            ),
            batchSize
        );
    }

    public void markPublished(Long id) {
        jdbc.update("""
            UPDATE outbox_event SET published_at = NOW() WHERE id = ?
            """, id);
    }

    public void markFailed(Long id, int attempts) {
        // 指数退避：1s, 2s, 4s, 8s, ..., 最大 5 min
        int delaySeconds = Math.min(300, (int) Math.pow(2, attempts));
        jdbc.update("""
            UPDATE outbox_event
            SET publish_attempts = ?,
                next_retry_at = NOW() + (? || ' seconds')::interval
            WHERE id = ?
            """, attempts, delaySeconds, id);
    }

    public record OutboxRow(Long id, UUID eventId, String tenantId,
                            String topic, String payload, int publishAttempts) {}
}
```

- [ ] **Step 5.1.3: 写 OutboxPublisher（后台 worker）**

```java
package com.metaplatform.ontology.infrastructure.outbox;

import com.metaplatform.ontology.infrastructure.postgres.OutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final int BATCH_SIZE = 100;
    private static final int MAX_ATTEMPTS = 10;

    private final OutboxRepository outboxRepo;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public OutboxPublisher(OutboxRepository outboxRepo, KafkaTemplate<String, String> kafkaTemplate) {
        this.outboxRepo = outboxRepo;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * 每 1 秒扫一次 outbox 表
     */
    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.SECONDS)
    public void publishBatch() {
        List<OutboxRepository.OutboxRow> rows = outboxRepo.fetchUnpublished(BATCH_SIZE);
        for (var row : rows) {
            try {
                kafkaTemplate.send(row.topic(), row.tenantId(), row.payload()).get(5, TimeUnit.SECONDS);
                outboxRepo.markPublished(row.id());
            } catch (Exception e) {
                int nextAttempts = row.publishAttempts() + 1;
                if (nextAttempts > MAX_ATTEMPTS) {
                    log.error("outbox event {} exceeded max attempts, giving up", row.eventId());
                    // 仍 markPublished 以免无限重试；下游有死信队列兜底
                    outboxRepo.markPublished(row.id());
                } else {
                    log.warn("outbox event {} publish failed (attempt {}): {}",
                        row.eventId(), nextAttempts, e.getMessage());
                    outboxRepo.markFailed(row.id(), nextAttempts);
                }
            }
        }
    }
}
```

- [ ] **Step 5.1.4: 改 EntityTypeService —— 把 Kafka publish 改为 outbox.enqueue**

修改 [Step 8.3 写的 EntityTypeService](Task 8)，把：

```java
publisher.publish(new EntityTypeCreated(...));
```

改为：

```java
// publisher.publish(new EntityTypeCreated(...));  // 旧写法
outbox.enqueue(new EntityTypeCreated(...), EventTopicConfig.ENTITY_TYPE_EVENTS, "EntityType");
```

注意：EntityTypeService 现在依赖 OutboxRepository 而不是 OntologyEventPublisher（Kafka 实现）。把 outbox.enqueue 包在 `@Transactional` 方法内，与 PG 写入同一事务。

- [ ] **Step 5.1.5: 加 @EnableScheduling + @Transactional**

在 `OntologyEngineApplication.java` 加 `@EnableScheduling`。

在 OutboxPublisher 的 `publishBatch` 上加 `@Transactional`（每个批次是一个事务）。

- [ ] **Step 5.1.6: 写集成测试（用 Testcontainers PG + Kafka）**

`OutboxPublisherIT.java`：

```java
package com.metaplatform.ontology.infrastructure.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.Property;
import com.metaplatform.ontology.domain.PropertyType;
import com.metaplatform.ontology.domain.event.EntityTypeCreated;
import com.metaplatform.ontology.domain.event.OntologyEvent;
import com.metaplatform.ontology.infrastructure.postgres.OutboxRepository;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class OutboxPublisherIT {

    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("ontology_meta").withUsername("test").withPassword("test");

    @Container
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("apache/kafka:3.6.1"));

    static OutboxRepository outboxRepo;
    static OutboxPublisher publisher;
    static KafkaConsumer<String, String> consumer;
    static final String TOPIC = "metaplatform.ontology.entity-type";

    @BeforeAll
    static void setup() throws Exception {
        pg.start();
        kafka.start();

        DataSource ds = new DriverManagerDataSource(
            pg.getJdbcUrl(), pg.getUsername(), pg.getPassword()
        );
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        jdbc.execute("""
            CREATE TABLE outbox_event (
                id BIGSERIAL PRIMARY KEY,
                event_id UUID NOT NULL UNIQUE,
                tenant_id VARCHAR(64) NOT NULL,
                topic VARCHAR(128) NOT NULL,
                aggregate_type VARCHAR(64) NOT NULL,
                aggregate_id VARCHAR(64) NOT NULL,
                payload JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                published_at TIMESTAMPTZ,
                publish_attempts INT NOT NULL DEFAULT 0,
                next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )""");

        Map<String, Object> producerProps = Map.of(
            "bootstrap.servers", kafka.getBootstrapServers(),
            "key.serializer", "org.apache.kafka.common.serialization.StringSerializer",
            "value.serializer", "org.apache.kafka.common.serialization.StringSerializer"
        );
        ProducerFactory<String, String> pf = new DefaultKafkaProducerFactory<>(producerProps);
        KafkaTemplate<String, String> template = new KafkaTemplate<>(pf);

        outboxRepo = new OutboxRepository(jdbc, new ObjectMapper());
        publisher = new OutboxPublisher(outboxRepo, template);

        Map<String, Object> consumerProps = Map.of(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, kafka.getBootstrapServers(),
            ConsumerConfig.GROUP_ID_CONFIG, "test-" + UUID.randomUUID(),
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class
        );
        consumer = new KafkaConsumer<>(consumerProps);
        consumer.subscribe(List.of(TOPIC));
    }

    @Test
    void shouldEnqueueAndPublishToKafka() throws Exception {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        OntologyEvent event = new EntityTypeCreated(
            UUID.randomUUID(), Instant.now(), "tenant-1", "user-1", et
        );
        outboxRepo.enqueue(event, TOPIC, "EntityType");

        // 触发 worker
        publisher.publishBatch();

        // 验证 Kafka 收到
        ConsumerRecord<String, String> record = pollOne();
        assertNotNull(record);
        assertEquals("tenant-1", record.key());
        assertTrue(record.value().contains("Customer"));
    }

    @Test
    void shouldNotDoublePublish() throws Exception {
        // 同一个 event_id 重复 enqueue 应该被 UNIQUE 约束拒绝
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Order",
            List.of(), List.of()
        );
        UUID eventId = UUID.randomUUID();
        OntologyEvent event = new EntityTypeCreated(
            eventId, Instant.now(), "tenant-1", "user-1", et
        );
        outboxRepo.enqueue(event, TOPIC, "EntityType");

        // 第二次 enqueue 同一个 event_id 应该抛异常
        assertThrows(Exception.class, () -> outboxRepo.enqueue(event, TOPIC, "EntityType"));
    }

    private ConsumerRecord<String, String> pollOne() {
        for (int i = 0; i < 20; i++) {
            var records = consumer.poll(Duration.ofMillis(500));
            if (!records.isEmpty()) return records.iterator().next();
        }
        return null;
    }
}
```

- [ ] **Step 5.1.7: 跑测试**

```bash
./mvnw test -Dtest=OutboxPublisherIT
```

Expected: 2 个测试全过

- [ ] **Step 5.1.8: 跑回归 —— 之前的 EntityTypeService 测试是否还通过**

```bash
./mvnw test
```

Expected: 之前所有测试 + 新的 Outbox 测试全过；EntityTypeService 的 verify(publisher) 改为 verify(outboxRepo)

- [ ] **Step 5.1.9: 提交**

```bash
git add .
git commit -m "feat(outbox): add outbox pattern for at-least-once event delivery"
```

---

## 🆕 Task 5.2（v1.2 必加）：trace_id 全链路串联

> **为什么必加**：v0.1 原设计没有 trace_id。当数据栈的 instance 写入失败时，**无法回溯到本体引擎的哪条业务对象创建请求**。trace_id 串联是排查问题的前提。

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/TraceIdFilter.java`
- Modify: `src/main/java/com/metaplatform/ontology/domain/event/OntologyEvent.java`（已经有 traceId 字段则跳过）
- Test: `src/test/java/com/metaplatform/ontology/interfaces/rest/TraceIdFilterTest.java`

- [ ] **Step 5.2.1: 写 TraceIdFilter（Servlet Filter）**

```java
package com.metaplatform.ontology.interfaces.rest;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(1)
public class TraceIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Trace-Id";
    public static final String MDC_KEY = "traceId";

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                     HttpServletResponse resp,
                                     FilterChain chain) throws ServletException, IOException {
        String traceId = req.getHeader(HEADER);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }
        MDC.put(MDC_KEY, traceId);
        resp.setHeader(HEADER, traceId);
        try {
            chain.doFilter(req, resp);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
```

- [ ] **Step 5.2.2: 让 EntityTypeService 把 traceId 写入事件**

修改 [Step 8.3 写的 EntityTypeService](Task 8)，在每个 `new EntityTypeCreated(...)` / `new PropertyAdded(...)` / `...` 事件中：

- 字段 `traceId`（String） 加到事件 record（如果 spec 没要求，可在 v0.2 补）
- 或者从 `MDC.get("traceId")` 读出，set 进事件的 traceId 字段

最简方案：在所有事件 record 中加一个 `String traceId` 字段，并在 EntityTypeService 中从 MDC 读出填入。

- [ ] **Step 5.2.3: 让日志自动带 traceId**

修改 `application.yml`：

```yaml
logging:
  pattern:
    level: "%5p [traceId=%X{traceId}]"
```

- [ ] **Step 5.2.4: 写测试**

`TraceIdFilterTest.java`：

```java
package com.metaplatform.ontology.interfaces.rest;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.MDC;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TraceIdFilterTest {

    @Test
    void shouldUseIncomingTraceId() throws Exception {
        var filter = new TraceIdFilter();
        var req = mock(HttpServletRequest.class);
        var resp = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);

        when(req.getHeader("X-Trace-Id")).thenReturn("trace-abc-123");

        filter.doFilter(req, resp, chain);

        verify(resp).setHeader("X-Trace-Id", "trace-abc-123");
        // MDC 在 chain.doFilter 之后被清理
        assertNull(MDC.get("traceId"));
    }

    @Test
    void shouldGenerateIfMissing() throws Exception {
        var filter = new TraceIdFilter();
        var req = mock(HttpServletRequest.class);
        var resp = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);

        when(req.getHeader("X-Trace-Id")).thenReturn(null);

        ArgumentCaptor<String> traceIdCaptor = ArgumentCaptor.forClass(String.class);
        filter.doFilter(req, resp, chain);

        verify(resp).setHeader(eq("X-Trace-Id"), traceIdCaptor.capture());
        assertNotNull(traceIdCaptor.getValue());
        assertFalse(traceIdCaptor.getValue().isBlank());
    }
}
```

- [ ] **Step 5.2.5: 跑测试**

```bash
./mvnw test -Dtest=TraceIdFilterTest
```

Expected: 2 个测试全过

- [ ] **Step 5.2.6: 跑回归 + smoke（确认 traceId 出现在事件 payload 中）**

```bash
./mvnw spring-boot:run &
sleep 15
TRACE=$(curl -s -X POST http://localhost:8080/api/v1/entity-types \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: my-trace-001" \
  -H "X-Actor-Id: alice" \
  -d '{"name":"Customer","properties":[{"name":"name","type":"STRING","required":true}]}' \
  -D - -o /dev/null | grep -i "x-trace-id" | tr -d '\r')

echo "Response trace header: $TRACE"

# 查 Kafka 事件
docker exec -it mp-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic metaplatform.ontology.entity-type \
  --max-messages 1 --timeout-ms 5000 | grep -o "my-trace-001" | head -1
```

Expected: Kafka 事件 payload 中能找到 `"traceId":"my-trace-001"`（或对应字段名）

- [ ] **Step 5.2.7: 提交**

```bash
git add .
git commit -m "feat(observability): add trace_id propagation via HTTP filter + MDC"
```

---

## Task 6: Neo4j 适配层 + EntityType 仓储

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/infrastructure/neo4j/EntityTypeNeo4jRepository.java`
- Test: `src/test/java/com/metaplatform/ontology/infrastructure/neo4j/EntityTypeNeo4jRepositoryIT.java`

- [ ] **Step 6.1: 写 Neo4j 仓储接口（在 application 层）**

Create: `src/main/java/com/metaplatform/ontology/application/EntityTypeRepository.java`

```java
package com.metaplatform.ontology.application;

import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.domain.EntityTypeId;
import java.util.List;
import java.util.Optional;

public interface EntityTypeRepository {
    void save(EntityType entityType);
    Optional<EntityType> findById(EntityTypeId id);
    Optional<EntityType> findByName(String tenantId, String name);
    List<EntityType> findAll(String tenantId);
    void deleteById(EntityTypeId id);
}
```

- [ ] **Step 6.2: 写 Neo4j 仓储实现**

```java
package com.metaplatform.ontology.infrastructure.neo4j;

import com.metaplatform.ontology.application.EntityTypeRepository;
import com.metaplatform.ontology.domain.*;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
public class EntityTypeNeo4jRepository implements EntityTypeRepository {

    private final Driver driver;

    public EntityTypeNeo4jRepository(Driver driver) {
        this.driver = driver;
    }

    @Override
    public void save(EntityType et) {
        try (Session session = driver.session()) {
            session.executeWrite(tx -> {
                tx.run("""
                    MERGE (e:EntityType {id: $id, tenantId: $tenantId})
                    SET e.name = $name
                    """,
                    Map.of(
                        "id", et.id().value().toString(),
                        "tenantId", "default-tenant", // v0.1 单租户硬编码
                        "name", et.name()
                    )
                );

                // 删旧属性 + 重建（v0.1 简化策略）
                tx.run("""
                    MATCH (e:EntityType {id: $id})-[r:HAS_PROPERTY]->()
                    DELETE r
                    """,
                    Map.of("id", et.id().value().toString())
                );
                for (Property p : et.properties()) {
                    tx.run("""
                        MATCH (e:EntityType {id: $id})
                        CREATE (e)-[:HAS_PROPERTY {
                            name: $propName, type: $propType
                        }]->(:Property {name: $propName, type: $propType})
                        """,
                        Map.of(
                            "id", et.id().value().toString(),
                            "propName", p.name(),
                            "propType", p.type().name()
                        )
                    );
                }
                return null;
            });
        }
    }

    @Override
    public Optional<EntityType> findById(EntityTypeId id) {
        try (Session session = driver.session()) {
            var records = session.executeRead(tx -> tx.run("""
                MATCH (e:EntityType {id: $id})
                OPTIONAL MATCH (e)-[:HAS_PROPERTY]->(p:Property)
                RETURN e, collect(p) AS props
                """,
                Map.of("id", id.value().toString())
            ).list());
            if (records.isEmpty()) return Optional.empty();
            return Optional.of(toEntityType(records.get(0)));
        }
    }

    @Override
    public Optional<EntityType> findByName(String tenantId, String name) {
        try (Session session = driver.session()) {
            var records = session.executeRead(tx -> tx.run("""
                MATCH (e:EntityType {tenantId: $tenantId, name: $name})
                OPTIONAL MATCH (e)-[:HAS_PROPERTY]->(p:Property)
                RETURN e, collect(p) AS props
                """,
                Map.of("tenantId", tenantId, "name", name)
            ).list());
            if (records.isEmpty()) return Optional.empty();
            return Optional.of(toEntityType(records.get(0)));
        }
    }

    @Override
    public List<EntityType> findAll(String tenantId) {
        try (Session session = driver.session()) {
            var records = session.executeRead(tx -> tx.run("""
                MATCH (e:EntityType {tenantId: $tenantId})
                OPTIONAL MATCH (e)-[:HAS_PROPERTY]->(p:Property)
                RETURN e, collect(p) AS props
                """,
                Map.of("tenantId", tenantId)
            ).list());
            return records.stream().map(this::toEntityType).toList();
        }
    }

    @Override
    public void deleteById(EntityTypeId id) {
        try (Session session = driver.session()) {
            session.executeWrite(tx -> tx.run("""
                MATCH (e:EntityType {id: $id})
                DETACH DELETE e
                """,
                Map.of("id", id.value().toString())
            ));
        }
    }

    private EntityType toEntityType(org.neo4j.driver.Record record) {
        var node = record.get("e").asNode();
        UUID id = UUID.fromString(node.get("id").asString());
        String name = node.get("name").asString();
        var propNodes = record.get("props").asList(v -> v.asNode());
        List<Property> props = propNodes.stream()
            .filter(n -> n != null && n.containsKey("name"))
            .map(n -> new Property(
                n.get("name").asString(),
                PropertyType.valueOf(n.get("type").asString()),
                null
            ))
            .toList();
        return new EntityType(new EntityTypeId(id), name, props, List.of());
    }
}
```

- [ ] **Step 6.3: 写集成测试（用 Testcontainers）**

`EntityTypeNeo4jRepositoryIT.java`：

```java
package com.metaplatform.ontology.infrastructure.neo4j;

import com.metaplatform.ontology.application.EntityTypeRepository;
import com.metaplatform.ontology.domain.*;
import org.junit.jupiter.api.*;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class EntityTypeNeo4jRepositoryIT {

    @Container
    static Neo4jContainer<?> neo4j = new Neo4jContainer<>(DockerImageName.parse("neo4j:5.18-community"))
        .withAdminPassword("test-password");

    static EntityTypeRepository repository;

    @BeforeAll
    static void setup() {
        neo4j.start();
        Driver driver = GraphDatabase.driver(neo4j.getBoltUrl(), AuthTokens.basic("neo4j", "test-password"));
        repository = new EntityTypeNeo4jRepository(driver);
    }

    @Test
    void shouldSaveAndFind() {
        EntityType customer = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(
                new Property("name", PropertyType.STRING, null, true),
                new Property("age", PropertyType.INTEGER, null, false)
            ),
            List.of()
        );
        repository.save(customer);

        Optional<EntityType> found = repository.findById(customer.id());
        assertTrue(found.isPresent());
        assertEquals("Customer", found.get().name());
        assertEquals(2, found.get().properties().size());
    }

    @Test
    void shouldFindByName() {
        EntityType company = new EntityType(
            EntityTypeId.newId(), "Company",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        repository.save(company);
        Optional<EntityType> found = repository.findByName("default-tenant", "Company");
        assertTrue(found.isPresent());
        assertEquals("Company", found.get().name());
    }

    @Test
    void shouldUpdate() {
        EntityType customer = new EntityType(
            EntityTypeId.newId(), "Customer2",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        repository.save(customer);
        EntityType updated = customer.addProperty(
            new Property("email", PropertyType.STRING, null, false)
        );
        repository.save(updated);

        Optional<EntityType> found = repository.findById(customer.id());
        assertEquals(2, found.get().properties().size());
    }

    @Test
    void shouldDelete() {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Tmp",
            List.of(), List.of()
        );
        repository.save(et);
        repository.deleteById(et.id());
        assertTrue(repository.findById(et.id()).isEmpty());
    }
}
```

- [ ] **Step 6.4: 跑测试 — 第一次跑 Testcontainers 拉镜像会慢**

```bash
./mvnw test -Dtest=EntityTypeNeo4jRepositoryIT
```

Expected: 4 个集成测试全通过；首次运行会下载 neo4j:5.18-community 镜像（~1GB）

- [ ] **Step 6.5: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/application/EntityTypeRepository.java \
        src/main/java/com/metaplatform/ontology/infrastructure/neo4j/EntityTypeNeo4jRepository.java \
        src/test/java/com/metaplatform/ontology/infrastructure/neo4j/EntityTypeNeo4jRepositoryIT.java
git commit -m "feat(infra): add Neo4j repository for EntityType with Testcontainers IT"
```

---

## Task 7: Kafka 事件发布器

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/infrastructure/kafka/EventTopicConfig.java`
- Create: `src/main/java/com/metaplatform/ontology/infrastructure/kafka/KafkaEventPublisher.java`
- Test: `src/test/java/com/metaplatform/ontology/infrastructure/kafka/KafkaEventPublisherIT.java`

- [ ] **Step 7.1: 写 topic 配置**

```java
package com.metaplatform.ontology.infrastructure.kafka;

public final class EventTopicConfig {
    public static final String ENTITY_TYPE_EVENTS = "metaplatform.ontology.entity-type";
    public static final String ENTITY_INSTANCE_EVENTS = "metaplatform.ontology.entity-instance";
    private EventTopicConfig() {}
}
```

- [ ] **Step 7.2: 写事件发布器接口（在 application 层）**

Create: `src/main/java/com/metaplatform/ontology/application/OntologyEventPublisher.java`

```java
package com.metaplatform.ontology.application;

import com.metaplatform.ontology.domain.event.OntologyEvent;

public interface OntologyEventPublisher {
    void publish(OntologyEvent event);
}
```

- [ ] **Step 7.3: 写 Kafka 实现**

```java
package com.metaplatform.ontology.infrastructure.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ontology.application.OntologyEventPublisher;
import com.metaplatform.ontology.domain.event.OntologyEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class KafkaEventPublisher implements OntologyEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public KafkaEventPublisher(KafkaTemplate<String, String> kafkaTemplate,
                               ObjectMapper objectMapper) {
        this(kafkaTemplate, objectMapper, EventTopicConfig.ENTITY_TYPE_EVENTS);
    }

    KafkaEventPublisher(KafkaTemplate<String, String> kafkaTemplate,
                        ObjectMapper objectMapper, String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    @Override
    public void publish(OntologyEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, event.tenantId(), payload);
        } catch (Exception e) {
            throw new RuntimeException("failed to publish event: " + event, e);
        }
    }
}
```

- [ ] **Step 7.4: 写集成测试**

`KafkaEventPublisherIT.java`：

```java
package com.metaplatform.ontology.infrastructure.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.Property;
import com.metaplatform.ontology.domain.PropertyType;
import com.metaplatform.ontology.domain.event.EntityTypeCreated;
import com.metaplatform.ontology.domain.event.OntologyEvent;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.*;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class KafkaEventPublisherIT {

    @Container
    static KafkaContainer kafka = new KafkaContainer(
        DockerImageName.parse("apache/kafka:3.6.1")
    );

    static KafkaEventPublisher publisher;
    static KafkaConsumer<String, String> consumer;
    static final String TOPIC = "metaplatform.ontology.entity-type";

    @BeforeAll
    static void setup() {
        kafka.start();

        Map<String, Object> producerProps = Map.of(
            "bootstrap.servers", kafka.getBootstrapServers(),
            "key.serializer", "org.apache.kafka.common.serialization.StringSerializer",
            "value.serializer", "org.apache.kafka.common.serialization.StringSerializer"
        );
        ProducerFactory<String, String> pf = new DefaultKafkaProducerFactory<>(producerProps);
        KafkaTemplate<String, String> template = new KafkaTemplate<>(pf);

        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        publisher = new KafkaEventPublisher(template, mapper, TOPIC);

        Map<String, Object> consumerProps = Map.of(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, kafka.getBootstrapServers(),
            ConsumerConfig.GROUP_ID_CONFIG, "test-group-" + UUID.randomUUID(),
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class
        );
        consumer = new KafkaConsumer<>(consumerProps);
        consumer.subscribe(List.of(TOPIC));
    }

    @Test
    void shouldPublishEvent() {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        OntologyEvent event = new EntityTypeCreated(
            UUID.randomUUID(), Instant.now(), "tenant-1", "user-1", et
        );
        publisher.publish(event);

        ConsumerRecord<String, String> record = pollOne();
        assertNotNull(record);
        assertEquals("tenant-1", record.key());
        assertTrue(record.value().contains("Customer"));
    }

    private ConsumerRecord<String, String> pollOne() {
        for (int i = 0; i < 20; i++) {
            var records = consumer.poll(Duration.ofMillis(500));
            if (!records.isEmpty()) return records.iterator().next();
        }
        return null;
    }
}
```

- [ ] **Step 7.5: 跑测试**

```bash
./mvnw test -Dtest=KafkaEventPublisherIT
```

Expected: 1 个集成测试通过

- [ ] **Step 7.6: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/infrastructure/kafka/ \
        src/main/java/com/metaplatform/ontology/application/OntologyEventPublisher.java \
        src/test/java/com/metaplatform/ontology/infrastructure/kafka/KafkaEventPublisherIT.java
git commit -m "feat(infra): add Kafka event publisher with Testcontainers IT"
```

---

## Task 8: 应用服务 — EntityTypeService（编排）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/application/EntityTypeService.java`
- Test: `src/test/java/com/metaplatform/ontology/application/EntityTypeServiceTest.java`

- [ ] **Step 8.1: 写测试（mock 仓储和发布器）**

`EntityTypeServiceTest.java`：

```java
package com.metaplatform.ontology.application;

import com.metaplatform.ontology.domain.*;
import com.metaplatform.ontology.domain.event.EntityTypeCreated;
import com.metaplatform.ontology.domain.event.OntologyEvent;
import com.metaplatform.ontology.domain.event.PropertyAdded;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EntityTypeServiceTest {

    private EntityTypeRepository repo;
    private OntologyEventPublisher publisher;
    private EntityTypeService service;

    @BeforeEach
    void setup() {
        repo = mock(EntityTypeRepository.class);
        publisher = mock(OntologyEventPublisher.class);
        service = new EntityTypeService(repo, publisher, "default-tenant");
    }

    @Test
    void shouldCreateEntityType() {
        EntityType et = service.createEntityType(
            "Customer",
            "user-1",
            List.of(new Property("name", PropertyType.STRING, null, true))
        );
        assertNotNull(et.id());
        assertEquals("Customer", et.name());
        verify(repo).save(et);
        verify(publisher).publish(any(EntityTypeCreated.class));
    }

    @Test
    void shouldRejectDuplicateName() {
        when(repo.findByName("default-tenant", "Customer"))
            .thenReturn(Optional.of(new EntityType(
                EntityTypeId.newId(), "Customer", List.of(), List.of()
            )));
        assertThrows(IllegalStateException.class,
            () -> service.createEntityType("Customer", "user-1", List.of()));
    }

    @Test
    void shouldAddPropertyAndEmitEvent() {
        EntityType existing = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        when(repo.findById(existing.id())).thenReturn(Optional.of(existing));

        EntityType updated = service.addProperty(
            existing.id(), "user-1",
            new Property("email", PropertyType.STRING, null, false)
        );
        assertEquals(2, updated.properties().size());

        ArgumentCaptor<OntologyEvent> captor = ArgumentCaptor.forClass(OntologyEvent.class);
        verify(publisher).publish(captor.capture());
        assertInstanceOf(PropertyAdded.class, captor.getValue());
    }
}
```

- [ ] **Step 8.2: 跑测试 — 失败**

```bash
./mvnw test -Dtest=EntityTypeServiceTest
```

Expected: 编译失败（EntityTypeService 不存在）

- [ ] **Step 8.3: 写 EntityTypeService**

```java
package com.metaplatform.ontology.application;

import com.metaplatform.ontology.domain.*;
import com.metaplatform.ontology.domain.event.EntityTypeCreated;
import com.metaplatform.ontology.domain.event.EntityTypeDeleted;
import com.metaplatform.ontology.domain.event.EntityTypeUpdated;
import com.metaplatform.ontology.domain.event.OntologyEvent;
import com.metaplatform.ontology.domain.event.PropertyAdded;
import com.metaplatform.ontology.domain.event.RelationAdded;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class EntityTypeService {

    private final EntityTypeRepository repo;
    private final OntologyEventPublisher publisher;
    private final String tenantId;

    public EntityTypeService(EntityTypeRepository repo,
                              OntologyEventPublisher publisher,
                              String tenantId) {
        this.repo = repo;
        this.publisher = publisher;
        this.tenantId = tenantId;
    }

    public EntityType createEntityType(String name, String actorId, List<Property> properties) {
        if (repo.findByName(tenantId, name).isPresent()) {
            throw new IllegalStateException("EntityType already exists: " + name);
        }
        EntityType et = new EntityType(EntityTypeId.newId(), name, properties, List.of());
        repo.save(et);
        publisher.publish(new EntityTypeCreated(
            UUID.randomUUID(), Instant.now(), tenantId, actorId, et
        ));
        return et;
    }

    public EntityType addProperty(EntityTypeId id, String actorId, Property property) {
        EntityType existing = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("EntityType not found: " + id));
        EntityType updated = existing.addProperty(property);
        repo.save(updated);
        publisher.publish(new PropertyAdded(
            UUID.randomUUID(), Instant.now(), tenantId, actorId, id, property
        ));
        return updated;
    }

    public EntityType addRelation(EntityTypeId id, String actorId, RelationType relation) {
        EntityType existing = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("EntityType not found: " + id));
        EntityType updated = existing.addRelation(relation);
        repo.save(updated);
        publisher.publish(new RelationAdded(
            UUID.randomUUID(), Instant.now(), tenantId, actorId, id, relation
        ));
        return updated;
    }

    public void deleteEntityType(EntityTypeId id, String actorId) {
        repo.deleteById(id);
        publisher.publish(new EntityTypeDeleted(
            UUID.randomUUID(), Instant.now(), tenantId, actorId, id
        ));
    }

    public EntityType updateEntityType(EntityType et, String actorId, int version) {
        repo.save(et);
        publisher.publish(new EntityTypeUpdated(
            UUID.randomUUID(), Instant.now(), tenantId, actorId, et, version
        ));
        return et;
    }
}
```

- [ ] **Step 8.4: 跑测试 — 通过**

```bash
./mvnw test -Dtest=EntityTypeServiceTest
```

Expected: 3 个测试全通过

- [ ] **Step 8.5: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/application/EntityTypeService.java \
        src/test/java/com/metaplatform/ontology/application/EntityTypeServiceTest.java
git commit -m "feat(application): add EntityTypeService with event publishing"
```

---

## Task 9: REST API 端点

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/EntityTypeController.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/CreateEntityTypeRequest.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/EntityTypeResponse.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/AddPropertyRequest.java`
- Create: `src/main/resources/application.yml`
- Test: `src/test/java/com/metaplatform/ontology/interfaces/rest/EntityTypeControllerTest.java`

- [ ] **Step 9.1: 写 DTO**

```java
// CreateEntityTypeRequest.java
package com.metaplatform.ontology.interfaces.rest.dto;

import com.metaplatform.ontology.domain.Property;
import com.metaplatform.ontology.domain.PropertyType;
import java.util.List;

public record CreateEntityTypeRequest(
    String name,
    List<PropertyDto> properties
) {
    public record PropertyDto(String name, PropertyType type, Object defaultValue, boolean required) {
        public Property toDomain() {
            return new Property(name, type, defaultValue, required);
        }
    }
}
```

```java
// EntityTypeResponse.java
package com.metaplatform.ontology.interfaces.rest.dto;

import com.metaplatform.ontology.domain.EntityType;
import java.util.List;

public record EntityTypeResponse(
    String id, String name,
    List<PropertyDto> properties
) {
    public record PropertyDto(String name, String type) {}
    public static EntityTypeResponse from(EntityType et) {
        return new EntityTypeResponse(
            et.id().value().toString(),
            et.name(),
            et.properties().stream()
                .map(p -> new PropertyDto(p.name(), p.type().name()))
                .toList()
        );
    }
}
```

```java
// AddPropertyRequest.java
package com.metaplatform.ontology.interfaces.rest.dto;

import com.metaplatform.ontology.domain.Property;
import com.metaplatform.ontology.domain.PropertyType;

public record AddPropertyRequest(
    String name, PropertyType type, Object defaultValue, boolean required
) {
    public Property toDomain() {
        return new Property(name, type, defaultValue, required);
    }
}
```

- [ ] **Step 9.2: 写 Controller**

```java
package com.metaplatform.ontology.interfaces.rest;

import com.metaplatform.ontology.application.EntityTypeService;
import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.interfaces.rest.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/entity-types")
public class EntityTypeController {

    private final EntityTypeService service;

    public EntityTypeController(EntityTypeService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<EntityTypeResponse> create(
            @RequestBody CreateEntityTypeRequest request,
            @RequestHeader("X-Actor-Id") String actorId) {
        List<com.metaplatform.ontology.domain.Property> props = request.properties() == null
            ? List.of()
            : request.properties().stream().map(CreateEntityTypeRequest.PropertyDto::toDomain).toList();
        EntityType et = service.createEntityType(request.name(), actorId, props);
        return ResponseEntity.status(HttpStatus.CREATED).body(EntityTypeResponse.from(et));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EntityTypeResponse> get(@PathVariable String id) {
        return service.findById(EntityTypeId.of(id))
            .map(et -> ResponseEntity.ok(EntityTypeResponse.from(et)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/properties")
    public ResponseEntity<EntityTypeResponse> addProperty(
            @PathVariable String id,
            @RequestBody AddPropertyRequest request,
            @RequestHeader("X-Actor-Id") String actorId) {
        EntityType updated = service.addProperty(
            EntityTypeId.of(id), actorId, request.toDomain()
        );
        return ResponseEntity.ok(EntityTypeResponse.from(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @RequestHeader("X-Actor-Id") String actorId) {
        service.deleteEntityType(EntityTypeId.of(id), actorId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 9.3: 写 application.yml**

```yaml
server:
  port: 8080

spring:
  neo4j:
    uri: bolt://localhost:7687
    authentication:
      username: neo4j
      password: metaplatform
  datasource:
    url: jdbc:postgresql://localhost:5432/ontology_meta
    username: meta
    password: metaplatform
  kafka:
    bootstrap-servers: localhost:9092

metaplatform:
  tenant: default-tenant
```

- [ ] **Step 9.4: 写 Controller 单测（用 @WebMvcTest）**

`EntityTypeControllerTest.java`：

```java
package com.metaplatform.ontology.interfaces.rest;

import com.metaplatform.ontology.application.EntityTypeService;
import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.Property;
import com.metaplatform.ontology.domain.PropertyType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(EntityTypeController.class)
class EntityTypeControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EntityTypeService service;

    @Test
    void shouldCreateEntityType() throws Exception {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        when(service.createEntityType(eq("Customer"), eq("user-1"), any())).thenReturn(et);

        mockMvc.perform(post("/api/v1/entity-types")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Actor-Id", "user-1")
                .content("""
                    {"name":"Customer","properties":[{"name":"name","type":"STRING","required":true}]}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Customer"))
            .andExpect(jsonPath("$.properties[0].name").value("name"));
    }

    @Test
    void shouldReturn404IfNotFound() throws Exception {
        when(service.findById(any())).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/v1/entity-types/00000000-0000-0000-0000-000000000000"))
            .andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 9.5: 跑测试**

```bash
./mvnw test -Dtest=EntityTypeControllerTest
```

Expected: 2 个测试通过

- [ ] **Step 9.6: 启动并 smoke test**

```bash
./mvnw spring-boot:run &
sleep 15
curl -X POST http://localhost:8080/api/v1/entity-types \
  -H "Content-Type: application/json" \
  -H "X-Actor-Id: user-1" \
  -d '{"name":"Customer","properties":[{"name":"name","type":"STRING","required":true}]}'
```

Expected: HTTP 201 + JSON with `id`, `name=Customer`

- [ ] **Step 9.7: 提交**

```bash
git add .
git commit -m "feat(api): add REST endpoints for EntityType CRUD"
```

---

## Task 10: 版本快照（PG 元数据 + Flyway）

**Files:**
- Create: `src/main/resources/db/migration/V1__init_ontology_metadata.sql`
- Create: `src/main/java/com/metaplatform/ontology/infrastructure/postgres/OntologyVersionRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/domain/OntologyVersion.java`
- Create: `src/main/java/com/metaplatform/ontology/application/VersioningService.java`
- Test: `src/test/java/com/metaplatform/ontology/application/VersioningServiceIT.java`

- [ ] **Step 10.1: 写 Flyway 迁移**

`V1__init_ontology_metadata.sql`：

```sql
CREATE TABLE ontology_version (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    entity_type_id UUID NOT NULL,
    version INT NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64) NOT NULL,
    UNIQUE (tenant_id, entity_type_id, version)
);

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    event_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_audit_tenant_occurred ON audit_log (tenant_id, occurred_at DESC);
```

- [ ] **Step 10.2: 写 OntologyVersion 领域对象**

```java
package com.metaplatform.ontology.domain;

import java.time.Instant;
import java.util.UUID;

public record OntologyVersion(
    Long id,
    String tenantId,
    UUID entityTypeId,
    int version,
    String snapshotJson,
    Instant createdAt,
    String createdBy
) {}
```

- [ ] **Step 10.3: 写 VersioningService 测试**

`VersioningServiceIT.java`（用 Testcontainers PG）：

```java
package com.metaplatform.ontology.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.domain.Property;
import com.metaplatform.ontology.domain.PropertyType;
import com.metaplatform.ontology.infrastructure.postgres.OntologyVersionRepository;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class VersioningServiceIT {

    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("ontology_meta")
        .withUsername("test")
        .withPassword("test");

    static VersioningService service;
    static OntologyVersionRepository repo;

    @BeforeAll
    static void setup() throws Exception {
        pg.start();
        DataSource ds = new DriverManagerDataSource(
            pg.getJdbcUrl(), pg.getUsername(), pg.getPassword()
        );
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        // 简化：直接执行 schema
        jdbc.execute("""
            CREATE TABLE ontology_version (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                entity_type_id UUID NOT NULL,
                version INT NOT NULL,
                snapshot JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_by VARCHAR(64) NOT NULL
            )
            """);
        repo = new OntologyVersionRepository(jdbc);
        service = new VersioningService(repo, new ObjectMapper(), "default-tenant");
    }

    @Test
    void shouldSnapshotAndRestore() throws Exception {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Customer",
            List.of(new Property("name", PropertyType.STRING, null, true)),
            List.of()
        );
        int version = service.snapshot(et, "user-1");
        assertEquals(1, version);

        Optional<EntityType> restored = service.findByVersion(et.id().value(), 1);
        assertTrue(restored.isPresent());
        assertEquals("Customer", restored.get().name());
        assertEquals(1, restored.get().properties().size());
    }

    @Test
    void shouldIncrementVersion() throws Exception {
        EntityType et = new EntityType(
            EntityTypeId.newId(), "Order",
            List.of(new Property("amount", PropertyType.DOUBLE, null, true)),
            List.of()
        );
        int v1 = service.snapshot(et, "user-1");
        EntityType updated = et.addProperty(new Property("currency", PropertyType.STRING, null, true));
        int v2 = service.snapshot(updated, "user-1");
        assertEquals(1, v1);
        assertEquals(2, v2);
    }
}
```

- [ ] **Step 10.4: 跑测试 — 失败**

```bash
./mvnw test -Dtest=VersioningServiceIT
```

Expected: 编译失败

- [ ] **Step 10.5: 写 VersioningService + Repository**

```java
// OntologyVersionRepository.java
package com.metaplatform.ontology.infrastructure.postgres;

import com.metaplatform.ontology.domain.OntologyVersion;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class OntologyVersionRepository {

    private final JdbcTemplate jdbc;

    public OntologyVersionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int insert(String tenantId, UUID entityTypeId, int version, String snapshotJson, String createdBy) {
        return jdbc.update("""
            INSERT INTO ontology_version (tenant_id, entity_type_id, version, snapshot, created_by)
            VALUES (?, ?, ?, ?::jsonb, ?)
            """, tenantId, entityTypeId, version, snapshotJson, createdBy);
    }

    public int findMaxVersion(String tenantId, UUID entityTypeId) {
        Integer max = jdbc.queryForObject("""
            SELECT COALESCE(MAX(version), 0) FROM ontology_version
            WHERE tenant_id = ? AND entity_type_id = ?
            """, Integer.class, tenantId, entityTypeId);
        return max == null ? 0 : max;
    }

    public Optional<OncologyVersionRow> findByVersion(String tenantId, UUID entityTypeId, int version) {
        // typo 修正：OntologyVersionRow
        return Optional.empty(); // 占位
    }
}
```

（上面有 typo，**正确的实现**如下——直接覆盖整个文件：）

```java
package com.metaplatform.ontology.infrastructure.postgres;

import com.metaplatform.ontology.domain.OntologyVersion;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class OntologyVersionRepository {

    private final JdbcTemplate jdbc;

    public OntologyVersionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String tenantId, UUID entityTypeId, int version,
                       String snapshotJson, String createdBy) {
        jdbc.update("""
            INSERT INTO ontology_version (tenant_id, entity_type_id, version, snapshot, created_by)
            VALUES (?, ?, ?, ?::jsonb, ?)
            """, tenantId, entityTypeId, version, snapshotJson, createdBy);
    }

    public int findMaxVersion(String tenantId, UUID entityTypeId) {
        Integer max = jdbc.queryForObject("""
            SELECT COALESCE(MAX(version), 0) FROM ontology_version
            WHERE tenant_id = ? AND entity_type_id = ?
            """, Integer.class, tenantId, entityTypeId);
        return max == null ? 0 : max;
    }

    public Optional<OntologyVersion> findByVersion(String tenantId, UUID entityTypeId, int version) {
        List<OntologyVersion> rows = jdbc.query("""
            SELECT id, tenant_id, entity_type_id, version, snapshot::text AS snapshot_text, created_at, created_by
            FROM ontology_version
            WHERE tenant_id = ? AND entity_type_id = ? AND version = ?
            """,
            (rs, rowNum) -> new OntologyVersion(
                rs.getLong("id"),
                rs.getString("tenant_id"),
                (UUID) rs.getObject("entity_type_id"),
                rs.getInt("version"),
                rs.getString("snapshot_text"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("created_by")
            ),
            tenantId, entityTypeId, version
        );
        return rows.stream().findFirst();
    }
}
```

```java
// VersioningService.java
package com.metaplatform.ontology.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ontology.domain.EntityType;
import com.metaplatform.ontology.infrastructure.postgres.OntologyVersionRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class VersioningService {

    private final OntologyVersionRepository repo;
    private final ObjectMapper objectMapper;
    private final String tenantId;

    public VersioningService(OntologyVersionRepository repo,
                              ObjectMapper objectMapper, String tenantId) {
        this.repo = repo;
        this.objectMapper = objectMapper;
        this.tenantId = tenantId;
    }

    public int snapshot(EntityType et, String actorId) {
        int nextVersion = repo.findMaxVersion(tenantId, et.id().value()) + 1;
        try {
            String json = objectMapper.writeValueAsString(et);
            repo.insert(tenantId, et.id().value(), nextVersion, json, actorId);
        } catch (Exception e) {
            throw new RuntimeException("failed to snapshot EntityType " + et.id(), e);
        }
        return nextVersion;
    }

    public Optional<EntityType> findByVersion(UUID entityTypeId, int version) {
        return repo.findByVersion(tenantId, entityTypeId, version)
            .flatMap(v -> {
                try {
                    return Optional.of(objectMapper.readValue(v.snapshotJson(), EntityType.class));
                } catch (Exception e) {
                    throw new RuntimeException("failed to deserialize version " + version, e);
                }
            });
    }
}
```

- [ ] **Step 10.6: 跑测试 — 通过**

```bash
./mvnw test -Dtest=VersioningServiceIT
```

Expected: 2 个集成测试通过

- [ ] **Step 10.7: 提交**

```bash
git add .
git commit -m "feat(versioning): add ontology version snapshots with PG + Flyway"
```

---

## Task 11: 端到端 smoke（spike 验收）

- [ ] **Step 11.1: 启动全套**

```bash
docker-compose up -d
./mvnw spring-boot:run &
sleep 20
```

- [ ] **Step 11.2: 创建"客户"实体类型**

```bash
curl -X POST http://localhost:8080/api/v1/entity-types \
  -H "Content-Type: application/json" \
  -H "X-Actor-Id: alice" \
  -d '{"name":"Customer","properties":[{"name":"name","type":"STRING","required":true},{"name":"email","type":"STRING","required":false}]}'
```

Expected: 返回 201 + JSON，记录 `id` 字段

- [ ] **Step 11.3: 加一个属性**

```bash
ID=<上一步的 id>
curl -X POST http://localhost:8080/api/v1/entity-types/$ID/properties \
  -H "Content-Type: application/json" \
  -H "X-Actor-Id: alice" \
  -d '{"name":"phone","type":"STRING","required":false}'
```

Expected: 返回 200，properties 数量 +1

- [ ] **Step 11.4: 查回**

```bash
curl http://localhost:8080/api/v1/entity-types/$ID
```

Expected: 返回 3 个属性

- [ ] **Step 11.5: 查 Kafka 事件**

```bash
docker exec -it mp-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic metaplatform.ontology.entity-type \
  --from-beginning --max-messages 5
```

Expected: 看到 EntityTypeCreated + PropertyAdded 两条 JSON 事件

- [ ] **Step 11.6: 查 Neo4j Browser**

打开 http://localhost:7474，登录 neo4j/metaplatform，查询：

```cypher
MATCH (e:EntityType {name: "Customer"})-[r:HAS_PROPERTY]->(p:Property)
RETURN e.name, r.name, p.type
```

Expected: 3 行结果

- [ ] **Step 11.7: 提交 smoke 文档**

Create: `docs/spike-acceptance.md`：

```markdown
# 本体引擎 v0.1 Spike 验收

日期：2026-07-XX
执行人：<name>

## 验收清单

- [ ] Task 11.2：创建 Customer 实体类型返回 201
- [ ] Task 11.3：添加 phone 属性返回 200
- [ ] Task 11.4：GET 端点返回 3 个属性
- [ ] Task 11.5：Kafka 收到 EntityTypeCreated + PropertyAdded 事件
- [ ] Task 11.6：Neo4j Browser 看到 EntityType + Property 节点和 HAS_PROPERTY 关系

## 结论

- [ ] 全部通过 → 进入 MVP（第 2 期）
- [ ] 部分失败 → 修补后再评审
```

- [ ] **Step 11.8: 最终提交**

```bash
git add docs/spike-acceptance.md
git commit -m "docs: add spike acceptance checklist"
```

---

## 自检（v1.2 spec 覆盖核对）

| spec 章节 | 对应 Task |
|---|---|
| §5.2.2 L2-2 实体类型 / 属性 / 关系 | Task 2 / 3 / 4 |
| §5.2.2 事件总线 | Task 5 / 7 |
| §5.2.2 推理 | ⚠️ v0.1 不含（推到 v0.2）|
| §5.2.2 语义查询 | ⚠️ v0.1 只做 findById/findByName/findAll（v0.2 加 Cypher）|
| §5.2.2 版本 | Task 10 |
| §6 D3 P3 半自动双向同步 | ⚠️ v0.1 不含"半自动"逻辑（业务对象层 v0.1 做）|
| §6 D7 图谱 = 本体运行时形态 | Task 6 实现 |

## 范围说明

**Spike 期只做 4 件事**：
1. 实体类型能 CRUD（Task 2/3/4/6/8/9）
2. 事件总线能广播变更（Task 5/7）
3. 版本能快照和恢复（Task 10）
4. 端到端 smoke（Task 11）

**Spike 期不做**（推到 MVP 第 2 期或 v0.2）：
- 推理引擎（OWL/SHACL）
- 半自动双向同步的业务确认流
- 业务对象层（业务对象层 v0.1 子项目做）
- 多租户（v0.1 硬编码 default-tenant）
- 安全 / 鉴权（v0.1 只信任 X-Actor-Id header）
- 性能优化（v0.1 只追求跑通）

---

## 完成标准

Spike 期完成 = **Task 1-11 全部勾选 + docs/spike-acceptance.md 全部勾选**。

之后进入第 2 期 MVP 阶段（业务对象层 v0.1 / AI Substrate v0.1 / ...）。

---

**生成时间**：2026-07-02 14:20
**对应 spec 版本**：v1.2
**对应决策**：D3 / D7 / D12
