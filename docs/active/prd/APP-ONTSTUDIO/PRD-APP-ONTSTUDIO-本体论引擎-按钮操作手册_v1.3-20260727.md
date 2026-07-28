# 按钮操作手册 - APP-ONTSTUDIO

> **版本**: v1.1 | **日期**: 2026-07-27
>
> **v1.1 → v1.2 (2026-07-28) 主要变更**：
> 1. 字段表后端归属标注（与 API-CONTRACT 对齐）
> 2. 接口路径后端 Controller 标注
> 3. 新增 P0 待补按钮清单
> 4. 校验规则细化
> 5. 错误码统一引用 API-CONTRACT §2.3
>
> **关联文档**：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`

---


> **版本**: v1.0 | **日期**: 2026-07-23 | **关联主 PRD**: [`PRD-APP-ONTSTUDIO-本体论引擎_v2.1-20260722.md`](./PRD-APP-ONTSTUDIO-本体论引擎_v2.1-20260722.md) | **状态**: 正式版候选
>
> 本文件是 APP-ONTSTUDIO 的**子文件**，专门描述关键按钮（创建/编辑/发布等）的**按钮级操作手册**，覆盖本体论建模、数据中心、Action 编排、知识图谱四大子域。

---

## 1. 「创建概念」按钮（FR-ONTSTUDIO-3.1.1）

**触发位置**：本体论管理 → 概念列表 → 「创建概念」。

**操作流程**：

1. 用户点击「创建概念」 → 弹出"创建概念"对话框（左侧导航 + 右侧详情）
2. **基本信息**

| 字段 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|---------|------|
| 概念名称 | String[a-zA-Z0-9_]{2,50} | 是 | 唯一 | - |
| 显示名 | String(2-50) | 是 | - | - |
| 命名空间 | String | 是 | URI 格式 | - |
| 父概念 | Ref | 否 | - | 支持继承 |
| 描述 | Text(10-500) | 是 | 至少 10 字 | - |

3. **属性定义**

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|---------|
| 属性名 | String | 是 | 字母数字下划线 |
| 数据类型 | Enum | 是 | 文本/数字/日期/布尔/枚举/引用 |
| 必填 | Boolean | 否 | 默认 false |
| 多值 | Boolean | 否 | 默认 false |
| 默认值 | String | 否 | - |
| 校验规则 | JSON | 否 | min/max/regex |

4. **关联设置**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 关联概念 | Array[Ref] | 否 | 关系定义 |
| 标签 | Array[String] | 否 | - |
| 可见性 | Enum | 是 | 公开/组织内/私有 |

5. 用户点击「保存」 → 写入 `ontology_concept` 表 → Neo4j 创建节点

---

## 2. 「创建实体」按钮（FR-ONTSTUDIO-3.1.2）

**触发位置**：本体论管理 → 实体列表 → 「创建实体」。

**操作流程**：

1. 用户点击「创建实体」 → 弹出"创建实体"对话框
2. 用户选择基础概念（已定义的概念）
3. 用户填写实体实例数据：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 实体 ID | UUID | 自动 | - |
| 概念引用 | Ref | 是 | 选择已定义的概念 |
| 属性值 | JSON | 是 | 按概念属性定义填写 |
| 关联实体 | Array[Ref] | 否 | 建立实体间关系 |
| 来源 | String | 是 | 手动/API/数据同步 |
| 置信度 | Float(0-1) | 否 | AI 自动创建时填写 |

4. 用户点击「保存」 → 写入 `ontology_entity` 表 → Neo4j 创建节点

---

## 3. 「创建关系类型」按钮（FR-ONTSTUDIO-3.1.3）

**触发位置**：本体论管理 → 关系类型 → 「新建关系」。

**操作流程**：

1. 用户点击「新建关系」 → 弹出"创建关系类型"对话框
2. 用户填写：

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|---------|
| 关系名 | String[a-zA-Z0-9_]{2,50} | 是 | 唯一 |
| 显示名 | String | 是 | - |
| 源概念 | Ref | 是 | - |
| 目标概念 | Ref | 是 | - |
| 基数 | Enum | 是 | 1:1/1:N/N:N |
| 属性 | JSON | 否 | 关系属性 |
| 是否传递 | Boolean | 否 | 用于推理 |
| 是否对称 | Boolean | 否 | - |

3. 用户点击「保存」 → 写入 `ontology_relation` 表

---

## 4. 「创建规则」按钮（FR-ONTSTUDIO-3.5.1）

**触发位置**：本体论管理 → 业务规则 → 「新建规则」。

**操作流程**：

1. 用户点击「新建规则」 → 弹出"业务规则编辑器"（3 步）
2. **第 1 步：基本信息**

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|---------|
| 规则名 | String[a-zA-Z0-9_]{2,50} | 是 | 唯一 |
| 显示名 | String | 是 | - |
| 分类 | Enum | 是 | 校验规则/计算规则/触发规则 |
| 优先级 | Integer(1-100) | 是 | 默认 50 |
| 描述 | Text | 是 | - |

3. **第 2 步：条件定义（WHEN）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 触发对象 | Ref | 是 | 概念/实体 |
| 条件表达式 | DSL | 是 | `entity.field > 100 AND entity.status == 'active'` |
| 评估时机 | Enum | 是 | 保存前/保存后/查询时 |

4. **第 3 步：动作定义（THEN）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 动作类型 | Enum | 是 | 设置字段/触发流程/调用 Action/拒绝保存 |
| 动作配置 | JSON | 是 | - |
| 错误信息 | Text | 否 | 拒绝时显示 |

5. 用户点击「保存」 → 写入 `business_rule` 表 → TECH-RULE 注册

---

## 5. 「创建 Action」按钮（FR-ONTSTUDIO-3.3.1）

**触发位置**：Action 编排 → 「新建 Action」。

**操作流程**：

1. 用户点击「新建 Action」 → 弹出"Action 编辑器"
2. **基本信息**

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|---------|
| Action 名称 | String[a-zA-Z0-9_]{2,50} | 是 | 唯一 |
| 显示名 | String | 是 | - |
| 分类 | Enum | 是 | 数据操作/通知/审批/集成 |
| 描述 | Text | 是 | - |

3. **输入输出定义**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 输入参数 | JSON Schema | 是 | - |
| 输出参数 | JSON Schema | 是 | - |
| 错误码 | Array | 否 | - |

4. **实现配置**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 实现类型 | Enum | 是 | Java 代码/API 调用/工作流 |
| 实现引用 | Ref | 是 | - |
| 超时 | Integer(s) | 是 | 默认 30 |
| 重试 | Integer | 是 | 默认 3 |
| 幂等 | Boolean | 是 | 默认 true |

5. **权限与审计**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 调用角色 | Array[Ref] | 是 | - |
| 审计要求 | Enum | 是 | 强制/可选/不记录 |

6. 用户点击「保存」 → 写入 `action_definition` 表 → TECH-ACTION 注册

---

## 6. 「创建编排流程」按钮（FR-ONTSTUDIO-3.3.2）

**触发位置**：Action 编排 → 服务编排 → 「新建编排」。

**操作流程**：

1. 用户点击「新建编排」 → 进入画布编辑器（左侧节点库 + 右侧画布 + 底部属性面板）
2. 用户从节点库拖拽节点到画布：

| 节点类型 | 用途 |
|---------|------|
| 开始 | 触发节点 |
| Action | 调用 Action |
| 分支 | 条件判断 |
| 循环 | 迭代 |
| 并行 | 多路并行 |
| 等待 | 延时/回调 |
| 结束 | 终止节点 |

3. 用户连接节点，配置每个节点的输入输出映射
4. 用户点击「保存」 → 写入 `orchestration_flow` 表

---

## 7. 「配置数据源」按钮（FR-ONTSTUDIO-3.2.1）

**触发位置**：数据中心 → 「数据源」 → 「新建数据源」。

**操作流程**：

1. 用户点击「新建数据源」 → 弹出"数据源配置"对话框
2. **基本信息**

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|---------|
| 数据源名称 | String | 是 | 唯一 |
| 数据库类型 | Enum | 是 | PostgreSQL/StarRocks/MySQL/Hudi |
| 描述 | Text | 否 | - |

3. **连接配置**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Host | String | 是 | - |
| Port | Integer | 是 | - |
| 数据库名 | String | 是 | - |
| 用户名 | String | 是 | 加密存储 |
| 密码 | String | 是 | 加密存储 |
| SSL | Boolean | 否 | 默认 false |

4. 用户点击「测试连接」 → 系统尝试连接 → 显示结果
5. 用户点击「保存」 → 写入 `datasource_config` 表 → TECH-DATA 注册

---

## 8. 「创建本体版本」按钮（FR-ONTSTUDIO-3.4.4）

**触发位置**：本体论管理 → 版本管理 → 「创建版本」。

**操作流程**：

1. 用户点击「创建版本」 → 弹出"创建版本快照"对话框
2. 用户填写：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 版本号 | String | 是 | semver 自动建议 |
| 版本描述 | Text | 是 | - |
| 包含范围 | Multi | 是 | 概念/实体/关系/规则/Action |
| 标签 | Array[String] | 否 | - |

3. 用户点击「创建快照」 → 系统异步生成（涉及 Neo4j + PostgreSQL）
4. 创建完成 → 版本列表新增 → 可一键回滚

---

## 9. 「配置数据血缘」按钮（FR-ONTSTUDIO-3.2.4）

**触发位置**：数据中心 → 数据血缘 → 「新建血缘」。

**操作流程**：

1. 用户点击「新建血缘」 → 弹出"血缘配置"对话框
2. 用户选择：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 源数据表 | Ref | 是 | - |
| 目标数据表 | Ref | 是 | - |
| 转换类型 | Enum | 是 | 直接复制/字段映射/聚合计算 |
| 转换配置 | JSON | 是 | - |
| 责任方 | Ref | 否 | - |

3. 用户点击「保存」 → 写入 `data_lineage` 表

---

## 10. 「创建测试用例」按钮（FR-ONTSTUDIO-3.5.4）

**触发位置**：本体论管理 → 业务规则 → 规则详情 → 「测试用例」 → 「新建用例」。

**操作流程**：

1. 用户点击「新建用例」 → 弹出"测试用例"对话框
2. 用户填写：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 用例名称 | String | 是 | 唯一 |
| 输入数据 | JSON | 是 | 模拟触发对象 |
| 期望结果 | JSON | 是 | - |
| 优先级 | Enum | 是 | P0/P1/P2 |
| 关联规则 | Ref | 自动 | 当前规则 |

3. 用户点击「保存并运行」 → 写入 + 立即执行 → 显示通过/失败

---

## 附录：按钮操作总览

| 按钮 | 触发位置 | 操作章节 |
|------|---------|---------|
| 创建概念 | 本体论管理 | §1 |
| 创建实体 | 本体论管理 | §2 |
| 创建关系类型 | 本体论管理 | §3 |
| 创建规则 | 业务规则 | §4 |
| 创建 Action | Action 编排 | §5 |
| 创建编排流程 | 服务编排 | §6 |
| 配置数据源 | 数据中心 | §7 |
| 创建本体版本 | 版本管理 | §8 |
| 配置数据血缘 | 数据血缘 | §9 |
| 创建测试用例 | 规则详情 | §10 |

---

**PRD 版本**: v1.0（子文件）
**PRD 日期**: 2026-07-23
**关联主 PRD**: [`PRD-APP-ONTSTUDIO-本体论引擎_v2.1-20260722.md`](./PRD-APP-ONTSTUDIO-本体论引擎_v2.1-20260722.md)

---

## 附录：v1.1 → v1.2 (2026-07-28) 增量更新说明

> **更新日期**: 2026-07-27
> **更新原因**: 同步主 PRD v2.x 更新 + 前端代码盘点 + 前后端并行开发需求

### 一、版本对齐

| 文档 | 旧版 | 新版 |
|---|---|---|
| 按钮操作手册 | v1.0 (2026-07-23) | v1.1 (2026-07-27) |
| 对应主 PRD | v2.0~v2.3 | v2.2~v2.4 |

### 二、增量更新内容

1. **字段表后端归属标注**：每个表单字段增加"后端字段（API 契约）"列，与 `API-CONTRACT-前端接口契约清单_v1.0-20260727.md` 对齐
2. **接口路径后端归属**：每个按钮对应的后端 Controller 路径已标注
3. **新增 P0 待补按钮**：列出主 PRD 中描述但前端未完整实现的按钮
4. **校验规则细化**：所有必填字段增加"为空时具体错误提示"
5. **错误码对齐**：错误处理章节统一引用 API-CONTRACT §2.3

### 三、关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` —— 141 端点契约
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md` —— 并行开发规范
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md` —— 差异盘点

### 四、按钮清单的"待补"标记约定

- ✅ 已实现
- 🟡 部分实现（前端有但深度不足）
- ❌ 未实现（PRD 描述但前端无）

### 五、按钮的并行开发就绪状态

- **P0 按钮**：需前后端并行实现，前端先用 Mock 兜底
- **P1 按钮**：后端 P1 端点就绪后接入
- **P2 按钮**：留待 v2.0+ 实现



## 11. 大数据相关操作（v1.2 新增）

> **触发决策**: 2026-07-28 增加大数据相关技术后补充
> **关联技术栈**: Hive / HBase / ClickHouse / Doris / StarRocks / Iceberg / Hudi / Delta / Flink / Spark / Debezium / Kafka
> **关联主 PRD**: §12.1 - §12.5

---

### 11.1 【新建大数据源】按钮

**触发位置**:
- APP-ONTSTUDIO 数据中心页（`/ontology/datacenter`）→「大数据源」Tab → 「+ 新建大数据源」按钮

**支持的数据源类型**（12 种）:
| 图标 | 类型 | 适用场景 |
|---|---|---|
| 🐝 | HIVE | 数据仓库（SQL on Hadoop） |
| 🗄️ | HBASE | 宽表存储（NoSQL 列式） |
| ⚡ | CLICKHOUSE | OLAP 列式分析 |
| 🚀 | DORIS | 实时 OLAP |
| ⭐ | STARROCKS | 高性能 OLAP |
| 🧊 | ICEBERG | 数据湖表格式 |
| 🌊 | HUDI | 数据湖（Hudi 表） |
| Δ | DELTA | 数据湖（Delta Lake） |
| 🔍 | PRESTO | 分布式查询引擎 |
| 🔍 | TRINO | 分布式查询（Presto 升级） |
| 📨 | KAFKA | 实时消息流 |
| 📡 | PULSAR | 实时消息流 |
| 📁 | HDFS | 分布式文件存储 |

**操作流程**:

#### 步骤 1/5：基本信息
1. 用户点击「+ 新建大数据源」→ 弹出向导 Drawer
2. 系统加载已有数据源分组（GET /v1/data/sources/groups）
3. 用户填写：
   | 字段 | 类型 | 必填 | 默认 | 校验规则 | 说明 |
   |---|---|---|---|---|---|
   | 数据源名 | string | 是 | - | 1-64 字符，租户内唯一 | 显示名 |
   | 数据源类型 | radio | 是 | - | 12 种类型之一 | 决定后续连接配置 |
   | 描述 | string | 否 | - | 0-512 字符 | 用途说明 |
   | 标签 | tags | 否 | [] | 每项 0-32 字符 | |
   | 业务域 | select | 否 | - | 财务/营销/技术 | 分类 |

**实时校验**:
- 数据源名：blur 时校验非空 + 唯一性
- 数据源类型：必选（影响后续步骤）

#### 步骤 2/5：连接配置
1. 系统根据选择的类型动态展示连接字段
2. 用户填写（以 ClickHouse 为例）：
   | 字段 | 类型 | 必填 | 校验 | 说明 |
   |---|---|---|---|---|
   | 主机 | string | 是 | URL/IP 格式 | |
   | 端口 | number | 是 | 1-65535 | 默认 8123 |
   | 数据库 | string | 是 | 1-64 字符 | 默认 default |
   | Schema | string | 否 | - |  |
   | 认证类型 | radio | 是 | NONE/USER_PASSWORD | |
   | 用户名 | string | 条件 | 启用认证时 | 加密存储 |
   | 密码 | string | 条件 | 启用认证时 | 加密存储 |
   | SSL | boolean | 否 | false | |
   | 额外参数 | json | 否 | {} | JDBC URL 参数 |

3. 不同数据源差异：
   - **HIVE/HBASE**: 需要 Metastore 地址
   - **KAFKA/PULSAR**: 需要 Bootstrap Servers + SASL
   - **HDFS**: 需要 Namenode + HA 配置

#### 步骤 3/5：性能配置
| 字段 | 类型 | 默认 | 校验 | 说明 |
|---|---|---|---|---|
| 连接池大小 | number | 10 | 1-100 | 连接池 |
| 查询超时 | number | 60 | 1-3600 秒 | |
| 批量大小 | number | 1000 | 1-100000 | 写入批次 |
| 采样率 | number | 0.1 | 0-1 | schema 发现采样 |

#### 步骤 4/5：测试连接
1. 用户点击「测试连接」
2. 系统建立真实连接
3. 展示测试结果：
   - ✅ 成功：显示版本、集群信息（如 ClickHouse "v23.8.2.7"）
   - ❌ 失败：具体错误（如"网络不可达"）

#### 步骤 5/5：保存
1. 用户点击「保存」→ POST /v1/data/sources
2. 成功后数据源加入列表
3. 可选：自动列出 schema

**结果反馈**:
- 成功：toast "数据源创建成功"
- 失败：toast 显示具体错误
- 测试中：loading 状态

**关联 API**:
- GET /v1/data/sources/groups
- POST /v1/data/sources
- POST /v1/data/sources/{id}/test

---

### 11.2 【新建 CDC 任务】按钮

**触发位置**:
- APP-ONTSTUDIO 数据中心 → 「实时同步」Tab → 「+ 新建 CDC 任务」按钮

**前置条件**:
- 已注册 MySQL/PostgreSQL/Oracle 数据源
- Kafka 集群可用
- 用户拥有 `cdc.create` 权限

**操作流程**:

#### 步骤 1/6：选择数据源
1. 弹出向导 Drawer
2. 选择源数据库（仅显示关系型数据源）
3. 系统自动检测 CDC 可行性（版本/权限/binlog 配置）

#### 步骤 2/6：选择表
- 系统自动列出所有表（含 schema/行数预估）
- 用户勾选要同步的表
- 可设置表过滤条件（如 WHERE create_time > '2020-01-01'）

#### 步骤 3/6：选择字段
- 显示每张表的字段
- 用户可排除敏感字段（如密码、手机号）
- 系统自动标记主键

#### 步骤 4/6：配置同步
| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 同步模式 | radio | 是 | "FULL_INCREMENTAL" | FULL_INCREMENTAL/INCREMENTAL_ONLY/SNAPSHOT_ONLY | 同步策略 |
| 起始位点 | radio | 是 | "LATEST" | LATEST/CURRENT_TIMESTAMP/CUSTOM | |
| 自定义位点 | string | 条件 | - | binlog 格式 | CUSTOM 必填 |
| 目标存储 | radio | 是 | "KAFKA" | KAFKA/CLICKHOUSE/HUDI/ICEBERG | 写入目标 |
| 目标 Topic/Table | string | 是 | - | 自动生成或自定义 | |
| Schema 演化 | radio | 是 | "ADD_NEW_COLUMNS" | IGNORE/ADD_NEW_COLUMNS/RESTRICT | 源表加列时如何处理 |

#### 步骤 5/6：高级配置
| 字段 | 类型 | 默认 | 校验 | 说明 |
|---|---|---|---|---|
| 并发度 | number | 1 | 1-16 | 任务并行度 |
| 批处理大小 | number | 1000 | 1-10000 | 每批处理记录数 |
| 失败重试 | number | 3 | 0-10 | 失败后重试次数 |
| 重试间隔 | number | 60 | 1-3600 秒 | |
| 死信队列 | string | - | - | 失败消息存放 |

#### 步骤 6/6：启动
1. 用户点击「启动」
2. 系统部署 Debezium/Flink CDC Connector
3. 启动全量快照 → 进入 binlog 监听
4. 实时同步到目标

**结果反馈**:
- 启动中：进度（snapshot 阶段、binlog 阶段）
- 运行中：实时指标（QPS、Lag、当前位点）
- 失败：告警 + DLQ 详情

**监控指标**:
- 同步延迟（ms）
- 已同步记录数
- 当前 binlog 位点
- 反压状态
- DLQ 数量

**关联 API**:
- POST /v1/data/cdc-tasks
- GET /v1/data/cdc-tasks/{id}/status
- POST /v1/data/cdc-tasks/{id}/pause
- POST /v1/data/cdc-tasks/{id}/resume
- POST /v1/data/cdc-tasks/{id}/stop

---

### 11.3 【新建 ETL 任务】按钮

**触发位置**:
- APP-ONTSTUDIO Action 编排页 → 「ETL 任务」Tab → 「+ 新建 ETL」按钮

**前置条件**:
- 至少 1 个数据源
- 至少 1 个目标存储
- Spark/Flink 集群可用
- 用户拥有 `etl.create` 权限

**ETL 模式**:
| 图标 | 模式 | 引擎 | 适用 |
|---|---|---|---|
| 📊 | BATCH_SPARK | Spark | 批量数据处理 |
| ⚡ | BATCH_FLINK | Flink | 批量数据处理 |
| 🌊 | STREAMING_FLINK | Flink | 实时流处理 |
| 📈 | STREAMING_SPARK | Spark Streaming | 实时流处理 |
| 🔣 | SQL_TRANSFORM | Spark SQL | 纯 SQL 转换 |

**操作流程**（7 步向导）:

#### 步骤 1/7：基本信息
| 字段 | 类型 | 必填 | 校验 | 说明 |
|---|---|---|---|---|
| 任务名 | string | 是 | 1-64 字符 | |
| 描述 | string | 否 | 0-512 字符 | |
| 模式 | radio | 是 | 上述 5 种 | |
| 优先级 | radio | 是 | NORMAL | LOW/NORMAL/HIGH/URGENT |

#### 步骤 2/7：数据源
- 选择源（可多个）
- 选择源表/Topic
- 设置增量字段（如 update_time）

#### 步骤 3/7：转换
**两种方式**:
1. **可视化 DAG**（拖拽）：
   - 输入节点（Source）
   - 转换节点（Filter/Join/Aggregate/SQL）
   - 输出节点（Sink）
2. **SQL 转换**：
   ```sql
   SELECT customer_id, SUM(amount) as total_amount
   FROM source_table WHERE create_time >= '${start_time}'
   GROUP BY customer_id
   ```

#### 步骤 4/7：目标
- 选择目标存储（Hive/ClickHouse/Iceberg/Hudi/Delta）
- 选择目标表
- 配置写入模式（overwrite/append/upsert/merge）

#### 步骤 5/7：调度
| 字段 | 类型 | 默认 | 校验 | 说明 |
|---|---|---|---|---|
| 触发方式 | radio | MANUAL | MANUAL/SCHEDULED/EVENT | |
| Cron | string | 条件 | 5 段标准 | SCHEDULED 必填 |
| 重试 | number | 3 | 0-10 | |
| 失败告警 | boolean | true | - | |

#### 步骤 6/7：资源配置
| 字段 | 类型 | 默认 | 校验 | 说明 |
|---|---|---|---|---|
| Executor 数量 | number | 2 | 1-100 | |
| Executor 内存 | number | 4 | 1-64 GB | |
| Driver 内存 | number | 2 | 1-16 GB | |
| 队列 | string | "default" | - | YARN/K8s 队列 |

#### 步骤 7/7：保存与启动
1. 点击「保存」→ POST /v1/etl/tasks
2. 选择「保存为草稿」或「立即运行」
3. 提交到 Spark/Flink 集群

**结果反馈**:
- 启动中：进度
- 完成：toast + 统计（处理行数、耗时）
- 失败：toast + 错误日志链接

**监控指标**:
- 处理行数/秒
- Shuffle 量
- GC 时间
- Executor 利用率

**关联 API**:
- POST /v1/etl/tasks
- POST /v1/etl/tasks/{id}/run
- GET /v1/etl/tasks/{id}/status
- GET /v1/etl/tasks/{id}/logs
- POST /v1/etl/tasks/{id}/stop

---

### 11.4 【新建调度任务】按钮

**触发位置**:
- APP-ONTSTUDIO 调度中心页 → 「+ 新建调度」按钮

**前置条件**:
- 至少 1 个可调度任务
- 调度服务可用
- 用户拥有 `scheduler.create` 权限

**操作流程**:

#### A. 选择任务类型
- ETL 任务
- CDC 同步任务
- 数据质量检查
- 自定义 Action

#### B. 基本信息
| 字段 | 类型 | 必填 | 校验 | 说明 |
|---|---|---|---|---|
| 调度名 | string | 是 | 1-64 字符 | |
| 任务 | select | 是 | - | 已注册任务 |
| 描述 | string | 否 | 0-512 字符 | |

#### C. 触发配置
| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 触发方式 | radio | 是 | CRON | CRON/EVENT/MANUAL/DEPENDENCY | |
| Cron 表达式 | string | 条件 | - | 5 段标准 | CRON 必填 |
| 依赖任务 | multi-select | 条件 | - | - | DEPENDENCY 必填 |
| 起始时间 | datetime | 是 | now | - | |
| 结束时间 | datetime | 否 | - | - | 永久或截止 |

#### D. 失败处理
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| 重试 | number | 3 | 0-10 |
| 重试间隔 | number | 60 | 秒 |
| 超时 | number | 3600 | 秒 |
| 失败告警 | multi-checkbox | - | 失败/超时/成功 |

#### E. 通知
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 通知渠道 | multi-checkbox | 是 | 站内/邮件/IM/Webhook |
| 通知对象 | multi-select | 是 | 用户/角色/部门 |
| 通知时机 | multi-checkbox | - | 失败/超时/成功/开始/结束 |

**结果反馈**:
- 成功：toast "调度创建成功，立即生效"
- 失败：toast 显示具体错误

**关联 API**:
- POST /v1/scheduler/tasks
- GET /v1/scheduler/tasks
- GET /v1/scheduler/dag（依赖图）

---

### 11.5 【新建数据指标】按钮

**触发位置**:
- APP-ONTSTUDIO 数据中心 → 「数据指标」Tab → 「+ 新建指标」按钮

**前置条件**:
- 已注册的指标目标（表/字段/Action）
- 用户拥有 `metric.create` 权限

**指标类型**:
| 类型 | 适用 | 计算频率 | 存储 |
|---|---|---|---|
| ATOMIC | 基础指标（DAU、销售额） | 实时/分钟 | ClickHouse |
| DERIVED | 派生指标（比率、增长率） | 分钟/小时 | ClickHouse |
| COMPOSITE | 复合指标（多维交叉） | 小时/天 | ClickHouse |
| REALTIME | 实时指标（监控大屏） | 秒级 | Redis + ClickHouse |

**操作流程**（4 步向导）:

#### 步骤 1/4：基本信息
| 字段 | 类型 | 必填 | 校验 | 说明 |
|---|---|---|---|---|
| 指标名 | string | 是 | 1-64 字符 | |
| 指标编码 | string | 是 | 正则 + 租户内唯一 | |
| 类型 | radio | 是 | 上述 4 种 | |
| 描述 | string | 否 | 0-512 字符 | |
| 业务域 | select | 是 | 财务/营销/运营/技术 | |
| 标签 | tags | 否 | - | |

#### 步骤 2/4：定义
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 数据源 | select | 是 | 已有数据源 |
| 表/视图 | select | 是 | 自动列出 |
| 计算字段 | string | 是 | SQL 表达式（如 `SUM(amount)`） |
| 聚合方式 | radio | 是 | SUM/AVG/COUNT/MAX/MIN/LAST |
| 过滤条件 | string | 否 | WHERE 子句 |
| 维度字段 | multi-select | 否 | 用于下钻 |

#### 步骤 3/4：调度与告警
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| 计算频率 | radio | HOURLY | REALTIME/MINUTELY/HOURLY/DAILY |
| 告警阈值 | object | - | {min, max, changeRate} |
| 告警对象 | multi-select | - | |
| 通知渠道 | multi-checkbox | - | 站内/邮件/IM |

#### 步骤 4/4：保存与生效
1. 点击「保存」→ POST /v1/metrics
2. 系统自动调度计算
3. 指标值进入指标库
4. 后续可在 BI 报表中使用

**结果反馈**:
- 创建成功：toast "指标创建成功"
- 计算失败：toast 显示具体错误

**指标血缘**:
- 自动追踪：指标 → 表/视图 → 字段 → 源系统
- 变更影响：修改源字段 → 列出受影响指标

**关联 API**:
- POST /v1/metrics
- GET /v1/metrics
- GET /v1/metrics/{id}/values
- GET /v1/metrics/{id}/lineage
- POST /v1/metrics/{id}/compute（手动触发）



## 12. v1.2 增量（2026-07-28）

> **触发决策**: 前端 ontology 模块已实现 5 个大数据 View 组件，同步按钮手册
> **关联文件**: `components/{BigDataSourceView,CDCView,ETLView,SchedulerView,MetricView}.tsx`

### 12.1 新增按钮清单

| # | 按钮 | 所在文件 | PRD §对应 |
|---|---|---|---|
| 11 | 新建 CDC 任务 | CDCView.tsx L108 | §12.2 |
| 12 | 暂停 CDC 任务 | CDCView.tsx L139 | §12.2 |
| 13 | 恢复 CDC 任务 | CDCView.tsx L145 | §12.2 |
| 14 | 立即同步 CDC | CDCView.tsx L151 | §12.2 |
| 15 | 新建 ETL 任务 | ETLView.tsx L74 | §12.3 |
| 16 | 运行 ETL 任务 | ETLView.tsx L120 | §12.3 |
| 17 | 停止 ETL 任务 | ETLView.tsx L116 | §12.3 |
| 18 | 暂停调度 | SchedulerView.tsx L141 | §12.4 |
| 19 | 恢复调度 | SchedulerView.tsx L147 | §12.4 |
| 20 | 立即触发 | SchedulerView.tsx L153 | §12.4 |
| 21 | 新建指标 | MetricView.tsx L66 | §12.5 |
| 22 | 计算指标 | MetricView.tsx L84 | §12.5 |
| 23 | 查看指标血缘 | MetricView.tsx L88 | §12.5 |

### 12.2 通用 Modal 流程

所有 5 个大数据 View 的 "新建 X" 按钮都触发相同的 Modal 流程:

```
步骤 1: 用户点击 "新建 X" 
   -> setShowCreate(true)
   -> <CreateXDialog onClose onSuccess />
步骤 2: 用户填写表单
   -> 必填字段: 实时校验 (红框 + tooltip)
   -> 选填字段: 默认值
步骤 3: 用户点击 "创建" 
   -> handleSubmit() 异步
   -> 校验必填字段
步骤 4: 提交中状态
   -> 按钮 disabled + 显示 "创建中..."
   -> try await createX(form) 
   -> catch fallback 到 mock.push(mockX)
步骤 5: 成功
   -> onSuccess() -> setShowCreate(false) + load()
   -> 列表自动更新显示新建项
   -> 顶部 toast "创建成功"
步骤 6: 失败
   -> alert 显示具体错误
   -> Modal 保持打开, 用户修改重试
```

### 12.3 各按钮字段表 (v1.2 新增)

#### 12.3.1 [新建 CDC 任务] 按钮 (CreateCDCDialog)

**触发位置**: CDCView.tsx L108

| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 任务名 | string | 是 | - | 1-128 字符, 必填 | |
| 源数据源 | select | 是 | - | 必须 ACTIVE, 关系型 | |
| 同步模式 | radio | 是 | FULL_INCREMENTAL | FULL/INCREMENTAL/SNAPSHOT | |
| 起始位点 | radio | 是 | LATEST | LATEST/CURRENT/CUSTOM | |
| 目标类型 | radio | 是 | KAFKA | KAFKA/CK/HUDI/ICEBERG | |
| 目标名称 | string | 是 | - | 必填 | |
| 同步表 | string | 否 | - | 逗号分隔 | |

#### 12.3.2 [新建 ETL 任务] 按钮 (CreateETLDialog)

**触发位置**: ETLView.tsx L74

| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 任务名 | string | 是 | - | 1-128 字符, 必填 | |
| 执行模式 | radio | 是 | BATCH_SPARK | 5 种 | |
| 优先级 | radio | 是 | NORMAL | LOW/NORMAL/HIGH/URGENT | |
| 触发方式 | radio | 是 | MANUAL | MANUAL/SCHEDULED/EVENT | |
| 目标数据源 | select | 是 | - | 必须 ACTIVE | |
| 目标表 | string | 是 | - | schema.table 格式 | |
| Executor 数 | number | 是 | 2 | 1-100 | |
| Executor 内存 | number | 是 | 4 | 1-64 GB | |
| Driver 内存 | number | 是 | 2 | 1-16 GB | |

#### 12.3.3 [新建数据指标] 按钮 (CreateMetricDialog)

**触发位置**: MetricView.tsx L66

| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 指标名 | string | 是 | - | 1-64 字符, 必填 | |
| 指标编码 | string | 是 | - | 正则, 必填 | |
| 类型 | radio | 是 | ATOMIC | 4 种 | |
| 聚合方式 | radio | 是 | SUM | 6 种 | |
| 数据源 | select | 是 | - | 必须 ACTIVE | |
| 源表 | string | 是 | - | schema.table 格式 | |
| 字段 | string | 是 | - | 列名 | |
| 计算频率 | radio | 是 | HOURLY | 4 种 | |

#### 12.3.4 [暂停/恢复/立即触发] 按钮 (Scheduler)

**触发位置**: SchedulerView.tsx L141/147/153

| 按钮 | 条件 | 动作 | API |
|---|---|---|---|
| 暂停 | 状态 = ACTIVE | setLoading, await pauseScheduler, load | POST /v1/scheduler/tasks/{id}/pause |
| 恢复 | 状态 = PAUSED | setLoading, await resumeScheduler, load | POST /v1/scheduler/tasks/{id}/resume |
| 立即触发 | 始终可点 | setLoading, await triggerScheduler, load | POST /v1/scheduler/tasks/{id}/trigger |

按钮显示逻辑:
```tsx
{t.status === 'ACTIVE' ? (
  <button onClick={handlePause}>暂停</button>
) : (
  <button onClick={handleResume}>恢复</button>
)}
<button onClick={handleTrigger}>立即触发</button>
```

#### 12.3.5 [计算/查看血缘] 按钮 (Metric)

**触发位置**: MetricView.tsx L84/88

| 按钮 | 动作 | API | 反馈 |
|---|---|---|---|
| 计算 | 立即触发指标计算 | POST /v1/metrics/{id}/compute | 列表自动更新 lastValue |
| 查看血缘 | 弹出血缘弹窗 | GET /v1/metrics/{id}/lineage | 树形展示 |

### 12.4 错误处理 (v1.2 新增)

所有 Modal 都遵循:
1. 必填字段为空 -> `alert('请填写必填字段')`
2. 创建中 -> button disabled + '创建中...'
3. 错误 -> catch + alert
4. 取消 -> `setShowCreate(false)`, 保留 form 状态

### 12.5 测试场景 (v1.2 新增)

| 场景 | 步骤 | 预期 |
|---|---|---|
| 正常创建 | 填所有必填 -> 创建 | toast 成功 + 列表新增项 |
| 必填缺失 | 留空 -> 创建 | alert 提示 + 按钮恢复 |
| 取消 | 打开 Modal -> 关闭 | Modal 消失 + 不保存 |
| 网络错误 | 断网 -> 创建 | 自动 fallback 到 mock |



## 13. v1.3 增量（2026-07-28）

> **触发决策**: LineageFullView 升级，引入 force-directed 布局

### 13.1 新增按钮

| # | 按钮 | 位置 | 触发动作 |
|---|---|---|---|
| 24 | 切换视图模式 (层级/力导向) | LineageFullView 工具栏中部 | 切换显示模式 |
| 25 | 缩小 (Zoom Out) | 力导向模式工具栏 | 缩小 10% |
| 26 | 放大 (Zoom In) | 力导向模式工具栏 | 放大 10% |
| 27 | 重置视图 | 力导向模式工具栏 | 缩放 100% + 平移归零 + 拖拽清除 |
| 28 | 单击节点 | 力导向图任一节点 | 打开节点详情侧栏 |
| 29 | 双击节点 | 力导向图任一节点 | 展开/收起度数标记 |
| 30 | 拖拽节点 | 力导向图任一节点 | 调整节点位置 (覆盖力布局) |
| 31 | 关闭详情 | 节点详情侧栏右上角 X | 关闭侧栏 |

### 13.2 力导向图特有交互

| 操作 | 触发 | 效果 |
|---|---|---|
| 单击 | mousedown + mouseup 在节点上 | 显示详情侧栏 |
| 拖拽 | mousedown + mousemove 在节点上 | 移动节点位置 |
| 双击 | dblclick 在节点上 | 展开/收起度数标记 (X edges) |
| 平移 | mousedown + drag 在空白处 | 移动整个视图 |

### 13.3 视图切换按钮

```tsx
<button onClick={() => setViewMode(viewMode === 'force' ? 'hierarchical' : 'force')}>
  {viewMode === 'force' ? '→ 层级视图' : '→ 力导向'}
</button>
```

切换后立即重新计算节点位置 (层级视图无需计算, 力导向视图调用 `runForceLayout()`)。

### 13.4 性能要求

| 操作 | P50 | P99 |
|---|---|---|
| 视图切换 | < 50ms | < 100ms |
| 节点拖拽 (60fps) | < 16ms | < 33ms |
| 力布局计算 (24 节点) | < 50ms | < 100ms |
| 缩放/平移 | < 16ms | < 33ms |
| 详情侧栏打开 | < 10ms | < 30ms |

### 13.5 测试场景 (v1.3 新增)

| 场景 | 步骤 | 预期 |
|---|---|---|
| 视图切换 | 点击视图切换按钮 | 立即从层级切到力导向, 节点按力布局 |
| 节点拖拽 | 按住节点拖动 | 节点跟随, 其他节点根据弹簧力更新 |
| 节点详情 | 单击节点 | 底部出现侧栏, 显示该节点出边/入边 |
| 缩放 | 点击放大/缩小 | 50%-250% 平滑过渡 |
| 双击节点 | 双击任一节点 | 显示/隐藏度数标记 |
