# 页面/表单生成器 v0.1 — Implementation Plan

> **Module:** `metaplatform-page-generator`
> **Version:** 0.1.0
> **Date:** 2026-07-02
> **Status:** Draft
> **Java:** 21 | **Spring Boot:** 3.2 | **Build:** Gradle 8.5

---

## 1. Vision & Scope

页面/表单生成器是 MetaPlatform 的核心 Superpower 之一。它允许用户通过 Schema 元数据或自然语言描述，自动生成 TABLE、FORM、KANBAN、PAGE 四种 UI 页面配置，并输出结构化 JSON 供前端渲染引擎消费。

### 1.1 核心能力

| 能力 | 说明 |
|------|------|
| Schema → UI 自动生成 | 从 ObjectMeta 自动生成 TABLE/FORM/KANBAN/PAGE 配置 |
| 智能字段映射 | FieldSemanticRecognizer 根据字段名/类型/注解自动选择最佳 Widget |
| 自然语言生成 | NlPageGenerator 通过 AI Substrate LLM 从自然语言描述生成 PageConfig |
| 布局优化 | LayoutOptimizer 智能排列字段顺序和分组 |
| 内置模板 | 提供 CRUD 表单、主从表单、看板三种预设模板 |
| 结构化输出 | PageRenderService 输出标准 JSON schema 供前端消费 |

### 1.2 Non-Goals (v0.1)

- 可视化拖拽设计器（v0.2）
- 自定义 CSS/样式注入
- 多语言国际化 UI 标签
- 前端组件代码生成（仅输出配置 JSON）

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        REST API Layer                           │
│  /api/v1/page-configs  /api/v1/pages  /api/v1/page-templates   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Service Layer                              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ PageGenerator │ │  NlPageGen   │ │     TemplateService     │ │
│  │   Service     │ │  erator      │ │  (CRUD/MasterDetail/    │ │
│  │               │ │              │ │   Kanban templates)     │ │
│  └──────┬───────┘ └──────┬───────┘ └────────────┬────────────┘ │
│         │                │                       │              │
│  ┌──────▼───────┐ ┌──────▼───────┐ ┌────────────▼────────────┐ │
│  │ FieldSemantic │ │ LayoutOpti- │ │   PageRenderService     │ │
│  │ Recognizer    │ │ mizer        │ │   (JSON output)         │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Domain Layer                               │
│  PageConfig  │  PageSection  │  FieldWidget  │  ViewConfig      │
│  TableConfig │  KanbanConfig │  PageTemplate                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Persistence Layer (JPA + H2/PostgreSQL)       │
│  page_config  │  page_section  │  page_template                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Domain Model

### 3.1 PageConfig (Aggregate Root)

```java
@Entity
@Table(name = "page_config")
public class PageConfig {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;              // 页面名称

    @Column(nullable = false)
    private String code;              // 唯一编码 (如 "customer_list")

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PageType pageType;        // TABLE | FORM | KANBAN | PAGE

    @Column(name = "object_code")
    private String objectCode;        // 关联的 ObjectMeta 编码

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "page_config_id")
    @OrderBy("sortOrder ASC")
    private List<PageSection> sections = new ArrayList<>();

    @Embedded
    private ViewConfig viewConfig;    // 视图配置 (筛选/排序/分页)

    @Column(columnDefinition = "TEXT")
    private String jsonConfig;        // 完整 JSON 配置 (序列化存储)

    @Enumerated(EnumType.STRING)
    private ConfigStatus status;      // DRAFT | PUBLISHED | ARCHIVED

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

public enum PageType {
    TABLE, FORM, KANBAN, PAGE
}

public enum ConfigStatus {
    DRAFT, PUBLISHED, ARCHIVED
}
```

### 3.2 PageSection (Entity)

```java
@Entity
@Table(name = "page_section")
public class PageSection {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "page_config_id", nullable = false)
    private Long pageConfigId;

    @Column(nullable = false)
    private String title;             // 区块标题

    @Enumerated(EnumType.STRING)
    private SectionType sectionType;  // FIELD_GROUP | TABLE | KANBAN | RICH_TEXT | CHART

    private Integer sortOrder;        // 排序序号

    private Integer columns;          // 栅格列数 (1-12), 默认 2

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "section_id")
    @OrderBy("sortOrder ASC")
    private List<FieldWidget> fields = new ArrayList<>();

    @Embedded
    private TableConfig tableConfig;  // 当 sectionType=TABLE 时使用

    @Embedded
    private KanbanConfig kanbanConfig; // 当 sectionType=KANBAN 时使用
}

public enum SectionType {
    FIELD_GROUP, TABLE, KANBAN, RICH_TEXT, CHART
}
```

### 3.3 FieldWidget (Entity)

```java
@Entity
@Table(name = "field_widget")
public class FieldWidget {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "section_id")
    private Long sectionId;

    @Column(nullable = false)
    private String fieldCode;         // 关联字段编码

    @Column(nullable = false)
    private String label;             // 显示标签

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WidgetType widgetType;    // 组件类型

    private Boolean required;         // 是否必填
    private Boolean readonly;         // 是否只读
    private String placeholder;       // 占位文本
    private Integer colSpan;          // 跨列数 (默认 1)

    @Column(columnDefinition = "TEXT")
    private String options;           // 组件选项 (JSON)

    @Column(columnDefinition = "TEXT")
    private String validationRules;   // 校验规则 (JSON)

    private Integer sortOrder;
}

public enum WidgetType {
    // 文本类
    TEXT, TEXTAREA, RICH_TEXT,
    // 数值类
    NUMBER, CURRENCY, PERCENTAGE,
    // 选择类
    SELECT, MULTI_SELECT, RADIO, CHECKBOX,
    // 日期类
    DATE, DATE_TIME, TIME,
    // 特殊类
    EMAIL, PHONE, URL, COLOR, FILE_UPLOAD, IMAGE_UPLOAD,
    // 关系类
    LOOKUP, MASTER_DETAIL,
    // 布局类
    DIVIDER, SECTION_HEADER
}
```

### 3.4 TableConfig (Embeddable)

```java
@Embeddable
public class TableConfig {
    private Boolean pagination;       // 是否分页 (默认 true)
    private Integer pageSize;         // 每页条数 (默认 20)
    private Boolean sortable;         // 是否可排序
    private Boolean filterable;       // 是否可筛选
    private Boolean selectable;       // 是否可选择行
    private Boolean exportable;       // 是否可导出

    @Column(columnDefinition = "TEXT")
    private String columnConfig;      // 列配置 JSON (width, frozen, visible 等)

    @Column(columnDefinition = "TEXT")
    private String defaultSort;       // 默认排序 JSON
}
```

### 3.5 KanbanConfig (Embeddable)

```java
@Embeddable
public class KanbanConfig {
    private String groupByField;      // 分组字段 (如 "status")
    private String titleField;        // 卡片标题字段
    private String descriptionField;  // 卡片描述字段
    private String avatarField;       // 头像字段
    private String[] colorRules;      // 颜色规则 JSON

    @Column(columnDefinition = "TEXT")
    private String swimLaneConfig;    // 泳道配置
}
```

### 3.6 ViewConfig (Embeddable)

```java
@Embeddable
public class ViewConfig {
    @Column(columnDefinition = "TEXT")
    private String filters;           // 预设筛选条件 JSON

    @Column(columnDefinition = "TEXT")
    private String sortRules;         // 排序规则 JSON

    private Integer defaultPageSize;  // 默认分页大小
    private Boolean showHeader;       // 是否显示页头
    private Boolean showBreadcrumb;   // 是否显示面包屑

    @Column(columnDefinition = "TEXT")
    private String actionButtons;     // 操作按钮配置 JSON
}
```

---

## 4. Implementation Tasks

### Task 1: 模块脚手架搭建

**目标:** 创建独立的 `metaplatform-page-generator` Gradle 子模块

**Steps:**

1. 在根 `settings.gradle.kts` 中 include 子模块
2. 创建 `metaplatform-page-generator/build.gradle.kts`
3. 配置依赖: Spring Boot 3.2, Spring Data JPA, Spring Web, H2 (dev), PostgreSQL (prod)
4. 创建包结构: `com.metaplatform.pagegenerator.{domain,application,infrastructure,api}`
5. 创建 `application.yml` 配置文件
6. 创建主启动类 `PageGeneratorApplication`

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
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
    implementation("org.apache.commons:commons-lang3:3.14.0")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    runtimeOnly("com.h2database:h2")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.mockito:mockito-core")
}
```

**验收标准:** `./gradlew :metaplatform-page-generator:build` 成功

---

### Task 2: PageConfig Domain Model + JPA Mapping

**目标:** 实现 PageConfig 聚合根及全部嵌入/关联实体

**Steps:**

1. 创建 `PageConfig` 实体 (如 3.1 所示)
2. 创建 `PageSection` 实体 (如 3.2 所示)
3. 创建 `FieldWidget` 实体 (如 3.3 所示)
4. 创建 `TableConfig`、`KanbanConfig`、`ViewConfig` 嵌入类
5. 创建枚举: `PageType`, `ConfigStatus`, `SectionType`, `WidgetType`
6. 创建 `PageConfigRepository` (Spring Data JPA)
7. 创建 Flyway 迁移脚本 `V001__create_page_config_tables.sql`

**Flyway Migration:**

```sql
-- V001__create_page_config_tables.sql

CREATE TABLE page_config (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    page_type VARCHAR(20) NOT NULL,
    object_code VARCHAR(100),
    json_config TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    show_header BOOLEAN DEFAULT TRUE,
    show_breadcrumb BOOLEAN DEFAULT TRUE,
    default_page_size INT DEFAULT 20,
    filters TEXT,
    sort_rules TEXT,
    action_buttons TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE page_section (
    id BIGSERIAL PRIMARY KEY,
    page_config_id BIGINT NOT NULL REFERENCES page_config(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    section_type VARCHAR(30) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    columns INT DEFAULT 2,
    -- TableConfig fields
    pagination BOOLEAN,
    page_size INT,
    sortable BOOLEAN,
    filterable BOOLEAN,
    selectable BOOLEAN,
    exportable BOOLEAN,
    column_config TEXT,
    default_sort TEXT,
    -- KanbanConfig fields
    group_by_field VARCHAR(100),
    title_field VARCHAR(100),
    description_field VARCHAR(100),
    avatar_field VARCHAR(100),
    color_rules TEXT,
    swim_lane_config TEXT
);

CREATE TABLE field_widget (
    id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES page_section(id) ON DELETE CASCADE,
    field_code VARCHAR(100) NOT NULL,
    label VARCHAR(200) NOT NULL,
    widget_type VARCHAR(30) NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    readonly BOOLEAN DEFAULT FALSE,
    placeholder VARCHAR(200),
    col_span INT DEFAULT 1,
    options TEXT,
    validation_rules TEXT,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_page_config_code ON page_config(code);
CREATE INDEX idx_page_section_config ON page_section(page_config_id);
CREATE INDEX idx_field_widget_section ON field_widget(section_id);
```

**验收标准:** 实体可通过 JPA 创建/查询，迁移脚本执行成功

---

### Task 3: FieldSemanticRecognizer — 智能字段→组件映射

**目标:** 根据字段的名称、数据类型、注解，自动推断最合适的 WidgetType

**设计决策:** 采用多策略组合：类型匹配 + 语义关键词匹配 + 注解优先

```java
@Service
public class FieldSemanticRecognizer {

    /**
     * 识别单个字段的最佳 WidgetType
     */
    public WidgetType recognize(FieldDescriptor field) {
        // 1. 注解优先 (@WidgetType 注解)
        WidgetType annotated = recognizeFromAnnotation(field);
        if (annotated != null) return annotated;

        // 2. 语义关键词匹配 (字段名)
        WidgetType semantic = recognizeFromSemantic(field);
        if (semantic != null) return semantic;

        // 3. 数据类型匹配 (兜底)
        return recognizeFromDataType(field);
    }

    /**
     * 批量识别
     */
    public Map<String, WidgetType> recognizeAll(List<FieldDescriptor> fields) {
        return fields.stream()
            .collect(Collectors.toMap(
                FieldDescriptor::getCode,
                this::recognize,
                (a, b) -> a,
                LinkedHashMap::new
            ));
    }

    // === 语义关键词映射表 ===
    private static final Map<String, WidgetType> SEMANTIC_RULES = Map.ofEntries(
        // 邮箱
        Map.entry("email", WidgetType.EMAIL),
        Map.entry("mail", WidgetType.EMAIL),
        Map.entry("邮箱", WidgetType.EMAIL),
        // 电话
        Map.entry("phone", WidgetType.PHONE),
        Map.entry("tel", WidgetType.PHONE),
        Map.entry("mobile", WidgetType.PHONE),
        Map.entry("电话", WidgetType.PHONE),
        Map.entry("手机", WidgetType.PHONE),
        // URL
        Map.entry("url", WidgetType.URL),
        Map.entry("website", WidgetType.URL),
        Map.entry("link", WidgetType.URL),
        Map.entry("网址", WidgetType.URL),
        Map.entry("链接", WidgetType.URL),
        // 金额
        Map.entry("amount", WidgetType.CURRENCY),
        Map.entry("price", WidgetType.CURRENCY),
        Map.entry("cost", WidgetType.CURRENCY),
        Map.entry("total", WidgetType.CURRENCY),
        Map.entry("金额", WidgetType.CURRENCY),
        Map.entry("价格", WidgetType.CURRENCY),
        Map.entry("费用", WidgetType.CURRENCY),
        // 百分比
        Map.entry("rate", WidgetType.PERCENTAGE),
        Map.entry("ratio", WidgetType.PERCENTAGE),
        Map.entry("percent", WidgetType.PERCENTAGE),
        Map.entry("比率", WidgetType.PERCENTAGE),
        // 日期/时间
        Map.entry("date", WidgetType.DATE),
        Map.entry("birthday", WidgetType.DATE),
        Map.entry("日期", WidgetType.DATE),
        Map.entry("生日", WidgetType.DATE),
        Map.entry("datetime", WidgetType.DATE_TIME),
        Map.entry("created_at", WidgetType.DATE_TIME),
        Map.entry("updated_at", WidgetType.DATE_TIME),
        Map.entry("时间", WidgetType.DATE_TIME),
        Map.entry("time", WidgetType.TIME),
        // 颜色
        Map.entry("color", WidgetType.COLOR),
        Map.entry("colour", WidgetType.COLOR),
        Map.entry("颜色", WidgetType.COLOR),
        // 富文本
        Map.entry("content", WidgetType.RICH_TEXT),
        Map.entry("description", WidgetType.RICH_TEXT),
        Map.entry("body", WidgetType.RICH_TEXT),
        Map.entry("内容", WidgetType.RICH_TEXT),
        Map.entry("描述", WidgetType.RICH_TEXT),
        Map.entry("正文", WidgetType.RICH_TEXT),
        // 文件/图片
        Map.entry("file", WidgetType.FILE_UPLOAD),
        Map.entry("attachment", WidgetType.FILE_UPLOAD),
        Map.entry("附件", WidgetType.FILE_UPLOAD),
        Map.entry("image", WidgetType.IMAGE_UPLOAD),
        Map.entry("photo", WidgetType.IMAGE_UPLOAD),
        Map.entry("avatar", WidgetType.IMAGE_UPLOAD),
        Map.entry("图片", WidgetType.IMAGE_UPLOAD),
        Map.entry("头像", WidgetType.IMAGE_UPLOAD),
        // 状态 (SELECT)
        Map.entry("status", WidgetType.SELECT),
        Map.entry("state", WidgetType.SELECT),
        Map.entry("type", WidgetType.SELECT),
        Map.entry("category", WidgetType.SELECT),
        Map.entry("级别", WidgetType.SELECT),
        Map.entry("类型", WidgetType.SELECT),
        Map.entry("分类", WidgetType.SELECT)
    );

    // === 数据类型 → WidgetType 映射 ===
    private WidgetType recognizeFromDataType(FieldDescriptor field) {
        return switch (field.getDataType()) {
            case STRING -> {
                if (field.getMaxLength() != null && field.getMaxLength() > 500) {
                    yield WidgetType.TEXTAREA;
                }
                yield WidgetType.TEXT;
            }
            case INTEGER, LONG, BIG_DECIMAL, DOUBLE -> WidgetType.NUMBER;
            case LOCAL_DATE -> WidgetType.DATE;
            case LOCAL_DATE_TIME, INSTANT -> WidgetType.DATE_TIME;
            case LOCAL_TIME -> WidgetType.TIME;
            case BOOLEAN -> WidgetType.CHECKBOX;
            case ENUM -> WidgetType.SELECT;
            case REFERENCE -> WidgetType.LOOKUP;
            default -> WidgetType.TEXT;
        };
    }
}
```

**测试用例:**

```java
@Test
void recognizeEmailField() {
    var field = new FieldDescriptor("email", DataType.STRING, 100);
    assertEquals(WidgetType.EMAIL, recognizer.recognize(field));
}

@Test
void recognizeAmountField() {
    var field = new FieldDescriptor("totalAmount", DataType.BIG_DECIMAL, null);
    assertEquals(WidgetType.CURRENCY, recognizer.recognize(field));
}

@Test
void recognizeLongTextField() {
    var field = new FieldDescriptor("memo", DataType.STRING, 2000);
    assertEquals(WidgetType.TEXTAREA, recognizer.recognize(field));
}

@Test
void recognizeEnumField() {
    var field = new FieldDescriptor("status", DataType.ENUM, null);
    assertEquals(WidgetType.SELECT, recognizer.recognize(field));
}

@Test
void recognizeDateField() {
    var field = new FieldDescriptor("birthday", DataType.LOCAL_DATE, null);
    assertEquals(WidgetType.DATE, recognizer.recognize(field));
}
```

**验收标准:** 全部测试通过; 对常见字段名/email, phone, amount, status 等正确映射

---

### Task 4: PageGeneratorService — Schema→UI 自动生成

**目标:** 核心生成服务，从 ObjectMeta 的 Schema 自动生成四种页面配置

```java
@Service
@RequiredArgsConstructor
public class PageGeneratorService {

    private final FieldSemanticRecognizer fieldRecognizer;
    private final LayoutOptimizer layoutOptimizer;
    private final PageConfigRepository pageConfigRepository;

    /**
     * 根据 Schema 生成页面配置
     *
     * @param objectCode 对象编码
     * @param pageType   页面类型
     * @param options    生成选项 (可选)
     * @return 生成的 PageConfig
     */
    public PageConfig generate(String objectCode, PageType pageType, GenerateOptions options) {
        // 1. 获取 ObjectMeta Schema
        ObjectMeta objectMeta = objectMetaService.getByCode(objectCode);
        List<FieldDescriptor> fields = objectMeta.getFields();

        // 2. 识别字段 Widget 映射
        Map<String, WidgetType> widgetMap = fieldRecognizer.recognizeAll(fields);

        // 3. 根据页面类型生成
        return switch (pageType) {
            case TABLE -> generateTablePage(objectMeta, widgetMap, options);
            case FORM -> generateFormPage(objectMeta, widgetMap, options);
            case KANBAN -> generateKanbanPage(objectMeta, widgetMap, options);
            case PAGE -> generateDetailPage(objectMeta, widgetMap, options);
        };
    }

    private PageConfig generateTablePage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                          GenerateOptions options) {
        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 列表");
        config.setCode(meta.getCode() + "_list");
        config.setPageType(PageType.TABLE);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        // 表格区块
        PageSection tableSection = new PageSection();
        tableSection.setTitle(meta.getLabel());
        tableSection.setSectionType(SectionType.TABLE);
        tableSection.setSortOrder(0);

        TableConfig tableConfig = new TableConfig();
        tableConfig.setPagination(true);
        tableConfig.setPageSize(20);
        tableConfig.setSortable(true);
        tableConfig.setFilterable(true);
        tableConfig.setSelectable(true);
        tableConfig.setExportable(true);
        tableSection.setTableConfig(tableConfig);

        // 将字段转为表格列 FieldWidget
        int order = 0;
        for (FieldDescriptor field : meta.getFields()) {
            if (field.isHidden()) continue;
            FieldWidget widget = new FieldWidget();
            widget.setFieldCode(field.getCode());
            widget.setLabel(field.getLabel());
            widget.setWidgetType(widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT));
            widget.setSortOrder(order++);
            tableSection.getFields().add(widget);
        }

        config.getSections().add(tableSection);

        // 操作按钮
        ViewConfig viewConfig = new ViewConfig();
        viewConfig.setShowHeader(true);
        viewConfig.setShowBreadcrumb(true);
        viewConfig.setDefaultPageSize(20);
        viewConfig.setActionButtons(buildDefaultTableActions());
        config.setViewConfig(viewConfig);

        // 优化布局
        layoutOptimizer.optimize(config);

        return config;
    }

    private PageConfig generateFormPage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                         GenerateOptions options) {
        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 表单");
        config.setCode(meta.getCode() + "_form");
        config.setPageType(PageType.FORM);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        // 基本信息区块
        PageSection basicSection = new PageSection();
        basicSection.setTitle("基本信息");
        basicSection.setSectionType(SectionType.FIELD_GROUP);
        basicSection.setColumns(2);
        basicSection.setSortOrder(0);

        // 详情/备注区块
        PageSection detailSection = new PageSection();
        detailSection.setTitle("详细信息");
        detailSection.setSectionType(SectionType.FIELD_GROUP);
        detailSection.setColumns(1);
        detailSection.setSortOrder(1);

        int basicOrder = 0, detailOrder = 0;
        for (FieldDescriptor field : meta.getFields()) {
            if (field.isHidden()) continue;
            WidgetType widgetType = widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT);

            FieldWidget widget = new FieldWidget();
            widget.setFieldCode(field.getCode());
            widget.setLabel(field.getLabel());
            widget.setWidgetType(widgetType);
            widget.setRequired(field.isRequired());
            widget.setPlaceholder("请输入" + field.getLabel());

            // 长文本放在详情区块
            if (widgetType == WidgetType.TEXTAREA || widgetType == WidgetType.RICH_TEXT) {
                widget.setColSpan(2);
                widget.setSortOrder(detailOrder++);
                detailSection.getFields().add(widget);
            } else {
                widget.setColSpan(1);
                widget.setSortOrder(basicOrder++);
                basicSection.getFields().add(widget);
            }
        }

        config.getSections().add(basicSection);
        if (!detailSection.getFields().isEmpty()) {
            config.getSections().add(detailSection);
        }

        return config;
    }

    private PageConfig generateKanbanPage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                           GenerateOptions options) {
        // 从字段中找 status/enums 类型字段作为分组
        String groupByField = meta.getFields().stream()
            .filter(f -> f.getDataType() == DataType.ENUM)
            .filter(f -> f.getCode().toLowerCase().contains("status"))
            .map(FieldDescriptor::getCode)
            .findFirst()
            .orElse(meta.getFields().stream()
                .filter(f -> f.getDataType() == DataType.ENUM)
                .map(FieldDescriptor::getCode)
                .findFirst()
                .orElseThrow(() -> new PageGenerationException(
                    "Kanban 页面需要至少一个枚举字段作为分组依据")));

        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 看板");
        config.setCode(meta.getCode() + "_kanban");
        config.setPageType(PageType.KANBAN);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        PageSection kanbanSection = new PageSection();
        kanbanSection.setTitle(meta.getLabel());
        kanbanSection.setSectionType(SectionType.KANBAN);
        kanbanSection.setSortOrder(0);

        KanbanConfig kanbanConfig = new KanbanConfig();
        kanbanConfig.setGroupByField(groupByField);

        // 标题字段: 优先 name/title, 其次第一个 STRING 字段
        String titleField = meta.getFields().stream()
            .filter(f -> f.getCode().matches("name|title|label"))
            .map(FieldDescriptor::getCode)
            .findFirst()
            .orElse(meta.getFields().stream()
                .filter(f -> f.getDataType() == DataType.STRING)
                .filter(f -> !f.getCode().equals(groupByField))
                .map(FieldDescriptor::getCode)
                .findFirst()
                .orElse("id"));
        kanbanConfig.setTitleField(titleField);
        kanbanSection.setKanbanConfig(kanbanConfig);

        config.getSections().add(kanbanSection);
        return config;
    }

    private PageConfig generateDetailPage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                           GenerateOptions options) {
        // 详情页 = 多区块 FIELD_GROUP, 按字段关联性分组
        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 详情");
        config.setCode(meta.getCode() + "_detail");
        config.setPageType(PageType.PAGE);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        // 使用 LayoutOptimizer 的智能分组
        List<PageSection> sections = layoutOptimizer.groupFieldsIntoSections(
            meta.getFields(), widgetMap, 2);

        int order = 0;
        for (PageSection section : sections) {
            section.setSortOrder(order++);
        }
        config.getSections().addAll(sections);

        return config;
    }

    /**
     * 保存生成的配置
     */
    public PageConfig save(PageConfig config) {
        // 序列化完整 JSON
        config.setJsonConfig(JsonUtils.toJson(config));
        config.setCreatedAt(LocalDateTime.now());
        config.setUpdatedAt(LocalDateTime.now());
        return pageConfigRepository.save(config);
    }
}
```

**验收标准:** 从 sample ObjectMeta 生成四种页面配置，字段映射正确

---

### Task 5: LayoutOptimizer — 智能布局优化

**目标:** 根据字段语义和关系，优化页面布局（分组、排序、跨列）

```java
@Service
public class LayoutOptimizer {

    /**
     * 优化现有 PageConfig 的布局
     */
    public void optimize(PageConfig config) {
        for (PageSection section : config.getSections()) {
            if (section.getSectionType() == SectionType.FIELD_GROUP) {
                optimizeFieldGroup(section);
            } else if (section.getSectionType() == SectionType.TABLE) {
                optimizeTableLayout(section);
            }
        }
        // 整体排序优化: 高频使用字段靠前
        prioritizeFrequentFields(config);
    }

    /**
     * 将扁平字段列表智能分组为多个区块
     */
    public List<PageSection> groupFieldsIntoSections(
            List<FieldDescriptor> fields,
            Map<String, WidgetType> widgetMap,
            int defaultColumns) {

        List<PageSection> sections = new ArrayList<>();

        // 分组策略: 按字段名前缀或语义聚类
        Map<String, List<FieldDescriptor>> groups = clusterFields(fields);

        int order = 0;
        for (Map.Entry<String, List<FieldDescriptor>> entry : groups.entrySet()) {
            PageSection section = new PageSection();
            section.setTitle(entry.getKey());
            section.setSectionType(SectionType.FIELD_GROUP);
            section.setColumns(defaultColumns);
            section.setSortOrder(order++);

            int fieldOrder = 0;
            for (FieldDescriptor field : entry.getValue()) {
                WidgetType widgetType = widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT);

                FieldWidget widget = new FieldWidget();
                widget.setFieldCode(field.getCode());
                widget.setLabel(field.getLabel());
                widget.setWidgetType(widgetType);
                widget.setRequired(field.isRequired());
                widget.setColSpan(calculateColSpan(widgetType, defaultColumns));
                widget.setSortOrder(fieldOrder++);
                section.getFields().add(widget);
            }

            sections.add(section);
        }

        return sections;
    }

    /**
     * 字段聚类: 按语义相关性分组
     */
    private Map<String, List<FieldDescriptor>> clusterFields(List<FieldDescriptor> fields) {
        Map<String, List<FieldDescriptor>> groups = new LinkedHashMap<>();

        // 通用分组规则
        List<FieldDescriptor> basicInfo = new ArrayList<>();
        List<FieldDescriptor> contactInfo = new ArrayList<>();
        List<FieldDescriptor> addressInfo = new ArrayList<>();
        List<FieldDescriptor> financialInfo = new ArrayList<>();
        List<FieldDescriptor> datetimeInfo = new ArrayList<>();
        List<FieldDescriptor> otherInfo = new ArrayList<>();

        for (FieldDescriptor field : fields) {
            if (field.isHidden()) continue;
            String code = field.getCode().toLowerCase();

            if (code.matches(".*(email|phone|tel|mobile|fax|wechat).*")) {
                contactInfo.add(field);
            } else if (code.matches(".*(address|city|province|country|zip|postal).*")) {
                addressInfo.add(field);
            } else if (code.matches(".*(amount|price|cost|total|balance|fee|budget).*")) {
                financialInfo.add(field);
            } else if (code.matches(".*(date|time|created|updated|deleted).*")) {
                datetimeInfo.add(field);
            } else if (code.matches(".*(name|title|code|type|status|id|no|number).*")) {
                basicInfo.add(field);
            } else {
                otherInfo.add(field);
            }
        }

        if (!basicInfo.isEmpty()) groups.put("基本信息", basicInfo);
        if (!contactInfo.isEmpty()) groups.put("联系方式", contactInfo);
        if (!addressInfo.isEmpty()) groups.put("地址信息", addressInfo);
        if (!financialInfo.isEmpty()) groups.put("财务信息", financialInfo);
        if (!datetimeInfo.isEmpty()) groups.put("时间信息", datetimeInfo);
        if (!otherInfo.isEmpty()) groups.put("其他信息", otherInfo);

        return groups;
    }

    /**
     * 根据组件类型计算跨列数
     */
    private int calculateColSpan(WidgetType widgetType, int maxColumns) {
        return switch (widgetType) {
            case TEXTAREA, RICH_TEXT, FILE_UPLOAD, IMAGE_UPLOAD -> maxColumns; // 占满一行
            case DIVIDER, SECTION_HEADER -> maxColumns;
            default -> 1;
        };
    }

    /**
     * 优化表格布局: 自动计算列宽
     */
    private void optimizeTableLayout(PageSection section) {
        for (FieldWidget field : section.getFields()) {
            // 根据 Widget 类型推断列宽
            // (通过 options JSON 传递给前端)
        }
    }

    /**
     * 高频字段优先排列
     */
    private void prioritizeFrequentFields(PageConfig config) {
        // 排序规则: name/title/code > status/type > 其他
        for (PageSection section : config.getSections()) {
            section.getFields().sort(Comparator.comparingInt(f -> {
                String code = f.getFieldCode().toLowerCase();
                if (code.matches("name|title|code")) return 0;
                if (code.matches("status|type|category")) return 1;
                if (f.getRequired()) return 2;
                return 3;
            }));
        }
    }
}
```

**验收标准:** 对 20+ 字段的 ObjectMeta 能正确分组，textarea 类占满整行

---

### Task 6: TemplateService — 内置模板

**目标:** 提供 CRUD 表单、主从表单、看板三种预设模板

```java
@Service
public class TemplateService {

    private final PageConfigRepository repository;

    /**
     * 获取所有内置模板
     */
    public List<PageTemplate> listTemplates() {
        return List.of(
            buildCrudTemplate(),
            buildMasterDetailTemplate(),
            buildKanbanTemplate()
        );
    }

    /**
     * 根据模板创建 PageConfig
     */
    public PageConfig createFromTemplate(String templateCode, String objectCode,
                                          TemplateOverrides overrides) {
        PageTemplate template = getTemplate(templateCode);
        // 将模板 + objectCode 生成实际的 PageConfig
        // 模板中的字段标记会被实际字段替换
        return template.instantiate(objectCode, overrides);
    }

    private PageTemplate buildCrudTemplate() {
        PageTemplate t = new PageTemplate();
        t.setCode("CRUD");
        t.setName("标准 CRUD 页面");
        t.setDescription("包含列表页 + 新建/编辑表单 + 详情页的标准增删改查页面组");
        t.setPageTypes(List.of(PageType.TABLE, PageType.FORM, PageType.PAGE));
        t.setJsonConfig("""
        {
          "list": {
            "pageType": "TABLE",
            "features": ["search", "filter", "export", "batchDelete"],
            "defaultPageSize": 20
          },
          "form": {
            "pageType": "FORM",
            "columns": 2,
            "sections": [
              {"title": "基本信息", "fields": ["*required"], "columns": 2},
              {"title": "详细信息", "fields": ["*optional"], "columns": 1}
            ]
          },
          "detail": {
            "pageType": "PAGE",
            "sections": ["*auto_grouped"]
          }
        }
        """);
        return t;
    }

    private PageTemplate buildMasterDetailTemplate() {
        PageTemplate t = new PageTemplate();
        t.setCode("MASTER_DETAIL");
        t.setName("主从表单");
        t.setDescription("主表单 + 子表表格的主从联动页面");
        t.setPageTypes(List.of(PageType.FORM));
        t.setJsonConfig("""
        {
          "form": {
            "pageType": "FORM",
            "columns": 2,
            "sections": [
              {"title": "主表信息", "fields": ["*master_fields"], "columns": 2},
              {"title": "明细行", "type": "TABLE", "fields": ["*detail_fields"],
               "features": ["inlineEdit", "addRow", "deleteRow"]}
            ]
          }
        }
        """);
        return t;
    }

    private PageTemplate buildKanbanTemplate() {
        PageTemplate t = new PageTemplate();
        t.setCode("KANBAN");
        t.setName("看板页面");
        t.setDescription("按状态分组的看板视图，支持拖拽");
        t.setPageTypes(List.of(PageType.KANBAN));
        t.setJsonConfig("""
        {
          "kanban": {
            "pageType": "KANBAN",
            "groupBy": "auto_detect_enum_status",
            "card": {
              "title": "auto_detect_name",
              "description": "auto_detect_description",
              "avatar": "auto_detect_avatar"
            },
            "features": ["dragDrop", "quickFilter"]
          }
        }
        """);
        return t;
    }
}
```

**验收标准:** 三种模板能正确列出; 从模板创建的 PageConfig 结构完整

---

### Task 7: NlPageGenerator — 自然语言→PageConfig

**目标:** 通过 AI Substrate LLM，从自然语言描述生成 PageConfig

```java
@Service
@RequiredArgsConstructor
public class NlPageGenerator {

    private final AiSubstrateClient aiClient;
    private final PageGeneratorService pageGeneratorService;

    private static final String SYSTEM_PROMPT = """
        你是 MetaPlatform 的页面配置生成器。根据用户的自然语言描述，
        生成 PageConfig 的 JSON 配置。

        输出必须是合法的 JSON，包含以下字段:
        - name: 页面名称
        - pageType: TABLE | FORM | KANBAN | PAGE
        - objectCode: 关联对象编码 (如有)
        - sections: 数组，每个元素包含:
          - title: 区块标题
          - sectionType: FIELD_GROUP | TABLE | KANBAN
          - columns: 栅格列数
          - fields: 数组，每个元素包含:
            - fieldCode: 字段编码
            - label: 显示标签
            - widgetType: 组件类型
            - required: 是否必填
            - placeholder: 占位文本

        示例输入: "创建一个客户管理的列表页面，显示姓名、电话、邮箱、状态"
        示例输出:
        {
          "name": "客户列表",
          "pageType": "TABLE",
          "objectCode": "customer",
          "sections": [{
            "title": "客户列表",
            "sectionType": "TABLE",
            "fields": [
              {"fieldCode": "name", "label": "姓名", "widgetType": "TEXT"},
              {"fieldCode": "phone", "label": "电话", "widgetType": "PHONE"},
              {"fieldCode": "email", "label": "邮箱", "widgetType": "EMAIL"},
              {"fieldCode": "status", "label": "状态", "widgetType": "SELECT"}
            ]
          }]
        }
        """;

    /**
     * 自然语言生成页面配置
     *
     * @param description 用户描述
     * @param objectCode  关联对象编码 (可选, 如果描述中没有明确对象)
     * @return 生成的 PageConfig (DRAFT 状态)
     */
    public PageConfig generate(String description, String objectCode) {
        // 1. 构建 LLM 请求
        String userPrompt = buildUserPrompt(description, objectCode);

        // 2. 调用 AI Substrate
        LlmResponse response = aiClient.chatCompletion(
            LlmRequest.builder()
                .model("gpt-4o")
                .systemPrompt(SYSTEM_PROMPT)
                .userMessage(userPrompt)
                .temperature(0.3)
                .responseFormat("json_object")
                .build()
        );

        // 3. 解析 JSON → PageConfig
        PageConfig config = parseResponse(response.getContent());
        config.setStatus(ConfigStatus.DRAFT);
        config.setCreatedBy("nl_generator");

        // 4. 补全字段映射 (如果有 objectCode)
        if (objectCode != null) {
            enrichWithSchema(config, objectCode);
        }

        return config;
    }

    private String buildUserPrompt(String description, String objectCode) {
        StringBuilder sb = new StringBuilder();
        sb.append("请根据以下描述生成页面配置:\n\n");
        sb.append(description);
        if (objectCode != null) {
            sb.append("\n\n关联对象编码: ").append(objectCode);
            // 附上对象的字段列表供 LLM 参考
            ObjectMeta meta = objectMetaService.getByCode(objectCode);
            if (meta != null) {
                sb.append("\n\n可用字段:\n");
                for (FieldDescriptor f : meta.getFields()) {
                    sb.append("- ").append(f.getCode())
                      .append(" (").append(f.getLabel())
                      .append(", ").append(f.getDataType()).append(")\n");
                }
            }
        }
        return sb.toString();
    }

    private PageConfig parseResponse(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            PageConfig config = new PageConfig();
            config.setName(root.get("name").asText());
            config.setPageType(PageType.valueOf(root.get("pageType").asText()));
            config.setCode(generateCode(config.getName()));

            if (root.has("objectCode")) {
                config.setObjectCode(root.get("objectCode").asText());
            }

            if (root.has("sections")) {
                int sectionOrder = 0;
                for (JsonNode sectionNode : root.get("sections")) {
                    PageSection section = parseSection(sectionNode, sectionOrder++);
                    config.getSections().add(section);
                }
            }

            return config;
        } catch (Exception e) {
            throw new NlGenerationException("无法解析 LLM 返回的 JSON: " + e.getMessage(), e);
        }
    }

    private PageSection parseSection(JsonNode node, int order) {
        PageSection section = new PageSection();
        section.setTitle(node.get("title").asText());
        section.setSectionType(SectionType.valueOf(node.get("sectionType").asText()));
        section.setSortOrder(order);
        section.setColumns(node.has("columns") ? node.get("columns").asInt() : 2);

        if (node.has("fields")) {
            int fieldOrder = 0;
            for (JsonNode fieldNode : node.get("fields")) {
                FieldWidget widget = new FieldWidget();
                widget.setFieldCode(fieldNode.get("fieldCode").asText());
                widget.setLabel(fieldNode.get("label").asText());
                widget.setWidgetType(WidgetType.valueOf(fieldNode.get("widgetType").asText()));
                widget.setRequired(fieldNode.has("required") &&
                    fieldNode.get("required").asBoolean());
                widget.setPlaceholder(fieldNode.has("placeholder") ?
                    fieldNode.get("placeholder").asText() : null);
                widget.setSortOrder(fieldOrder++);
                section.getFields().add(widget);
            }
        }

        return section;
    }
}
```

**验收标准:** 输入 "创建客户管理表单" 能返回合理的 PageConfig JSON

---

### Task 8: PageRenderService — 输出结构化 JSON

**目标:** 将 PageConfig 转换为前端渲染引擎所需的标准化 JSON 格式

```java
@Service
public class PageRenderService {

    /**
     * 渲染页面配置为前端 JSON
     *
     * @param pageConfig 页面配置
     * @param dataContext 数据上下文 (编辑/详情页时传入数据)
     * @return 标准化的渲染 JSON
     */
    public JsonNode render(PageConfig pageConfig, DataContext dataContext) {
        ObjectNode root = objectMapper.createObjectNode();

        root.put("pageType", pageConfig.getPageType().name());
        root.put("name", pageConfig.getName());
        root.put("code", pageConfig.getCode());
        root.put("objectCode", pageConfig.getObjectCode());

        // 视图配置
        if (pageConfig.getViewConfig() != null) {
            root.set("viewConfig", renderViewConfig(pageConfig.getViewConfig()));
        }

        // 区块数组
        ArrayNode sectionsArray = root.putArray("sections");
        for (PageSection section : pageConfig.getSections()) {
            sectionsArray.add(renderSection(section, dataContext));
        }

        // 元数据
        ObjectNode meta = root.putObject("_meta");
        meta.put("version", "0.1");
        meta.put("generatedAt", Instant.now().toString());
        meta.put("renderer", "PageRenderService");

        return root;
    }

    private JsonNode renderSection(PageSection section, DataContext dataContext) {
        ObjectNode sectionNode = objectMapper.createObjectNode();
        sectionNode.put("id", section.getId());
        sectionNode.put("title", section.getTitle());
        sectionNode.put("type", section.getSectionType().name());
        sectionNode.put("columns", section.getColumns());

        switch (section.getSectionType()) {
            case FIELD_GROUP -> renderFieldGroup(section, sectionNode, dataContext);
            case TABLE -> renderTableSection(section, sectionNode, dataContext);
            case KANBAN -> renderKanbanSection(section, sectionNode, dataContext);
        }

        return sectionNode;
    }

    private void renderFieldGroup(PageSection section, ObjectNode node, DataContext ctx) {
        ArrayNode fieldsArray = node.putArray("fields");
        for (FieldWidget widget : section.getFields()) {
            ObjectNode fieldNode = objectMapper.createObjectNode();
            fieldNode.put("fieldCode", widget.getFieldCode());
            fieldNode.put("label", widget.getLabel());
            fieldNode.put("widgetType", widget.getWidgetType().name());
            fieldNode.put("required", Boolean.TRUE.equals(widget.getRequired()));
            fieldNode.put("readonly", Boolean.TRUE.equals(widget.getReadonly()));
            fieldNode.put("colSpan", widget.getColSpan());

            if (widget.getPlaceholder() != null) {
                fieldNode.put("placeholder", widget.getPlaceholder());
            }
            if (widget.getOptions() != null) {
                fieldNode.set("options", parseJson(widget.getOptions()));
            }
            if (widget.getValidationRules() != null) {
                fieldNode.set("validation", parseJson(widget.getValidationRules()));
            }

            // 注入当前值
            if (ctx != null && ctx.hasValue(widget.getFieldCode())) {
                fieldNode.set("value", ctx.getValue(widget.getFieldCode()));
            }

            fieldsArray.add(fieldNode);
        }
    }

    private void renderTableSection(PageSection section, ObjectNode node, DataContext ctx) {
        ObjectNode tableNode = node.putObject("table");
        TableConfig tc = section.getTableConfig();

        tableNode.put("pagination", Boolean.TRUE.equals(tc.getPagination()));
        tableNode.put("pageSize", tc.getPageSize() != null ? tc.getPageSize() : 20);
        tableNode.put("sortable", Boolean.TRUE.equals(tc.getSortable()));
        tableNode.put("filterable", Boolean.TRUE.equals(tc.getFilterable()));

        ArrayNode columns = tableNode.putArray("columns");
        for (FieldWidget widget : section.getFields()) {
            ObjectNode col = objectMapper.createObjectNode();
            col.put("field", widget.getFieldCode());
            col.put("headerName", widget.getLabel());
            col.put("type", widget.getWidgetType().name());
            columns.add(col);
        }
    }

    private void renderKanbanSection(PageSection section, ObjectNode node, DataContext ctx) {
        ObjectNode kanbanNode = node.putObject("kanban");
        KanbanConfig kc = section.getKanbanConfig();

        kanbanNode.put("groupBy", kc.getGroupByField());
        kanbanNode.put("titleField", kc.getTitleField());
        kanbanNode.put("descriptionField", kc.getDescriptionField());
    }
}
```

**验收标准:** 输出的 JSON 结构与前端渲染引擎 spec 一致

---

### Task 9: REST API — PageConfig CRUD

**目标:** 提供 `/api/v1/page-configs` 的完整 CRUD REST API

```java
@RestController
@RequestMapping("/api/v1/page-configs")
@RequiredArgsConstructor
public class PageConfigController {

    private final PageConfigRepository repository;
    private final PageGeneratorService generatorService;
    private final PageRenderService renderService;

    @GetMapping
    public Page<PageConfig> list(
            @RequestParam(required = false) PageType pageType,
            @RequestParam(required = false) String objectCode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // 支持按 pageType 和 objectCode 筛选
        Specification<PageConfig> spec = buildSpec(pageType, objectCode);
        return repository.findAll(spec, PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @GetMapping("/{id}")
    public PageConfig getById(@PathVariable Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("PageConfig", id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PageConfig create(@Valid @RequestBody PageConfigCreateRequest request) {
        PageConfig config = new PageConfig();
        config.setName(request.getName());
        config.setCode(request.getCode());
        config.setPageType(request.getPageType());
        config.setObjectCode(request.getObjectCode());
        config.setStatus(ConfigStatus.DRAFT);
        config.setCreatedBy(getCurrentUser());
        return generatorService.save(config);
    }

    @PutMapping("/{id}")
    public PageConfig update(@PathVariable Long id,
                              @Valid @RequestBody PageConfigUpdateRequest request) {
        PageConfig existing = getById(id);
        existing.setName(request.getName());
        existing.setPageType(request.getPageType());
        existing.setSections(request.getSections());
        existing.setViewConfig(request.getViewConfig());
        existing.setUpdatedAt(LocalDateTime.now());
        return generatorService.save(existing);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        repository.deleteById(id);
    }

    @PostMapping("/{id}/publish")
    public PageConfig publish(@PathVariable Long id) {
        PageConfig config = getById(id);
        config.setStatus(ConfigStatus.PUBLISHED);
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }

    @PostMapping("/{id}/archive")
    public PageConfig archive(@PathVariable Long id) {
        PageConfig config = getById(id);
        config.setStatus(ConfigStatus.ARCHIVED);
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }
}
```

**验收标准:** CRUD 操作全部正常; 支持分页/筛选/发布/归档

---

### Task 10: REST API — Pages (生成+渲染)

**目标:** 提供 `/api/v1/pages` 的生成和渲染接口

```java
@RestController
@RequestMapping("/api/v1/pages")
@RequiredArgsConstructor
public class PageController {

    private final PageGeneratorService generatorService;
    private final NlPageGenerator nlGenerator;
    private final PageRenderService renderService;
    private final PageConfigRepository configRepository;

    /**
     * 从 Schema 自动生成页面配置
     */
    @PostMapping("/generate")
    public PageConfig generateFromSchema(@Valid @RequestBody PageGenerateRequest request) {
        return generatorService.generate(
            request.getObjectCode(),
            request.getPageType(),
            request.getOptions()
        );
    }

    /**
     * 从自然语言生成页面配置
     */
    @PostMapping("/generate-from-nl")
    public PageConfig generateFromNaturalLanguage(
            @Valid @RequestBody NlPageGenerateRequest request) {
        return nlGenerator.generate(request.getDescription(), request.getObjectCode());
    }

    /**
     * 渲染已保存的页面配置为前端 JSON
     */
    @GetMapping("/{id}/render")
    public JsonNode renderPage(@PathVariable Long id,
                                @RequestParam(required = false) Long dataId) {
        PageConfig config = configRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("PageConfig", id));

        DataContext dataContext = null;
        if (dataId != null) {
            dataContext = dataService.loadContext(config.getObjectCode(), dataId);
        }

        return renderService.render(config, dataContext);
    }

    /**
     * 一步到位: 生成 + 渲染
     */
    @PostMapping("/quick-create")
    public JsonNode quickCreate(@Valid @RequestBody PageGenerateRequest request) {
        PageConfig config = generatorService.generate(
            request.getObjectCode(),
            request.getPageType(),
            request.getOptions()
        );
        PageConfig saved = generatorService.save(config);
        return renderService.render(saved, null);
    }
}
```

**验收标准:** `/pages/generate` 返回 PageConfig; `/pages/{id}/render` 返回渲染 JSON

---

### Task 11: REST API — PageTemplates

**目标:** 提供 `/api/v1/page-templates` 的查询和应用接口

```java
@RestController
@RequestMapping("/api/v1/page-templates")
@RequiredArgsConstructor
public class PageTemplateController {

    private final TemplateService templateService;

    @GetMapping
    public List<PageTemplate> listTemplates() {
        return templateService.listTemplates();
    }

    @GetMapping("/{code}")
    public PageTemplate getTemplate(@PathVariable String code) {
        return templateService.getTemplate(code);
    }

    /**
     * 应用模板生成页面配置
     */
    @PostMapping("/{code}/apply")
    public PageConfig applyTemplate(@PathVariable String code,
                                     @Valid @RequestBody TemplateApplyRequest request) {
        return templateService.createFromTemplate(
            code, request.getObjectCode(), request.getOverrides()
        );
    }
}
```

**验收标准:** 模板列表正常返回; 应用模板生成的 PageConfig 结构完整

---

### Task 12: Integration Tests

**目标:** 端到端集成测试覆盖核心场景

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class PageGeneratorIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired PageConfigRepository repository;
    @Autowired ObjectMapper objectMapper;

    @Test
    void generateTablePageFromSchema() throws Exception {
        // 先创建 ObjectMeta (模拟)
        ObjectMeta customerMeta = createTestCustomerMeta();

        PageGenerateRequest request = new PageGenerateRequest();
        request.setObjectCode("customer");
        request.setPageType(PageType.TABLE);

        String response = mockMvc.perform(post("/api/v1/pages/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pageType").value("TABLE"))
            .andExpect(jsonPath("$.sections[0].sectionType").value("TABLE"))
            .andExpect(jsonPath("$.sections[0].fields").isArray())
            .andReturn().getResponse().getContentAsString();

        PageConfig config = objectMapper.readValue(response, PageConfig.class);
        assertNotNull(config.getSections().get(0).getTableConfig());
    }

    @Test
    void generateFormPageWithSemanticRecognition() throws Exception {
        PageGenerateRequest request = new PageGenerateRequest();
        request.setObjectCode("customer");
        request.setPageType(PageType.FORM);

        mockMvc.perform(post("/api/v1/pages/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pageType").value("FORM"))
            .andExpect(jsonPath("$.sections[0].sectionType").value("FIELD_GROUP"))
            // email 字段应被映射为 EMAIL widget
            .andExpect(jsonPath(
                "$.sections[0].fields[?(@.fieldCode=='email')].widgetType[0]")
                .value("EMAIL"));
    }

    @Test
    void saveAndRenderPageConfig() throws Exception {
        // 创建并保存
        PageConfig config = createTestPageConfig();
        String saved = mockMvc.perform(post("/api/v1/page-configs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(config)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        PageConfig savedConfig = objectMapper.readValue(saved, PageConfig.class);

        // 渲染
        mockMvc.perform(get("/api/v1/pages/" + savedConfig.getId() + "/render"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pageType").exists())
            .andExpect(jsonPath("$.sections").isArray())
            .andExpect(jsonPath("$.renderer").value("PageRenderService"));
    }

    @Test
    void templateBasedGeneration() throws Exception {
        TemplateApplyRequest request = new TemplateApplyRequest();
        request.setObjectCode("order");

        mockMvc.perform(post("/api/v1/page-templates/CRUD/apply")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("订单 CRUD"))
            .andExpect(jsonPath("$.sections").isArray());
    }

    @Test
    void publishAndArchivePageConfig() throws Exception {
        PageConfig config = repository.save(createTestPageConfig());

        mockMvc.perform(post("/api/v1/page-configs/" + config.getId() + "/publish"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PUBLISHED"));

        mockMvc.perform(post("/api/v1/page-configs/" + config.getId() + "/archive"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }
}
```

**验收标准:** 所有集成测试通过

---

### Task 13: 文档与 API Contract

**目标:** 补充 OpenAPI spec、模块 README、开发指南

**文件结构:**

```
metaplatform-page-generator/
├── build.gradle.kts
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/pagegenerator/
│   │   │   ├── PageGeneratorApplication.java
│   │   │   ├── domain/
│   │   │   │   ├── PageConfig.java
│   │   │   │   ├── PageSection.java
│   │   │   │   ├── FieldWidget.java
│   │   │   │   ├── TableConfig.java
│   │   │   │   ├── KanbanConfig.java
│   │   │   │   ├── ViewConfig.java
│   │   │   │   ├── PageTemplate.java
│   │   │   │   ├── enums/
│   │   │   │   │   ├── PageType.java
│   │   │   │   │   ├── ConfigStatus.java
│   │   │   │   │   ├── SectionType.java
│   │   │   │   │   └── WidgetType.java
│   │   │   │   └── repository/
│   │   │   │       └── PageConfigRepository.java
│   │   │   ├── application/
│   │   │   │   ├── PageGeneratorService.java
│   │   │   │   ├── FieldSemanticRecognizer.java
│   │   │   │   ├── LayoutOptimizer.java
│   │   │   │   ├── TemplateService.java
│   │   │   │   ├── NlPageGenerator.java
│   │   │   │   └── PageRenderService.java
│   │   │   ├── api/
│   │   │   │   ├── PageConfigController.java
│   │   │   │   ├── PageController.java
│   │   │   │   ├── PageTemplateController.java
│   │   │   │   └── dto/
│   │   │   │       ├── PageConfigCreateRequest.java
│   │   │   │       ├── PageConfigUpdateRequest.java
│   │   │   │       ├── PageGenerateRequest.java
│   │   │   │       ├── NlPageGenerateRequest.java
│   │   │   │       └── TemplateApplyRequest.java
│   │   │   └── infrastructure/
│   │   │       ├── config/
│   │   │       │   └── JacksonConfig.java
│   │   │       └── exception/
│   │   │           ├── PageGenerationException.java
│   │   │           ├── NlGenerationException.java
│   │   │           └── ResourceNotFoundException.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   │           └── V001__create_page_config_tables.sql
│   └── test/
│       └── java/com/metaplatform/pagegenerator/
│           ├── application/
│           │   ├── FieldSemanticRecognizerTest.java
│           │   ├── PageGeneratorServiceTest.java
│           │   └── LayoutOptimizerTest.java
│           └── api/
│               └── PageGeneratorIntegrationTest.java
└── openapi/
    └── page-generator-api.yaml
```

---

## 5. Design Decisions

| # | 决策 | 理由 |
|---|------|------|
| DD-1 | PageConfig 作为聚合根，包含所有 Sections 和 Fields | 避免过度拆分，页面配置是一个完整的领域概念 |
| DD-2 | FieldSemanticRecognizer 使用规则表而非 ML | v0.1 阶段规则表足够覆盖常见场景，后续可升级为 ML |
| DD-3 | LayoutOptimizer 采用关键词聚类而非复杂算法 | 字段数量有限 (通常 <50)，简单规则即可满足 |
| DD-4 | NlPageGenerator 使用 JSON mode 的 LLM | 保证输出结构化 JSON，减少解析错误 |
| DD-5 | PageRenderService 输出标准化 JSON 而非 HTML | 前端框架无关，支持 React/Vue/Angular 等多种渲染 |
| DD-6 | 独立模块，不依赖其他 Superpower 核心模块 | 可独立开发/测试/部署，减少耦合 |
| DD-7 | 支持 DRAFT→PUBLISHED→ARCHIVED 生命周期 | 符合实际业务场景，草稿可反复编辑，发布后锁定 |

---

## 6. API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/page-configs` | 分页查询页面配置列表 |
| GET | `/api/v1/page-configs/{id}` | 获取单个页面配置详情 |
| POST | `/api/v1/page-configs` | 创建页面配置 |
| PUT | `/api/v1/page-configs/{id}` | 更新页面配置 |
| DELETE | `/api/v1/page-configs/{id}` | 删除页面配置 |
| POST | `/api/v1/page-configs/{id}/publish` | 发布页面配置 |
| POST | `/api/v1/page-configs/{id}/archive` | 归档页面配置 |
| POST | `/api/v1/pages/generate` | 从 Schema 自动生成 |
| POST | `/api/v1/pages/generate-from-nl` | 从自然语言生成 |
| GET | `/api/v1/pages/{id}/render` | 渲染页面为 JSON |
| POST | `/api/v1/pages/quick-create` | 生成 + 保存 + 渲染一步到位 |
| GET | `/api/v1/page-templates` | 获取模板列表 |
| GET | `/api/v1/page-templates/{code}` | 获取模板详情 |
| POST | `/api/v1/page-templates/{code}/apply` | 应用模板生成配置 |

---

## 7. Test Strategy

| 层级 | 覆盖范围 | 工具 |
|------|----------|------|
| 单元测试 | FieldSemanticRecognizer, LayoutOptimizer, PageGeneratorService | JUnit 5 + Mockito |
| 集成测试 | REST API 端到端 | @SpringBootTest + MockMvc |
| 契约测试 | API 请求/响应 JSON Schema | Spring RestDocs |

**测试命令:**

```bash
# 全部测试
./gradlew :metaplatform-page-generator:test

# 仅单元测试
./gradlew :metaplatform-page-generator:test --tests "*.application.*"

# 仅集成测试
./gradlew :metaplatform-page-generator:test --tests "*.api.*"

# 测试覆盖率报告
./gradlew :metaplatform-page-generator:jacocoTestReport
```

---

## 8. v0.2 Roadmap

| Feature | Priority | Description |
|---------|----------|-------------|
| 可视化拖拽设计器 | P0 | 拖拽式页面编辑器，所见即所得 |
| 自定义主题/样式 | P1 | 支持 CSS 变量覆盖、主题色配置 |
| 多语言标签 | P1 | 字段标签的 i18n 支持 |
| 页面版本管理 | P1 | PageConfig 版本历史、回滚 |
| 自定义 Widget 扩展 | P2 | 支持用户注册自定义 WidgetType |
| AI 布局建议 | P2 | 基于用户行为数据的布局优化建议 |
| 前端组件代码生成 | P2 | 从 PageConfig 直接生成 React/Vue 代码 |
| 条件渲染规则 | P2 | 字段/区块的条件显示/隐藏规则 |
| 嵌套页面引用 | P3 | 子页面、Tab 页引用 |
| 页面性能分析 | P3 | 页面加载性能指标追踪 |

---

*Document generated: 2026-07-02*
*Author: MetaPlatform Team*
