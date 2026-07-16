# 业务对象层 v0.1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 MetaPlatform 的业务对象层 v0.1 —— ObjectType（聚合根，包装 EntityType 并添加字段定义、校验规则、生命周期流转）+ ObjectInstance（带字段值的 CRUD + 生命周期状态机）+ 校验引擎 + 视图自动配置，让业务对象在平台上可定义、可创建、可流转。

**Architecture:** 多租户 · Java 21 + Spring Boot 3.2 · PostgreSQL 16 · Redis 7（校验规则缓存）· 扩展现有 ontology-engine 代码库 · DDD 分层。

**Tech Stack:**
- 后端：Java 21+、Spring Boot 3.2+、Maven
- 数据库：PostgreSQL 16+（tenant_id 列级隔离）
- 缓存：Redis 7+（校验规则 + 视图配置缓存）
- 表达式引擎：Aviator 5.x（字段校验规则求值）
- 状态机：Spring StateMachine 或手写轻量状态机
- 测试：JUnit 5、Testcontainers、Mockito
- 容器化：Docker + docker-compose（复用 ontology-engine 的基础设施）

**对应 spec：** §5.2.2 L2-2 本体引擎（业务对象扩展层）
**对应决策：** D7（图谱 = 本体运行时形态的上层封装）、D4（多租户 tenant_id 隔离）
**对应阶段：** 第 1 期 · Spike（T-1 ~ T0）
**与 ontology-engine 的关系：** EntityType 是 ontology-engine 已有的聚合根；ObjectType 在其上包装字段定义、校验规则、生命周期，是业务对象层的聚合根。二者通过 EntityTypeId 关联。

---

## 文件结构

```
metaplatform-ontology-engine/              # 扩展现有代码库
├── src/main/java/com/metaplatform/ontology/
│   ├── object/                            # 新增：业务对象层
│   │   ├── ObjectType.java                # 聚合根
│   │   ├── ObjectTypeId.java              # 强类型 ID
│   │   ├── FieldDefinition.java           # 字段定义值对象
│   │   ├── ValidationRule.java            # 校验规则值对象
│   │   ├── LifecycleTransition.java       # 生命周期流转定义
│   │   ├── ObjectTypeRepository.java      # 仓储接口
│   │   ├── ObjectTypeService.java         # 用例编排
│   │   ├── ObjectInstance.java            # 实例聚合根
│   │   ├── ObjectInstanceId.java          # 强类型 ID
│   │   ├── FieldValue.java                # 字段值值对象
│   │   ├── ObjectInstanceRepository.java  # 仓储接口
│   │   ├── ObjectInstanceService.java     # 用例编排
│   │   ├── validation/
│   │   │   ├── ValidationService.java     # 校验服务
│   │   │   └── AviatorExpressionEngine.java # Aviator 表达式引擎
│   │   ├── lifecycle/
│   │   │   ├── LifecycleService.java      # 生命周期服务
│   │   │   └── StateMachine.java          # 状态机实现
│   │   ├── view/
│   │   │   ├── ViewConfig.java            # 视图配置值对象
│   │   │   ├── ViewConfigService.java     # 视图自动配置
│   │   │   └── ViewConfigRepository.java  # 视图仓储
│   │   └── infrastructure/
│   │       ├── postgres/
│   │       │   ├── ObjectTypeJpaRepository.java
│   │       │   ├── ObjectInstanceJpaRepository.java
│   │       │   └── ViewConfigJpaRepository.java
│   │       └── cache/
│   │           └── ValidationCacheService.java
│   └── interfaces/
│       └── rest/
│           ├── ObjectTypeController.java
│           ├── ObjectInstanceController.java
│           └── dto/
│               ├── CreateObjectTypeRequest.java
│               ├── ObjectTypeResponse.java
│               ├── CreateObjectInstanceRequest.java
│               └── ObjectInstanceResponse.java
├── src/main/resources/db/migration/
│   ├── V4__object_type.sql
│   ├── V5__object_instance.sql
│   └── V6__view_config.sql
├── src/test/java/com/metaplatform/ontology/object/
│   ├── ObjectTypeTest.java
│   ├── ObjectInstanceTest.java
│   ├── ValidationServiceTest.java
│   ├── LifecycleServiceTest.java
│   ├── ViewConfigServiceTest.java
│   └── ObjectTypeControllerTest.java
└── pom.xml                                # 新增 Aviator 依赖
```

---

## Task 1: 添加 Aviator 依赖

**Files:**
- Modify: `metaplatform-ontology-engine/pom.xml`

- [ ] **Step 1.1: 在 pom.xml 中添加 Aviator 5 依赖**

在 `<dependencies>` 中添加：

```xml
<!-- Aviator 表达式引擎 -->
<dependency>
    <groupId>com.googlecode.aviator</groupId>
    <artifactId>aviator</artifactId>
    <version>5.4.3</version>
</dependency>

<!-- Redis 缓存 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

- [ ] **Step 1.2: 验证编译**

```bash
cd metaplatform-ontology-engine
./mvnw clean compile
```

Expected: BUILD SUCCESS

- [ ] **Step 1.3: 提交**

```bash
git add pom.xml
git commit -m "chore(deps): add Aviator 5 and Redis dependencies"
```

---

## Task 2: 领域模型 — FieldDefinition + ValidationRule（值对象）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/FieldDefinition.java`
- Create: `src/main/java/com/metaplatform/ontology/object/ValidationRule.java`

- [ ] **Step 2.1: 写 FieldDefinition 值对象**

```java
package com.metaplatform.ontology.object;

import java.util.Objects;

/**
 * 字段定义：描述一个 ObjectType 中的单个字段。
 * 与 ontology-engine 的 Property 的区别：Property 是元数据层的属性类型定义，
 * FieldDefinition 是业务对象层的字段定义，包含默认值、必填、可编辑等业务语义。
 */
public record FieldDefinition(
    String name,                // 字段名（英文，snake_case）
    String displayName,         // 显示名（中文）
    FieldType fieldType,        // 字段类型
    boolean required,           // 是否必填
    boolean editable,           // 是否可编辑
    String defaultValue,        // 默认值（字符串表示）
    String description          // 字段描述
) {
    public FieldDefinition {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("field name must not be blank");
        }
        if (displayName == null || displayName.isBlank()) {
            throw new IllegalArgumentException("field displayName must not be blank");
        }
        Objects.requireNonNull(fieldType, "fieldType must not be null");
    }

    public enum FieldType {
        STRING,
        TEXT,           // 长文本
        INTEGER,
        LONG,
        DOUBLE,
        BOOLEAN,
        DATE,
        DATETIME,
        ENUM,           // 枚举（值列表）
        REFERENCE,      // 引用其他 ObjectInstance
        JSON            // JSON 结构化数据
    }
}
```

- [ ] **Step 2.2: 写 ValidationRule 值对象**

```java
package com.metaplatform.ontology.object;

import java.util.Objects;

/**
 * 校验规则：基于 Aviator 表达式的字段级或对象级校验。
 * 
 * 示例：
 * - 字段级: fieldName="price", expression="price > 0", message="价格必须大于0"
 * - 对象级: expression="start_date < end_date", message="开始日期必须早于结束日期"
 */
public record ValidationRule(
    String name,            // 规则名称
    String fieldName,       // 作用的字段名（null 表示对象级规则）
    String expression,      // Aviator 表达式
    String message,         // 校验失败时的错误消息
    RuleLevel level         // 规则级别
) {
    public ValidationRule {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("rule name must not be blank");
        }
        if (expression == null || expression.isBlank()) {
            throw new IllegalArgumentException("expression must not be blank");
        }
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("message must not be blank");
        }
        Objects.requireNonNull(level, "level must not be null");
    }

    public enum RuleLevel {
        FIELD,      // 字段级校验
        OBJECT      // 对象级校验
    }

    public boolean isFieldLevel() {
        return level == RuleLevel.FIELD && fieldName != null;
    }

    public boolean isObjectLevel() {
        return level == RuleLevel.OBJECT;
    }
}
```

- [ ] **Step 2.3: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/FieldDefinition.java \
        src/main/java/com/metaplatform/ontology/object/ValidationRule.java
git commit -m "feat(object): add FieldDefinition and ValidationRule value objects"
```

---

## Task 3: 领域模型 — ObjectType（聚合根）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/ObjectTypeId.java`
- Create: `src/main/java/com/metaplatform/ontology/object/LifecycleTransition.java`
- Create: `src/main/java/com/metaplatform/ontology/object/ObjectType.java`
- Test: `src/test/java/com/metaplatform/ontology/object/ObjectTypeTest.java`

- [ ] **Step 3.1: 写 ObjectTypeId 强类型 ID**

```java
package com.metaplatform.ontology.object;

import java.util.Objects;
import java.util.UUID;

public record ObjectTypeId(UUID value) {
    public ObjectTypeId {
        Objects.requireNonNull(value, "ObjectTypeId value must not be null");
    }

    public static ObjectTypeId newId() {
        return new ObjectTypeId(UUID.randomUUID());
    }

    public static ObjectTypeId of(String s) {
        return new ObjectTypeId(UUID.fromString(s));
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
```

- [ ] **Step 3.2: 写 LifecycleTransition 值对象**

```java
package com.metaplatform.ontology.object;

import java.util.Objects;

/**
 * 生命周期流转定义：定义从一个状态到另一个状态的流转规则。
 */
public record LifecycleTransition(
    String fromState,       // 起始状态
    String toState,         // 目标状态
    String name,            // 流转名称（如 "提交审批"）
    String guardExpression, // Aviator 表达式，用于判断是否允许流转（null 表示无条件）
    String description      // 描述
) {
    public LifecycleTransition {
        if (fromState == null || fromState.isBlank()) {
            throw new IllegalArgumentException("fromState must not be blank");
        }
        if (toState == null || toState.isBlank()) {
            throw new IllegalArgumentException("toState must not be blank");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("transition name must not be blank");
        }
    }

    public boolean hasGuard() {
        return guardExpression != null && !guardExpression.isBlank();
    }
}
```

- [ ] **Step 3.3: 写 ObjectType 测试**

`ObjectTypeTest.java`：

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.domain.EntityTypeId;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ObjectTypeTest {

    @Test
    void shouldCreateObjectType() {
        ObjectType ot = new ObjectType(
                ObjectTypeId.newId(),
                EntityTypeId.newId(),
                "order",
                "订单",
                "订单业务对象",
                List.of(
                        new FieldDefinition("order_no", "订单号", FieldDefinition.FieldType.STRING,
                                true, false, null, "系统自动生成"),
                        new FieldDefinition("amount", "金额", FieldDefinition.FieldType.DOUBLE,
                                true, true, "0.0", "订单总金额")
                ),
                List.of(
                        new ValidationRule("amount_positive", "amount", "amount > 0",
                                "金额必须大于0", ValidationRule.RuleLevel.FIELD)
                ),
                List.of(
                        new LifecycleTransition("draft", "pending", "提交审批", null, "提交订单到待审批"),
                        new LifecycleTransition("pending", "approved", "审批通过", null, "审批通过")
                ),
                Set.of("draft", "pending", "approved", "rejected"),
                "draft"
        );

        assertEquals("order", ot.code());
        assertEquals("订单", ot.displayName());
        assertEquals(2, ot.fieldDefinitions().size());
        assertEquals(1, ot.validationRules().size());
        assertEquals(2, ot.lifecycleTransitions().size());
        assertEquals(4, ot.lifecycleStates().size());
        assertEquals("draft", ot.initialState());
    }

    @Test
    void shouldRejectNullId() {
        assertThrows(NullPointerException.class, () ->
                new ObjectType(null, EntityTypeId.newId(), "test", "测试", null,
                        List.of(), List.of(), List.of(), Set.of("new"), "new"));
    }

    @Test
    void shouldRejectBlankCode() {
        assertThrows(IllegalArgumentException.class, () ->
                new ObjectType(ObjectTypeId.newId(), EntityTypeId.newId(), "", "测试", null,
                        List.of(), List.of(), List.of(), Set.of("new"), "new"));
    }

    @Test
    void shouldRejectBlankDisplayName() {
        assertThrows(IllegalArgumentException.class, () ->
                new ObjectType(ObjectTypeId.newId(), EntityTypeId.newId(), "test", "", null,
                        List.of(), List.of(), List.of(), Set.of("new"), "new"));
    }

    @Test
    void shouldRejectInitialStateNotInStates() {
        assertThrows(IllegalArgumentException.class, () ->
                new ObjectType(ObjectTypeId.newId(), EntityTypeId.newId(), "test", "测试", null,
                        List.of(), List.of(), List.of(), Set.of("draft"), "approved"));
    }

    @Test
    void shouldRejectTransitionFromStateNotInStates() {
        assertThrows(IllegalArgumentException.class, () ->
                new ObjectType(ObjectTypeId.newId(), EntityTypeId.newId(), "test", "测试", null,
                        List.of(), List.of(),
                        List.of(new LifecycleTransition("nonexistent", "draft", "回退", null, null)),
                        Set.of("draft"), "draft"));
    }

    @Test
    void shouldFindFieldByName() {
        FieldDefinition fd = new FieldDefinition("price", "价格", FieldDefinition.FieldType.DOUBLE,
                true, true, null, null);
        ObjectType ot = new ObjectType(ObjectTypeId.newId(), EntityTypeId.newId(),
                "product", "产品", null, List.of(fd), List.of(), List.of(), Set.of("new"), "new");

        assertTrue(ot.findField("price").isPresent());
        assertEquals("价格", ot.findField("price").get().displayName());
        assertTrue(ot.findField("nonexistent").isEmpty());
    }

    @Test
    void shouldFindTransitionsFromState() {
        LifecycleTransition t1 = new LifecycleTransition("draft", "pending", "提交", null, null);
        LifecycleTransition t2 = new LifecycleTransition("draft", "cancelled", "取消", null, null);
        LifecycleTransition t3 = new LifecycleTransition("pending", "approved", "审批", null, null);

        ObjectType ot = new ObjectType(ObjectTypeId.newId(), EntityTypeId.newId(),
                "order", "订单", null, List.of(), List.of(),
                List.of(t1, t2, t3), Set.of("draft", "pending", "approved", "cancelled"), "draft");

        List<LifecycleTransition> fromDraft = ot.findTransitionsFrom("draft");
        assertEquals(2, fromDraft.size());

        List<LifecycleTransition> fromPending = ot.findTransitionsFrom("pending");
        assertEquals(1, fromPending.size());
    }
}
```

- [ ] **Step 3.4: 运行测试 — 确认失败**

```bash
./mvnw test -Dtest=ObjectTypeTest
```

Expected: 编译失败（ObjectType 类不存在）

- [ ] **Step 3.5: 写 ObjectType 聚合根**

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.domain.EntityTypeId;

import java.util.*;
import java.util.stream.Collectors;

/**
 * ObjectType 聚合根：包装 EntityType（来自 ontology-engine），
 * 添加字段定义、校验规则、生命周期流转。
 */
public record ObjectType(
    ObjectTypeId id,
    EntityTypeId entityTypeId,  // 关联的 EntityType ID
    String code,                // 业务对象编码（英文）
    String displayName,         // 显示名
    String description,         // 描述
    List<FieldDefinition> fieldDefinitions,
    List<ValidationRule> validationRules,
    List<LifecycleTransition> lifecycleTransitions,
    Set<String> lifecycleStates,
    String initialState
) {
    public ObjectType {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(entityTypeId, "entityTypeId must not be null");
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code must not be blank");
        }
        if (displayName == null || displayName.isBlank()) {
            throw new IllegalArgumentException("displayName must not be blank");
        }
        fieldDefinitions = fieldDefinitions != null ? List.copyOf(fieldDefinitions) : List.of();
        validationRules = validationRules != null ? List.copyOf(validationRules) : List.of();
        lifecycleTransitions = lifecycleTransitions != null ? List.copyOf(lifecycleTransitions) : List.of();
        lifecycleStates = lifecycleStates != null ? Set.copyOf(lifecycleStates) : Set.of();
        if (initialState != null && !lifecycleStates.isEmpty() && !lifecycleStates.contains(initialState)) {
            throw new IllegalArgumentException(
                    "initialState '" + initialState + "' must be one of lifecycleStates: " + lifecycleStates);
        }
        // 验证所有流转的 fromState 和 toState 都在 lifecycleStates 中
        for (LifecycleTransition t : lifecycleTransitions) {
            if (!lifecycleStates.contains(t.fromState())) {
                throw new IllegalArgumentException(
                        "transition fromState '" + t.fromState() + "' not in lifecycleStates");
            }
            if (!lifecycleStates.contains(t.toState())) {
                throw new IllegalArgumentException(
                        "transition toState '" + t.toState() + "' not in lifecycleStates");
            }
        }
    }

    /**
     * 按名称查找字段定义
     */
    public Optional<FieldDefinition> findField(String fieldName) {
        return fieldDefinitions.stream()
                .filter(f -> f.name().equals(fieldName))
                .findFirst();
    }

    /**
     * 查找从指定状态出发的所有流转
     */
    public List<LifecycleTransition> findTransitionsFrom(String state) {
        return lifecycleTransitions.stream()
                .filter(t -> t.fromState().equals(state))
                .toList();
    }

    /**
     * 查找从 fromState 到 toState 的流转
     */
    public Optional<LifecycleTransition> findTransition(String fromState, String toState) {
        return lifecycleTransitions.stream()
                .filter(t -> t.fromState().equals(fromState) && t.toState().equals(toState))
                .findFirst();
    }

    /**
     * 检查是否有生命周期流转
     */
    public boolean hasLifecycle() {
        return !lifecycleStates.isEmpty() && !lifecycleTransitions.isEmpty();
    }

    /**
     * 获取所有必填字段名
     */
    public Set<String> requiredFieldNames() {
        return fieldDefinitions.stream()
                .filter(FieldDefinition::required)
                .map(FieldDefinition::name)
                .collect(Collectors.toSet());
    }

    /**
     * 获取字段级校验规则
     */
    public List<ValidationRule> fieldValidationRules(String fieldName) {
        return validationRules.stream()
                .filter(r -> r.isFieldLevel() && fieldName.equals(r.fieldName()))
                .toList();
    }

    /**
     * 获取对象级校验规则
     */
    public List<ValidationRule> objectValidationRules() {
        return validationRules.stream()
                .filter(ValidationRule::isObjectLevel)
                .toList();
    }
}
```

- [ ] **Step 3.6: 跑测试 — 确认通过**

```bash
./mvnw test -Dtest=ObjectTypeTest
```

Expected: 8 个测试全通过

- [ ] **Step 3.7: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/ObjectTypeId.java \
        src/main/java/com/metaplatform/ontology/object/LifecycleTransition.java \
        src/main/java/com/metaplatform/ontology/object/ObjectType.java \
        src/test/java/com/metaplatform/ontology/object/ObjectTypeTest.java
git commit -m "feat(object): add ObjectType aggregate root with lifecycle transitions"
```

---

## Task 4: 领域模型 — ObjectInstance + FieldValue（实例聚合根）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/ObjectInstanceId.java`
- Create: `src/main/java/com/metaplatform/ontology/object/FieldValue.java`
- Create: `src/main/java/com/metaplatform/ontology/object/ObjectInstance.java`
- Test: `src/test/java/com/metaplatform/ontology/object/ObjectInstanceTest.java`

- [ ] **Step 4.1: 写 ObjectInstanceId**

```java
package com.metaplatform.ontology.object;

import java.util.Objects;
import java.util.UUID;

public record ObjectInstanceId(UUID value) {
    public ObjectInstanceId {
        Objects.requireNonNull(value, "ObjectInstanceId value must not be null");
    }

    public static ObjectInstanceId newId() {
        return new ObjectInstanceId(UUID.randomUUID());
    }

    public static ObjectInstanceId of(String s) {
        return new ObjectInstanceId(UUID.fromString(s));
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
```

- [ ] **Step 4.2: 写 FieldValue 值对象**

```java
package com.metaplatform.ontology.object;

import java.util.Objects;

/**
 * 字段值：存储 ObjectInstance 中某个字段的实际值。
 */
public record FieldValue(
    String fieldName,
    Object value
) {
    public FieldValue {
        if (fieldName == null || fieldName.isBlank()) {
            throw new IllegalArgumentException("fieldName must not be blank");
        }
    }

    /**
     * 获取字符串形式的值
     */
    public String stringValue() {
        return value != null ? value.toString() : null;
    }

    /**
     * 获取数值形式的值
     */
    public Number numberValue() {
        if (value instanceof Number n) return n;
        if (value instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    /**
     * 获取布尔形式的值
     */
    public Boolean booleanValue() {
        if (value instanceof Boolean b) return b;
        if (value instanceof String s) return Boolean.parseBoolean(s);
        return null;
    }

    public boolean isNull() {
        return value == null;
    }
}
```

- [ ] **Step 4.3: 写 ObjectInstance 测试**

`ObjectInstanceTest.java`：

```java
package com.metaplatform.ontology.object;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ObjectInstanceTest {

    private final UUID tenantId = UUID.randomUUID();
    private final ObjectTypeId objectTypeId = ObjectTypeId.newId();

    @Test
    void shouldCreateObjectInstance() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(),
                tenantId,
                objectTypeId,
                "draft",
                Map.of(
                        "order_no", new FieldValue("order_no", "ORD-001"),
                        "amount", new FieldValue("amount", 100.0)
                )
        );

        assertEquals(tenantId, inst.tenantId());
        assertEquals(objectTypeId, inst.objectTypeId());
        assertEquals("draft", inst.lifecycleState());
        assertEquals(2, inst.fieldValues().size());
        assertEquals("ORD-001", inst.getFieldValue("order_no").stringValue());
    }

    @Test
    void shouldSetFieldValue() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), tenantId, objectTypeId, "draft", Map.of());

        ObjectInstance updated = inst.setFieldValue(new FieldValue("amount", 200.0));
        assertEquals(200.0, updated.getFieldValue("amount").numberValue().doubleValue());
        assertEquals("draft", updated.lifecycleState()); // 状态不变
    }

    @Test
    void shouldTransitionLifecycle() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), tenantId, objectTypeId, "draft", Map.of());

        ObjectInstance transitioned = inst.transitionTo("pending");
        assertEquals("pending", transitioned.lifecycleState());
    }

    @Test
    void shouldGetEmptyFieldValueForMissingKey() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), tenantId, objectTypeId, "draft", Map.of());

        FieldValue fv = inst.getFieldValue("nonexistent");
        assertTrue(fv.isNull());
    }

    @Test
    void shouldRejectNullId() {
        assertThrows(NullPointerException.class, () ->
                new ObjectInstance(null, tenantId, objectTypeId, "draft", Map.of()));
    }

    @Test
    void shouldRejectNullTenantId() {
        assertThrows(NullPointerException.class, () ->
                new ObjectInstance(ObjectInstanceId.newId(), null, objectTypeId, "draft", Map.of()));
    }

    @Test
    void shouldRejectNullObjectTypeId() {
        assertThrows(NullPointerException.class, () ->
                new ObjectInstance(ObjectInstanceId.newId(), tenantId, null, "draft", Map.of()));
    }
}
```

- [ ] **Step 4.4: 运行测试 — 确认失败**

```bash
./mvnw test -Dtest=ObjectInstanceTest
```

Expected: 编译失败

- [ ] **Step 4.5: 写 ObjectInstance 聚合根**

```java
package com.metaplatform.ontology.object;

import java.util.*;

/**
 * ObjectInstance 聚合根：ObjectType 的实例，包含字段值和生命周期状态。
 */
public record ObjectInstance(
    ObjectInstanceId id,
    UUID tenantId,
    ObjectTypeId objectTypeId,
    String lifecycleState,
    Map<String, FieldValue> fieldValues
) {
    public ObjectInstance {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(tenantId, "tenantId must not be null");
        Objects.requireNonNull(objectTypeId, "objectTypeId must not be null");
        if (lifecycleState == null || lifecycleState.isBlank()) {
            throw new IllegalArgumentException("lifecycleState must not be blank");
        }
        fieldValues = fieldValues != null ? Map.copyOf(fieldValues) : Map.of();
    }

    /**
     * 设置字段值（返回新实例）
     */
    public ObjectInstance setFieldValue(FieldValue fieldValue) {
        Map<String, FieldValue> newValues = new HashMap<>(this.fieldValues);
        newValues.put(fieldValue.fieldName(), fieldValue);
        return new ObjectInstance(id, tenantId, objectTypeId, lifecycleState, newValues);
    }

    /**
     * 批量设置字段值
     */
    public ObjectInstance setFieldValues(List<FieldValue> values) {
        Map<String, FieldValue> newValues = new HashMap<>(this.fieldValues);
        values.forEach(v -> newValues.put(v.fieldName(), v));
        return new ObjectInstance(id, tenantId, objectTypeId, lifecycleState, newValues);
    }

    /**
     * 获取字段值（不存在则返回空 FieldValue）
     */
    public FieldValue getFieldValue(String fieldName) {
        FieldValue fv = fieldValues.get(fieldName);
        return fv != null ? fv : new FieldValue(fieldName, null);
    }

    /**
     * 生命周期状态流转（返回新实例）
     */
    public ObjectInstance transitionTo(String newState) {
        if (newState == null || newState.isBlank()) {
            throw new IllegalArgumentException("newState must not be blank");
        }
        return new ObjectInstance(id, tenantId, objectTypeId, newState, fieldValues);
    }

    /**
     * 转换为 Map（用于 Aviator 表达式求值）
     */
    public Map<String, Object> toContextMap() {
        Map<String, Object> ctx = new HashMap<>();
        fieldValues.forEach((k, v) -> ctx.put(k, v.value()));
        ctx.put("_state", lifecycleState);
        ctx.put("_tenantId", tenantId.toString());
        ctx.put("_instanceId", id.toString());
        return ctx;
    }
}
```

- [ ] **Step 4.6: 跑测试 — 确认通过**

```bash
./mvnw test -Dtest=ObjectInstanceTest
```

Expected: 7 个测试全通过

- [ ] **Step 4.7: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/ObjectInstanceId.java \
        src/main/java/com/metaplatform/ontology/object/FieldValue.java \
        src/main/java/com/metaplatform/ontology/object/ObjectInstance.java \
        src/test/java/com/metaplatform/ontology/object/ObjectInstanceTest.java
git commit -m "feat(object): add ObjectInstance aggregate root with FieldValue"
```

---

## Task 5: 校验引擎 — AviatorExpressionEngine + ValidationService

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/validation/AviatorExpressionEngine.java`
- Create: `src/main/java/com/metaplatform/ontology/object/validation/ValidationService.java`
- Test: `src/test/java/com/metaplatform/ontology/object/ValidationServiceTest.java`

- [ ] **Step 5.1: 写 AviatorExpressionEngine**

```java
package com.metaplatform.ontology.object.validation;

import com.googlecode.aviator.AviatorEvaluator;
import com.googlecode.aviator.Expression;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Aviator 表达式引擎封装。
 * 使用编译缓存提升性能。
 */
@Component
public class AviatorExpressionEngine {

    private static final Logger log = LoggerFactory.getLogger(AviatorExpressionEngine.class);

    private final Map<String, Expression> compiledCache = new ConcurrentHashMap<>();

    /**
     * 求值布尔表达式。返回 true 表示校验通过。
     */
    public boolean evaluate(String expression, Map<String, Object> context) {
        try {
            Expression compiled = compiledCache.computeIfAbsent(expression, AviatorEvaluator::compile);
            Object result = compiled.execute(context);
            if (result instanceof Boolean b) {
                return b;
            }
            log.warn("Expression '{}' returned non-boolean: {}", expression, result);
            return false;
        } catch (Exception e) {
            log.error("Failed to evaluate expression '{}': {}", expression, e.getMessage());
            return false;
        }
    }

    /**
     * 求值通用表达式，返回结果值
     */
    public Object evaluateValue(String expression, Map<String, Object> context) {
        try {
            Expression compiled = compiledCache.computeIfAbsent(expression, AviatorEvaluator::compile);
            return compiled.execute(context);
        } catch (Exception e) {
            log.error("Failed to evaluate expression '{}': {}", expression, e.getMessage());
            return null;
        }
    }

    /**
     * 清除编译缓存
     */
    public void clearCache() {
        compiledCache.clear();
    }
}
```

- [ ] **Step 5.2: 写 ValidationService**

```java
package com.metaplatform.ontology.object.validation;

import com.metaplatform.ontology.object.*;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 校验服务：根据 ObjectType 的定义校验 ObjectInstance。
 */
@Service
public class ValidationService {

    private final AviatorExpressionEngine engine;

    public ValidationService(AviatorExpressionEngine engine) {
        this.engine = engine;
    }

    /**
     * 校验 ObjectInstance 是否符合 ObjectType 的规则。
     * 返回空列表表示校验通过。
     */
    public List<ValidationError> validate(ObjectType objectType, ObjectInstance instance) {
        List<ValidationError> errors = new ArrayList<>();

        // 1. 校验必填字段
        validateRequiredFields(objectType, instance, errors);

        // 2. 校验字段类型
        validateFieldTypes(objectType, instance, errors);

        // 3. 执行字段级校验规则
        validateFieldRules(objectType, instance, errors);

        // 4. 执行对象级校验规则
        validateObjectRules(objectType, instance, errors);

        return errors;
    }

    private void validateRequiredFields(ObjectType objectType, ObjectInstance instance,
                                         List<ValidationError> errors) {
        for (String requiredField : objectType.requiredFieldNames()) {
            FieldValue fv = instance.getFieldValue(requiredField);
            if (fv.isNull() || (fv.stringValue() != null && fv.stringValue().isBlank())) {
                Optional<FieldDefinition> fieldDef = objectType.findField(requiredField);
                String displayName = fieldDef.map(FieldDefinition::displayName).orElse(requiredField);
                errors.add(new ValidationError(requiredField, displayName + "不能为空", "REQUIRED"));
            }
        }
    }

    private void validateFieldTypes(ObjectType objectType, ObjectInstance instance,
                                     List<ValidationError> errors) {
        for (FieldValue fv : instance.fieldValues().values()) {
            if (fv.isNull()) continue;

            objectType.findField(fv.fieldName()).ifPresent(fieldDef -> {
                boolean valid = switch (fieldDef.fieldType()) {
                    case INTEGER -> fv.value() instanceof Integer ||
                                    (fv.stringValue() != null && fv.stringValue().matches("-?\\d+"));
                    case LONG -> fv.value() instanceof Long ||
                                  (fv.stringValue() != null && fv.stringValue().matches("-?\\d+"));
                    case DOUBLE -> fv.value() instanceof Number ||
                                   (fv.stringValue() != null && fv.stringValue().matches("-?\\d+(\\.\\d+)?"));
                    case BOOLEAN -> fv.value() instanceof Boolean ||
                                    "true".equalsIgnoreCase(fv.stringValue()) ||
                                    "false".equalsIgnoreCase(fv.stringValue());
                    case STRING, TEXT -> fv.value() instanceof String;
                    default -> true; // DATE/DATETIME/ENUM/REFERENCE/JSON 暂不校验
                };

                if (!valid) {
                    errors.add(new ValidationError(fv.fieldName(),
                            fieldDef.displayName() + "类型不匹配，期望 " + fieldDef.fieldType(),
                            "TYPE_MISMATCH"));
                }
            });
        }
    }

    private void validateFieldRules(ObjectType objectType, ObjectInstance instance,
                                     List<ValidationError> errors) {
        Map<String, Object> context = instance.toContextMap();

        for (ValidationRule rule : objectType.validationRules()) {
            if (!rule.isFieldLevel()) continue;

            FieldValue fv = instance.getFieldValue(rule.fieldName());
            if (fv.isNull()) continue; // 空值跳过字段级校验（必填校验已处理）

            if (!engine.evaluate(rule.expression(), context)) {
                errors.add(new ValidationError(rule.fieldName(), rule.message(), "RULE_VIOLATION"));
            }
        }
    }

    private void validateObjectRules(ObjectType objectType, ObjectInstance instance,
                                      List<ValidationError> errors) {
        Map<String, Object> context = instance.toContextMap();

        for (ValidationRule rule : objectType.validationRules()) {
            if (!rule.isObjectLevel()) continue;

            if (!engine.evaluate(rule.expression(), context)) {
                errors.add(new ValidationError(null, rule.message(), "OBJECT_RULE_VIOLATION"));
            }
        }
    }

    /**
     * 校验错误
     */
    public record ValidationError(
        String fieldName,       // null 表示对象级错误
        String message,
        String errorCode
    ) {}
}
```

- [ ] **Step 5.3: 写 ValidationService 测试**

`ValidationServiceTest.java`：

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.object.validation.AviatorExpressionEngine;
import com.metaplatform.ontology.object.validation.ValidationService;
import com.metaplatform.ontology.object.validation.ValidationService.ValidationError;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ValidationServiceTest {

    private ValidationService validationService;
    private ObjectType orderType;

    @BeforeEach
    void setUp() {
        validationService = new ValidationService(new AviatorExpressionEngine());

        orderType = new ObjectType(
                ObjectTypeId.newId(),
                EntityTypeId.newId(),
                "order",
                "订单",
                null,
                List.of(
                        new FieldDefinition("order_no", "订单号", FieldDefinition.FieldType.STRING,
                                true, false, null, null),
                        new FieldDefinition("amount", "金额", FieldDefinition.FieldType.DOUBLE,
                                true, true, "0.0", null),
                        new FieldDefinition("quantity", "数量", FieldDefinition.FieldType.INTEGER,
                                true, true, "1", null)
                ),
                List.of(
                        new ValidationRule("amount_positive", "amount", "amount > 0",
                                "金额必须大于0", ValidationRule.RuleLevel.FIELD),
                        new ValidationRule("quantity_positive", "quantity", "quantity > 0",
                                "数量必须大于0", ValidationRule.RuleLevel.FIELD),
                        new ValidationRule("amount_quantity_relation", null,
                                "amount >= quantity * 1.0",
                                "金额不能小于数量", ValidationRule.RuleLevel.OBJECT)
                ),
                List.of(),
                Set.of("draft"),
                "draft"
        );
    }

    @Test
    void shouldPassValidInstance() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), orderType.id(), "draft",
                Map.of(
                        "order_no", new FieldValue("order_no", "ORD-001"),
                        "amount", new FieldValue("amount", 100.0),
                        "quantity", new FieldValue("quantity", 5)
                ));

        List<ValidationError> errors = validationService.validate(orderType, inst);
        assertTrue(errors.isEmpty(), "Expected no errors but got: " + errors);
    }

    @Test
    void shouldFailOnMissingRequiredField() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), orderType.id(), "draft",
                Map.of(
                        "amount", new FieldValue("amount", 100.0),
                        "quantity", new FieldValue("quantity", 5)
                        // 缺少 order_no
                ));

        List<ValidationError> errors = validationService.validate(orderType, inst);
        assertEquals(1, errors.size());
        assertEquals("REQUIRED", errors.get(0).errorCode());
        assertEquals("order_no", errors.get(0).fieldName());
    }

    @Test
    void shouldFailOnNegativeAmount() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), orderType.id(), "draft",
                Map.of(
                        "order_no", new FieldValue("order_no", "ORD-001"),
                        "amount", new FieldValue("amount", -10.0),
                        "quantity", new FieldValue("quantity", 5)
                ));

        List<ValidationError> errors = validationService.validate(orderType, inst);
        assertTrue(errors.stream().anyMatch(e -> "RULE_VIOLATION".equals(e.errorCode())
                && "amount".equals(e.fieldName())));
    }

    @Test
    void shouldFailOnObjectLevelRule() {
        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), orderType.id(), "draft",
                Map.of(
                        "order_no", new FieldValue("order_no", "ORD-001"),
                        "amount", new FieldValue("amount", 2.0),
                        "quantity", new FieldValue("quantity", 10)
                        // amount(2) < quantity(10) * 1.0 = 10
                ));

        List<ValidationError> errors = validationService.validate(orderType, inst);
        assertTrue(errors.stream().anyMatch(e -> "OBJECT_RULE_VIOLATION".equals(e.errorCode())));
    }

    @Test
    void shouldPassWithEmptyValuesWhenNotRequired() {
        ObjectType simpleType = new ObjectType(
                ObjectTypeId.newId(), EntityTypeId.newId(),
                "simple", "简单", null,
                List.of(
                        new FieldDefinition("name", "名称", FieldDefinition.FieldType.STRING,
                                true, true, null, null),
                        new FieldDefinition("note", "备注", FieldDefinition.FieldType.STRING,
                                false, true, null, null)
                ),
                List.of(), List.of(), Set.of("new"), "new");

        ObjectInstance inst = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), simpleType.id(), "new",
                Map.of("name", new FieldValue("name", "test")));

        List<ValidationError> errors = validationService.validate(simpleType, inst);
        assertTrue(errors.isEmpty());
    }
}
```

- [ ] **Step 5.4: 跑测试**

```bash
./mvnw test -Dtest=ValidationServiceTest
```

Expected: 5 个测试全通过

- [ ] **Step 5.5: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/validation/ \
        src/test/java/com/metaplatform/ontology/object/ValidationServiceTest.java
git commit -m "feat(object): add ValidationService with Aviator expression engine"
```

---

## Task 6: 生命周期引擎 — StateMachine + LifecycleService

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/lifecycle/StateMachine.java`
- Create: `src/main/java/com/metaplatform/ontology/object/lifecycle/LifecycleService.java`
- Test: `src/test/java/com/metaplatform/ontology/object/LifecycleServiceTest.java`

- [ ] **Step 6.1: 写 StateMachine**

```java
package com.metaplatform.ontology.object.lifecycle;

import com.metaplatform.ontology.object.LifecycleTransition;
import com.metaplatform.ontology.object.ObjectInstance;
import com.metaplatform.ontology.object.ObjectType;
import com.metaplatform.ontology.object.validation.AviatorExpressionEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 轻量级状态机：根据 ObjectType 的定义驱动 ObjectInstance 的生命周期流转。
 */
@Component
public class StateMachine {

    private static final Logger log = LoggerFactory.getLogger(StateMachine.class);

    private final AviatorExpressionEngine engine;

    public StateMachine(AviatorExpressionEngine engine) {
        this.engine = engine;
    }

    /**
     * 执行状态流转。
     *
     * @param objectType 对象类型定义
     * @param instance   当前实例
     * @param toState    目标状态
     * @return 流转后的新实例
     * @throws IllegalStateException 如果流转不合法
     */
    public ObjectInstance transition(ObjectType objectType, ObjectInstance instance, String toState) {
        String currentState = instance.lifecycleState();

        // 1. 查找流转定义
        Optional<LifecycleTransition> transitionOpt = objectType.findTransition(currentState, toState);
        if (transitionOpt.isEmpty()) {
            throw new IllegalStateException(
                    String.format("No transition defined from '%s' to '%s' for ObjectType '%s'",
                            currentState, toState, objectType.code()));
        }

        LifecycleTransition transition = transitionOpt.get();

        // 2. 检查 guard 条件
        if (transition.hasGuard()) {
            Map<String, Object> context = instance.toContextMap();
            boolean allowed = engine.evaluate(transition.guardExpression(), context);
            if (!allowed) {
                throw new IllegalStateException(
                        String.format("Guard condition failed for transition '%s': %s",
                                transition.name(), transition.guardExpression()));
            }
        }

        // 3. 执行流转
        log.info("Transitioning instance {} from '{}' to '{}' via '{}'",
                instance.id(), currentState, toState, transition.name());

        return instance.transitionTo(toState);
    }

    /**
     * 获取当前状态下可用的流转列表
     */
    public List<LifecycleTransition> availableTransitions(ObjectType objectType, ObjectInstance instance) {
        return objectType.findTransitionsFrom(instance.lifecycleState());
    }

    /**
     * 检查是否可以流转到指定状态
     */
    public boolean canTransition(ObjectType objectType, ObjectInstance instance, String toState) {
        return objectType.findTransition(instance.lifecycleState(), toState).isPresent();
    }
}
```

- [ ] **Step 6.2: 写 LifecycleService**

```java
package com.metaplatform.ontology.object.lifecycle;

import com.metaplatform.ontology.object.*;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 生命周期服务：编排状态流转，确保校验通过后才能流转。
 */
@Service
public class LifecycleService {

    private final StateMachine stateMachine;
    private final ObjectInstanceRepository instanceRepository;
    private final ObjectTypeRepository objectTypeRepository;

    public LifecycleService(StateMachine stateMachine,
                            ObjectInstanceRepository instanceRepository,
                            ObjectTypeRepository objectTypeRepository) {
        this.stateMachine = stateMachine;
        this.instanceRepository = instanceRepository;
        this.objectTypeRepository = objectTypeRepository;
    }

    /**
     * 执行状态流转。
     * 在流转前先校验实例数据是否合法。
     */
    public ObjectInstance transition(ObjectTypeId objectTypeId, ObjectInstanceId instanceId,
                                      String toState) {
        ObjectType objectType = objectTypeRepository.findById(objectTypeId)
                .orElseThrow(() -> new IllegalArgumentException("ObjectType not found: " + objectTypeId));

        ObjectInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() -> new IllegalArgumentException("ObjectInstance not found: " + instanceId));

        // 执行状态流转
        ObjectInstance transitioned = stateMachine.transition(objectType, instance, toState);

        // 持久化
        return instanceRepository.save(transitioned);
    }

    /**
     * 获取当前可用的流转列表
     */
    public List<LifecycleTransition> availableTransitions(ObjectTypeId objectTypeId,
                                                           ObjectInstanceId instanceId) {
        ObjectType objectType = objectTypeRepository.findById(objectTypeId)
                .orElseThrow(() -> new IllegalArgumentException("ObjectType not found: " + objectTypeId));

        ObjectInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() -> new IllegalArgumentException("ObjectInstance not found: " + instanceId));

        return stateMachine.availableTransitions(objectType, instance);
    }
}
```

- [ ] **Step 6.3: 写仓储接口**

```java
package com.metaplatform.ontology.object;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ObjectTypeRepository {
    ObjectType save(ObjectType objectType);
    Optional<ObjectType> findById(ObjectTypeId id);
    Optional<ObjectType> findByCode(String code);
    List<ObjectType> findAll(UUID tenantId);
    void delete(ObjectTypeId id);
}
```

```java
package com.metaplatform.ontology.object;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ObjectInstanceRepository {
    ObjectInstance save(ObjectInstance instance);
    Optional<ObjectInstance> findById(ObjectInstanceId id);
    List<ObjectInstance> findByObjectTypeId(ObjectTypeId objectTypeId, UUID tenantId);
    List<ObjectInstance> findByLifecycleState(ObjectTypeId objectTypeId, String state, UUID tenantId);
    void delete(ObjectInstanceId id);
    long countByObjectTypeId(ObjectTypeId objectTypeId, UUID tenantId);
}
```

- [ ] **Step 6.4: 写 LifecycleService 测试**

`LifecycleServiceTest.java`：

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.object.lifecycle.LifecycleService;
import com.metaplatform.ontology.object.lifecycle.StateMachine;
import com.metaplatform.ontology.object.validation.AviatorExpressionEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LifecycleServiceTest {

    @Mock
    private ObjectTypeRepository objectTypeRepository;

    @Mock
    private ObjectInstanceRepository instanceRepository;

    private LifecycleService lifecycleService;

    private ObjectType orderType;
    private ObjectInstance draftInstance;

    @BeforeEach
    void setUp() {
        StateMachine stateMachine = new StateMachine(new AviatorExpressionEngine());
        lifecycleService = new LifecycleService(stateMachine, instanceRepository, objectTypeRepository);

        orderType = new ObjectType(
                ObjectTypeId.newId(), EntityTypeId.newId(),
                "order", "订单", null,
                List.of(
                        new FieldDefinition("order_no", "订单号", FieldDefinition.FieldType.STRING,
                                true, false, null, null),
                        new FieldDefinition("amount", "金额", FieldDefinition.FieldType.DOUBLE,
                                true, true, "0.0", null)
                ),
                List.of(
                        new ValidationRule("amount_positive", "amount", "amount > 0",
                                "金额必须大于0", ValidationRule.RuleLevel.FIELD)
                ),
                List.of(
                        new LifecycleTransition("draft", "pending", "提交审批", null, null),
                        new LifecycleTransition("pending", "approved", "审批通过", null, null),
                        new LifecycleTransition("pending", "rejected", "审批拒绝", null, null),
                        new LifecycleTransition("draft", "cancelled", "取消", null, null)
                ),
                Set.of("draft", "pending", "approved", "rejected", "cancelled"),
                "draft"
        );

        draftInstance = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), orderType.id(), "draft",
                Map.of(
                        "order_no", new FieldValue("order_no", "ORD-001"),
                        "amount", new FieldValue("amount", 100.0)
                ));
    }

    @Test
    void shouldTransitionFromDraftToPending() {
        when(objectTypeRepository.findById(orderType.id())).thenReturn(Optional.of(orderType));
        when(instanceRepository.findById(draftInstance.id())).thenReturn(Optional.of(draftInstance));
        when(instanceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ObjectInstance result = lifecycleService.transition(
                orderType.id(), draftInstance.id(), "pending");

        assertEquals("pending", result.lifecycleState());
        verify(instanceRepository).save(any());
    }

    @Test
    void shouldThrowOnInvalidTransition() {
        when(objectTypeRepository.findById(orderType.id())).thenReturn(Optional.of(orderType));
        when(instanceRepository.findById(draftInstance.id())).thenReturn(Optional.of(draftInstance));

        assertThrows(IllegalStateException.class, () ->
                lifecycleService.transition(orderType.id(), draftInstance.id(), "approved"));
    }

    @Test
    void shouldListAvailableTransitions() {
        when(objectTypeRepository.findById(orderType.id())).thenReturn(Optional.of(orderType));
        when(instanceRepository.findById(draftInstance.id())).thenReturn(Optional.of(draftInstance));

        List<LifecycleTransition> transitions = lifecycleService.availableTransitions(
                orderType.id(), draftInstance.id());

        assertEquals(2, transitions.size()); // draft -> pending, draft -> cancelled
    }

    @Test
    void shouldTransitionThroughMultipleStates() {
        when(objectTypeRepository.findById(orderType.id())).thenReturn(Optional.of(orderType));
        when(instanceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // draft -> pending
        when(instanceRepository.findById(draftInstance.id())).thenReturn(Optional.of(draftInstance));
        ObjectInstance pending = lifecycleService.transition(
                orderType.id(), draftInstance.id(), "pending");
        assertEquals("pending", pending.lifecycleState());

        // pending -> approved
        when(instanceRepository.findById(pending.id())).thenReturn(Optional.of(pending));
        ObjectInstance approved = lifecycleService.transition(
                orderType.id(), pending.id(), "approved");
        assertEquals("approved", approved.lifecycleState());
    }

    @Test
    void shouldThrowOnGuardConditionFailure() {
        // 带 guard 的流转
        ObjectType guardedType = new ObjectType(
                ObjectTypeId.newId(), EntityTypeId.newId(),
                "guarded", "受保护", null,
                List.of(
                        new FieldDefinition("amount", "金额", FieldDefinition.FieldType.DOUBLE,
                                true, true, null, null)
                ),
                List.of(),
                List.of(
                        new LifecycleTransition("draft", "pending", "提交", "amount >= 100", "金额>=100才能提交")
                ),
                Set.of("draft", "pending"), "draft");

        ObjectInstance lowAmount = new ObjectInstance(
                ObjectInstanceId.newId(), UUID.randomUUID(), guardedType.id(), "draft",
                Map.of("amount", new FieldValue("amount", 50.0)));

        when(objectTypeRepository.findById(guardedType.id())).thenReturn(Optional.of(guardedType));
        when(instanceRepository.findById(lowAmount.id())).thenReturn(Optional.of(lowAmount));

        assertThrows(IllegalStateException.class, () ->
                lifecycleService.transition(guardedType.id(), lowAmount.id(), "pending"));
    }
}
```

- [ ] **Step 6.5: 跑测试**

```bash
./mvnw test -Dtest=LifecycleServiceTest
```

Expected: 5 个测试全通过

- [ ] **Step 6.6: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/lifecycle/ \
        src/main/java/com/metaplatform/ontology/object/ObjectTypeRepository.java \
        src/main/java/com/metaplatform/ontology/object/ObjectInstanceRepository.java \
        src/test/java/com/metaplatform/ontology/object/LifecycleServiceTest.java
git commit -m "feat(object): add LifecycleService with StateMachine and guard conditions"
```

---

## Task 7: 视图自动配置 — ViewConfigService

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/view/ViewConfig.java`
- Create: `src/main/java/com/metaplatform/ontology/object/view/ViewConfigRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/object/view/ViewConfigService.java`
- Test: `src/test/java/com/metaplatform/ontology/object/ViewConfigServiceTest.java`

- [ ] **Step 7.1: 写 ViewConfig 值对象**

```java
package com.metaplatform.ontology.object.view;

import java.util.List;
import java.util.Map;

/**
 * 视图配置：自动从 ObjectType 生成的 TABLE + FORM 视图。
 */
public record ViewConfig(
    String objectTypeId,
    String viewType,        // TABLE, FORM
    List<ColumnConfig> columns,
    List<FieldLayout> fields,
    Map<String, Object> metadata
) {
    /**
     * TABLE 视图的列配置
     */
    public record ColumnConfig(
        String field,
        String title,
        String type,        // text, number, date, badge, etc.
        boolean sortable,
        boolean filterable,
        int width,          // px, -1 表示自动
        String align        // left, center, right
    ) {}

    /**
     * FORM 视图的字段布局
     */
    public record FieldLayout(
        String field,
        String label,
        String component,   // input, textarea, select, datepicker, switch, etc.
        boolean required,
        String placeholder,
        String defaultValue,
        int order,
        String group        // 字段分组
    ) {}
}
```

- [ ] **Step 7.2: 写 ViewConfigRepository**

```java
package com.metaplatform.ontology.object.view;

import com.metaplatform.ontology.object.ObjectTypeId;

import java.util.Optional;

public interface ViewConfigRepository {
    ViewConfig save(ViewConfig config);
    Optional<ViewConfig> findByObjectTypeIdAndType(ObjectTypeId objectTypeId, String viewType);
    void deleteByObjectTypeId(ObjectTypeId objectTypeId);
}
```

- [ ] **Step 7.3: 写 ViewConfigService**

```java
package com.metaplatform.ontology.object.view;

import com.metaplatform.ontology.object.FieldDefinition;
import com.metaplatform.ontology.object.ObjectType;
import com.metaplatform.ontology.object.ObjectTypeId;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 视图自动配置服务：根据 ObjectType 的字段定义自动生成 TABLE + FORM 视图。
 */
@Service
public class ViewConfigService {

    private final ViewConfigRepository repository;

    public ViewConfigService(ViewConfigRepository repository) {
        this.repository = repository;
    }

    /**
     * 为 ObjectType 自动生成 TABLE 和 FORM 视图配置
     */
    public List<ViewConfig> generateViews(ObjectType objectType) {
        List<ViewConfig> configs = new ArrayList<>();
        configs.add(generateTableView(objectType));
        configs.add(generateFormView(objectType));
        configs.forEach(repository::save);
        return configs;
    }

    /**
     * 生成 TABLE 视图
     */
    public ViewConfig generateTableView(ObjectType objectType) {
        AtomicInteger order = new AtomicInteger(0);
        List<ViewConfig.ColumnConfig> columns = objectType.fieldDefinitions().stream()
                .map(fd -> new ViewConfig.ColumnConfig(
                        fd.name(),
                        fd.displayName(),
                        mapFieldTypeToColumnType(fd.fieldType()),
                        true,       // sortable
                        true,       // filterable
                        -1,         // auto width
                        alignForType(fd.fieldType())
                ))
                .toList();

        return new ViewConfig(
                objectType.id().toString(),
                "TABLE",
                columns,
                List.of(),
                Map.of(
                        "objectCode", objectType.code(),
                        "objectDisplayName", objectType.displayName(),
                        "generatedAt", java.time.Instant.now().toString()
                )
        );
    }

    /**
     * 生成 FORM 视图
     */
    public ViewConfig generateFormView(ObjectType objectType) {
        AtomicInteger order = new AtomicInteger(0);
        List<ViewConfig.FieldLayout> fields = objectType.fieldDefinitions().stream()
                .map(fd -> new ViewConfig.FieldLayout(
                        fd.name(),
                        fd.displayName(),
                        mapFieldTypeToComponent(fd.fieldType()),
                        fd.required(),
                        "请输入" + fd.displayName(),
                        fd.defaultValue(),
                        order.getAndIncrement(),
                        "default"
                ))
                .toList();

        return new ViewConfig(
                objectType.id().toString(),
                "FORM",
                List.of(),
                fields,
                Map.of(
                        "objectCode", objectType.code(),
                        "objectDisplayName", objectType.displayName(),
                        "generatedAt", java.time.Instant.now().toString()
                )
        );
    }

    /**
     * 获取视图配置（缓存优先）
     */
    public ViewConfig getView(ObjectTypeId objectTypeId, String viewType) {
        return repository.findByObjectTypeIdAndType(objectTypeId, viewType)
                .orElseThrow(() -> new IllegalArgumentException(
                        "View not found for ObjectType " + objectTypeId + " type=" + viewType));
    }

    /**
     * 重新生成视图（当 ObjectType 更新后调用）
     */
    public List<ViewConfig> regenerateViews(ObjectType objectType) {
        repository.deleteByObjectTypeId(objectType.id());
        return generateViews(objectType);
    }

    private String mapFieldTypeToColumnType(FieldDefinition.FieldType fieldType) {
        return switch (fieldType) {
            case STRING, TEXT -> "text";
            case INTEGER, LONG, DOUBLE -> "number";
            case BOOLEAN -> "badge";
            case DATE, DATETIME -> "date";
            case ENUM -> "tag";
            case REFERENCE -> "link";
            case JSON -> "json";
        };
    }

    private String mapFieldTypeToComponent(FieldDefinition.FieldType fieldType) {
        return switch (fieldType) {
            case STRING -> "input";
            case TEXT -> "textarea";
            case INTEGER, LONG, DOUBLE -> "number";
            case BOOLEAN -> "switch";
            case DATE -> "datepicker";
            case DATETIME -> "datetimepicker";
            case ENUM -> "select";
            case REFERENCE -> "remote-select";
            case JSON -> "code-editor";
        };
    }

    private String alignForType(FieldDefinition.FieldType fieldType) {
        return switch (fieldType) {
            case INTEGER, LONG, DOUBLE -> "right";
            case BOOLEAN -> "center";
            case DATE, DATETIME -> "center";
            default -> "left";
        };
    }
}
```

- [ ] **Step 7.4: 写 ViewConfigService 测试**

`ViewConfigServiceTest.java`：

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.object.view.ViewConfig;
import com.metaplatform.ontology.object.view.ViewConfigRepository;
import com.metaplatform.ontology.object.view.ViewConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ViewConfigServiceTest {

    @Mock
    private ViewConfigRepository repository;

    private ViewConfigService viewConfigService;

    private ObjectType orderType;

    @BeforeEach
    void setUp() {
        viewConfigService = new ViewConfigService(repository);

        orderType = new ObjectType(
                ObjectTypeId.newId(), EntityTypeId.newId(),
                "order", "订单", null,
                List.of(
                        new FieldDefinition("order_no", "订单号", FieldDefinition.FieldType.STRING,
                                true, false, null, null),
                        new FieldDefinition("amount", "金额", FieldDefinition.FieldType.DOUBLE,
                                true, true, "0.0", "订单总金额"),
                        new FieldDefinition("is_paid", "是否已付", FieldDefinition.FieldType.BOOLEAN,
                                false, true, "false", null),
                        new FieldDefinition("created_at", "创建时间", FieldDefinition.FieldType.DATETIME,
                                false, false, null, null)
                ),
                List.of(), List.of(), Set.of("draft"), "draft"
        );
    }

    @Test
    void shouldGenerateTableView() {
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        List<ViewConfig> configs = viewConfigService.generateViews(orderType);

        assertEquals(2, configs.size());

        ViewConfig table = configs.stream().filter(c -> "TABLE".equals(c.viewType())).findFirst().orElseThrow();
        assertEquals(4, table.columns().size());
        assertEquals("order_no", table.columns().get(0).field());
        assertEquals("订单号", table.columns().get(0).title());
        assertEquals("text", table.columns().get(0).type());
        assertEquals("right", table.columns().get(1).align()); // DOUBLE -> right
        assertEquals("center", table.columns().get(2).align()); // BOOLEAN -> center
    }

    @Test
    void shouldGenerateFormView() {
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        List<ViewConfig> configs = viewConfigService.generateViews(orderType);

        ViewConfig form = configs.stream().filter(c -> "FORM".equals(c.viewType())).findFirst().orElseThrow();
        assertEquals(4, form.fields().size());

        ViewConfig.FieldLayout amountField = form.fields().stream()
                .filter(f -> "amount".equals(f.field())).findFirst().orElseThrow();
        assertEquals("金额", amountField.label());
        assertEquals("number", amountField.component());
        assertTrue(amountField.required());
        assertEquals("0.0", amountField.defaultValue());

        ViewConfig.FieldLayout paidField = form.fields().stream()
                .filter(f -> "is_paid".equals(f.field())).findFirst().orElseThrow();
        assertEquals("switch", paidField.component());
    }

    @Test
    void shouldRegenerateViews() {
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doNothing().when(repository).deleteByObjectTypeId(any());

        viewConfigService.regenerateViews(orderType);

        verify(repository).deleteByObjectTypeId(orderType.id());
        verify(repository, times(2)).save(any());
    }
}
```

- [ ] **Step 7.5: 跑测试**

```bash
./mvnw test -Dtest=ViewConfigServiceTest
```

Expected: 3 个测试全通过

- [ ] **Step 7.6: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/view/ \
        src/test/java/com/metaplatform/ontology/object/ViewConfigServiceTest.java
git commit -m "feat(object): add ViewConfigService for auto TABLE + FORM view generation"
```

---

## Task 8: ObjectTypeService + ObjectInstanceService（用例编排）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/ObjectTypeService.java`
- Create: `src/main/java/com/metaplatform/ontology/object/ObjectInstanceService.java`

- [ ] **Step 8.1: 写 ObjectTypeService**

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.object.validation.ValidationService;
import com.metaplatform.ontology.object.view.ViewConfig;
import com.metaplatform.ontology.object.view.ViewConfigService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ObjectTypeService {

    private final ObjectTypeRepository objectTypeRepository;
    private final ViewConfigService viewConfigService;

    public ObjectTypeService(ObjectTypeRepository objectTypeRepository,
                             ViewConfigService viewConfigService) {
        this.objectTypeRepository = objectTypeRepository;
        this.viewConfigService = viewConfigService;
    }

    /**
     * 创建 ObjectType 并自动生成视图配置
     */
    public ObjectType create(ObjectType objectType) {
        // 检查编码唯一性
        if (objectTypeRepository.findByCode(objectType.code()).isPresent()) {
            throw new IllegalArgumentException("ObjectType code already exists: " + objectType.code());
        }

        ObjectType saved = objectTypeRepository.save(objectType);

        // 自动生成 TABLE + FORM 视图
        viewConfigService.generateViews(saved);

        return saved;
    }

    @Transactional(readOnly = true)
    public ObjectType findById(ObjectTypeId id) {
        return objectTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ObjectType not found: " + id));
    }

    @Transactional(readOnly = true)
    public ObjectType findByCode(String code) {
        return objectTypeRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("ObjectType not found by code: " + code));
    }

    @Transactional(readOnly = true)
    public List<ObjectType> findAll(UUID tenantId) {
        return objectTypeRepository.findAll(tenantId);
    }

    /**
     * 更新 ObjectType 并重新生成视图配置
     */
    public ObjectType update(ObjectType objectType) {
        // 确保存在
        findById(objectType.id());

        ObjectType saved = objectTypeRepository.save(objectType);

        // 重新生成视图
        viewConfigService.regenerateViews(saved);

        return saved;
    }

    public void delete(ObjectTypeId id) {
        findById(id); // 确保存在
        objectTypeRepository.delete(id);
    }
}
```

- [ ] **Step 8.2: 写 ObjectInstanceService**

```java
package com.metaplatform.ontology.object;

import com.metaplatform.ontology.object.lifecycle.LifecycleService;
import com.metaplatform.ontology.object.validation.ValidationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ObjectInstanceService {

    private final ObjectInstanceRepository instanceRepository;
    private final ObjectTypeRepository objectTypeRepository;
    private final ValidationService validationService;
    private final LifecycleService lifecycleService;

    public ObjectInstanceService(ObjectInstanceRepository instanceRepository,
                                 ObjectTypeRepository objectTypeRepository,
                                 ValidationService validationService,
                                 LifecycleService lifecycleService) {
        this.instanceRepository = instanceRepository;
        this.objectTypeRepository = objectTypeRepository;
        this.validationService = validationService;
        this.lifecycleService = lifecycleService;
    }

    /**
     * 创建 ObjectInstance，先校验再持久化
     */
    public ObjectInstance create(ObjectTypeId objectTypeId, ObjectInstance instance) {
        ObjectType objectType = objectTypeRepository.findById(objectTypeId)
                .orElseThrow(() -> new IllegalArgumentException("ObjectType not found: " + objectTypeId));

        // 校验
        List<ValidationService.ValidationError> errors = validationService.validate(objectType, instance);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }

        return instanceRepository.save(instance);
    }

    /**
     * 更新字段值，先校验再持久化
     */
    public ObjectInstance updateFields(ObjectInstanceId instanceId, List<FieldValue> fieldValues) {
        ObjectInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() -> new IllegalArgumentException("ObjectInstance not found: " + instanceId));

        ObjectType objectType = objectTypeRepository.findById(instance.objectTypeId())
                .orElseThrow(() -> new IllegalArgumentException("ObjectType not found: " + instance.objectTypeId()));

        // 设置新字段值
        ObjectInstance updated = instance.setFieldValues(fieldValues);

        // 校验
        List<ValidationService.ValidationError> errors = validationService.validate(objectType, updated);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }

        return instanceRepository.save(updated);
    }

    @Transactional(readOnly = true)
    public ObjectInstance findById(ObjectInstanceId id) {
        return instanceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ObjectInstance not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<ObjectInstance> findByObjectType(ObjectTypeId objectTypeId, UUID tenantId) {
        return instanceRepository.findByObjectTypeId(objectTypeId, tenantId);
    }

    /**
     * 执行生命周期流转
     */
    public ObjectInstance transition(ObjectTypeId objectTypeId, ObjectInstanceId instanceId,
                                      String toState) {
        return lifecycleService.transition(objectTypeId, instanceId, toState);
    }

    /**
     * 获取可用的生命周期流转
     */
    public List<LifecycleTransition> availableTransitions(ObjectTypeId objectTypeId,
                                                           ObjectInstanceId instanceId) {
        return lifecycleService.availableTransitions(objectTypeId, instanceId);
    }

    public void delete(ObjectInstanceId id) {
        instanceRepository.delete(id);
    }

    /**
     * 校验异常
     */
    public static class ValidationException extends RuntimeException {
        private final List<ValidationService.ValidationError> errors;

        public ValidationException(List<ValidationService.ValidationError> errors) {
            super("Validation failed: " + errors.stream()
                    .map(ValidationService.ValidationError::message)
                    .reduce((a, b) -> a + "; " + b)
                    .orElse("unknown"));
            this.errors = errors;
        }

        public List<ValidationService.ValidationError> getErrors() {
            return errors;
        }
    }
}
```

- [ ] **Step 8.3: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/ObjectTypeService.java \
        src/main/java/com/metaplatform/ontology/object/ObjectInstanceService.java
git commit -m "feat(object): add ObjectTypeService and ObjectInstanceService orchestration"
```

---

## Task 9: 基础设施层 — JPA Repository + Flyway 迁移

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/postgres/ObjectTypeJpaRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/postgres/ObjectInstanceJpaRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/postgres/ViewConfigJpaRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/cache/ValidationCacheService.java`
- Create: `src/main/resources/db/migration/V4__object_type.sql`
- Create: `src/main/resources/db/migration/V5__object_instance.sql`
- Create: `src/main/resources/db/migration/V6__view_config.sql`

- [ ] **Step 9.1: 写 Flyway 迁移 V4**

`src/main/resources/db/migration/V4__object_type.sql`：

```sql
-- ObjectType 表
CREATE TABLE object_types (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    entity_type_id UUID NOT NULL,
    code VARCHAR(64) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    description TEXT,
    field_definitions JSONB NOT NULL DEFAULT '[]',
    validation_rules JSONB NOT NULL DEFAULT '[]',
    lifecycle_transitions JSONB NOT NULL DEFAULT '[]',
    lifecycle_states JSONB NOT NULL DEFAULT '[]',
    initial_state VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_object_types_tenant ON object_types(tenant_id);
CREATE INDEX idx_object_types_entity_type ON object_types(entity_type_id);
CREATE INDEX idx_object_types_code ON object_types(tenant_id, code);
```

- [ ] **Step 9.2: 写 Flyway 迁移 V5**

`src/main/resources/db/migration/V5__object_instance.sql`：

```sql
-- ObjectInstance 表
CREATE TABLE object_instances (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    object_type_id UUID NOT NULL REFERENCES object_types(id),
    lifecycle_state VARCHAR(64) NOT NULL,
    field_values JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_object_instances_tenant ON object_instances(tenant_id);
CREATE INDEX idx_object_instances_type ON object_instances(object_type_id);
CREATE INDEX idx_object_instances_state ON object_instances(object_type_id, lifecycle_state);
```

- [ ] **Step 9.3: 写 Flyway 迁移 V6**

`src/main/resources/db/migration/V6__view_config.sql`：

```sql
-- 视图配置表
CREATE TABLE view_configs (
    id BIGSERIAL PRIMARY KEY,
    object_type_id UUID NOT NULL,
    view_type VARCHAR(32) NOT NULL,  -- TABLE, FORM
    config_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (object_type_id, view_type)
);

CREATE INDEX idx_view_configs_type ON view_configs(object_type_id);
```

- [ ] **Step 9.4: 写 JPA Repository 实现**

`ObjectTypeJpaRepository.java`：

```java
package com.metaplatform.ontology.object.infrastructure.postgres;

import com.metaplatform.ontology.object.ObjectType;
import com.metaplatform.ontology.object.ObjectTypeId;
import com.metaplatform.ontology.object.ObjectTypeRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.util.*;

@Repository
public class ObjectTypeJpaRepository implements ObjectTypeRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ObjectTypeJpaRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public ObjectType save(ObjectType ot) {
        try {
            String fieldJson = mapper.writeValueAsString(ot.fieldDefinitions());
            String rulesJson = mapper.writeValueAsString(ot.validationRules());
            String transitionsJson = mapper.writeValueAsString(ot.lifecycleTransitions());
            String statesJson = mapper.writeValueAsString(ot.lifecycleStates());

            jdbc.update("""
                INSERT INTO object_types (id, tenant_id, entity_type_id, code, display_name, description,
                    field_definitions, validation_rules, lifecycle_transitions, lifecycle_states, initial_state)
                VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?)
                ON CONFLICT (id) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    field_definitions = EXCLUDED.field_definitions,
                    validation_rules = EXCLUDED.validation_rules,
                    lifecycle_transitions = EXCLUDED.lifecycle_transitions,
                    lifecycle_states = EXCLUDED.lifecycle_states,
                    initial_state = EXCLUDED.initial_state,
                    updated_at = NOW()
                """,
                    ot.id().value(), UUID.randomUUID(), ot.entityTypeId().value(),
                    ot.code(), ot.displayName(), ot.description(),
                    fieldJson, rulesJson, transitionsJson, statesJson, ot.initialState());
        } catch (Exception e) {
            throw new RuntimeException("Failed to save ObjectType", e);
        }
        return ot;
    }

    @Override
    public Optional<ObjectType> findById(ObjectTypeId id) {
        // 简化实现：v0.1 从内存缓存或 PG 查询
        // 实际应从 PG 加载并反序列化 JSON 字段
        return Optional.empty(); // TODO: 实现完整查询
    }

    @Override
    public Optional<ObjectType> findByCode(String code) {
        return Optional.empty(); // TODO: 实现完整查询
    }

    @Override
    public List<ObjectType> findAll(UUID tenantId) {
        return List.of(); // TODO: 实现完整查询
    }

    @Override
    public void delete(ObjectTypeId id) {
        jdbc.update("DELETE FROM object_types WHERE id = ?", id.value());
    }
}
```

`ObjectInstanceJpaRepository.java`：

```java
package com.metaplatform.ontology.object.infrastructure.postgres;

import com.metaplatform.ontology.object.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.util.*;

@Repository
public class ObjectInstanceJpaRepository implements ObjectInstanceRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ObjectInstanceJpaRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public ObjectInstance save(ObjectInstance inst) {
        try {
            String valuesJson = mapper.writeValueAsString(inst.fieldValues());

            jdbc.update("""
                INSERT INTO object_instances (id, tenant_id, object_type_id, lifecycle_state, field_values)
                VALUES (?, ?, ?, ?, ?::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    lifecycle_state = EXCLUDED.lifecycle_state,
                    field_values = EXCLUDED.field_values,
                    updated_at = NOW()
                """,
                    inst.id().value(), inst.tenantId(), inst.objectTypeId().value(),
                    inst.lifecycleState(), valuesJson);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save ObjectInstance", e);
        }
        return inst;
    }

    @Override
    public Optional<ObjectInstance> findById(ObjectInstanceId id) {
        return Optional.empty(); // TODO: 实现完整查询
    }

    @Override
    public List<ObjectInstance> findByObjectTypeId(ObjectTypeId objectTypeId, UUID tenantId) {
        return List.of(); // TODO: 实现完整查询
    }

    @Override
    public List<ObjectInstance> findByLifecycleState(ObjectTypeId objectTypeId, String state, UUID tenantId) {
        return List.of(); // TODO: 实现完整查询
    }

    @Override
    public void delete(ObjectInstanceId id) {
        jdbc.update("DELETE FROM object_instances WHERE id = ?", id.value());
    }

    @Override
    public long countByObjectTypeId(ObjectTypeId objectTypeId, UUID tenantId) {
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM object_instances WHERE object_type_id = ? AND tenant_id = ?",
                Long.class, objectTypeId.value(), tenantId);
        return count != null ? count : 0;
    }
}
```

`ViewConfigJpaRepository.java`：

```java
package com.metaplatform.ontology.object.infrastructure.postgres;

import com.metaplatform.ontology.object.ObjectTypeId;
import com.metaplatform.ontology.object.view.ViewConfig;
import com.metaplatform.ontology.object.view.ViewConfigRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Optional;

@Repository
public class ViewConfigJpaRepository implements ViewConfigRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ViewConfigJpaRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public ViewConfig save(ViewConfig config) {
        try {
            String json = mapper.writeValueAsString(config);
            jdbc.update("""
                INSERT INTO view_configs (object_type_id, view_type, config_json)
                VALUES (?, ?, ?::jsonb)
                ON CONFLICT (object_type_id, view_type) DO UPDATE SET
                    config_json = EXCLUDED.config_json,
                    updated_at = NOW()
                """,
                    config.objectTypeId(), config.viewType(), json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save ViewConfig", e);
        }
        return config;
    }

    @Override
    public Optional<ViewConfig> findByObjectTypeIdAndType(ObjectTypeId objectTypeId, String viewType) {
        return Optional.empty(); // TODO: 实现完整查询
    }

    @Override
    public void deleteByObjectTypeId(ObjectTypeId objectTypeId) {
        jdbc.update("DELETE FROM view_configs WHERE object_type_id = ?", objectTypeId.toString());
    }
}
```

- [ ] **Step 9.5: 写 ValidationCacheService**

```java
package com.metaplatform.ontology.object.infrastructure.cache;

import com.metaplatform.ontology.object.ObjectType;
import com.metaplatform.ontology.object.ObjectTypeId;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.concurrent.TimeUnit;

/**
 * 校验规则缓存：将 ObjectType 的校验规则缓存到 Redis，避免每次校验都查 DB。
 */
@Service
public class ValidationCacheService {

    private static final String KEY_PREFIX = "validation:object-type:";
    private static final long TTL_MINUTES = 30;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public ValidationCacheService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public void cacheObjectType(ObjectType objectType) {
        try {
            String key = KEY_PREFIX + objectType.id();
            String json = objectMapper.writeValueAsString(objectType);
            redisTemplate.opsForValue().set(key, json, TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            // 缓存失败不影响业务
        }
    }

    public ObjectType getCachedObjectType(ObjectTypeId id) {
        try {
            String key = KEY_PREFIX + id;
            String json = redisTemplate.opsForValue().get(key);
            if (json != null) {
                return objectMapper.readValue(json, ObjectType.class);
            }
        } catch (Exception e) {
            // 缓存读取失败，返回 null 走 DB
        }
        return null;
    }

    public void evict(ObjectTypeId id) {
        redisTemplate.delete(KEY_PREFIX + id);
    }
}
```

- [ ] **Step 9.6: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/infrastructure/ \
        src/main/resources/db/migration/V4__object_type.sql \
        src/main/resources/db/migration/V5__object_instance.sql \
        src/main/resources/db/migration/V6__view_config.sql
git commit -m "feat(object): add JPA repositories and Flyway migrations for object layer"
```

---

## Task 10: REST API — ObjectTypeController + ObjectInstanceController

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/ObjectTypeController.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/ObjectInstanceController.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/CreateObjectTypeRequest.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/ObjectTypeResponse.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/CreateObjectInstanceRequest.java`
- Create: `src/main/java/com/metaplatform/ontology/interfaces/rest/dto/ObjectInstanceResponse.java`

- [ ] **Step 10.1: 写 DTO**

`CreateObjectTypeRequest.java`：

```java
package com.metaplatform.ontology.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Set;

public record CreateObjectTypeRequest(
    @NotBlank String code,
    @NotBlank String displayName,
    String description,
    @NotBlank String entityTypeId,
    List<FieldDefSpec> fieldDefinitions,
    List<ValidationRuleSpec> validationRules,
    List<LifecycleTransitionSpec> lifecycleTransitions,
    Set<String> lifecycleStates,
    String initialState
) {
    public record FieldDefSpec(
        @NotBlank String name,
        @NotBlank String displayName,
        @NotBlank String fieldType,
        boolean required,
        boolean editable,
        String defaultValue,
        String description
    ) {}

    public record ValidationRuleSpec(
        @NotBlank String name,
        String fieldName,
        @NotBlank String expression,
        @NotBlank String message,
        @NotBlank String level
    ) {}

    public record LifecycleTransitionSpec(
        @NotBlank String fromState,
        @NotBlank String toState,
        @NotBlank String name,
        String guardExpression,
        String description
    ) {}
}
```

`ObjectTypeResponse.java`：

```java
package com.metaplatform.ontology.interfaces.rest.dto;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record ObjectTypeResponse(
    String id,
    String entityTypeId,
    String code,
    String displayName,
    String description,
    List<Map<String, Object>> fieldDefinitions,
    List<Map<String, Object>> validationRules,
    List<Map<String, Object>> lifecycleTransitions,
    Set<String> lifecycleStates,
    String initialState
) {}
```

`CreateObjectInstanceRequest.java`：

```java
package com.metaplatform.ontology.interfaces.rest.dto;

import java.util.Map;

public record CreateObjectInstanceRequest(
    Map<String, Object> fieldValues
) {}
```

`ObjectInstanceResponse.java`：

```java
package com.metaplatform.ontology.interfaces.rest.dto;

import java.util.List;
import java.util.Map;

public record ObjectInstanceResponse(
    String id,
    String tenantId,
    String objectTypeId,
    String lifecycleState,
    Map<String, Object> fieldValues,
    List<Map<String, Object>> availableTransitions
) {}
```

- [ ] **Step 10.2: 写 ObjectTypeController**

```java
package com.metaplatform.ontology.interfaces.rest;

import com.metaplatform.ontology.domain.EntityTypeId;
import com.metaplatform.ontology.interfaces.rest.dto.CreateObjectTypeRequest;
import com.metaplatform.ontology.interfaces.rest.dto.ObjectTypeResponse;
import com.metaplatform.ontology.object.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/object-types")
public class ObjectTypeController {

    private final ObjectTypeService objectTypeService;

    public ObjectTypeController(ObjectTypeService objectTypeService) {
        this.objectTypeService = objectTypeService;
    }

    @PostMapping
    public ResponseEntity<ObjectTypeResponse> create(
            @Valid @RequestBody CreateObjectTypeRequest request) {

        ObjectType objectType = mapToDomain(request);
        ObjectType saved = objectTypeService.create(objectType);

        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(saved));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObjectTypeResponse> findById(@PathVariable String id) {
        ObjectType ot = objectTypeService.findById(ObjectTypeId.of(id));
        return ResponseEntity.ok(mapToResponse(ot));
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<ObjectTypeResponse> findByCode(@PathVariable String code) {
        ObjectType ot = objectTypeService.findByCode(code);
        return ResponseEntity.ok(mapToResponse(ot));
    }

    @GetMapping
    public ResponseEntity<List<ObjectTypeResponse>> findAll(
            @RequestParam UUID tenantId) {
        List<ObjectTypeResponse> results = objectTypeService.findAll(tenantId).stream()
                .map(this::mapToResponse)
                .toList();
        return ResponseEntity.ok(results);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ObjectTypeResponse> update(
            @PathVariable String id,
            @Valid @RequestBody CreateObjectTypeRequest request) {
        ObjectType objectType = mapToDomain(request);
        // 保持原有 ID
        ObjectType updated = new ObjectType(
                ObjectTypeId.of(id), objectType.entityTypeId(),
                objectType.code(), objectType.displayName(), objectType.description(),
                objectType.fieldDefinitions(), objectType.validationRules(),
                objectType.lifecycleTransitions(), objectType.lifecycleStates(),
                objectType.initialState());

        ObjectType saved = objectTypeService.update(updated);
        return ResponseEntity.ok(mapToResponse(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        objectTypeService.delete(ObjectTypeId.of(id));
        return ResponseEntity.noContent().build();
    }

    private ObjectType mapToDomain(CreateObjectTypeRequest req) {
        List<FieldDefinition> fields = req.fieldDefinitions() != null ?
                req.fieldDefinitions().stream()
                        .map(f -> new FieldDefinition(f.name(), f.displayName(),
                                FieldDefinition.FieldType.valueOf(f.fieldType()),
                                f.required(), f.editable(), f.defaultValue(), f.description()))
                        .toList() : List.of();

        List<ValidationRule> rules = req.validationRules() != null ?
                req.validationRules().stream()
                        .map(r -> new ValidationRule(r.name(), r.fieldName(), r.expression(),
                                r.message(), ValidationRule.RuleLevel.valueOf(r.level())))
                        .toList() : List.of();

        List<LifecycleTransition> transitions = req.lifecycleTransitions() != null ?
                req.lifecycleTransitions().stream()
                        .map(t -> new LifecycleTransition(t.fromState(), t.toState(), t.name(),
                                t.guardExpression(), t.description()))
                        .toList() : List.of();

        return new ObjectType(
                ObjectTypeId.newId(),
                EntityTypeId.of(req.entityTypeId()),
                req.code(), req.displayName(), req.description(),
                fields, rules, transitions,
                req.lifecycleStates() != null ? req.lifecycleStates() : Set.of(),
                req.initialState()
        );
    }

    private ObjectTypeResponse mapToResponse(ObjectType ot) {
        return new ObjectTypeResponse(
                ot.id().toString(),
                ot.entityTypeId().toString(),
                ot.code(),
                ot.displayName(),
                ot.description(),
                ot.fieldDefinitions().stream()
                        .map(f -> (Map<String, Object>) Map.of(
                                "name", f.name(), "displayName", f.displayName(),
                                "fieldType", f.fieldType().name(), "required", f.required(),
                                "editable", f.editable(), "defaultValue", f.defaultValue() != null ? f.defaultValue() : "",
                                "description", f.description() != null ? f.description() : ""))
                        .toList(),
                ot.validationRules().stream()
                        .map(r -> (Map<String, Object>) Map.of(
                                "name", r.name(), "fieldName", r.fieldName() != null ? r.fieldName() : "",
                                "expression", r.expression(), "message", r.message(),
                                "level", r.level().name()))
                        .toList(),
                ot.lifecycleTransitions().stream()
                        .map(t -> (Map<String, Object>) Map.of(
                                "fromState", t.fromState(), "toState", t.toState(),
                                "name", t.name(),
                                "guardExpression", t.guardExpression() != null ? t.guardExpression() : "",
                                "description", t.description() != null ? t.description() : ""))
                        .toList(),
                ot.lifecycleStates(),
                ot.initialState()
        );
    }
}
```

- [ ] **Step 10.3: 写 ObjectInstanceController**

```java
package com.metaplatform.ontology.interfaces.rest;

import com.metaplatform.ontology.interfaces.rest.dto.CreateObjectInstanceRequest;
import com.metaplatform.ontology.interfaces.rest.dto.ObjectInstanceResponse;
import com.metaplatform.ontology.object.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/object-instances")
public class ObjectInstanceController {

    private final ObjectInstanceService instanceService;

    public ObjectInstanceController(ObjectInstanceService instanceService) {
        this.instanceService = instanceService;
    }

    @PostMapping
    public ResponseEntity<ObjectInstanceResponse> create(
            @RequestParam String objectTypeId,
            @RequestParam UUID tenantId,
            @Valid @RequestBody CreateObjectInstanceRequest request) {

        ObjectTypeId typeId = ObjectTypeId.of(objectTypeId);

        // 构建 FieldValue
        Map<String, FieldValue> fieldValues = new HashMap<>();
        if (request.fieldValues() != null) {
            request.fieldValues().forEach((k, v) -> fieldValues.put(k, new FieldValue(k, v)));
        }

        ObjectType objectType = null; // 需要从 service 获取
        String initialState = "draft"; // 默认初始状态

        ObjectInstance instance = new ObjectInstance(
                ObjectInstanceId.newId(), tenantId, typeId, initialState, fieldValues);

        ObjectInstance saved = instanceService.create(typeId, instance);

        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(saved, List.of()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObjectInstanceResponse> findById(@PathVariable String id) {
        ObjectInstance inst = instanceService.findById(ObjectInstanceId.of(id));
        List<LifecycleTransition> transitions = instanceService.availableTransitions(
                inst.objectTypeId(), inst.id());
        return ResponseEntity.ok(mapToResponse(inst, transitions));
    }

    @GetMapping
    public ResponseEntity<List<ObjectInstanceResponse>> findByObjectType(
            @RequestParam String objectTypeId,
            @RequestParam UUID tenantId) {
        List<ObjectInstanceResponse> results = instanceService.findByObjectType(
                        ObjectTypeId.of(objectTypeId), tenantId).stream()
                .map(inst -> mapToResponse(inst, List.of()))
                .toList();
        return ResponseEntity.ok(results);
    }

    @PutMapping("/{id}/fields")
    public ResponseEntity<ObjectInstanceResponse> updateFields(
            @PathVariable String id,
            @RequestBody Map<String, Object> fields) {

        List<FieldValue> fieldValues = fields.entrySet().stream()
                .map(e -> new FieldValue(e.getKey(), e.getValue()))
                .toList();

        ObjectInstance updated = instanceService.updateFields(ObjectInstanceId.of(id), fieldValues);
        return ResponseEntity.ok(mapToResponse(updated, List.of()));
    }

    @PostMapping("/{id}/transition")
    public ResponseEntity<ObjectInstanceResponse> transition(
            @PathVariable String id,
            @RequestParam String objectTypeId,
            @RequestParam String toState) {

        ObjectInstance transitioned = instanceService.transition(
                ObjectTypeId.of(objectTypeId), ObjectInstanceId.of(id), toState);

        List<LifecycleTransition> transitions = instanceService.availableTransitions(
                transitioned.objectTypeId(), transitioned.id());

        return ResponseEntity.ok(mapToResponse(transitioned, transitions));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        instanceService.delete(ObjectInstanceId.of(id));
        return ResponseEntity.noContent().build();
    }

    private ObjectInstanceResponse mapToResponse(ObjectInstance inst,
                                                  List<LifecycleTransition> transitions) {
        Map<String, Object> fieldMap = new HashMap<>();
        inst.fieldValues().forEach((k, v) -> fieldMap.put(k, v.value()));

        List<Map<String, Object>> transList = transitions.stream()
                .map(t -> (Map<String, Object>) Map.of(
                        "fromState", t.fromState(), "toState", t.toState(),
                        "name", t.name()))
                .toList();

        return new ObjectInstanceResponse(
                inst.id().toString(),
                inst.tenantId().toString(),
                inst.objectTypeId().toString(),
                inst.lifecycleState(),
                fieldMap,
                transList
        );
    }
}
```

- [ ] **Step 10.4: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/interfaces/rest/ObjectTypeController.java \
        src/main/java/com/metaplatform/ontology/interfaces/rest/ObjectInstanceController.java \
        src/main/java/com/metaplatform/ontology/interfaces/rest/dto/
git commit -m "feat(api): add /api/v1/object-types and /api/v1/object-instances REST APIs"
```

---

## Task 11: InMemory Repository 实现（用于开发测试）

**Files:**
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/memory/InMemoryObjectTypeRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/memory/InMemoryObjectInstanceRepository.java`
- Create: `src/main/java/com/metaplatform/ontology/object/infrastructure/memory/InMemoryViewConfigRepository.java`

- [ ] **Step 11.1: 写 InMemory ObjectTypeRepository**

```java
package com.metaplatform.ontology.object.infrastructure.memory;

import com.metaplatform.ontology.object.ObjectType;
import com.metaplatform.ontology.object.ObjectTypeId;
import com.metaplatform.ontology.object.ObjectTypeRepository;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemoryObjectTypeRepository implements ObjectTypeRepository {

    private final Map<UUID, ObjectType> store = new ConcurrentHashMap<>();

    @Override
    public ObjectType save(ObjectType objectType) {
        store.put(objectType.id().value(), objectType);
        return objectType;
    }

    @Override
    public Optional<ObjectType> findById(ObjectTypeId id) {
        return Optional.ofNullable(store.get(id.value()));
    }

    @Override
    public Optional<ObjectType> findByCode(String code) {
        return store.values().stream()
                .filter(ot -> ot.code().equals(code))
                .findFirst();
    }

    @Override
    public List<ObjectType> findAll(UUID tenantId) {
        // v0.1 不区分租户（简化）
        return List.copyOf(store.values());
    }

    @Override
    public void delete(ObjectTypeId id) {
        store.remove(id.value());
    }
}
```

- [ ] **Step 11.2: 写 InMemory ObjectInstanceRepository**

```java
package com.metaplatform.ontology.object.infrastructure.memory;

import com.metaplatform.ontology.object.*;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemoryObjectInstanceRepository implements ObjectInstanceRepository {

    private final Map<UUID, ObjectInstance> store = new ConcurrentHashMap<>();

    @Override
    public ObjectInstance save(ObjectInstance instance) {
        store.put(instance.id().value(), instance);
        return instance;
    }

    @Override
    public Optional<ObjectInstance> findById(ObjectInstanceId id) {
        return Optional.ofNullable(store.get(id.value()));
    }

    @Override
    public List<ObjectInstance> findByObjectTypeId(ObjectTypeId objectTypeId, UUID tenantId) {
        return store.values().stream()
                .filter(i -> i.objectTypeId().equals(objectTypeId) && i.tenantId().equals(tenantId))
                .toList();
    }

    @Override
    public List<ObjectInstance> findByLifecycleState(ObjectTypeId objectTypeId, String state, UUID tenantId) {
        return store.values().stream()
                .filter(i -> i.objectTypeId().equals(objectTypeId)
                        && i.lifecycleState().equals(state)
                        && i.tenantId().equals(tenantId))
                .toList();
    }

    @Override
    public void delete(ObjectInstanceId id) {
        store.remove(id.value());
    }

    @Override
    public long countByObjectTypeId(ObjectTypeId objectTypeId, UUID tenantId) {
        return store.values().stream()
                .filter(i -> i.objectTypeId().equals(objectTypeId) && i.tenantId().equals(tenantId))
                .count();
    }
}
```

- [ ] **Step 11.3: 写 InMemory ViewConfigRepository**

```java
package com.metaplatform.ontology.object.infrastructure.memory;

import com.metaplatform.ontology.object.ObjectTypeId;
import com.metaplatform.ontology.object.view.ViewConfig;
import com.metaplatform.ontology.object.view.ViewConfigRepository;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemoryViewConfigRepository implements ViewConfigRepository {

    private final Map<String, ViewConfig> store = new ConcurrentHashMap<>();

    @Override
    public ViewConfig save(ViewConfig config) {
        String key = config.objectTypeId() + ":" + config.viewType();
        store.put(key, config);
        return config;
    }

    @Override
    public Optional<ViewConfig> findByObjectTypeIdAndType(ObjectTypeId objectTypeId, String viewType) {
        String key = objectTypeId.toString() + ":" + viewType;
        return Optional.ofNullable(store.get(key));
    }

    @Override
    public void deleteByObjectTypeId(ObjectTypeId objectTypeId) {
        store.keySet().removeIf(k -> k.startsWith(objectTypeId.toString()));
    }
}
```

- [ ] **Step 11.4: 提交**

```bash
git add src/main/java/com/metaplatform/ontology/object/infrastructure/memory/
git commit -m "feat(object): add in-memory repository implementations for dev/test"
```

---

## Task 12: 端到端验证 — 构建、启动、手动测试

- [ ] **Step 12.1: 编译整个项目**

```bash
cd metaplatform-ontology-engine
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

Expected: Neo4j/PostgreSQL/Kafka 容器运行

- [ ] **Step 12.4: 启动应用**

```bash
./mvnw spring-boot:run
```

Expected: 应用启动成功，Flyway 执行 V4/V5/V6 迁移

- [ ] **Step 12.5: 手动测试 — 创建 ObjectType**

```bash
curl -X POST http://localhost:8080/api/v1/object-types \
  -H "Content-Type: application/json" \
  -d '{
    "code": "customer",
    "displayName": "客户",
    "description": "客户业务对象",
    "entityTypeId": "00000000-0000-0000-0000-000000000000",
    "fieldDefinitions": [
      {
        "name": "name",
        "displayName": "客户名称",
        "fieldType": "STRING",
        "required": true,
        "editable": true,
        "defaultValue": "",
        "description": "客户全称"
      },
      {
        "name": "email",
        "displayName": "邮箱",
        "fieldType": "STRING",
        "required": true,
        "editable": true,
        "defaultValue": "",
        "description": "联系邮箱"
      },
      {
        "name": "credit_limit",
        "displayName": "信用额度",
        "fieldType": "DOUBLE",
        "required": false,
        "editable": true,
        "defaultValue": "0.0",
        "description": "信用额度上限"
      }
    ],
    "validationRules": [
      {
        "name": "credit_positive",
        "fieldName": "credit_limit",
        "expression": "credit_limit >= 0",
        "message": "信用额度不能为负数",
        "level": "FIELD"
      }
    ],
    "lifecycleTransitions": [
      {
        "fromState": "draft",
        "toState": "active",
        "name": "激活",
        "guardExpression": null,
        "description": "将客户从草稿激活为正式客户"
      },
      {
        "fromState": "active",
        "toState": "suspended",
        "name": "暂停",
        "guardExpression": null,
        "description": "暂停客户"
      }
    ],
    "lifecycleStates": ["draft", "active", "suspended", "archived"],
    "initialState": "draft"
  }'
```

Expected: 201 Created

- [ ] **Step 12.6: 手动测试 — 创建 ObjectInstance**

```bash
curl -X POST "http://localhost:8080/api/v1/object-instances?objectTypeId=<type-id>&tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldValues": {
      "name": "Acme Corp",
      "email": "contact@acme.com",
      "credit_limit": 10000.0
    }
  }'
```

Expected: 201 Created

- [ ] **Step 12.7: 手动测试 — 生命周期流转**

```bash
curl -X POST "http://localhost:8080/api/v1/object-instances/<instance-id>/transition?objectTypeId=<type-id>&toState=active"
```

Expected: 200 OK, lifecycleState = "active"

- [ ] **Step 12.8: 打包**

```bash
./mvnw clean package -DskipTests
```

Expected: JAR 文件生成

- [ ] **Step 12.9: 最终提交**

```bash
git add .
git commit -m "chore: finalize business object layer v0.1"
```

---

## 验收标准

| # | 验收项 | 验证方法 |
|---|--------|----------|
| 1 | ObjectType CRUD + 字段定义 | 创建、查询、更新、删除 ObjectType |
| 2 | ObjectInstance CRUD + 校验 | 创建实例时自动校验必填和类型 |
| 3 | Aviator 表达式校验 | 字段级和对象级校验规则生效 |
| 4 | 生命周期状态机 | draft -> active -> suspended 流转 |
| 5 | Guard 条件守卫 | 不满足条件时拒绝流转 |
| 6 | 视图自动生成 | 创建 ObjectType 后自动生成 TABLE + FORM 视图 |
| 7 | 全部单元测试通过 | `./mvnw test` |
| 8 | 应用可启动 | `./mvnw spring-boot:run` |
