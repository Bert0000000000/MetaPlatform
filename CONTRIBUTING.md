# 贡献指南

感谢您对 MetaPlatform 项目的关注！本指南将帮助您了解如何参与项目开发。

---

## 开发环境搭建

### 前置条件

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| JDK | 21+ | 推荐使用 Eclipse Temurin 或 GraalVM |
| Maven | 3.9+ | 构建工具 |
| Docker | 24+ | 容器化运行 PostgreSQL、Redis、Kafka |
| Node.js | 18+ | 前端开发（如适用） |
| Git | 2.40+ | 版本控制 |

### 快速启动

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/metaplatform-ontology-engine.git
cd metaplatform-ontology-engine

# 2. 启动基础设施
docker-compose up -d

# 3. 编译运行
mvn clean install
mvn spring-boot:run

# 4. 访问服务
# API: http://localhost:8090/api/v1
# Swagger: http://localhost:8090/swagger-ui.html
# 健康检查: http://localhost:8090/api/v1/health
```

---

## 代码规范

### Java 编码风格

1. **JavaDoc 使用中文**：所有公共类、方法的文档注释使用中文撰写
2. **领域模型使用 record**：优先使用 Java record 定义领域对象，保持不可变性
3. **数据访问使用 JdbcTemplate**：统一使用 Spring JdbcTemplate 进行数据库操作
4. **构造器注入**：使用构造器注入依赖，不使用 `@Autowired` 字段注入
5. **不可变优先**：尽量使用 `final` 字段、不可变集合

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 包名 | 小写，按模块划分 | `com.metaplatform.ontology.object` |
| 类名 | PascalCase | `ObjectTypeService` |
| 方法名 | camelCase | `createBackup()` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_CHUNK_SIZE` |
| 数据库表名 | snake_case | `backup_records` |
| 数据库列名 | snake_case | `tenant_id` |

### 分层架构

```
interfaces/rest/       → REST 控制器（HTTP 入口）
ops/                   → 运维服务（备份、灰度、SLA、配置）
object/                → 业务对象核心域
knowledge/             → 知识库域
security/              → 安全域
config/                → 配置类
```

---

## Git 工作流

### 分支策略

- `main` — 稳定发布分支
- `develop` — 开发集成分支
- `feature/*` — 功能开发分支（如 `feature/gray-release`）
- `fix/*` — 缺陷修复分支（如 `fix/validation-null-check`）
- `release/*` — 发布准备分支

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范：

```
<类型>(<范围>): <描述>

[可选正文]

[可选脚注]
```

**类型说明：**

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 文档变更 |
| `style` | 代码格式调整（不影响逻辑） |
| `refactor` | 代码重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具变更 |

**示例：**

```
feat(ops): 新增备份管理服务
fix(validation): 修复空值校验空指针异常
docs: 更新 API 文档
test(ops): 新增 SystemConfigService 单元测试
```

---

## 测试指南

### 单元测试

- 测试类放在 `src/test/java` 对应包下
- 测试类命名：`{ServiceName}Test.java`
- 使用 JUnit 5 + Mockito
- 每个测试方法命名：`should{期望行为}_when{条件}`

```java
@Test
void shouldReturnConfigValue_whenKeyExists() {
    // given
    // ...
    
    // when
    String result = systemConfigService.getConfig("platform.name");
    
    // then
    assertEquals("MetaPlatform", result);
}
```

### 运行测试

```bash
# 运行所有测试
mvn test

# 运行特定测试类
mvn test -Dtest=SystemConfigServiceTest

# 跳过测试编译
mvn compile -DskipTests
```

---

## Pull Request 流程

1. 从 `develop` 创建功能分支
2. 在功能分支上开发并提交
3. 确保所有测试通过：`mvn test`
4. 确保代码编译通过：`mvn compile -DskipTests`
5. 编写清晰的 PR 描述，说明变更内容和原因
6. 至少需要一位团队成员 Review
7. Review 通过后合并到 `develop`

### PR 检查清单

- [ ] 代码遵循项目编码规范
- [ ] 新增代码有对应的单元测试
- [ ] 所有测试通过
- [ ] 数据库变更有对应的 Flyway 迁移脚本
- [ ] 公共 API 有中文 JavaDoc
- [ ] 提交信息符合 Conventional Commits 规范
