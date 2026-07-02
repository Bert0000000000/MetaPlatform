# 流程自动化引擎 v0.1 — Implementation Plan

> **Module:** `metaplatform-process-engine`
> **Version:** 0.1.0
> **Date:** 2026-07-02
> **Status:** Draft
> **Java:** 21 | **Spring Boot:** 3.2 | **Build:** Gradle 8.5

---

## 1. Vision & Scope

流程自动化引擎是 MetaPlatform 的核心 Superpower 之一。它提供轻量级的工作流/审批流能力，支持 JSON DSL 定义流程、自动/手动触发、网关分支、人工审批、SLA 监控、AI 辅助生成流程定义。

### 1.1 核心能力

| 能力 | 说明 |
|------|------|
| JSON DSL 流程定义 | 节点 (开始/结束/任务/网关) + 转换 + 触发器 + 变量 + SLA |
| 流程实例运行 | 状态机驱动: RUNNING → COMPLETED / CANCELLED / FAILED |
| 网关评估 | 条件网关 (XOR) + 并行网关 (AND) |
| 人工审批任务 | 创建任务 → 分配参与者 → 审批/拒绝 → 流转 |
| 参与者解析 | USER/ROLE/EXPRESSION (Aviator 表达式) 三种分配方式 |
| 触发匹配 | 对象事件触发 (Kafka) + 手动触发 + 定时触发 |
| SLA 监控 | 节点级 SLA 超时追踪与告警 |
| AI 流程生成 | 自然语言 → JSON DSL (via AI Substrate LLM) |
| 审计追踪 | 全量流程历史事件记录 |

### 1.2 Non-Goals (v0.1)

- BPMN 2.0 标准支持 (v0.2)
- 可视化流程设计器 (v0.2)
- 子流程嵌套 (v0.2)
- 多租户隔离
- 分布式事务补偿 (Saga)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           REST API Layer                            │
│  /api/v1/process-definitions  /api/v1/process-instances             │
│  /api/v1/tasks                /api/v1/nl-process                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                         Application Layer                           │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ ProcessEngine   │  │ TaskService  │  │ NlProcessGenerator      │ │
│  │ (核心状态机)     │  │ (审批任务)    │  │ (NL→DSL via LLM)       │ │
│  └────────┬───────┘  └──────┬───────┘  └────────────┬────────────┘ │
│           │                 │                        │              │
│  ┌────────▼───────┐  ┌──────▼───────┐  ┌────────────▼────────────┐ │
│  │ DslParser      │  │ Participant- │  │ TriggerMatcher          │ │
│  │ DefinitionVal- │  │ Resolver     │  │ ObjectEventConsumer     │ │
│  │ idator         │  │ (Aviator)    │  │ ManualStartService      │ │
│  └────────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                     │
│  ┌────────────────┐  ┌────────────────────────────────────────────┐ │
│  │ SlaTracker     │  │ ProcessHistoryEvent (Audit Trail)          │ │
│  │ SlaCheckSched- │  │                                            │ │
│  │ uler           │  │                                            │ │
│  └────────────────┘  └────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      Domain Layer                                   │
│  ProcessDefinition │ ProcessInstance │ ProcessNode │ Task           │
│  Transition        │ ProcessVariable │ SlaConfig   │ HistoryEvent   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│              Persistence Layer (JPA + PostgreSQL + Flyway)          │
│  process_definition │ process_instance │ process_task               │
│  process_history    │ process_variable │ process_sla                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Domain Model

### 3.1 ProcessDefinition (Aggregate Root)

```java
@Entity
@Table(name = "process_definition")
public class ProcessDefinition {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;               // 流程名称

    @Column(nullable = false, unique = true)
    private String code;               // 流程编码 (如 "approval_order")

    private String description;        // 流程描述
    private Integer version;           // 版本号 (默认 1)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DefinitionStatus status;   // DRAFT | ACTIVE | SUSPENDED | ARCHIVED

    @Column(columnDefinition = "TEXT", nullable = false)
    private String dslJson;            // JSON DSL 原文

    @Transient
    private ProcessDsl parsedDsl;      // 解析后的 DSL 对象 (懒解析)

    private String triggerType;        // MANUAL | OBJECT_EVENT | SCHEDULE
    private String triggerConfig;      // 触发配置 JSON

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

public enum DefinitionStatus {
    DRAFT, ACTIVE, SUSPENDED, ARCHIVED
}
```

### 3.2 JSON DSL 结构

```json
{
  "key": "approval_order",
  "name": "订单审批流程",
  "description": "订单金额超过1万时需要审批",
  "variables": [
    {"name": "orderAmount", "type": "DECIMAL", "required": true},
    {"name": "approver", "type": "STRING", "required": false}
  ],
  "nodes": [
    {
      "id": "start",
      "type": "START",
      "name": "开始"
    },
    {
      "id": "check_amount",
      "type": "GATEWAY",
      "name": "金额判断",
      "gatewayType": "XOR"
    },
    {
      "id": "auto_approve",
      "type": "END",
      "name": "自动通过",
      "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}
    },
    {
      "id": "manager_approve",
      "type": "TASK",
      "name": "经理审批",
      "assignee": {
        "type": "EXPRESSION",
        "expression": "getVariable('approver')"
      },
      "taskType": "APPROVAL",
      "sla": {
        "duration": "PT24H",
        "escalation": "NOTIFY"
      },
      "form": {
        "fields": [
          {"code": "comment", "label": "审批意见", "type": "TEXTAREA", "required": true},
          {"code": "decision", "label": "决定", "type": "SELECT",
           "options": ["APPROVE", "REJECT"]}
        ]
      }
    },
    {
      "id": "notify_rejected",
      "type": "TASK",
      "name": "通知发起人",
      "assignee": {"type": "EXPRESSION", "expression": "getInitiator()"},
      "taskType": "NOTIFICATION"
    },
    {
      "id": "end_approved",
      "type": "END",
      "name": "审批通过",
      "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}
    },
    {
      "id": "end_rejected",
      "type": "END",
      "name": "审批拒绝",
      "action": {"type": "SET_VARIABLE", "variable": "status", "value": "REJECTED"}
    }
  ],
  "transitions": [
    {"from": "start", "to": "check_amount"},
    {"from": "check_amount", "to": "auto_approve",
     "condition": "getVariable('orderAmount') < 10000"},
    {"from": "check_amount", "to": "manager_approve",
     "condition": "getVariable('orderAmount') >= 10000"},
    {"from": "manager_approve", "to": "end_approved",
     "condition": "taskResult == 'APPROVE'"},
    {"from": "manager_approve", "to": "notify_rejected",
     "condition": "taskResult == 'REJECT'"},
    {"from": "notify_rejected", "to": "end_rejected"}
  ]
}
```

### 3.3 ProcessDsl (解析后的 DSL 对象)

```java
public class ProcessDsl {
    private String key;
    private String name;
    private String description;
    private List<VariableDefinition> variables;
    private List<ProcessNode> nodes;
    private List<Transition> transitions;

    // 便捷方法
    public ProcessNode getStartNode() { ... }
    public ProcessNode getNodeById(String id) { ... }
    public List<Transition> getOutgoingTransitions(String nodeId) { ... }
}

public class ProcessNode {
    private String id;
    private NodeType type;          // START | END | TASK | GATEWAY | SUBPROCESS
    private String name;
    private GatewayType gatewayType; // XOR | AND (仅 GATEWAY 类型)
    private AssigneeConfig assignee; // (仅 TASK 类型)
    private TaskType taskType;       // APPROVAL | NOTIFICATION | MANUAL | AUTO
    private SlaConfig sla;
    private FormConfig form;         // 任务表单配置
    private NodeAction action;       // 节点动作 (SET_VARIABLE, INVOKE_API 等)
}

public class Transition {
    private String from;
    private String to;
    private String condition;        // Aviator 条件表达式 (可选, 网关分支)
}

public class VariableDefinition {
    private String name;
    private VariableType type;       // STRING | INTEGER | DECIMAL | BOOLEAN | DATE | JSON
    private boolean required;
    private String defaultValue;
}

public class AssigneeConfig {
    private AssigneeType type;       // USER | ROLE | EXPRESSION
    private String value;            // userId / roleName / Aviator 表达式
}

public class SlaConfig {
    private Duration duration;       // ISO 8601 Duration (PT24H, P3D 等)
    private String escalation;       // NOTIFY | REASSIGN | AUTO_COMPLETE
}

public class FormConfig {
    private List<FormField> fields;
}

public enum NodeType { START, END, TASK, GATEWAY, SUBPROCESS }
public enum GatewayType { XOR, AND }
public enum TaskType { APPROVAL, NOTIFICATION, MANUAL, AUTO }
public enum AssigneeType { USER, ROLE, EXPRESSION }
```

### 3.4 ProcessInstance (Aggregate Root)

```java
@Entity
@Table(name = "process_instance")
public class ProcessInstance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "definition_id", nullable = false)
    private Long definitionId;

    @Column(nullable = false)
    private String definitionCode;     // 冗余存储，便于查询

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InstanceStatus status;     // RUNNING | COMPLETED | CANCELLED | FAILED

    @Column(name = "current_node_id")
    private String currentNodeId;      // 当前所在节点 ID

    private String initiatorId;        // 发起人 ID
    private String initiatorName;      // 发起人姓名

    @Column(name = "business_key")
    private String businessKey;        // 业务关联键 (如 orderId)

    @Column(name = "business_type")
    private String businessType;       // 业务类型 (如 "order")

    @Column(columnDefinition = "TEXT")
    private String variablesJson;      // 流程变量 JSON

    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private LocalDateTime updatedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "instance_id")
    private List<ProcessTask> tasks = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "instance_id")
    @OrderBy("timestamp ASC")
    private List<ProcessHistoryEvent> history = new ArrayList<>();
}

public enum InstanceStatus {
    RUNNING, COMPLETED, CANCELLED, FAILED
}
```

### 3.5 Task (Entity)

```java
@Entity
@Table(name = "process_task")
public class ProcessTask {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", nullable = false)
    private Long instanceId;

    @Column(name = "node_id", nullable = false)
    private String nodeId;            // 对应的流程节点 ID

    @Column(nullable = false)
    private String title;              // 任务标题

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskType taskType;         // APPROVAL | NOTIFICATION | MANUAL | AUTO

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;         // PENDING | COMPLETED | CANCELLED | EXPIRED

    private String assigneeId;         // 被分配人 ID
    private String assigneeName;       // 被分配人姓名

    private String result;             // 审批结果 (APPROVE/REJECT 等)

    @Column(columnDefinition = "TEXT")
    private String formData;           // 任务表单数据 JSON

    @Column(columnDefinition = "TEXT")
    private String comment;            // 审批意见

    private LocalDateTime dueDate;     // SLA 截止时间
    private LocalDateTime completedAt; // 实际完成时间
    private LocalDateTime createdAt;
}

public enum TaskStatus {
    PENDING, COMPLETED, CANCELLED, EXPIRED
}
```

### 3.6 ProcessHistoryEvent (Entity)

```java
@Entity
@Table(name = "process_history")
public class ProcessHistoryEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", nullable = false)
    private Long instanceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HistoryEventType eventType;

    private String nodeId;            // 相关节点
    private String actorId;           // 操作人
    private String actorName;

    @Column(columnDefinition = "TEXT")
    private String detail;            // 事件详情 JSON

    private LocalDateTime timestamp;

    public static ProcessHistoryEvent of(InstanceStatus from, InstanceStatus to,
                                          String nodeId, String actorId) {
        // 工厂方法
    }
}

public enum HistoryEventType {
    INSTANCE_STARTED,      // 流程启动
    NODE_ENTERED,          // 进入节点
    NODE_COMPLETED,        // 节点完成
    TASK_CREATED,          // 任务创建
    TASK_ASSIGNED,         // 任务分配
    TASK_COMPLETED,        // 任务完成
    GATEWAY_EVALUATED,     // 网关评估
    VARIABLE_SET,          // 变量设置
    SLA_WARNING,           // SLA 预警
    SLA_BREACHED,          // SLA 超时
    INSTANCE_COMPLETED,    // 流程完成
    INSTANCE_CANCELLED,    // 流程取消
    INSTANCE_FAILED        // 流程失败
}
```

---

## 4. Implementation Tasks

### Task 1: 模块脚手架搭建

**目标:** 创建独立的 `metaplatform-process-engine` Gradle 子模块

**Steps:**

1. 在根 `settings.gradle.kts` 中 include 子模块
2. 创建 `metaplatform-process-engine/build.gradle.kts`
3. 配置依赖: Spring Boot 3.2, Spring Data JPA, Spring Web, Kafka, Aviator, PostgreSQL
4. 创建包结构: `com.metaplatform.process.{domain,application,infrastructure,api}`
5. 创建 `application.yml` 配置文件
6. 创建主启动类 `ProcessEngineApplication`

**build.gradle.kts:**

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.2.5"
    id("io.spring.dependency-management") version "1.1.5"
}

group = "com.metaplatform"
version = "0.1.0"

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.kafka:spring-kafka")

    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
    implementation("commons-beanutils:commons-beanutils:1.9.4")

    // Aviator for expression evaluation
    implementation("com.googlecode.aviator:aviator:5.4.3")

    // JSON Schema validation
    implementation("com.networknt:json-schema-validator:1.4.0")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.kafka:spring-kafka-test")
    testImplementation("org.mockito:mockito-core")
    testImplementation("com.h2database:h2")
}
```

**验收标准:** `./gradlew :metaplatform-process-engine:build` 成功

---

### Task 2: DslParser — JSON DSL 解析

**目标:** 将 JSON 字符串解析为类型安全的 ProcessDsl 对象图

```java
@Service
public class DslParser {

    private final ObjectMapper objectMapper;

    /**
     * 解析 JSON DSL 字符串为 ProcessDsl
     */
    public ProcessDsl parse(String dslJson) {
        try {
            JsonNode root = objectMapper.readTree(dslJson);

            ProcessDsl dsl = new ProcessDsl();
            dsl.setKey(root.get("key").asText());
            dsl.setName(root.get("name").asText());
            dsl.setDescription(root.has("description") ?
                root.get("description").asText() : null);

            // 解析变量
            if (root.has("variables")) {
                dsl.setVariables(parseVariables(root.get("variables")));
            }

            // 解析节点
            dsl.setNodes(parseNodes(root.get("nodes")));

            // 解析转换
            dsl.setTransitions(parseTransitions(root.get("transitions")));

            return dsl;
        } catch (Exception e) {
            throw new DslParseException("DSL 解析失败: " + e.getMessage(), e);
        }
    }

    private List<ProcessNode> parseNodes(JsonNode nodesNode) {
        List<ProcessNode> nodes = new ArrayList<>();
        for (JsonNode nodeNode : nodesNode) {
            ProcessNode node = new ProcessNode();
            node.setId(nodeNode.get("id").asText());
            node.setType(NodeType.valueOf(nodeNode.get("type").asText()));
            node.setName(nodeNode.get("name").asText());

            if (node.getType() == NodeType.GATEWAY && nodeNode.has("gatewayType")) {
                node.setGatewayType(GatewayType.valueOf(nodeNode.get("gatewayType").asText()));
            }

            if (node.getType() == NodeType.TASK) {
                node.setAssignee(parseAssignee(nodeNode.get("assignee")));
                if (nodeNode.has("taskType")) {
                    node.setTaskType(TaskType.valueOf(nodeNode.get("taskType").asText()));
                }
                if (nodeNode.has("sla")) {
                    node.setSla(parseSla(nodeNode.get("sla")));
                }
                if (nodeNode.has("form")) {
                    node.setForm(parseForm(nodeNode.get("form")));
                }
            }

            if (nodeNode.has("action")) {
                node.setAction(parseAction(nodeNode.get("action")));
            }

            nodes.add(node);
        }
        return nodes;
    }

    private AssigneeConfig parseAssignee(JsonNode node) {
        AssigneeConfig config = new AssigneeConfig();
        config.setType(AssigneeType.valueOf(node.get("type").asText()));
        config.setValue(node.get("value").asText());
        return config;
    }

    private SlaConfig parseSla(JsonNode node) {
        SlaConfig config = new SlaConfig();
        config.setDuration(Duration.parse(node.get("duration").asText()));
        if (node.has("escalation")) {
            config.setEscalation(node.get("escalation").asText());
        }
        return config;
    }
}
```

**验收标准:** 能正确解析 Section 3.2 的示例 DSL; 解析错误时抛出明确异常

---

### Task 3: DefinitionValidator — DSL 校验

**目标:** 校验 ProcessDsl 的合法性（连通性、引用完整性、结构约束）

```java
@Service
public class DefinitionValidator {

    /**
     * 校验 ProcessDsl 的合法性
     * @return 校验结果 (有效/无效 + 错误列表)
     */
    public ValidationResult validate(ProcessDsl dsl) {
        List<String> errors = new ArrayList<>();

        // 1. 必须有且只有一个 START 节点
        long startCount = dsl.getNodes().stream()
            .filter(n -> n.getType() == NodeType.START).count();
        if (startCount != 1) {
            errors.add("流程必须有且只有一个 START 节点, 当前: " + startCount);
        }

        // 2. 必须有至少一个 END 节点
        long endCount = dsl.getNodes().stream()
            .filter(n -> n.getType() == NodeType.END).count();
        if (endCount < 1) {
            errors.add("流程必须有至少一个 END 节点");
        }

        // 3. 所有 transition 的 from/to 节点必须存在
        Set<String> nodeIds = dsl.getNodes().stream()
            .map(ProcessNode::getId).collect(Collectors.toSet());
        for (Transition t : dsl.getTransitions()) {
            if (!nodeIds.contains(t.getFrom())) {
                errors.add("转换的 from 节点不存在: " + t.getFrom());
            }
            if (!nodeIds.contains(t.getTo())) {
                errors.add("转换的 to 节点不存在: " + t.getTo());
            }
        }

        // 4. GATEWAY 节点必须有至少 2 条出边
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.GATEWAY) {
                long outgoing = dsl.getTransitions().stream()
                    .filter(t -> t.getFrom().equals(node.getId())).count();
                if (outgoing < 2) {
                    errors.add("GATEWAY 节点 '" + node.getId() + "' 必须有至少 2 条出边");
                }
                // XOR 网关的每条出边必须有条件
                if (node.getGatewayType() == GatewayType.XOR) {
                    List<Transition> outgoingTransitions = dsl.getTransitions().stream()
                        .filter(t -> t.getFrom().equals(node.getId()))
                        .toList();
                    for (Transition t : outgoingTransitions) {
                        if (t.getCondition() == null || t.getCondition().isBlank()) {
                            errors.add("XOR 网关 '" + node.getId() +
                                "' 的出边必须有条件表达式");
                        }
                    }
                }
            }
        }

        // 5. TASK 节点必须有 assignee
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.TASK && node.getAssignee() == null) {
                errors.add("TASK 节点 '" + node.getId() + "' 必须配置 assignee");
            }
        }

        // 6. START 节点不能有入边
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.START) {
                long incoming = dsl.getTransitions().stream()
                    .filter(t -> t.getTo().equals(node.getId())).count();
                if (incoming > 0) {
                    errors.add("START 节点不能有入边");
                }
            }
        }

        // 7. END 节点不能有出边
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.END) {
                long outgoing = dsl.getTransitions().stream()
                    .filter(t -> t.getFrom().equals(node.getId())).count();
                if (outgoing > 0) {
                    errors.add("END 节点不能有出边");
                }
            }
        }

        // 8. 变量引用的合法性 (transition condition 中引用的变量必须在 variables 中声明)
        Set<String> varNames = dsl.getVariables() != null ?
            dsl.getVariables().stream()
                .map(VariableDefinition::getName)
                .collect(Collectors.toSet()) : Set.of();

        for (Transition t : dsl.getTransitions()) {
            if (t.getCondition() != null) {
                // 提取 getVariable('xxx') 中的变量名
                List<String> refs = extractVariableReferences(t.getCondition());
                for (String ref : refs) {
                    if (!varNames.contains(ref)) {
                        errors.add("条件表达式引用了未声明的变量: " + ref);
                    }
                }
            }
        }

        return new ValidationResult(errors.isEmpty(), errors);
    }

    private List<String> extractVariableReferences(String expression) {
        List<String> refs = new ArrayList<>();
        Pattern pattern = Pattern.compile("getVariable\\('([^']+)'\\)");
        Matcher matcher = pattern.matcher(expression);
        while (matcher.find()) {
            refs.add(matcher.group(1));
        }
        return refs;
    }
}
```

**验收标准:** 对合法 DSL 返回 valid=true; 对各种非法情况返回明确错误

---

### Task 4: ProcessEngine — 核心引擎 (流程推进)

**目标:** 实现流程实例的状态机推进逻辑

```java
@Service
@RequiredArgsConstructor
@Transactional
public class ProcessEngine {

    private final ProcessInstanceRepository instanceRepository;
    private final ProcessDefinitionRepository definitionRepository;
    private final DslParser dslParser;
    private final DefinitionValidator validator;
    private final ParticipantResolver participantResolver;
    private final TaskService taskService;
    private final SlaTracker slaTracker;
    private final ProcessHistoryService historyService;

    /**
     * 启动新的流程实例
     */
    public ProcessInstance startProcess(String definitionCode, String initiatorId,
                                         String businessKey, Map<String, Object> variables) {
        // 1. 加载流程定义
        ProcessDefinition definition = definitionRepository
            .findByCodeAndStatus(definitionCode, DefinitionStatus.ACTIVE)
            .orElseThrow(() -> new ProcessDefinitionNotFoundException(definitionCode));

        // 2. 解析 DSL
        ProcessDsl dsl = dslParser.parse(definition.getDslJson());

        // 3. 校验变量
        validateVariables(dsl, variables);

        // 4. 创建流程实例
        ProcessInstance instance = new ProcessInstance();
        instance.setDefinitionId(definition.getId());
        instance.setDefinitionCode(definitionCode);
        instance.setStatus(InstanceStatus.RUNNING);
        instance.setInitiatorId(initiatorId);
        instance.setBusinessKey(businessKey);
        instance.setVariablesJson(JsonUtils.toJson(variables != null ? variables : Map.of()));
        instance.setStartedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());

        // 5. 找到 START 节点，推进到下一个节点
        ProcessNode startNode = dsl.getStartNode();
        instance.setCurrentNodeId(startNode.getId());

        instance = instanceRepository.save(instance);

        // 6. 记录历史
        historyService.record(instance, HistoryEventType.INSTANCE_STARTED,
            startNode.getId(), initiatorId, null);

        // 7. 自动推进 (START 节点通常直接到下一个)
        advance(instance, dsl);

        return instance;
    }

    /**
     * 推进流程到下一个节点
     */
    public void advance(ProcessInstance instance, ProcessDsl dsl) {
        String currentNodeId = instance.getCurrentNodeId();
        ProcessNode currentNode = dsl.getNodeById(currentNodeId);

        // 获取出边
        List<Transition> outgoing = dsl.getOutgoingTransitions(currentNodeId);

        if (outgoing.isEmpty()) {
            // 无出边 → 流程结束 (理论上只在 END 节点)
            if (currentNode.getType() == NodeType.END) {
                completeInstance(instance, currentNode);
            }
            return;
        }

        // 根据节点类型处理
        switch (currentNode.getType()) {
            case START -> {
                // START 节点: 直接跳转到唯一出边
                Transition next = outgoing.get(0);
                moveToNode(instance, dsl, next.getTo());
            }
            case GATEWAY -> {
                evaluateGateway(instance, dsl, currentNode, outgoing);
            }
            case TASK -> {
                createTaskForNode(instance, currentNode);
                // TASK 节点需要等待外部完成, 不自动推进
            }
            case END -> {
                completeInstance(instance, currentNode);
            }
        }
    }

    /**
     * 评估网关节点
     */
    private void evaluateGateway(ProcessInstance instance, ProcessDsl dsl,
                                  ProcessNode gateway, List<Transition> outgoing) {
        Map<String, Object> variables = JsonUtils.fromJson(
            instance.getVariablesJson(), Map.class);

        historyService.record(instance, HistoryEventType.GATEWAY_EVALUATED,
            gateway.getId(), "SYSTEM", null);

        if (gateway.getGatewayType() == GatewayType.XOR) {
            // XOR: 找第一个条件为真的出边
            for (Transition transition : outgoing) {
                if (evaluateCondition(transition.getCondition(), variables, instance)) {
                    moveToNode(instance, dsl, transition.getTo());
                    return;
                }
            }
            throw new ProcessEngineException(
                "XOR 网关 '" + gateway.getId() + "' 没有匹配的条件分支");
        } else if (gateway.getGatewayType() == GatewayType.AND) {
            // AND: 并行网关 (v0.1 简化为顺序执行所有分支)
            for (Transition transition : outgoing) {
                moveToNode(instance, dsl, transition.getTo());
            }
        }
    }

    /**
     * 使用 Aviator 评估条件表达式
     */
    private boolean evaluateCondition(String expression, Map<String, Object> variables,
                                       ProcessInstance instance) {
        if (expression == null || expression.isBlank()) return true;

        try {
            // 构建执行环境: 变量 + 辅助函数
            Map<String, Object> env = new HashMap<>(variables);
            env.put("taskResult", instance.getTasks().stream()
                .filter(t -> t.getStatus() == TaskStatus.COMPLETED)
                .reduce((a, b) -> b) // 取最后一个
                .map(ProcessTask::getResult)
                .orElse(null));
            env.put("initiatorId", instance.getInitiatorId());

            // 替换 getVariable('xxx') 为实际值
            String processed = expression;
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                processed = processed.replace(
                    "getVariable('" + entry.getKey() + "')",
                    formatValue(entry.getValue()));
            }

            Object result = AviatorEvaluator.execute(processed, env, true);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            throw new ProcessEngineException(
                "条件表达式评估失败: " + expression + " - " + e.getMessage(), e);
        }
    }

    /**
     * 移动到指定节点
     */
    private void moveToNode(ProcessInstance instance, ProcessDsl dsl, String targetNodeId) {
        ProcessNode targetNode = dsl.getNodeById(targetNodeId);
        instance.setCurrentNodeId(targetNodeId);
        instance.setUpdatedAt(LocalDateTime.now());
        instanceRepository.save(instance);

        historyService.record(instance, HistoryEventType.NODE_ENTERED,
            targetNodeId, "SYSTEM", null);

        // 递归推进
        advance(instance, dsl);
    }

    /**
     * 完成流程实例
     */
    private void completeInstance(ProcessInstance instance, ProcessNode endNode) {
        instance.setStatus(InstanceStatus.COMPLETED);
        instance.setCompletedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());

        // 执行结束节点的动作
        if (endNode.getAction() != null) {
            executeAction(instance, endNode.getAction());
        }

        instanceRepository.save(instance);

        historyService.record(instance, HistoryEventType.INSTANCE_COMPLETED,
            endNode.getId(), "SYSTEM", null);
    }

    /**
     * 为 TASK 节点创建审批任务
     */
    private void createTaskForNode(ProcessInstance instance, ProcessNode taskNode) {
        String assigneeId = participantResolver.resolve(
            taskNode.getAssignee(), instance);

        ProcessTask task = new ProcessTask();
        task.setInstanceId(instance.getId());
        task.setNodeId(taskNode.getId());
        task.setTitle(taskNode.getName());
        task.setTaskType(taskNode.getTaskType());
        task.setStatus(TaskStatus.PENDING);
        task.setAssigneeId(assigneeId);
        task.setCreatedAt(LocalDateTime.now());

        // SLA 设置
        if (taskNode.getSla() != null) {
            LocalDateTime dueDate = LocalDateTime.now().plus(taskNode.getSla().getDuration());
            task.setDueDate(dueDate);
            slaTracker.scheduleCheck(task, taskNode.getSla());
        }

        instance.getTasks().add(task);
        instanceRepository.save(instance);

        historyService.record(instance, HistoryEventType.TASK_CREATED,
            taskNode.getId(), "SYSTEM",
            Map.of("taskId", task.getId(), "assigneeId", assigneeId));
    }

    /**
     * 完成任务 (外部调用, 如审批通过/拒绝)
     */
    public void completeTask(Long taskId, String assigneeId, String result,
                              String comment, Map<String, Object> formData) {
        ProcessTask task = taskService.getById(taskId);

        if (task.getStatus() != TaskStatus.PENDING) {
            throw new ProcessEngineException("任务已完成或已取消, 无法重复操作");
        }

        if (!task.getAssigneeId().equals(assigneeId)) {
            throw new ProcessEngineException("只有被分配人才能完成此任务");
        }

        // 更新任务
        task.setStatus(TaskStatus.COMPLETED);
        task.setResult(result);
        task.setComment(comment);
        task.setFormData(JsonUtils.toJson(formData));
        task.setCompletedAt(LocalDateTime.now());

        // 如果表单中有变量更新，写入流程变量
        ProcessInstance instance = instanceRepository.findById(task.getInstanceId()).orElseThrow();
        if (formData != null && !formData.isEmpty()) {
            Map<String, Object> variables = JsonUtils.fromJson(
                instance.getVariablesJson(), Map.class);
            variables.putAll(formData);
            instance.setVariablesJson(JsonUtils.toJson(variables));
        }

        // 设置 taskResult 变量
        Map<String, Object> variables = JsonUtils.fromJson(
            instance.getVariablesJson(), Map.class);
        variables.put("taskResult", result);
        instance.setVariablesJson(JsonUtils.toJson(variables));

        instanceRepository.save(instance);

        historyService.record(instance, HistoryEventType.TASK_COMPLETED,
            task.getNodeId(), assigneeId,
            Map.of("result", result, "comment", comment != null ? comment : ""));

        // 推进流程
        ProcessDefinition definition = definitionRepository
            .findById(instance.getDefinitionId()).orElseThrow();
        ProcessDsl dsl = dslParser.parse(definition.getDslJson());
        advance(instance, dsl);
    }

    private String formatValue(Object value) {
        if (value instanceof String) return "'" + value + "'";
        return String.valueOf(value);
    }
}
```

**验收标准:** 启动流程 → 自动推进到 TASK → 完成任务 → 流程走完或进入下一节点

---

### Task 5: TaskService — 人工审批任务管理

**目标:** 提供任务的查询和操作能力

```java
@Service
@RequiredArgsConstructor
public class TaskService {

    private final ProcessTaskRepository taskRepository;

    public ProcessTask getById(Long id) {
        return taskRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Task", id));
    }

    /**
     * 查询用户待办任务
     */
    public Page<ProcessTask> getPendingTasks(String assigneeId, Pageable pageable) {
        return taskRepository.findByAssigneeIdAndStatus(
            assigneeId, TaskStatus.PENDING, pageable);
    }

    /**
     * 查询用户已办任务
     */
    public Page<ProcessTask> getCompletedTasks(String assigneeId, Pageable pageable) {
        return taskRepository.findByAssigneeIdAndStatus(
            assigneeId, TaskStatus.COMPLETED, pageable);
    }

    /**
     * 查询流程实例下的所有任务
     */
    public List<ProcessTask> getTasksByInstance(Long instanceId) {
        return taskRepository.findByInstanceId(instanceId);
    }

    /**
     * 催办 (设置为紧急)
     */
    public void escalate(Long taskId) {
        ProcessTask task = getById(taskId);
        // 发送通知
        notificationService.sendEscalation(task);
    }
}
```

---

### Task 6: ParticipantResolver — 参与者解析

**目标:** 根据配置解析任务的实际分配人

```java
@Service
@RequiredArgsConstructor
public class ParticipantResolver {

    private final UserService userService;

    /**
     * 解析参与者
     */
    public String resolve(AssigneeConfig config, ProcessInstance instance) {
        return switch (config.getType()) {
            case USER -> resolveUser(config.getValue());
            case ROLE -> resolveRole(config.getValue(), instance);
            case EXPRESSION -> resolveExpression(config.getValue(), instance);
        };
    }

    /**
     * 直接指定用户 ID
     */
    private String resolveUser(String userId) {
        if (!userService.exists(userId)) {
            throw new ParticipantResolutionException("用户不存在: " + userId);
        }
        return userId;
    }

    /**
     * 按角色解析 (取第一个匹配的用户)
     */
    private String resolveRole(String roleName, ProcessInstance instance) {
        List<String> users = userService.findByRole(roleName);
        if (users.isEmpty()) {
            throw new ParticipantResolutionException("角色下没有用户: " + roleName);
        }
        // v0.1: 取第一个, v0.2 可实现负载均衡
        return users.get(0);
    }

    /**
     * Aviator 表达式解析
     */
    private String resolveExpression(String expression, ProcessInstance instance) {
        Map<String, Object> env = new HashMap<>();
        env.put("initiatorId", instance.getInitiatorId());

        // 加入流程变量
        Map<String, Object> variables = JsonUtils.fromJson(
            instance.getVariablesJson(), Map.class);
        env.putAll(variables);

        // 注册辅助函数
        env.put("getVariable", variables);
        env.put("getInitiator", instance.getInitiatorId());

        try {
            // 处理 getVariable('approver') 风格
            String processed = expression;
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                processed = processed.replace(
                    "getVariable('" + entry.getKey() + "')",
                    entry.getValue() instanceof String ?
                        "'" + entry.getValue() + "'" : String.valueOf(entry.getValue()));
            }
            processed = processed.replace("getInitiator()",
                "'" + instance.getInitiatorId() + "'");

            Object result = AviatorEvaluator.execute(processed, env, true);
            if (result == null) {
                throw new ParticipantResolutionException(
                    "表达式返回 null: " + expression);
            }
            return result.toString();
        } catch (Exception e) {
            throw new ParticipantResolutionException(
                "表达式解析失败: " + expression + " - " + e.getMessage(), e);
        }
    }
}
```

**验收标准:** 三种分配方式均能正确解析; 表达式错误时抛出明确异常

---

### Task 7: TriggerMatcher + ObjectEventConsumer + ManualStartService

**目标:** 支持三种触发方式启动流程

```java
// === Object Event Consumer (Kafka) ===
@Service
@RequiredArgsConstructor
public class ObjectEventConsumer {

    private final ProcessEngine processEngine;
    private final ProcessDefinitionRepository definitionRepository;

    @KafkaListener(topics = "metaplatform.object-events", groupId = "process-engine")
    public void consumeEvent(ObjectEvent event) {
        // 查找匹配触发器的流程定义
        List<ProcessDefinition> definitions = definitionRepository
            .findByTriggerTypeAndStatus("OBJECT_EVENT", DefinitionStatus.ACTIVE);

        for (ProcessDefinition definition : definitions) {
            if (matchesTrigger(event, definition.getTriggerConfig())) {
                Map<String, Object> variables = buildVariables(event);
                processEngine.startProcess(
                    definition.getCode(),
                    event.getActorId(),
                    event.getObjectId(),
                    variables
                );
            }
        }
    }

    private boolean matchesTrigger(ObjectEvent event, String triggerConfigJson) {
        TriggerConfig config = JsonUtils.fromJson(triggerConfigJson, TriggerConfig.class);
        // 匹配对象类型
        if (!config.getObjectType().equals(event.getObjectType())) return false;
        // 匹配事件类型
        if (!config.getEventTypes().contains(event.getEventType())) return false;
        // 匹配条件 (可选)
        if (config.getCondition() != null) {
            return evaluateCondition(config.getCondition(), event);
        }
        return true;
    }
}

// === Manual Start Service ===
@Service
@RequiredArgsConstructor
public class ManualStartService {

    private final ProcessEngine processEngine;

    /**
     * 手动启动流程
     */
    public ProcessInstance start(String definitionCode, String initiatorId,
                                  String businessKey, Map<String, Object> variables) {
        return processEngine.startProcess(definitionCode, initiatorId, businessKey, variables);
    }

    /**
     * 取消流程
     */
    public void cancel(Long instanceId, String operatorId, String reason) {
        // 验证权限: 只有发起人或管理员可以取消
        processEngine.cancelProcess(instanceId, operatorId, reason);
    }
}

// === Trigger Config ===
public class TriggerConfig {
    private String objectType;          // 触发对象类型
    private List<String> eventTypes;    // 事件类型: CREATE, UPDATE, DELETE
    private String condition;           // 触发条件表达式
}
```

**验收标准:** Kafka 事件触发流程; 手动触发流程; 条件不满足时不触发

---

### Task 8: SlaTracker + SlaCheckScheduler

**目标:** SLA 超时追踪与告警

```java
@Service
@RequiredArgsConstructor
public class SlaTracker {

    private final ProcessTaskRepository taskRepository;
    private final ProcessInstanceRepository instanceRepository;
    private final NotificationService notificationService;
    private final ProcessHistoryService historyService;

    /**
     * 定时检查 SLA 超时
     * 每 5 分钟执行一次
     */
    @Scheduled(fixedRate = 300000) // 5 minutes
    @Transactional
    public void checkSlaBreaches() {
        LocalDateTime now = LocalDateTime.now();

        // 查找已超时的 PENDING 任务
        List<ProcessTask> overdueTasks = taskRepository
            .findByStatusAndDueDateBefore(TaskStatus.PENDING, now);

        for (ProcessTask task : overdueTasks) {
            handleSlaBreach(task);
        }
    }

    /**
     * 处理 SLA 超时
     */
    private void handleSlaBreach(ProcessTask task) {
        ProcessInstance instance = instanceRepository
            .findById(task.getInstanceId()).orElseThrow();

        // 获取 SLA 配置
        ProcessDefinition definition = definitionRepository
            .findById(instance.getDefinitionId()).orElseThrow();
        ProcessDsl dsl = dslParser.parse(definition.getDslJson());
        ProcessNode node = dsl.getNodeById(task.getNodeId());

        if (node.getSla() == null) return;

        switch (node.getSla().getEscalation()) {
            case "NOTIFY" -> {
                notificationService.notifySlaBreached(task);
                historyService.record(instance, HistoryEventType.SLA_BREACHED,
                    task.getNodeId(), "SYSTEM",
                    Map.of("taskId", task.getId(), "dueDate", task.getDueDate().toString()));
            }
            case "REASSIGN" -> {
                // 重新分配给上级
                String supervisorId = userService.getSupervisor(task.getAssigneeId());
                task.setAssigneeId(supervisorId);
                taskRepository.save(task);
            }
            case "AUTO_COMPLETE" -> {
                task.setStatus(TaskStatus.EXPIRED);
                task.setResult("AUTO_APPROVE");
                task.setCompletedAt(LocalDateTime.now());
                taskRepository.save(task);

                // 推进流程
                processEngine.completeTask(task.getId(), "SYSTEM",
                    "AUTO_APPROVE", "SLA 超时自动通过", null);
            }
        }
    }

    /**
     * 设置 SLA 定时检查
     */
    public void scheduleCheck(ProcessTask task, SlaConfig slaConfig) {
        // 任务创建时设置 dueDate, 由定时任务统一检查
        // (而非为每个任务创建独立定时器, 减少调度开销)
    }
}
```

**验收标准:** 超时任务被正确检测; NOTIFY 模式发送通知; AUTO_COMPLETE 模式自动推进

---

### Task 9: NlProcessGenerator — 自然语言→DSL

**目标:** 通过 AI Substrate LLM 从自然语言描述生成流程 DSL

```java
@Service
@RequiredArgsConstructor
public class NlProcessGenerator {

    private final AiSubstrateClient aiClient;
    private final DslParser dslParser;
    private final DefinitionValidator validator;

    private static final String SYSTEM_PROMPT = """
        你是 MetaPlatform 的流程自动化 DSL 生成器。根据用户的自然语言描述，
        生成 JSON 格式的流程定义 DSL。

        DSL 结构:
        {
          "key": "流程编码",
          "name": "流程名称",
          "description": "流程描述",
          "variables": [
            {"name": "变量名", "type": "STRING|INTEGER|DECIMAL|BOOLEAN|DATE|JSON", "required": true/false}
          ],
          "nodes": [
            {"id": "唯一ID", "type": "START|END|TASK|GATEWAY", "name": "节点名称",
             "assignee": {"type": "USER|ROLE|EXPRESSION", "value": "..."},
             "taskType": "APPROVAL|NOTIFICATION|MANUAL",
             "sla": {"duration": "PT24H", "escalation": "NOTIFY|REASSIGN|AUTO_COMPLETE"},
             "gatewayType": "XOR|AND",
             "action": {"type": "SET_VARIABLE", "variable": "...", "value": "..."}}
          ],
          "transitions": [
            {"from": "节点ID", "to": "节点ID", "condition": "Aviator表达式(可选)"}
          ]
        }

        规则:
        1. 必须有且只有一个 START 节点
        2. 必须有至少一个 END 节点
        3. GATEWAY 节点的出边必须有 condition (XOR) 或无 condition (AND)
        4. TASK 节点必须有 assignee
        5. 节点 ID 必须唯一
        6. 请使用合理的英文缩写作为 key 和 node id
        7. Aviator 条件表达式使用 getVariable('xxx') 引用变量
        """;

    /**
     * 自然语言生成流程 DSL
     */
    public ProcessDefinition generate(String description) {
        // 1. 调用 LLM
        LlmResponse response = aiClient.chatCompletion(
            LlmRequest.builder()
                .model("gpt-4o")
                .systemPrompt(SYSTEM_PROMPT)
                .userMessage("请根据以下描述生成流程 DSL:\n\n" + description)
                .temperature(0.2)
                .responseFormat("json_object")
                .build()
        );

        // 2. 解析 DSL
        String dslJson = response.getContent();
        ProcessDsl dsl = dslParser.parse(dslJson);

        // 3. 校验
        ValidationResult result = validator.validate(dsl);
        if (!result.isValid()) {
            // 尝试让 LLM 修正
            return retryWithCorrections(description, dslJson, result.getErrors());
        }

        // 4. 构建 ProcessDefinition
        ProcessDefinition definition = new ProcessDefinition();
        definition.setName(dsl.getName());
        definition.setCode(dsl.getKey());
        definition.setDescription(dsl.getDescription());
        definition.setVersion(1);
        definition.setStatus(DefinitionStatus.DRAFT);
        definition.setDslJson(dslJson);
        definition.setCreatedBy("nl_generator");
        definition.setCreatedAt(LocalDateTime.now());
        definition.setUpdatedAt(LocalDateTime.now());

        return definition;
    }

    /**
     * 校验失败时重试修正
     */
    private ProcessDefinition retryWithCorrections(String originalDesc,
                                                     String failedDsl,
                                                     List<String> errors) {
        String correctionPrompt = """
            之前的 DSL 生成有以下错误:
            %s

            原始 DSL:
            %s

            请修正以上错误，重新生成合法的 DSL JSON。
            """.formatted(String.join("\n- ", errors), failedDsl);

        LlmResponse retryResponse = aiClient.chatCompletion(
            LlmRequest.builder()
                .model("gpt-4o")
                .systemPrompt(SYSTEM_PROMPT)
                .userMessage(correctionPrompt)
                .temperature(0.1)
                .responseFormat("json_object")
                .build()
        );

        ProcessDsl correctedDsl = dslParser.parse(retryResponse.getContent());
        ValidationResult revalidation = validator.validate(correctedDsl);

        if (!revalidation.isValid()) {
            throw new NlGenerationException(
                "即使经过修正，DSL 仍然不合法: " + revalidation.getErrors());
        }

        ProcessDefinition definition = new ProcessDefinition();
        definition.setName(correctedDsl.getName());
        definition.setCode(correctedDsl.getKey());
        definition.setDescription(correctedDsl.getDescription());
        definition.setVersion(1);
        definition.setStatus(DefinitionStatus.DRAFT);
        definition.setDslJson(retryResponse.getContent());
        definition.setCreatedBy("nl_generator");
        definition.setCreatedAt(LocalDateTime.now());
        definition.setUpdatedAt(LocalDateTime.now());

        return definition;
    }
}
```

**验收标准:** "创建一个订单审批流程，金额超过1万需要经理审批" 能生成合法 DSL

---

### Task 10: ProcessHistoryEvent — 审计追踪

**目标:** 完整的流程审计事件记录和查询

```java
@Service
@RequiredArgsConstructor
public class ProcessHistoryService {

    private final ProcessHistoryRepository repository;

    public void record(ProcessInstance instance, HistoryEventType eventType,
                        String nodeId, String actorId, Object detail) {
        ProcessHistoryEvent event = new ProcessHistoryEvent();
        event.setInstanceId(instance.getId());
        event.setEventType(eventType);
        event.setNodeId(nodeId);
        event.setActorId(actorId);
        event.setDetail(detail != null ? JsonUtils.toJson(detail) : null);
        event.setTimestamp(LocalDateTime.now());
        repository.save(event);
    }

    /**
     * 查询流程实例的完整历史
     */
    public List<ProcessHistoryEvent> getInstanceHistory(Long instanceId) {
        return repository.findByInstanceIdOrderByTimestampAsc(instanceId);
    }

    /**
     * 查询节点的操作历史
     */
    public List<ProcessHistoryEvent> getNodeHistory(Long instanceId, String nodeId) {
        return repository.findByInstanceIdAndNodeIdOrderByTimestampAsc(instanceId, nodeId);
    }

    /**
     * 查询用户的操作历史
     */
    public Page<ProcessHistoryEvent> getActorHistory(String actorId, Pageable pageable) {
        return repository.findByActorIdOrderByTimestampDesc(actorId, pageable);
    }
}
```

---

### Task 11: REST API — ProcessDefinition CRUD

**目标:** `/api/v1/process-definitions` 完整 CRUD

```java
@RestController
@RequestMapping("/api/v1/process-definitions")
@RequiredArgsConstructor
public class ProcessDefinitionController {

    private final ProcessDefinitionRepository repository;
    private final DslParser dslParser;
    private final DefinitionValidator validator;

    @GetMapping
    public Page<ProcessDefinition> list(
            @RequestParam(required = false) DefinitionStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Specification<ProcessDefinition> spec = buildSpec(status);
        return repository.findAll(spec,
            PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @GetMapping("/{id}")
    public ProcessDefinition getById(@PathVariable Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("ProcessDefinition", id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProcessDefinition create(@Valid @RequestBody ProcessDefinitionCreateRequest req) {
        // 校验 DSL 合法性
        ProcessDsl dsl = dslParser.parse(req.getDslJson());
        ValidationResult result = validator.validate(dsl);
        if (!result.isValid()) {
            throw new ValidationException("DSL 不合法: " + result.getErrors());
        }

        ProcessDefinition definition = new ProcessDefinition();
        definition.setName(dsl.getName());
        definition.setCode(dsl.getKey());
        definition.setDescription(dsl.getDescription());
        definition.setVersion(1);
        definition.setStatus(DefinitionStatus.DRAFT);
        definition.setDslJson(req.getDslJson());
        definition.setTriggerType(req.getTriggerType());
        definition.setTriggerConfig(req.getTriggerConfig());
        definition.setCreatedBy(getCurrentUser());
        definition.setCreatedAt(LocalDateTime.now());
        definition.setUpdatedAt(LocalDateTime.now());

        return repository.save(definition);
    }

    @PutMapping("/{id}")
    public ProcessDefinition update(@PathVariable Long id,
                                     @Valid @RequestBody ProcessDefinitionUpdateRequest req) {
        ProcessDefinition existing = getById(id);
        if (existing.getStatus() == DefinitionStatus.ACTIVE) {
            throw new ValidationException("已激活的流程定义不能直接修改, 请先暂停");
        }

        ProcessDsl dsl = dslParser.parse(req.getDslJson());
        ValidationResult result = validator.validate(dsl);
        if (!result.isValid()) {
            throw new ValidationException("DSL 不合法: " + result.getErrors());
        }

        existing.setName(req.getName());
        existing.setDslJson(req.getDslJson());
        existing.setUpdatedAt(LocalDateTime.now());
        return repository.save(existing);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        ProcessDefinition existing = getById(id);
        if (existing.getStatus() == DefinitionStatus.ACTIVE) {
            throw new ValidationException("不能删除已激活的流程定义");
        }
        repository.deleteById(id);
    }

    @PostMapping("/{id}/activate")
    public ProcessDefinition activate(@PathVariable Long id) {
        ProcessDefinition definition = getById(id);
        definition.setStatus(DefinitionStatus.ACTIVE);
        definition.setUpdatedAt(LocalDateTime.now());
        return repository.save(definition);
    }

    @PostMapping("/{id}/suspend")
    public ProcessDefinition suspend(@PathVariable Long id) {
        ProcessDefinition definition = getById(id);
        definition.setStatus(DefinitionStatus.SUSPENDED);
        definition.setUpdatedAt(LocalDateTime.now());
        return repository.save(definition);
    }
}
```

---

### Task 12: REST API — ProcessInstance 操作

**目标:** `/api/v1/process-instances` 流程实例操作

```java
@RestController
@RequestMapping("/api/v1/process-instances")
@RequiredArgsConstructor
public class ProcessInstanceController {

    private final ProcessEngine processEngine;
    private final ManualStartService manualStartService;
    private final ProcessInstanceRepository instanceRepository;
    private final ProcessHistoryService historyService;

    @GetMapping
    public Page<ProcessInstance> list(
            @RequestParam(required = false) InstanceStatus status,
            @RequestParam(required = false) String definitionCode,
            @RequestParam(required = false) String initiatorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Specification<ProcessInstance> spec = buildSpec(status, definitionCode, initiatorId);
        return instanceRepository.findAll(spec,
            PageRequest.of(page, size, Sort.by("startedAt").descending()));
    }

    @GetMapping("/{id}")
    public ProcessInstance getById(@PathVariable Long id) {
        return instanceRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("ProcessInstance", id));
    }

    @GetMapping("/{id}/history")
    public List<ProcessHistoryEvent> getHistory(@PathVariable Long id) {
        return historyService.getInstanceHistory(id);
    }

    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public ProcessInstance startProcess(@Valid @RequestBody ProcessStartRequest request) {
        return manualStartService.start(
            request.getDefinitionCode(),
            getCurrentUserId(),
            request.getBusinessKey(),
            request.getVariables()
        );
    }

    @PostMapping("/{id}/cancel")
    public ProcessInstance cancel(@PathVariable Long id,
                                   @Valid @RequestBody ProcessCancelRequest request) {
        manualStartService.cancel(id, getCurrentUserId(), request.getReason());
        return getById(id);
    }
}
```

---

### Task 13: REST API — Task 操作

**目标:** `/api/v1/tasks` 任务查询和审批操作

```java
@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final ProcessEngine processEngine;

    @GetMapping("/my/pending")
    public Page<ProcessTask> myPendingTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return taskService.getPendingTasks(getCurrentUserId(),
            PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @GetMapping("/my/completed")
    public Page<ProcessTask> myCompletedTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return taskService.getCompletedTasks(getCurrentUserId(),
            PageRequest.of(page, size, Sort.by("completedAt").descending()));
    }

    @GetMapping("/{id}")
    public ProcessTask getById(@PathVariable Long id) {
        return taskService.getById(id);
    }

    /**
     * 完成审批任务 (通过/拒绝)
     */
    @PostMapping("/{id}/complete")
    public ProcessTask complete(@PathVariable Long id,
                                 @Valid @RequestBody TaskCompleteRequest request) {
        processEngine.completeTask(
            id,
            getCurrentUserId(),
            request.getResult(),
            request.getComment(),
            request.getFormData()
        );
        return taskService.getById(id);
    }

    /**
     * 催办
     */
    @PostMapping("/{id}/escalate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void escalate(@PathVariable Long id) {
        taskService.escalate(id);
    }
}
```

---

### Task 14: REST API — NL Process 生成

**目标:** `/api/v1/nl-process` 自然语言生成流程

```java
@RestController
@RequestMapping("/api/v1/nl-process")
@RequiredArgsConstructor
public class NlProcessController {

    private final NlProcessGenerator nlGenerator;
    private final ProcessDefinitionRepository repository;

    /**
     * 自然语言生成流程定义
     */
    @PostMapping("/generate")
    public ProcessDefinition generate(@Valid @RequestBody NlProcessGenerateRequest request) {
        return nlGenerator.generate(request.getDescription());
    }

    /**
     * 自然语言生成 + 保存 + 激活
     */
    @PostMapping("/generate-and-activate")
    public ProcessDefinition generateAndActivate(
            @Valid @RequestBody NlProcessGenerateRequest request) {
        ProcessDefinition definition = nlGenerator.generate(request.getDescription());
        definition.setStatus(DefinitionStatus.ACTIVE);
        return repository.save(definition);
    }

    /**
     * 预览 DSL (不保存)
     */
    @PostMapping("/preview")
    public JsonNode preview(@Valid @RequestBody NlProcessGenerateRequest request) {
        ProcessDefinition definition = nlGenerator.generate(request.getDescription());
        return JsonUtils.toJsonNode(definition.getDslJson());
    }
}
```

---

### Task 15: PostgreSQL + Flyway 迁移

**目标:** 创建数据库迁移脚本

```sql
-- V001__create_process_tables.sql

CREATE TABLE process_definition (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    dsl_json TEXT NOT NULL,
    trigger_type VARCHAR(30),
    trigger_config TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE process_instance (
    id BIGSERIAL PRIMARY KEY,
    definition_id BIGINT NOT NULL REFERENCES process_definition(id),
    definition_code VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    current_node_id VARCHAR(100),
    initiator_id VARCHAR(100) NOT NULL,
    initiator_name VARCHAR(200),
    business_key VARCHAR(200),
    business_type VARCHAR(100),
    variables_json TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE process_task (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    task_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assignee_id VARCHAR(100),
    assignee_name VARCHAR(200),
    result VARCHAR(100),
    form_data TEXT,
    comment TEXT,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE process_history (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    node_id VARCHAR(100),
    actor_id VARCHAR(100),
    actor_name VARCHAR(200),
    detail TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE process_variable (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value TEXT,
    type VARCHAR(20) NOT NULL,
    UNIQUE (instance_id, name)
);

CREATE TABLE process_sla (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES process_task(id) ON DELETE CASCADE,
    duration VARCHAR(50) NOT NULL,
    escalation VARCHAR(30),
    due_date TIMESTAMP NOT NULL,
    breached BOOLEAN DEFAULT FALSE,
    breached_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_process_instance_definition ON process_instance(definition_code);
CREATE INDEX idx_process_instance_status ON process_instance(status);
CREATE INDEX idx_process_instance_initiator ON process_instance(initiator_id);
CREATE INDEX idx_process_instance_business ON process_instance(business_type, business_key);
CREATE INDEX idx_process_task_instance ON process_task(instance_id);
CREATE INDEX idx_process_task_assignee ON process_task(assignee_id, status);
CREATE INDEX idx_process_task_due ON process_task(due_date) WHERE status = 'PENDING';
CREATE INDEX idx_process_history_instance ON process_history(instance_id, timestamp);
CREATE INDEX idx_process_history_actor ON process_history(actor_id);
```

```sql
-- V002__add_process_sla_check_column.sql
ALTER TABLE process_task ADD COLUMN sla_warning_sent BOOLEAN DEFAULT FALSE;
```

```sql
-- V003__add_process_definition_trigger_index.sql
CREATE INDEX idx_process_def_trigger ON process_definition(trigger_type, status);
```

```sql
-- V004__add_process_instance_correlation.sql
ALTER TABLE process_instance ADD COLUMN correlation_id VARCHAR(200);
CREATE INDEX idx_process_instance_correlation ON process_instance(correlation_id);
```

---

### Task 16: Integration Tests

**目标:** 端到端集成测试

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class ProcessEngineIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired ProcessDefinitionRepository definitionRepository;
    @Autowired ProcessInstanceRepository instanceRepository;

    private String approvalDsl;

    @BeforeEach
    void setUp() {
        approvalDsl = """
        {
          "key": "test_approval",
          "name": "测试审批流程",
          "variables": [
            {"name": "amount", "type": "DECIMAL", "required": true}
          ],
          "nodes": [
            {"id": "start", "type": "START", "name": "开始"},
            {"id": "check", "type": "GATEWAY", "name": "金额判断", "gatewayType": "XOR"},
            {"id": "auto", "type": "END", "name": "自动通过"},
            {"id": "approve", "type": "TASK", "name": "人工审批",
             "assignee": {"type": "USER", "value": "manager01"},
             "taskType": "APPROVAL"},
            {"id": "end_ok", "type": "END", "name": "完成"},
            {"id": "end_no", "type": "END", "name": "拒绝"}
          ],
          "transitions": [
            {"from": "start", "to": "check"},
            {"from": "check", "to": "auto", "condition": "getVariable('amount') < 10000"},
            {"from": "check", "to": "approve", "condition": "getVariable('amount') >= 10000"},
            {"from": "approve", "to": "end_ok", "condition": "taskResult == 'APPROVE'"},
            {"from": "approve", "to": "end_no", "condition": "taskResult == 'REJECT'"}
          ]
        }
        """;
    }

    @Test
    void createDefinitionAndActivate() throws Exception {
        ProcessDefinitionCreateRequest req = new ProcessDefinitionCreateRequest();
        req.setDslJson(approvalDsl);

        String response = mockMvc.perform(post("/api/v1/process-definitions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.code").value("test_approval"))
            .andReturn().getResponse().getContentAsString();

        ProcessDefinition def = objectMapper.readValue(response, ProcessDefinition.class);

        mockMvc.perform(post("/api/v1/process-definitions/" + def.getId() + "/activate"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void startProcessAutoApprove() throws Exception {
        // 创建并激活定义
        ProcessDefinition def = createAndActivateDefinition();

        ProcessStartRequest req = new ProcessStartRequest();
        req.setDefinitionCode("test_approval");
        req.setBusinessKey("order-001");
        req.setVariables(Map.of("amount", 5000));

        mockMvc.perform(post("/api/v1/process-instances/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("COMPLETED")) // 金额<1万，自动通过
            .andExpect(jsonPath("$.currentNodeId").value("auto"));
    }

    @Test
    void startProcessManualApproval() throws Exception {
        ProcessDefinition def = createAndActivateDefinition();

        ProcessStartRequest req = new ProcessStartRequest();
        req.setDefinitionCode("test_approval");
        req.setBusinessKey("order-002");
        req.setVariables(Map.of("amount", 20000));

        String response = mockMvc.perform(post("/api/v1/process-instances/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("RUNNING"))
            .andExpect(jsonPath("$.currentNodeId").value("approve"))
            .andReturn().getResponse().getContentAsString();

        ProcessInstance instance = objectMapper.readValue(response, ProcessInstance.class);

        // 查询待办任务
        mockMvc.perform(get("/api/v1/tasks/my/pending"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].nodeId").value("approve"));

        // 完成审批 (通过)
        Long taskId = instance.getTasks().get(0).getId();
        TaskCompleteRequest completeReq = new TaskCompleteRequest();
        completeReq.setResult("APPROVE");
        completeReq.setComment("同意");

        mockMvc.perform(post("/api/v1/tasks/" + taskId + "/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(completeReq)))
            .andExpect(status().isOk());

        // 流程应已完成
        mockMvc.perform(get("/api/v1/process-instances/" + instance.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test
    void startProcessRejectFlow() throws Exception {
        ProcessDefinition def = createAndActivateDefinition();

        ProcessStartRequest req = new ProcessStartRequest();
        req.setDefinitionCode("test_approval");
        req.setBusinessKey("order-003");
        req.setVariables(Map.of("amount", 50000));

        String response = mockMvc.perform(post("/api/v1/process-instances/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        ProcessInstance instance = objectMapper.readValue(response, ProcessInstance.class);
        Long taskId = instance.getTasks().get(0).getId();

        // 拒绝
        TaskCompleteRequest completeReq = new TaskCompleteRequest();
        completeReq.setResult("REJECT");
        completeReq.setComment("预算不足");

        mockMvc.perform(post("/api/v1/tasks/" + taskId + "/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(completeReq)))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/process-instances/" + instance.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.currentNodeId").value("end_no"));
    }

    @Test
    void getProcessHistory() throws Exception {
        ProcessDefinition def = createAndActivateDefinition();
        ProcessStartRequest req = new ProcessStartRequest();
        req.setDefinitionCode("test_approval");
        req.setBusinessKey("order-004");
        req.setVariables(Map.of("amount", 5000));

        String response = mockMvc.perform(post("/api/v1/process-instances/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        ProcessInstance instance = objectMapper.readValue(response, ProcessInstance.class);

        mockMvc.perform(get("/api/v1/process-instances/" + instance.getId() + "/history"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$.length()").isGreaterThan(0));
    }
}
```

**验收标准:** 全部集成测试通过; 自动审批/人工审批/拒绝流程均正常

---

### Task 17: 文档与 API Contract

**目标:** 补充 OpenAPI spec、模块 README

**文件结构:**

```
metaplatform-process-engine/
├── build.gradle.kts
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/process/
│   │   │   ├── ProcessEngineApplication.java
│   │   │   ├── domain/
│   │   │   │   ├── ProcessDefinition.java
│   │   │   │   ├── ProcessInstance.java
│   │   │   │   ├── ProcessTask.java
│   │   │   │   ├── ProcessHistoryEvent.java
│   │   │   │   ├── dsl/
│   │   │   │   │   ├── ProcessDsl.java
│   │   │   │   │   ├── ProcessNode.java
│   │   │   │   │   ├── Transition.java
│   │   │   │   │   ├── VariableDefinition.java
│   │   │   │   │   ├── AssigneeConfig.java
│   │   │   │   │   ├── SlaConfig.java
│   │   │   │   │   └── FormConfig.java
│   │   │   │   ├── enums/
│   │   │   │   │   ├── InstanceStatus.java
│   │   │   │   │   ├── NodeType.java
│   │   │   │   │   ├── GatewayType.java
│   │   │   │   │   ├── TaskType.java
│   │   │   │   │   ├── TaskStatus.java
│   │   │   │   │   ├── AssigneeType.java
│   │   │   │   │   ├── DefinitionStatus.java
│   │   │   │   │   └── HistoryEventType.java
│   │   │   │   └── repository/
│   │   │   │       ├── ProcessDefinitionRepository.java
│   │   │   │       ├── ProcessInstanceRepository.java
│   │   │   │       ├── ProcessTaskRepository.java
│   │   │   │       └── ProcessHistoryRepository.java
│   │   │   ├── application/
│   │   │   │   ├── ProcessEngine.java
│   │   │   │   ├── DslParser.java
│   │   │   │   ├── DefinitionValidator.java
│   │   │   │   ├── TaskService.java
│   │   │   │   ├── ParticipantResolver.java
│   │   │   │   ├── TriggerMatcher.java
│   │   │   │   ├── ManualStartService.java
│   │   │   │   ├── SlaTracker.java
│   │   │   │   ├── NlProcessGenerator.java
│   │   │   │   └── ProcessHistoryService.java
│   │   │   ├── api/
│   │   │   │   ├── ProcessDefinitionController.java
│   │   │   │   ├── ProcessInstanceController.java
│   │   │   │   ├── TaskController.java
│   │   │   │   ├── NlProcessController.java
│   │   │   │   └── dto/
│   │   │   │       ├── ProcessDefinitionCreateRequest.java
│   │   │   │       ├── ProcessDefinitionUpdateRequest.java
│   │   │   │       ├── ProcessStartRequest.java
│   │   │   │       ├── ProcessCancelRequest.java
│   │   │   │       ├── TaskCompleteRequest.java
│   │   │   │       └── NlProcessGenerateRequest.java
│   │   │   └── infrastructure/
│   │   │       ├── config/
│   │   │       │   ├── KafkaConfig.java
│   │   │       │   └── AviatorConfig.java
│   │   │       ├── consumer/
│   │   │       │   └── ObjectEventConsumer.java
│   │   │       └── exception/
│   │   │           ├── DslParseException.java
│   │   │           ├── ProcessEngineException.java
│   │   │           ├── ParticipantResolutionException.java
│   │   │           ├── NlGenerationException.java
│   │   │           └── ResourceNotFoundException.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   │           ├── V001__create_process_tables.sql
│   │           ├── V002__add_process_sla_check_column.sql
│   │           ├── V003__add_process_definition_trigger_index.sql
│   │           └── V004__add_process_instance_correlation.sql
│   └── test/
│       └── java/com/metaplatform/process/
│           ├── application/
│           │   ├── DslParserTest.java
│           │   ├── DefinitionValidatorTest.java
│           │   ├── ProcessEngineTest.java
│           │   └── ParticipantResolverTest.java
│           └── api/
│               └── ProcessEngineIntegrationTest.java
└── openapi/
    └── process-engine-api.yaml
```

---

## 5. Design Decisions

| # | 决策 | 理由 |
|---|------|------|
| DD-1 | 自定义 JSON DSL 而非 BPMN 2.0 | v0.1 追求简洁, JSON 易于生成/解析; BPMN 作为 v0.2 升级方向 |
| DD-2 | 状态机驱动而非事件驱动 | 流程推进逻辑简单直接, 便于理解和调试 |
| DD-3 | Aviator 表达式引擎 | 轻量级, 性能好, 支持 Java 对象操作, 国内社区活跃 |
| DD-4 | Task 与 Instance 同一事务 | 保证任务创建和流程推进的原子性 |
| DD-5 | SLA 使用定时轮询而非延迟队列 | 实现简单, 5 分钟精度满足 v0.1 需求 |
| DD-6 | Kafka 消费对象事件 | 与 MetaPlatform 核心的对象事件总线对齐 |
| DD-7 | NL 生成后自动校验+修正循环 | 提高 LLM 生成 DSL 的成功率 |
| DD-8 | 并行网关 v0.1 简化为顺序执行 | 避免引入复杂的并行状态追踪, v0.2 再支持真并行 |

---

## 6. API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/process-definitions` | 查询流程定义列表 |
| GET | `/api/v1/process-definitions/{id}` | 获取流程定义详情 |
| POST | `/api/v1/process-definitions` | 创建流程定义 |
| PUT | `/api/v1/process-definitions/{id}` | 更新流程定义 |
| DELETE | `/api/v1/process-definitions/{id}` | 删除流程定义 |
| POST | `/api/v1/process-definitions/{id}/activate` | 激活流程定义 |
| POST | `/api/v1/process-definitions/{id}/suspend` | 暂停流程定义 |
| GET | `/api/v1/process-instances` | 查询流程实例列表 |
| GET | `/api/v1/process-instances/{id}` | 获取流程实例详情 |
| GET | `/api/v1/process-instances/{id}/history` | 查询流程历史 |
| POST | `/api/v1/process-instances/start` | 启动流程实例 |
| POST | `/api/v1/process-instances/{id}/cancel` | 取消流程实例 |
| GET | `/api/v1/tasks/my/pending` | 查询我的待办任务 |
| GET | `/api/v1/tasks/my/completed` | 查询我的已办任务 |
| GET | `/api/v1/tasks/{id}` | 获取任务详情 |
| POST | `/api/v1/tasks/{id}/complete` | 完成任务 (审批) |
| POST | `/api/v1/tasks/{id}/escalate` | 催办任务 |
| POST | `/api/v1/nl-process/generate` | NL 生成流程定义 |
| POST | `/api/v1/nl-process/generate-and-activate` | NL 生成+激活 |
| POST | `/api/v1/nl-process/preview` | NL 预览 DSL |

---

## 7. Test Strategy

| 层级 | 覆盖范围 | 工具 |
|------|----------|------|
| 单元测试 | DslParser, DefinitionValidator, ProcessEngine, ParticipantResolver | JUnit 5 + Mockito |
| 集成测试 | REST API 端到端 (自动审批/人工审批/拒绝/SLA) | @SpringBootTest + MockMvc |
| Kafka 测试 | ObjectEventConsumer 事件消费 | spring-kafka-test |

**测试命令:**

```bash
# 全部测试
./gradlew :metaplatform-process-engine:test

# 仅单元测试
./gradlew :metaplatform-process-engine:test --tests "*.application.*"

# 仅集成测试
./gradlew :metaplatform-process-engine:test --tests "*.api.*"

# 测试覆盖率
./gradlew :metaplatform-process-engine:jacocoTestReport
```

---

## 8. v0.2 Roadmap

| Feature | Priority | Description |
|---------|----------|-------------|
| BPMN 2.0 支持 | P0 | 导入/导出标准 BPMN 2.0 XML |
| 可视化流程设计器 | P0 | 拖拽式流程设计界面 |
| 子流程嵌套 | P1 | 支持 SUBPROCESS 节点调用子流程 |
| 真并行网关 | P1 | AND 网关的真正并行执行 (fork/join) |
| 多实例任务 | P1 | 一个 TASK 节点分配给多人并行/串行审批 |
| 条件事件 | P2 | 基于条件表达式的事件触发 |
| 信号事件 | P2 | 跨流程的信号通信 |
| 流程变量持久化 | P2 | 独立的变量表管理复杂变量 |
| 流程监控仪表盘 | P2 | 流程运行状态统计和可视化 |
| 流程版本管理 | P2 | 定义版本升级、在途实例迁移策略 |
| 委托/转办 | P2 | 任务委托给他人处理 |
| 会签/或签 | P3 | 多人投票/任意一人通过 |
| 超时自动策略 | P3 | 更丰富的 SLA 升级策略 |
| AI 智能路由 | P3 | 基于历史数据的智能参与者推荐 |

---

*Document generated: 2026-07-02*
*Author: MetaPlatform Team*
