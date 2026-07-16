# PRD - MCP 服务中心（APP-MCPHUB）

> Mate Platform MCP（Model Context Protocol）服务中心产品需求文档
>
> 管理平台对外的 AI 工具能力暴露，支持 MCP Server/Client 双向管理、工具注册中心、在线调试器、调用审计、权限控制与外部 AI IDE 对接。

**版本**：v1.0

**日期**：2026-07-16

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本 | - |

---

## 1. 模块概述

### 1.1 背景

MCP（Model Context Protocol）是 Anthropic 于 2024 年 11 月开源的 AI 工具调用协议，基于 JSON-RPC，支持 stdio / HTTP SSE 传输，截至 2026 年初已成为事实上的 AI 工具接入标准。Mate Platform 作为企业级决策与运营提效平台，需要通过 MCP 协议将平台核心能力（Ontology 查询、知识库检索、Action 执行、架构资产访问等）暴露给外部 AI 应用（Cursor、GitHub Copilot、Claude Code、Claude Desktop 等），同时也需要作为 MCP Client 连接第三方 MCP Server 以扩展平台 Agent 的工具能力。

APP-MCPHUB 是 Mate Platform 的 MCP 服务中心，是平台与外部 AI 生态之间的"能力网关"。它不直接实现 MCP 协议通信（由 `TECH-MCP` 技术服务负责），而是提供面向管理员和开发者的配置管理、工具注册、在线调试、权限管控、调用审计与外部对接的管理界面。

### 1.2 定位

| 维度 | 说明 |
|---|---|
| 模块类型 | APP 应用模块 |
| 核心职责 | MCP Server/Client 配置管理、工具注册与发布、在线调试、权限管控、调用审计、外部 IDE 对接 |
| 技术底座 | `TECH-MCP`（MCP 协议适配）、`TECH-IAM`（权限认证）、`TECH-ONT`（Ontology 查询）、`TECH-RAG`（知识库检索）、`TECH-ACTION`（Action 执行） |
| 上游依赖 | TECH-MCP、TECH-ONT、TECH-RAG、TECH-ACTION、TECH-IAM |
| 下游消费 | 外部 MCP Client（Cursor / Copilot / Claude Code / Claude Desktop）、APP-SUPERAI（内部 MCP Client 调用） |
| 前端栈 | React 19 + TypeScript 5.7 + Ant Design 6.0 |
| 后端栈 | Java 21 + Spring Boot 3.4 + spring-ai-mcp-server-spring-boot-starter |

### 1.3 核心能力概览

| 序号 | 能力 | 说明 |
|---|---|---|
| 1 | MCP Server 管理 | 配置哪些平台能力通过 MCP 暴露（Tools / Resources / Prompts），管理 Server 实例的启停 |
| 2 | MCP Client 管理 | 配置平台连接的第三方 MCP Server（如外部 GitHub MCP、数据库 MCP），测试连接状态 |
| 3 | 工具注册中心 | 统一管理平台所有 Tools 的注册、Schema 定义、分类、版本、调用统计 |
| 4 | MCP 调试器 | 在线测试 MCP 工具调用，查看完整请求/响应，支持断点调试与历史回放 |
| 5 | 调用审计 | MCP 调用记录、Token 消耗统计、错误追踪与分类分析 |
| 6 | 权限控制 | 配置哪些用户/应用可以调用哪些 MCP 工具，支持 RBAC + ABAC 混合模型 |
| 7 | 外部应用对接 | 生成 Cursor / Copilot / Claude Code 等 AI IDE 的 MCP 配置，管理连接状态 |

### 1.4 目标用户

| 角色 | 典型操作 | 权限范围 |
|---|---|---|
| 平台管理员 | 配置 MCP Server 暴露策略、管理权限规则、查看调用审计全局视图 | 全部功能 |
| 平台开发者 | 注册/编辑工具、在调试器中测试工具调用、配置第三方 MCP Client 连接 | 工具注册、调试器、Client 管理 |
| 应用管理员 | 查看应用关联工具的调用统计、配置应用级工具权限 | 权限配置（应用范围）、审计查看（应用范围） |
| 外部开发者 | 获取 MCP 连接配置、查看连接状态 | 外部对接（只读） |

---

## 2. 用户动线总览

### 2.1 核心动线

```
进入 MCP 中心
    │
    ├─── 工具注册中心 ──→ 注册 Tools ──→ 定义 Schema ──→ 分类标签
    │
    ├─── MCP Server 管理 ──→ 创建 Server ──→ 配置暴露的 Tools/Resources/Prompts ──→ 启动 Server
    │
    ├─── MCP 调试器 ──→ 选择 Server/Tool ──→ 填写参数 ──→ 执行调用 ──→ 查看响应
    │
    ├─── 权限控制 ──→ 创建权限规则 ──→ 绑定用户/应用 ──→ 绑定工具范围
    │
    ├─── 外部应用对接 ──→ 选择 IDE 类型 ──→ 生成配置 ──→ 复制配置 ──→ 查看连接状态
    │
    ├─── MCP Client 管理 ──→ 添加第三方 Server 连接 ──→ 测试连接 ──→ 查看可用工具
    │
    └─── 调用审计 ──→ 查看调用记录 ──→ 分析 Token 消耗 ──→ 追踪错误
```

### 2.2 典型场景动线

**场景一：将 Ontology 查询能力暴露给 Cursor**

```
1. 进入 MCP 中心 → 工具注册中心
2. 点击「注册工具」→ 填写工具名称（ontology_query）、描述、输入参数 Schema → 点击「保存」
3. 进入 MCP Server 管理 → 点击「创建 Server」→ 填写 Server 名称（Mate Platform MCP）→ 选择传输方式（HTTP SSE）→ 点击「保存」
4. 在 Server 详情页 → 点击「添加 Tools」→ 勾选 ontology_query → 点击「确认添加」
5. 进入权限控制 → 点击「创建权限规则」→ 选择工具 ontology_query → 绑定用户/应用 → 点击「保存」
6. 进入外部应用对接 → 选择 Cursor → 点击「生成配置」→ 复制 JSON 配置
7. 在 Cursor 中粘贴配置 → 连接成功 → 进入连接状态查看已连接
8. 进入调用审计 → 查看 ontology_query 的调用记录与 Token 消耗
```

**场景二：连接第三方 GitHub MCP Server 并在调试器中测试**

```
1. 进入 MCP 中心 → MCP Client 管理
2. 点击「添加连接」→ 填写连接名称（GitHub MCP）、Server URL、认证信息 → 点击「保存」
3. 在连接列表中点击「测试连接」→ 连接状态显示"已连接" → 展开查看可用工具列表
4. 进入 MCP 调试器 → 选择连接源（GitHub MCP）→ 选择工具（create_issue）
5. 填写参数（repo、title、body）→ 点击「执行调用」→ 查看响应结果
6. 进入调用审计 → 查看 create_issue 的调用记录
```

**场景三：管理员排查 MCP 调用错误**

```
1. 进入 MCP 中心 → 调用审计
2. 筛选状态=「失败」→ 查看错误调用列表
3. 点击某条错误记录 → 查看完整请求/响应/错误堆栈
4. 点击「错误分类统计」Tab → 查看按错误类型分组的统计图表
5. 根据错误信息定位到具体工具 → 进入工具注册中心编辑工具 Schema
```

### 2.3 页面导航结构

```
MCP 中心
├── 概览（Dashboard）
│   ├── Server 状态概览
│   ├── 工具总数 / 在线工具数
│   ├── 今日调用次数 / Token 消耗
│   └── 近期错误告警
├── MCP Server 管理
│   ├── Server 列表
│   ├── Server 详情（暴露的 Tools / Resources / Prompts）
│   └── Server 配置编辑
├── MCP Client 管理
│   ├── 第三方 Server 连接列表
│   ├── 添加 / 编辑连接
│   └── 连接详情（可用工具列表）
├── 工具注册中心
│   ├── 工具列表（卡片/表格切换）
│   ├── 注册 / 编辑工具
│   ├── 工具分类管理
│   └── 工具详情（Schema / 版本 / 调用统计）
├── MCP 调试器
│   ├── 连接源选择
│   ├── 工具选择
│   ├── 参数填写面板
│   ├── 响应结果面板
│   └── 历史调用记录
├── 调用审计
│   ├── 调用记录列表
│   ├── Token 统计分析
│   ├── 错误追踪
│   └── 调用详情
├── 权限控制
│   ├── 权限规则列表
│   ├── 创建 / 编辑权限规则
│   ├── 用户-工具映射
│   └── 应用-工具映射
└── 外部应用对接
    ├── IDE 配置指引
    ├── 连接管理
    └── 连接状态监控
```

---

## 3. 功能详情

### 3.1 MCP Server 管理

管理平台作为 MCP Server 暴露能力的配置。一个 MCP Server 实例代表一个对外的 MCP 服务端点，可包含若干 Tools、Resources、Prompts。

#### 3.1.1 Server 列表

**入口**：左侧导航 → 「MCP Server 管理」→ 默认进入 Server 列表页

**页面布局**：

- 顶部操作栏：搜索框（按名称/描述搜索）、状态筛选下拉（全部/运行中/已停止/异常）、传输方式筛选（全部/HTTP SSE/stdio）、「创建 Server」按钮
- 列表表格：复选框、Server 名称、描述、传输方式、暴露工具数、暴露资源数、暴露 Prompt 数、状态（Tag 标签：运行中=绿色/已停止=灰色/异常=红色）、创建时间、操作列
- 操作列按钮：「详情」、「启动」/「停止」、「编辑」、「删除」（带二次确认）
- 底部：分页器（默认每页 20 条）

**操作步骤**：

1. 进入 MCP Server 管理页面，系统加载 Server 列表，展示当前所有 MCP Server 实例
2. 在搜索框输入关键词（如"Ontology"），列表实时筛选匹配项
3. 点击状态下拉选择"运行中"，列表仅展示状态为运行中的 Server
4. 点击某行 Server 名称 → 跳转至 Server 详情页
5. 点击操作列「启动」按钮 → 弹出确认对话框"确认启动 Server [名称]？" → 点击「确认」→ Server 状态变更为"运行中"，列表刷新，Toast 提示"Server 启动成功"
6. 点击操作列「停止」按钮 → 弹出确认对话框"确认停止 Server [名称]？停止后外部 Client 将无法连接。" → 点击「确认」→ Server 状态变更为"已停止"，Toast 提示"Server 已停止"
7. 点击操作列「删除」按钮 → 弹出确认对话框"确认删除 Server [名称]？此操作不可恢复，关联的权限规则将一并删除。" → 输入 Server 名称确认 → 点击「确认删除」→ Server 从列表移除，Toast 提示"Server 已删除"

**反馈**：

- 列表加载中：表格区域显示 Skeleton 骨架屏
- 列表为空：显示 Empty 空状态组件，文案"暂无 MCP Server，点击「创建 Server」开始配置"
- 操作成功：Toast 提示 + 列表自动刷新
- 操作失败：Toast 错误提示 + 错误详情

#### 3.1.2 创建 Server

**入口**：Server 列表页 → 点击「创建 Server」按钮

**操作步骤**：

1. 点击「创建 Server」按钮 → 弹出创建 Server 抽屉面板（Drawer，宽度 600px）
2. 填写表单字段（见下方字段详情）
3. 点击「保存」按钮 → 表单校验 → 校验通过后保存 → 抽屉关闭 → Server 列表刷新 → Toast 提示"Server 创建成功，默认状态为已停止，请配置暴露能力后启动"
4. 点击「取消」按钮 → 如有未保存修改，弹出确认"有未保存的修改，确认放弃？" → 点击「确认」关闭抽屉

**表单字段详情**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| Server 名称 | Input | 是 | 唯一标识，支持中英文/数字/下划线/连字符，1-64 字符 |
| 描述 | TextArea | 否 | Server 用途说明，最多 500 字符 |
| 传输方式 | RadioGroup | 是 | HTTP SSE（对外暴露推荐）/ stdio（本地运行） |
| 监听地址 | Input | 是（HTTP SSE 时） | 默认 `0.0.0.0`，可指定 IP |
| 监听端口 | InputNumber | 是（HTTP SSE 时） | 默认 `8080`，范围 1024-65535 |
| SSE 端点路径 | Input | 是（HTTP SSE 时） | 默认 `/sse`，需以 `/` 开头 |
| 认证方式 | Select | 是 | 无认证 / API Key / OAuth2 |
| API Key | Input | 是（API Key 时） | 自动生成或手动输入，32 位字符串 |
| 标签 | Select (multi) | 否 | 从已有标签选择或新建标签，用于分类管理 |
| 超时时间（秒） | InputNumber | 否 | 单次工具调用超时，默认 30 秒 |
| 最大并发数 | InputNumber | 否 | 同时处理的最大请求数，默认 100 |

**反馈**：

- 字段校验失败：对应字段下方红色提示文案，输入框红色边框
- 名称重复：Server 名称字段提示"该名称已存在，请更换"
- 端口被占用：监听端口字段提示"端口 [X] 已被占用"
- 保存成功：Toast 提示 + 列表刷新

#### 3.1.3 配置暴露的 Tools / Resources / Prompts

**入口**：Server 列表页 → 点击 Server 名称 → 进入 Server 详情页 → 三个 Tab 页签

**操作步骤 - 配置 Tools**：

1. 在 Server 详情页点击「Tools」Tab → 展示当前 Server 已暴露的工具列表（表格：工具名称、描述、分类、状态、操作）
2. 点击「添加 Tools」按钮 → 弹出工具选择抽屉 → 左侧为分类树，右侧为工具列表（带复选框）
3. 勾选需要暴露的工具 → 点击「确认添加」→ 抽屉关闭 → 工具列表刷新 → Toast 提示"已添加 [N] 个工具到 Server"
4. 点击工具行操作列「移除」按钮 → 弹出确认"确认从 Server 移除工具 [名称]？移除后外部 Client 将无法调用此工具。" → 点击「确认」→ 工具从列表移除
5. 点击工具行操作列「查看 Schema」→ 弹出 Schema 查看弹窗，展示工具的完整 JSON Schema（只读，带语法高亮）
6. 点击「批量移除」→ 勾选多个工具 → 点击「批量移除」→ 确认后批量移除

**操作步骤 - 配置 Resources**：

1. 在 Server 详情页点击「Resources」Tab → 展示当前 Server 已暴露的资源列表
2. 点击「添加 Resource」按钮 → 弹出添加资源表单
3. 填写资源字段（见下方）→ 点击「保存」→ 资源添加到列表
4. 资源类型支持：文档（来自 TECH-RAG 知识库）、架构资产（来自 TECH-EA）、流程定义（来自 TECH-WFE）、数据字典（来自 TECH-ONT）

**Resource 表单字段**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| Resource URI | Input | 是 | MCP Resource 标识，格式如 `ont://concepts/{id}` 或 `rag://docs/{id}` |
| 资源名称 | Input | 是 | 显示名称，1-128 字符 |
| 描述 | TextArea | 否 | 资源内容说明 |
| 资源类型 | Select | 是 | 文档 / 架构资产 / 流程定义 / 数据字典 / 自定义 |
| 数据源 | Select | 是 | 根据资源类型联动：文档→知识库列表，架构资产→EA 资产列表，等 |
| MIME 类型 | Input | 否 | 默认根据资源类型自动填充（如 `application/json`、`text/markdown`） |
| 访问模式 | RadioGroup | 是 | 只读 / 读写 |

**操作步骤 - 配置 Prompts**：

1. 在 Server 详情页点击「Prompts」Tab → 展示当前 Server 已暴露的 Prompt 模板列表
2. 点击「添加 Prompt」按钮 → 弹出添加 Prompt 表单
3. 填写 Prompt 字段（见下方）→ 点击「保存」→ Prompt 添加到列表
4. 支持从现有角色模板导入：点击「从角色模板导入」→ 选择 TECH-AGENT 中的角色模板 → 自动填充 Prompt 内容

**Prompt 表单字段**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| Prompt 名称 | Input | 是 | 唯一标识，1-64 字符 |
| 描述 | TextArea | 否 | Prompt 用途说明 |
| Prompt 内容 | CodeEditor | 是 | 支持变量占位符（如 `{{role}}`、`{{context}}`），支持 Markdown 语法 |
| 参数定义 | Array (动态表单) | 否 | 变量名、类型（string/number/boolean）、描述、是否必填 |
| 分类 | Select | 否 | 角色模板 / 业务分析 / 代码生成 / 自定义 |

**反馈**：

- 添加成功：Toast 提示 + 列表刷新
- 添加失败（如 URI 冲突）：对应字段红色提示
- Server 运行中添加工具：Toast 提示"工具已添加，外部 Client 需重新连接以获取最新工具列表"

#### 3.1.4 Server 启停与状态监控

**入口**：Server 详情页 → 右上角操作区

**操作步骤**：

1. 在 Server 详情页右上角，显示当前状态 Tag 和操作按钮
2. 状态为"已停止"时显示「启动」按钮 → 点击「启动」→ 按钮变为 Loading → 启动成功后状态 Tag 变为绿色"运行中" → Toast 提示"Server 启动成功"
3. 状态为"运行中"时显示「停止」按钮 → 点击「停止」→ 确认对话框 → 确认后状态 Tag 变为灰色"已停止"
4. 点击「重启」按钮 → 确认对话框"重启期间连接将中断，确认重启？" → 确认后 Server 重启
5. 在详情页底部展示"连接状态"面板：当前连接数、历史连接数、连接来源分布

**状态定义**：

| 状态 | 颜色 | 说明 |
|---|---|---|
| 运行中 | 绿色 | Server 正常运行，可接受外部连接 |
| 已停止 | 灰色 | Server 已手动停止 |
| 启动中 | 蓝色（Loading） | Server 正在启动 |
| 异常 | 红色 | Server 运行异常，需查看日志排查 |

---

### 3.2 MCP Client 管理

管理平台作为 MCP Client 连接的第三方 MCP Server，扩展平台 Agent 的工具能力。

#### 3.2.1 第三方 Server 连接列表

**入口**：左侧导航 → 「MCP Client 管理」→ 默认进入连接列表页

**页面布局**：

- 顶部操作栏：搜索框（按名称/URL 搜索）、状态筛选（全部/已连接/未连接/连接异常）、「添加连接」按钮
- 列表表格：连接名称、Server URL、传输方式、认证方式、可用工具数、状态（已连接=绿色/未连接=灰色/连接异常=红色）、最后连接时间、操作列
- 操作列按钮：「详情」、「测试连接」、「编辑」、「删除」（带二次确认）
- 底部：分页器

**操作步骤**：

1. 进入 MCP Client 管理页面，系统加载连接列表
2. 在搜索框输入关键词筛选
3. 点击操作列「测试连接」→ 按钮变为 Loading → 系统尝试连接第三方 Server → 连接成功：状态更新为"已连接"，Toast 提示"连接成功，发现 [N] 个可用工具" → 连接失败：状态更新为"连接异常"，Toast 错误提示 + 错误详情展开
4. 点击连接名称 → 跳转至连接详情页，展示可用工具列表及工具 Schema
5. 点击「删除」→ 确认对话框 → 确认后删除连接

**反馈**：

- 列表为空：Empty 组件，文案"暂无第三方 MCP Server 连接，点击「添加连接」开始配置"
- 测试连接超时：Toast 提示"连接超时，请检查网络和 Server 地址"

#### 3.2.2 添加连接

**入口**：连接列表页 → 点击「添加连接」按钮

**操作步骤**：

1. 点击「添加连接」→ 弹出添加连接抽屉面板（Drawer，宽度 600px）
2. 填写表单字段（见下方）
3. 点击「测试连接」按钮 → 系统实时测试连接 → 测试通过后显示绿色"连接成功"标识和发现的工具数量
4. 点击「保存」按钮 → 表单校验 → 保存成功 → 抽屉关闭 → 列表刷新 → Toast 提示"连接添加成功"
5. 点击「取消」→ 关闭抽屉

**表单字段详情**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 连接名称 | Input | 是 | 唯一标识，1-64 字符 |
| 描述 | TextArea | 否 | 连接用途说明 |
| 传输方式 | RadioGroup | 是 | HTTP SSE / stdio |
| Server URL | Input | 是（HTTP SSE 时） | 第三方 MCP Server 地址，如 `https://github-mcp.example.com/sse` |
| 命令路径 | Input | 是（stdio 时） | 本地可执行文件路径，如 `/usr/local/bin/github-mcp-server` |
| 命令参数 | Input | 否（stdio 时） | 启动参数，空格分隔 |
| 环境变量 | KeyValueEditor | 否 | 键值对形式，如 `GITHUB_TOKEN=xxx` |
| 认证方式 | Select | 是 | 无认证 / API Key / Bearer Token / OAuth2 |
| 认证凭据 | Input | 是（需认证时） | 根据认证方式动态展示 |
| 自动重连 | Switch | 否 | 开启后连接断开自动重试，默认开启 |
| 重连间隔（秒） | InputNumber | 否 | 自动重连间隔，默认 30 秒 |
| 超时时间（秒） | InputNumber | 否 | 连接和调用超时，默认 30 秒 |

**反馈**：

- 测试连接中：「测试连接」按钮 Loading + 提示"正在连接..."
- URL 格式错误：Server URL 字段提示"请输入有效的 URL 地址"
- 认证失败：Toast 错误提示"认证失败，请检查凭据"
- 保存成功：Toast 提示 + 列表刷新

#### 3.2.3 连接详情与工具发现

**入口**：连接列表页 → 点击连接名称

**操作步骤**：

1. 点击连接名称 → 进入连接详情页
2. 详情页顶部展示连接基本信息（名称、URL、状态、创建时间、最后连接时间）
3. 点击「刷新工具列表」按钮 → 系统重新拉取第三方 Server 的工具列表 → Loading → 刷新完成 → Toast 提示"工具列表已刷新，发现 [N] 个工具"
4. 工具列表表格展示：工具名称、描述、输入 Schema 摘要、状态（可用/不可用）
5. 点击工具名称 → 弹出工具 Schema 详情弹窗，展示完整 JSON Schema
6. 点击「同步到工具注册中心」按钮 → 弹出确认"将 [N] 个工具同步到平台工具注册中心？同步后可在 Agent 编排中使用。" → 确认后执行同步 → Toast 提示"已同步 [N] 个工具到注册中心"
7. 点击「在调试器中测试」按钮 → 跳转至 MCP 调试器，自动选择该连接和对应工具

**反馈**：

- 工具列表为空：提示"未发现可用工具，请检查 Server 是否正常暴露工具"
- 同步冲突：如有同名工具，弹窗提示"工具 [名称] 已存在，是否覆盖？" → 选择覆盖/跳过/重命名

---

### 3.3 工具注册中心

统一管理平台所有 MCP Tools 的注册、Schema 定义、分类与版本。工具是 MCP 协议中的核心能力单元，对应 MCP Server 暴露的 Tools 列表。

#### 3.3.1 工具列表

**入口**：左侧导航 → 「工具注册中心」→ 默认进入工具列表页

**页面布局**：

- 顶部操作栏：搜索框（按名称/描述搜索）、分类筛选（树形下拉，含"全部"）、状态筛选（全部/已发布/草稿/已下线）、来源筛选（平台内置/自定义/第三方同步）、「注册工具」按钮
- 视图切换：卡片视图 / 表格视图（右上角切换图标）
- **卡片视图**：每个工具为一张卡片，展示工具名称、描述、分类标签、来源标识、状态 Tag、调用次数、最后调用时间。卡片底部操作按钮：「编辑」、「调试」、「更多」（下拉：复制、下线、删除）
- **表格视图**：复选框、工具名称、描述、分类、来源、版本、状态、调用次数、最后调用时间、操作列
- 底部：分页器（默认每页 20 条）

**操作步骤**：

1. 进入工具注册中心，系统加载工具列表
2. 点击视图切换图标在卡片/表格视图间切换
3. 在搜索框输入关键词 → 列表实时筛选
4. 点击分类筛选 → 展开分类树 → 选择分类（如"Ontology"）→ 列表按分类筛选
5. 点击工具卡片/行 → 跳转至工具详情页
6. 点击卡片底部「调试」→ 跳转至 MCP 调试器并自动选中该工具
7. 勾选多个工具 → 点击「批量操作」→ 选择「批量下线」/「批量删除」

**反馈**：

- 列表为空：Empty 组件 + "暂无工具，点击「注册工具」开始"
- 加载中：Skeleton 骨架屏

#### 3.3.2 注册工具

**入口**：工具列表页 → 点击「注册工具」按钮

**操作步骤**：

1. 点击「注册工具」→ 弹出注册工具抽屉面板（Drawer，宽度 720px）
2. 填写基本信息区域字段
3. 填写输入参数 Schema 区域（JSON Schema 编辑器）
4. 填写输出 Schema 区域（可选）
5. 点击「预览」按钮 → 弹出预览弹窗，展示工具注册后对外暴露的 MCP Tool 定义（JSON 格式）
6. 确认无误后点击「保存为草稿」→ 工具状态为"草稿" → 或点击「保存并发布」→ 工具状态为"已发布"
7. 抽屉关闭 → 列表刷新 → Toast 提示"工具注册成功"

**表单字段详情**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 工具名称 | Input | 是 | 唯一标识，snake_case，1-64 字符，如 `ontology_query` |
| 显示名称 | Input | 是 | 用户可读名称，如"Ontology 查询" |
| 描述 | TextArea | 是 | 工具功能描述，会暴露给 AI 模型作为工具说明，1-500 字符 |
| 分类 | TreeSelect | 是 | 从分类树选择或新建分类 |
| 来源 | Select | 是 | 平台内置（从 TECH-ONT/RAG/ACTION 自动注册）/ 自定义 / 第三方同步 |
| 实现类型 | RadioGroup | 是 | Ontology 查询 / RAG 检索 / Action 执行 / HTTP 调用 / 自定义脚本 |
| 关联资源 | Select | 是（实现类型为 Ontology/RAG/Action 时） | 根据实现类型联动选择具体资源 |
| HTTP 端点 | Input | 是（实现类型为 HTTP 调用时） | 目标 API 地址 |
| HTTP 方法 | Select | 是（实现类型为 HTTP 调用时） | GET / POST / PUT / DELETE |
| 自定义脚本 | CodeEditor | 是（实现类型为自定义脚本时） | Python 脚本，支持使用平台 SDK |
| 输入参数 Schema | JSONSchemaEditor | 是 | 工具输入参数的 JSON Schema 定义 |
| 输出 Schema | JSONSchemaEditor | 否 | 工具输出结果的 JSON Schema 定义 |
| 超时时间（秒） | InputNumber | 否 | 单次调用超时，默认 30 秒 |
| 是否幂等 | Switch | 否 | 标识工具是否可安全重试，默认关闭 |
| 标签 | Select (multi) | 否 | 工具标签，便于检索和管理 |

**JSON Schema 编辑器说明**：

- 可视化编辑器 + 源码编辑器双模式切换
- 可视化模式：以表格形式添加参数，每行包含：参数名、类型（string/number/integer/boolean/array/object）、描述、是否必填、默认值、枚举值
- 源码模式：直接编辑 JSON Schema 源码，带语法高亮和校验
- 两个模式实时同步

**反馈**：

- 工具名称重复：字段提示"工具名称已存在"
- Schema 格式错误：JSON Schema 编辑器下方提示具体错误位置
- 保存成功：Toast 提示 + 列表刷新

#### 3.3.3 编辑工具 Schema

**入口**：工具列表页 → 点击工具 → 进入工具详情页 → 点击「编辑」按钮 / 或工具卡片「编辑」按钮

**操作步骤**：

1. 进入工具详情页，展示工具基本信息、输入/输出 Schema、版本历史、调用统计
2. 点击右上角「编辑」按钮 → 进入编辑模式，字段变为可编辑状态
3. 修改工具字段或 Schema
4. 点击「保存」→ 如工具为"已发布"状态，弹出确认"修改已发布工具将创建新版本，确认保存？" → 确认后保存为新版本
5. 点击「取消」→ 放弃修改退出编辑模式

**版本管理**：

- 每次修改"已发布"工具自动创建新版本，版本号自增（如 v1 → v2）
- 工具详情页展示版本历史列表，每个版本可查看差异对比
- 点击版本操作列「回滚」→ 确认后回滚到指定版本 → 创建新版本（内容为回滚目标版本）
- 点击「设为当前版本」→ 将指定版本设为对外暴露的版本

**反馈**：

- 保存成功：Toast 提示"工具已更新，新版本 v[N] 已创建"
- 版本回滚：Toast 提示"已回滚到 v[N]，当前版本为 v[M]"

#### 3.3.4 工具分类管理

**入口**：工具注册中心 → 左上角分类树面板 → 点击「管理分类」按钮

**操作步骤**：

1. 点击「管理分类」→ 弹出分类管理弹窗，展示分类树
2. 点击「新增分类」→ 弹出输入框 → 填写分类名称、选择父分类（可选）→ 点击「确认」→ 分类添加到树
3. 点击分类节点的「编辑」→ 修改分类名称 → 点击「确认」
4. 点击分类节点的「删除」→ 如分类下有工具，提示"该分类下有 [N] 个工具，无法删除，请先迁移工具" → 如无工具，确认后删除
5. 拖拽分类节点调整层级关系 → 自动保存

**预设分类**：

| 分类 | 说明 | 典型工具 |
|---|---|---|
| Ontology | 本体引擎相关 | concept_query、entity_search、relation_traverse、rule_validate |
| RAG | 知识库检索相关 | knowledge_search、document_retrieve、qa_answer |
| Action | Action 执行相关 | execute_action、query_action_status、cancel_action |
| Data | 数据查询相关 | data_query、data_export、data_lineage |
| EA | 架构资产相关 | capability_map、application_list、tech_stack_query |
| Workflow | 流程相关 | start_process、query_task、complete_task |
| External | 第三方同步工具 | github_create_issue、slack_send_message |

---

### 3.4 MCP 调试器

在线测试 MCP 工具调用，支持查看完整的 JSON-RPC 请求/响应，是开发和排查工具问题的核心工具。

#### 3.4.1 调试器主界面

**入口**：左侧导航 → 「MCP 调试器」→ 进入调试器主界面

**页面布局（三栏式）**：

- **左栏（连接与工具选择区，宽度 280px）**：
  - 连接源选择：下拉选择 MCP Server（平台作为 Server 时测试本地工具）/ MCP Client 连接（测试第三方工具）
  - 工具列表：根据连接源展示可用工具列表，带搜索框
  - 点击工具 → 中栏加载该工具的参数表单
- **中栏（参数填写区，自适应宽度）**：
  - 工具名称与描述展示
  - 参数表单（根据工具输入 Schema 自动生成）
  - 底部操作栏：「执行调用」按钮、「清空参数」按钮、「加载示例」按钮
- **右栏（响应结果区，宽度 480px）**：
  - 响应结果 Tab：展示调用返回结果（JSON 格式化展示，带语法高亮）
  - 原始报文 Tab：展示完整的 JSON-RPC 请求报文和响应报文
  - 调用信息 Tab：展示调用耗时、状态码、Token 消耗（如适用）、Trace ID
  - 历史记录 Tab：本次会话的调用历史列表

#### 3.4.2 选择工具与填写参数

**操作步骤**：

1. 进入调试器 → 左栏连接源下拉选择 MCP Server（如"Mate Platform MCP"）→ 工具列表自动加载该 Server 暴露的所有工具
2. 在工具列表搜索框输入关键词（如"ontology"）→ 列表筛选
3. 点击工具（如 `ontology_query`）→ 中栏加载参数表单
4. 参数表单根据工具的输入 Schema 自动生成：
   - string 类型 → Input 输入框
   - number/integer 类型 → InputNumber 输入框
   - boolean 类型 → Switch 开关
   - enum 类型 → Select 下拉选择
   - array 类型 → 动态列表（可添加/删除行）
   - object 类型 → 嵌套表单
5. 填写参数值
6. 点击「加载示例」→ 系统加载工具预设的示例参数 → 自动填充表单
7. 点击「清空参数」→ 清空所有参数值

**参数表单字段示例（以 ontology_query 为例）**：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| query_type | Select (enum) | 是 | concept / entity / relation / rule |
| concept_name | Input (string) | 否 | 概念名称（query_type=concept 时有效） |
| entity_id | Input (string) | 否 | 实体 ID（query_type=entity 时有效） |
| depth | InputNumber (integer) | 否 | 关系遍历深度，默认 1，范围 1-5 |
| filter | KeyValueEditor (object) | 否 | 过滤条件键值对 |

**反馈**：

- 必填参数未填：执行调用时参数字段红色提示"[参数名]为必填项"
- 参数类型不匹配：实时校验，输入框下方提示类型错误

#### 3.4.3 执行调用与查看响应

**操作步骤**：

1. 填写完参数后点击「执行调用」按钮 → 按钮变为 Loading 状态"调用中..."
2. 系统通过 MCP 协议向目标 Server 发起 JSON-RPC 调用
3. 调用完成后，右栏展示结果：
   - **响应结果 Tab**：格式化展示返回数据，支持折叠/展开 JSON 节点
   - **原始报文 Tab**：
     - 请求报文区域（只读，带语法高亮）：
       ```json
       {
         "jsonrpc": "2.0",
         "id": 1,
         "method": "tools/call",
         "params": {
           "name": "ontology_query",
           "arguments": { "query_type": "concept", "concept_name": "客户" }
         }
       }
       ```
     - 响应报文区域（只读，带语法高亮）：展示完整 JSON-RPC 响应
   - **调用信息 Tab**：调用 ID、Trace ID、开始时间、耗时（ms）、HTTP 状态码、是否成功、Token 消耗（如涉及 LLM 调用）
4. 调用成功：右栏顶部显示绿色"调用成功"标识 + 耗时
5. 调用失败：右栏顶部显示红色"调用失败"标识 + 错误信息 + 错误堆栈
6. 点击「复制响应」→ 复制响应 JSON 到剪贴板 → Toast 提示"已复制到剪贴板"
7. 点击「复制请求报文」→ 复制 JSON-RPC 请求报文到剪贴板
8. 点击「重新调用」→ 使用当前参数重新发起调用
9. 每次调用自动记录到右栏"历史记录"Tab

**历史记录**：

- 历史记录列表展示：工具名称、调用时间、状态（成功/失败）、耗时
- 点击某条历史记录 → 中栏恢复该次调用的参数 → 右栏展示该次调用的响应
- 点击「清空历史」→ 清空当前会话历史

**反馈**：

- 调用中：按钮 Loading + 右栏展示"正在调用..."
- 调用超时：右栏红色提示"调用超时（超过 [N] 秒）"
- 调用错误：右栏红色提示错误信息 + 可展开错误堆栈
- 调用成功：右栏绿色标识 + 格式化结果展示

---

### 3.5 调用审计

记录所有 MCP 工具调用，提供调用记录查询、Token 消耗统计与错误追踪能力。

#### 3.5.1 调用记录列表

**入口**：左侧导航 → 「调用审计」→ 默认进入调用记录列表页

**页面布局**：

- 顶部统计卡片区域（4 个卡片）：
  - 今日调用总数（含环比变化百分比）
  - 今日 Token 消耗（含环比变化百分比）
  - 今日错误数（含错误率）
  - 平均响应耗时
- 筛选区域：
  - 时间范围选择器（快捷选项：今日/昨日/近 7 天/近 30 天/自定义）
  - 工具筛选（下拉选择）
  - Server/Client 筛选（下拉选择）
  - 调用方筛选（外部应用/内部 Agent/调试器）
  - 状态筛选（全部/成功/失败/超时）
  - 「查询」按钮、「重置」按钮
- 列表表格：调用 ID、Trace ID、工具名称、调用方、Server/Client、状态、耗时（ms）、Token 消耗、调用时间、操作列
- 操作列：「查看详情」
- 底部：分页器（默认每页 50 条）

**操作步骤**：

1. 进入调用审计页面，系统默认加载今日调用记录 + 顶部统计卡片
2. 选择时间范围为"近 7 天" → 点击「查询」→ 列表和统计卡片更新
3. 在工具筛选中选择"ontology_query" → 点击「查询」→ 列表仅展示该工具的调用记录
4. 在状态筛选中选择"失败" → 列表仅展示失败的调用记录
5. 点击某行调用 ID → 跳转至调用详情页
6. 点击「导出」按钮 → 选择导出格式（CSV / Excel）→ 下载导出文件

**反馈**：

- 列表为空：Empty 组件 + "所选条件下暂无调用记录"
- 数据加载中：表格 Skeleton
- 导出成功：Toast 提示"导出成功" + 浏览器触发下载

#### 3.5.2 调用详情

**入口**：调用记录列表 → 点击「查看详情」/ 调用 ID

**操作步骤**：

1. 点击调用记录的「查看详情」→ 进入调用详情页
2. 详情页展示以下信息区块：
   - **基本信息**：调用 ID、Trace ID、工具名称、Server/Client 名称、调用方、调用时间、总耗时
   - **请求信息**：JSON-RPC 请求报文（格式化 + 语法高亮）、请求参数表单视图
   - **响应信息**：JSON-RPC 响应报文（格式化 + 语法高亮）、响应状态码
   - **执行链路**：调用链路可视化（如：外部 Client → TECH-GW → TECH-MCP → TECH-ONT → 返回），每段链路展示耗时
   - **Token 消耗**：如涉及 LLM 调用，展示 Prompt Token / Completion Token / 总 Token + 成本估算
   - **错误信息**（失败时）：错误类型、错误消息、错误堆栈、错误分类（参数错误/权限不足/超时/服务异常/工具执行错误）
3. 点击「复制 Trace ID」→ 复制到剪贴板 → 可在 TECH-OBS 可观测性中追踪完整链路
4. 点击「重新执行」→ 跳转至 MCP 调试器，自动填充该次调用的参数
5. 点击「查看日志」→ 弹出日志查看弹窗，展示该调用的服务端日志（关联 Trace ID）

**反馈**：

- 详情加载中：Skeleton 骨架屏
- 链路数据缺失：执行链路区域提示"链路数据不完整，可能由于 Trace 采样未覆盖"

#### 3.5.3 Token 统计分析

**入口**：调用审计 → 点击「Token 统计」Tab 页签

**操作步骤**：

1. 点击「Token 统计」Tab → 展示 Token 消耗分析页面
2. 选择时间范围 → 页面刷新统计图表
3. 图表区域包含：
   - **Token 消耗趋势图**：折线图，按日/小时展示 Token 消耗趋势，支持切换 Prompt Token / Completion Token / 总 Token
   - **工具 Token 排行**：柱状图，展示 Top 10 Token 消耗工具
   - **调用方 Token 分布**：饼图，按调用方类型展示 Token 消耗占比
   - **Token 明细表**：表格展示每个工具的调用次数、平均 Token、总 Token、成本估算
4. 鼠标悬停图表数据点 → 显示 Tooltip 详情（日期、Token 数、调用次数）
5. 点击图表中某个工具 → 下钻展示该工具的 Token 消耗趋势

**反馈**：

- 无数据：图表区域显示"所选时间范围内暂无 Token 消耗数据"

#### 3.5.4 错误追踪

**入口**：调用审计 → 点击「错误追踪」Tab 页签

**操作步骤**：

1. 点击「错误追踪」Tab → 展示错误分析页面
2. 页面展示：
   - **错误趋势图**：折线图，按日展示错误数和错误率趋势
   - **错误分类统计**：饼图 + 表格，按错误类型分组统计（参数错误/权限不足/超时/服务异常/工具执行错误/连接错误）
   - **错误工具排行**：柱状图，展示错误数 Top 10 工具
   - **近期错误列表**：表格展示最近的错误调用记录（调用 ID、工具名称、错误类型、错误消息、时间、操作）
3. 点击错误分类饼图中的某个分类 → 下钻展示该分类下的错误列表
4. 点击错误列表中的「查看详情」→ 跳转至调用详情页
5. 点击「设置告警规则」→ 弹出告警规则配置弹窗 → 配置错误率阈值和通知方式 → 保存

**告警规则配置字段**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 规则名称 | Input | 是 | 告警规则名称 |
| 监控范围 | Select | 是 | 全部工具 / 指定工具 |
| 触发条件 | Select | 是 | 错误率超过 X% / 错误数超过 X 次 / 连续失败 X 次 |
| 阈值 | InputNumber | 是 | 根据触发条件动态展示（百分比/次数） |
| 统计窗口 | Select | 是 | 近 5 分钟 / 近 15 分钟 / 近 1 小时 / 近 24 小时 |
| 通知方式 | CheckboxGroup | 是 | 站内信 / 邮件 / Webhook |
| Webhook URL | Input | 是（Webhook 时） | 告警通知的 Webhook 地址 |
| 是否启用 | Switch | 是 | 默认开启 |

**反馈**：

- 告警规则保存成功：Toast 提示"告警规则已保存"
- 告警触发：站内信/邮件/Webhook 发送告警通知，包含错误摘要和详情链接

---

### 3.6 权限控制

控制哪些用户/应用可以调用哪些 MCP 工具，采用 RBAC（基于角色）+ ABAC（基于属性）混合权限模型。

#### 3.6.1 权限规则列表

**入口**：左侧导航 → 「权限控制」→ 默认进入权限规则列表页

**页面布局**：

- 顶部操作栏：搜索框（按规则名称搜索）、状态筛选（全部/启用/禁用）、主体类型筛选（全部/用户/应用/角色）、「创建权限规则」按钮
- 列表表格：规则名称、主体类型、主体名称、工具范围、权限类型（允许/拒绝）、优先级、状态（启用=绿色/禁用=灰色）、创建时间、操作列
- 操作列按钮：「编辑」、「启用」/「禁用」、「删除」（带二次确认）
- 底部：分页器

**操作步骤**：

1. 进入权限控制页面，系统加载权限规则列表
2. 在搜索框输入规则名称 → 列表筛选
3. 点击主体类型筛选选择"应用" → 列表仅展示应用类型的权限规则
4. 点击操作列「禁用」→ 规则状态变为"禁用" → Toast 提示"规则已禁用"
5. 点击操作列「删除」→ 确认对话框 → 确认后删除规则

**反馈**：

- 列表为空：Empty 组件 + "暂无权限规则，点击「创建权限规则」开始配置"
- 操作成功：Toast 提示 + 列表刷新

#### 3.6.2 创建权限规则

**入口**：权限规则列表页 → 点击「创建权限规则」按钮

**操作步骤**：

1. 点击「创建权限规则」→ 弹出创建规则抽屉面板（Drawer，宽度 640px）
2. 填写表单字段（见下方）
3. 点击「保存」→ 表单校验 → 保存成功 → 抽屉关闭 → 列表刷新 → Toast 提示"权限规则创建成功"
4. 点击「取消」→ 关闭抽屉

**表单字段详情**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 规则名称 | Input | 是 | 唯一标识，1-64 字符 |
| 描述 | TextArea | 否 | 规则用途说明 |
| 主体类型 | RadioGroup | 是 | 用户 / 应用 / 角色 |
| 主体选择 | Select (multi) | 是 | 根据主体类型联动：用户→用户选择器，应用→应用选择器，角色→角色选择器 |
| 工具范围 | RadioGroup + Select | 是 | 全部工具 / 指定工具（多选） / 按分类选择 |
| 权限类型 | RadioGroup | 是 | 允许（白名单）/ 拒绝（黑名单） |
| 优先级 | InputNumber | 是 | 数值越大优先级越高（1-100），默认 50。当多条规则冲突时，优先级高的生效；相同优先级时拒绝优先 |
| 条件表达式（ABAC） | CodeEditor | 否 | 属性条件表达式，如 `request.time >= '09:00' && request.time <= '18:00'` |
| 生效时间 | DateRangePicker | 否 | 规则生效时间范围，留空表示永久有效 |
| 是否启用 | Switch | 是 | 默认开启 |

**权限决策逻辑**：

1. 当一个调用请求到达时，系统查找该主体匹配的所有权限规则
2. 按优先级排序，优先级数值大的规则优先评估
3. 如最高优先级的规则为"允许" → 允许调用
4. 如最高优先级的规则为"拒绝" → 拒绝调用
5. 如同一优先级存在允许和拒绝规则 → 拒绝优先
6. 如无匹配规则 → 默认拒绝（安全优先）

**反馈**：

- 主体未选择：主体选择字段提示"请至少选择一个主体"
- 工具范围未选择：工具范围字段提示"请选择工具范围"
- 保存成功：Toast 提示 + 列表刷新

#### 3.6.3 用户-工具映射视图

**入口**：权限控制 → 点击「用户-工具映射」Tab 页签

**操作步骤**：

1. 点击「用户-工具映射」Tab → 展示用户与工具的权限映射矩阵
2. 页面左侧为用户列表（可搜索），右侧为工具列表
3. 矩阵视图中，行=用户，列=工具，交叉单元格显示权限状态（绿色对勾=允许 / 红色叉号=拒绝 / 灰色横线=无规则）
4. 在用户搜索框输入用户名 → 筛选用户列表
5. 点击矩阵单元格 → 弹出权限详情弹窗 → 展示该用户对该工具的所有匹配规则及最终决策结果
6. 点击「导出映射」→ 导出当前映射矩阵为 Excel 文件

**反馈**：

- 用户或工具过多时：矩阵区域支持横向/纵向滚动，固定首行首列
- 导出成功：Toast 提示 + 下载文件

#### 3.6.4 应用-工具映射视图

**入口**：权限控制 → 点击「应用-工具映射」Tab 页签

**操作步骤**：

1. 点击「应用-工具映射」Tab → 展示应用与工具的权限映射矩阵
2. 页面布局与用户-工具映射类似，行为已注册的外部应用，列为工具
3. 点击应用名称 → 展开该应用的详细权限配置面板
4. 在展开面板中点击「添加工具授权」→ 弹出工具选择弹窗 → 勾选工具 → 点击「确认」→ 为该应用添加工具授权
5. 点击工具授权行的「撤销」→ 确认后撤销该工具授权
6. 点击「生成应用 API Key」→ 弹出 API Key 生成弹窗 → 展示新生成的 API Key（仅展示一次）→ 点击「复制」→ 复制到剪贴板

**应用 API Key 生成弹窗字段**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| Key 名称 | Input | 是 | API Key 标识名称 |
| 关联应用 | Select | 是 | 选择已注册的外部应用 |
| 有效期 | Select | 是 | 7 天 / 30 天 / 90 天 / 365 天 / 永久 |
| 权限范围 | Select (multi) | 是 | 该 Key 可调用的工具列表 |
| 描述 | TextArea | 否 | Key 用途说明 |

**反馈**：

- API Key 生成成功：弹窗展示 Key 值（明文，仅展示一次）+ 复制按钮 + 警告提示"请妥善保存，关闭后将无法再次查看"
- 撤销授权成功：Toast 提示"工具授权已撤销"

---

### 3.7 外部应用对接

为外部 AI IDE（Cursor、GitHub Copilot、Claude Code、Claude Desktop 等）提供 MCP 连接配置生成、连接管理与状态监控。

#### 3.7.1 IDE 配置指引

**入口**：左侧导航 → 「外部应用对接」→ 默认进入 IDE 配置指引页

**页面布局**：

- 顶部：支持的 IDE 类型卡片选择区（Cursor / GitHub Copilot / Claude Code / Claude Desktop / 通用 MCP Client）
- 下方：选中 IDE 后展示对应的配置指引和配置生成区

**操作步骤**：

1. 进入外部应用对接页面，顶部展示支持的 IDE 类型卡片
2. 点击 IDE 类型卡片（如"Cursor"）→ 下方展示该 IDE 的配置指引
3. 配置指引区域包含：
   - **配置说明**：该 IDE 如何接入 MCP Server 的简要说明
   - **Server 选择**：下拉选择已创建且运行中的 MCP Server
   - **应用选择**：下拉选择已注册的外部应用（用于权限关联），或选择"创建新应用"
   - **认证方式**：展示该 Server 的认证方式和需要提供的凭据
   - **「生成配置」按钮**
4. 选择 Server 和应用后 → 点击「生成配置」→ 系统生成该 IDE 的 MCP 配置内容
5. 配置内容区域展示：
   - **配置文件内容**（代码块，带语法高亮和复制按钮）
   - **配置文件路径**（该 IDE 的 MCP 配置文件路径说明）
   - **手动配置步骤**（步骤化的操作指引）
6. 点击「复制配置」→ 配置内容复制到剪贴板 → Toast 提示"配置已复制到剪贴板"
7. 点击「下载配置文件」→ 下载为 JSON 文件

**各 IDE 配置模板示例**：

**Cursor**（配置文件路径：`~/.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "mate-platform": {
      "url": "http://mcp.metaplatform.example.com:8080/sse",
      "headers": {
        "Authorization": "Bearer {{API_KEY}}"
      }
    }
  }
}
```

**Claude Desktop**（配置文件路径：`~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "mate-platform": {
      "type": "sse",
      "url": "http://mcp.metaplatform.example.com:8080/sse",
      "headers": {
        "Authorization": "Bearer {{API_KEY}}"
      }
    }
  }
}
```

**Claude Code**（命令行配置）：

```bash
claude mcp add mate-platform --transport sse http://mcp.metaplatform.example.com:8080/sse --header "Authorization: Bearer {{API_KEY}}"
```

**GitHub Copilot**（配置文件路径：`.vscode/mcp.json`）：

```json
{
  "servers": {
    "mate-platform": {
      "type": "sse",
      "url": "http://mcp.metaplatform.example.com:8080/sse",
      "headers": {
        "Authorization": "Bearer {{API_KEY}}"
      }
    }
  }
}
```

**通用 MCP Client**（展示标准 MCP 连接信息）：

```json
{
  "transport": "http-sse",
  "endpoint": "http://mcp.metaplatform.example.com:8080/sse",
  "auth": {
    "type": "bearer",
    "token": "{{API_KEY}}"
  },
  "metadata": {
    "name": "Mate Platform MCP",
    "version": "1.0.0"
  }
}
```

**反馈**：

- 无可用 Server：Server 选择下拉为空 + 提示"暂无运行中的 MCP Server，请先创建并启动 Server"
- 生成成功：配置内容区域展示 + 复制/下载按钮可用

#### 3.7.2 连接管理

**入口**：外部应用对接 → 点击「连接管理」Tab 页签

**操作步骤**：

1. 点击「连接管理」Tab → 展示外部应用连接列表
2. 点击「注册外部应用」按钮 → 弹出注册应用表单
3. 填写应用信息 → 点击「保存」→ 应用注册成功
4. 在连接列表中查看每个应用的连接状态
5. 点击应用行操作列「管理 API Key」→ 弹出 API Key 管理面板 → 展示该应用的所有 API Key 列表（Key 名称、创建时间、最后使用时间、状态）→ 可创建新 Key 或撤销 Key
6. 点击应用行操作列「查看授权工具」→ 弹出工具授权列表 → 可添加/撤销工具授权
7. 点击应用行操作列「编辑」→ 弹出编辑应用表单 → 修改应用信息
8. 点击应用行操作列「删除」→ 确认对话框 → 确认后删除应用及其所有 API Key 和权限规则

**注册外部应用表单字段**：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 应用名称 | Input | 是 | 唯一标识，1-64 字符 |
| 应用类型 | Select | 是 | Cursor / GitHub Copilot / Claude Code / Claude Desktop / 自定义 |
| 描述 | TextArea | 否 | 应用用途说明 |
| 关联用户 | Select | 是 | 应用归属的用户 |
| 回调 URL | Input | 否 | OAuth2 回调地址（如使用 OAuth2 认证） |
| IP 白名单 | InputArray | 否 | 允许调用的 IP 地址列表，留空表示不限 |
| 速率限制 | InputNumber | 否 | 每分钟最大调用次数，默认 60 |

**连接列表表格字段**：

| 列名 | 说明 |
|---|---|
| 应用名称 | 应用显示名称 |
| 应用类型 | IDE 类型图标 + 名称 |
| API Key 数 | 该应用关联的 API Key 数量 |
| 授权工具数 | 该应用已授权的工具数量 |
| 连接状态 | 在线（绿色）/ 离线（灰色） |
| 最后连接时间 | 最近一次连接时间 |
| 今日调用次数 | 今日该应用的调用次数 |
| 操作 | 管理 API Key / 查看授权工具 / 编辑 / 删除 |

**反馈**：

- 应用名称重复：字段提示"应用名称已存在"
- 删除成功：Toast 提示"应用已删除，关联的 API Key 和权限规则已一并清除"

#### 3.7.3 连接状态监控

**入口**：外部应用对接 → 点击「连接状态」Tab 页签

**操作步骤**：

1. 点击「连接状态」Tab → 展示连接状态监控面板
2. 面板顶部展示统计卡片：
   - 在线应用数 / 总注册应用数
   - 今日活跃连接数
   - 今日连接成功率
   - 当前 SSE 活跃连接数
3. 下方展示活跃连接列表（实时更新的表格）：
   - 应用名称、连接 ID、连接建立时间、持续时间、客户端 IP、最后活动时间、状态
4. 点击连接行「查看详情」→ 弹出连接详情弹窗 → 展示该连接的会话信息（已调用的工具列表、调用次数、Token 消耗）
5. 点击连接行「强制断开」→ 确认对话框 → 确认后断开该 SSE 连接
6. 页面每 10 秒自动刷新活跃连接列表
7. 点击「暂停自动刷新」→ 停止自动刷新 → 按钮变为「恢复自动刷新」

**反馈**：

- 无活跃连接：列表区域显示"当前无活跃连接"
- 强制断开成功：Toast 提示"连接已断开" + 列表刷新

---

## 4. 增量交付计划

### 4.1 交付阶段总览

| 阶段 | 周期 | 核心交付 | 验收标准 |
|---|---|---|---|
| P0 - 基础框架 | 3 周 | MCP Server 管理（基础）、工具注册中心（基础）、MCP 调试器（基础） | 能注册工具、创建 Server、在调试器中测试工具调用 |
| P1 - 核心能力 | 3 周 | MCP Server 完整管理（Resources/Prompts）、MCP Client 管理、权限控制（基础） | 能完整管理 Server/Client、配置基础权限规则 |
| P2 - 运营治理 | 2 周 | 调用审计（完整）、Token 统计、错误追踪、告警 | 能查看调用记录、Token 消耗、错误分析 |
| P3 - 生态对接 | 2 周 | 外部应用对接（IDE 配置、连接管理、状态监控）、权限控制（ABAC） | 能生成 IDE 配置、管理外部应用连接 |
| P4 - 优化增强 | 2 周 | 工具版本管理、权限矩阵视图、审计导出、性能优化 | 完整的版本管理和权限可视化 |

### 4.2 P0 - 基础框架（3 周）

**目标**：打通 MCP 工具注册 -> Server 创建 -> 调试器测试的核心链路。

**交付内容**：

| 序号 | 功能点 | 说明 |
|---|---|---|
| 1 | 工具注册中心 - 工具列表 | 卡片/表格视图、搜索、分类筛选 |
| 2 | 工具注册中心 - 注册工具 | 基本信息填写、JSON Schema 编辑器（可视化模式）、保存为草稿/发布 |
| 3 | 工具注册中心 - 编辑工具 | 编辑工具信息、保存 |
| 4 | 工具注册中心 - 工具分类管理 | 预设分类、新增/编辑/删除分类 |
| 5 | MCP Server 管理 - Server 列表 | 列表展示、搜索、状态筛选 |
| 6 | MCP Server 管理 - 创建 Server | 表单创建、HTTP SSE 传输、API Key 认证 |
| 7 | MCP Server 管理 - 配置 Tools | 添加/移除工具到 Server |
| 8 | MCP Server 管理 - 启停 | 启动/停止/重启 Server |
| 9 | MCP 调试器 - 基础功能 | 连接源选择、工具选择、参数填写、执行调用、查看响应 |

**验收标准**：

- 能注册一个 `ontology_query` 工具并定义 Schema
- 能创建一个 MCP Server 并将工具暴露
- 能在调试器中选择工具、填写参数、执行调用并查看响应
- Server 启停功能正常

### 4.3 P1 - 核心能力（3 周）

**目标**：完成 Server/Client 双向管理能力，建立基础权限控制。

**交付内容**：

| 序号 | 功能点 | 说明 |
|---|---|---|
| 1 | MCP Server 管理 - 配置 Resources | 添加/移除资源、资源类型支持 |
| 2 | MCP Server 管理 - 配置 Prompts | 添加/移除 Prompt、参数定义、角色模板导入 |
| 3 | MCP Server 管理 - 状态监控 | 连接状态面板、连接数统计 |
| 4 | MCP Client 管理 - 连接列表 | 列表展示、搜索、状态筛选 |
| 5 | MCP Client 管理 - 添加连接 | HTTP SSE / stdio、认证配置、测试连接 |
| 6 | MCP Client 管理 - 连接详情 | 工具发现、工具 Schema 查看、同步到注册中心 |
| 7 | 权限控制 - 规则列表 | 列表展示、搜索、启用/禁用 |
| 8 | 权限控制 - 创建规则 | 主体选择、工具范围、权限类型、优先级 |

**验收标准**：

- 能在 Server 中添加 Resources 和 Prompts
- 能添加第三方 MCP Server 连接并测试连接
- 能将第三方工具同步到工具注册中心
- 能创建权限规则并控制工具调用权限

### 4.4 P2 - 运营治理（2 周）

**目标**：建立完整的调用审计和监控能力。

**交付内容**：

| 序号 | 功能点 | 说明 |
|---|---|---|
| 1 | 调用审计 - 调用记录列表 | 统计卡片、筛选、分页、导出 |
| 2 | 调用审计 - 调用详情 | 基本信息、请求/响应报文、执行链路、Token 消耗、错误信息 |
| 3 | 调用审计 - Token 统计 | 趋势图、排行、分布、明细表 |
| 4 | 调用审计 - 错误追踪 | 错误趋势、分类统计、工具排行、错误列表 |
| 5 | 调用审计 - 告警规则 | 规则配置、通知方式 |

**验收标准**：

- 调用记录完整记录所有 MCP 工具调用
- Token 统计能按工具、时间、调用方维度分析
- 错误追踪能分类统计和下钻分析
- 告警规则能按配置触发通知

### 4.5 P3 - 生态对接（2 周）

**目标**：完成外部 AI IDE 对接，支持 Cursor/Copilot/Claude Code 等接入。

**交付内容**：

| 序号 | 功能点 | 说明 |
|---|---|---|
| 1 | 外部应用对接 - IDE 配置指引 | Cursor/Claude Desktop/Claude Code/Copilot/通用配置生成 |
| 2 | 外部应用对接 - 连接管理 | 应用注册、API Key 管理、工具授权 |
| 3 | 外部应用对接 - 连接状态监控 | 活跃连接列表、强制断开、实时刷新 |
| 4 | 权限控制 - ABAC | 条件表达式、生效时间 |
| 5 | 权限控制 - 用户-工具映射 | 权限矩阵视图 |

**验收标准**：

- 能生成 Cursor/Claude Code 等 IDE 的 MCP 配置并成功连接
- 能注册外部应用、生成 API Key、管理工具授权
- 能监控活跃连接状态
- ABAC 条件表达式能正确生效

### 4.6 P4 - 优化增强（2 周）

**目标**：完善版本管理、权限可视化和性能优化。

**交付内容**：

| 序号 | 功能点 | 说明 |
|---|---|---|
| 1 | 工具注册中心 - 版本管理 | 版本历史、差异对比、版本回滚 |
| 2 | 权限控制 - 应用-工具映射 | 权限矩阵视图、批量授权 |
| 3 | 调用审计 - 增强导出 | CSV/Excel 导出、自定义字段选择 |
| 4 | MCP 调试器 - 增强 | 历史记录持久化、断点调试 |
| 5 | 性能优化 | 列表分页优化、缓存策略、SSE 连接池 |

**验收标准**：

- 工具版本管理完整可用，支持回滚
- 权限矩阵视图支持用户和应用两个维度
- 审计导出功能完整
- 调试器历史记录可持久化保存

---

## 5. 依赖关系

### 5.1 上游依赖（本模块依赖的技术服务）

| 依赖服务 | 依赖内容 | 依赖说明 |
|---|---|---|
| TECH-MCP | MCP 协议适配 | 底层 MCP Server/Client 通信实现，APP-MCPHUB 通过 TECH-MCP 的管理 API 进行配置 |
| TECH-ONT | Ontology 查询能力 | 工具注册中心的 Ontology 类工具需调用 TECH-ONT 接口 |
| TECH-RAG | 知识库检索能力 | 工具注册中心的 RAG 类工具需调用 TECH-RAG 接口 |
| TECH-ACTION | Action 执行能力 | 工具注册中心的 Action 类工具需调用 TECH-ACTION 接口 |
| TECH-IAM | 权限认证 | 用户身份认证、RBAC/ABAC 权限校验 |
| TECH-GW | API 网关 | 外部 MCP Client 通过 TECH-GW 接入，限流、路由 |
| TECH-OBS | 可观测性 | 调用审计的 Trace 链路、日志关联 |
| TECH-LLMGW | LLM Gateway | Token 消耗统计的数据来源 |
| TECH-MSG | 消息队列 | 告警通知的异步发送 |

### 5.2 下游消费（依赖本模块的消费者）

| 消费方 | 消费内容 | 消费说明 |
|---|---|---|
| 外部 MCP Client | MCP Tools/Resources/Prompts | Cursor/Copilot/Claude Code 等通过 MCP 协议调用平台暴露的能力 |
| APP-SUPERAI | MCP Client 连接配置 | 超级 AI 通过 MCP Client 调用第三方 MCP Server 工具 |
| TECH-AGENT | 工具注册中心 | Agent 框架从工具注册中心获取可用工具列表 |
| 平台管理员 | 调用审计、权限管理 | 管理员通过本模块查看调用统计和配置权限 |

### 5.3 依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│                     APP-MCPHUB                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Server   │  │  Client   │  │  工具    │  │ 调试器  │ │
│  │  管理     │  │  管理     │  │  注册    │  │        │ │
│  └─────┬────┘  └─────┬────┘  └────┬─────┘  └───┬────┘ │
│        │             │            │             │      │
│  ┌─────┴─────────────┴────────────┴─────────────┴────┐ │
│  │              权限控制  |  调用审计  |  外部对接      │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ TECH-MCP │    │ TECH-IAM │    │ TECH-OBS │
    └─────┬────┘    └──────────┘    └──────────┘
          │
    ┌─────┴──────────────────────────┐
    ▼          ▼          ▼          ▼
┌────────┐┌────────┐┌────────┐┌──────────┐
│TECH-ONT││TECH-RAG││TECH-   ││TECH-LLMGW│
│        ││        ││ACTION  ││          │
└────────┘└────────┘└────────┘└──────────┘
```

---

## 6. API 接口概要

### 6.1 MCP Server 管理

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 获取 Server 列表 | GET | `/api/v1/mcp/servers` | 分页查询，支持搜索和筛选 |
| 创建 Server | POST | `/api/v1/mcp/servers` | 创建 MCP Server 实例 |
| 获取 Server 详情 | GET | `/api/v1/mcp/servers/{serverId}` | 获取 Server 详细信息 |
| 更新 Server | PUT | `/api/v1/mcp/servers/{serverId}` | 更新 Server 配置 |
| 删除 Server | DELETE | `/api/v1/mcp/servers/{serverId}` | 删除 Server |
| 启动 Server | POST | `/api/v1/mcp/servers/{serverId}/start` | 启动 Server 实例 |
| 停止 Server | POST | `/api/v1/mcp/servers/{serverId}/stop` | 停止 Server 实例 |
| 重启 Server | POST | `/api/v1/mcp/servers/{serverId}/restart` | 重启 Server 实例 |
| 获取 Server Tools | GET | `/api/v1/mcp/servers/{serverId}/tools` | 获取 Server 暴露的工具列表 |
| 添加 Server Tools | POST | `/api/v1/mcp/servers/{serverId}/tools` | 批量添加工具到 Server |
| 移除 Server Tool | DELETE | `/api/v1/mcp/servers/{serverId}/tools/{toolId}` | 从 Server 移除工具 |
| 获取 Server Resources | GET | `/api/v1/mcp/servers/{serverId}/resources` | 获取 Server 暴露的资源列表 |
| 添加 Server Resource | POST | `/api/v1/mcp/servers/{serverId}/resources` | 添加资源到 Server |
| 移除 Server Resource | DELETE | `/api/v1/mcp/servers/{serverId}/resources/{resourceId}` | 从 Server 移除资源 |
| 获取 Server Prompts | GET | `/api/v1/mcp/servers/{serverId}/prompts` | 获取 Server 暴露的 Prompt 列表 |
| 添加 Server Prompt | POST | `/api/v1/mcp/servers/{serverId}/prompts` | 添加 Prompt 到 Server |
| 移除 Server Prompt | DELETE | `/api/v1/mcp/servers/{serverId}/prompts/{promptId}` | 从 Server 移除 Prompt |
| 获取连接状态 | GET | `/api/v1/mcp/servers/{serverId}/connections` | 获取 Server 当前连接状态 |

### 6.2 MCP Client 管理

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 获取连接列表 | GET | `/api/v1/mcp/clients` | 分页查询第三方 Server 连接 |
| 添加连接 | POST | `/api/v1/mcp/clients` | 添加第三方 MCP Server 连接 |
| 获取连接详情 | GET | `/api/v1/mcp/clients/{clientId}` | 获取连接详细信息 |
| 更新连接 | PUT | `/api/v1/mcp/clients/{clientId}` | 更新连接配置 |
| 删除连接 | DELETE | `/api/v1/mcp/clients/{clientId}` | 删除连接 |
| 测试连接 | POST | `/api/v1/mcp/clients/{clientId}/test` | 测试连接是否可用 |
| 获取可用工具 | GET | `/api/v1/mcp/clients/{clientId}/tools` | 获取第三方 Server 暴露的工具列表 |
| 刷新工具列表 | POST | `/api/v1/mcp/clients/{clientId}/tools/refresh` | 重新拉取工具列表 |
| 同步工具到注册中心 | POST | `/api/v1/mcp/clients/{clientId}/tools/sync` | 将第三方工具同步到工具注册中心 |

### 6.3 工具注册中心

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 获取工具列表 | GET | `/api/v1/mcp/tools` | 分页查询，支持搜索/分类/状态筛选 |
| 注册工具 | POST | `/api/v1/mcp/tools` | 注册新工具 |
| 获取工具详情 | GET | `/api/v1/mcp/tools/{toolId}` | 获取工具详细信息 |
| 更新工具 | PUT | `/api/v1/mcp/tools/{toolId}` | 更新工具（创建新版本） |
| 删除工具 | DELETE | `/api/v1/mcp/tools/{toolId}` | 删除工具 |
| 发布工具 | POST | `/api/v1/mcp/tools/{toolId}/publish` | 发布草稿工具 |
| 下线工具 | POST | `/api/v1/mcp/tools/{toolId}/unpublish` | 下线已发布工具 |
| 获取工具版本列表 | GET | `/api/v1/mcp/tools/{toolId}/versions` | 获取工具版本历史 |
| 获取版本差异 | GET | `/api/v1/mcp/tools/{toolId}/versions/diff` | 对比两个版本的差异 |
| 回滚版本 | POST | `/api/v1/mcp/tools/{toolId}/versions/{versionId}/rollback` | 回滚到指定版本 |
| 设为当前版本 | PUT | `/api/v1/mcp/tools/{toolId}/current-version` | 设定对外暴露的版本 |
| 获取分类树 | GET | `/api/v1/mcp/tool-categories` | 获取工具分类树 |
| 创建分类 | POST | `/api/v1/mcp/tool-categories` | 新增工具分类 |
| 更新分类 | PUT | `/api/v1/mcp/tool-categories/{categoryId}` | 编辑分类 |
| 删除分类 | DELETE | `/api/v1/mcp/tool-categories/{categoryId}` | 删除分类 |
| 获取工具调用统计 | GET | `/api/v1/mcp/tools/{toolId}/stats` | 获取工具调用统计信息 |

### 6.4 MCP 调试器

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 执行工具调用 | POST | `/api/v1/mcp/debugger/call` | 执行一次工具调用并返回结果 |
| 获取调用历史 | GET | `/api/v1/mcp/debugger/history` | 获取当前会话的调用历史 |
| 获取工具示例参数 | GET | `/api/v1/mcp/tools/{toolId}/example` | 获取工具的示例参数 |

### 6.5 调用审计

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 获取调用记录列表 | GET | `/api/v1/mcp/audit/calls` | 分页查询调用记录，支持筛选 |
| 获取调用详情 | GET | `/api/v1/mcp/audit/calls/{callId}` | 获取调用详细信息 |
| 获取调用统计概览 | GET | `/api/v1/mcp/audit/stats/overview` | 获取统计卡片数据 |
| 获取 Token 统计 | GET | `/api/v1/mcp/audit/stats/tokens` | Token 消耗统计分析 |
| 获取错误统计 | GET | `/api/v1/mcp/audit/stats/errors` | 错误分类统计分析 |
| 导出调用记录 | POST | `/api/v1/mcp/audit/export` | 导出调用记录（CSV/Excel） |
| 获取告警规则列表 | GET | `/api/v1/mcp/audit/alerts` | 获取告警规则列表 |
| 创建告警规则 | POST | `/api/v1/mcp/audit/alerts` | 创建告警规则 |
| 更新告警规则 | PUT | `/api/v1/mcp/audit/alerts/{alertId}` | 更新告警规则 |
| 删除告警规则 | DELETE | `/api/v1/mcp/audit/alerts/{alertId}` | 删除告警规则 |

### 6.6 权限控制

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 获取权限规则列表 | GET | `/api/v1/mcp/permissions/rules` | 分页查询权限规则 |
| 创建权限规则 | POST | `/api/v1/mcp/permissions/rules` | 创建权限规则 |
| 更新权限规则 | PUT | `/api/v1/mcp/permissions/rules/{ruleId}` | 更新权限规则 |
| 删除权限规则 | DELETE | `/api/v1/mcp/permissions/rules/{ruleId}` | 删除权限规则 |
| 启用/禁用规则 | PUT | `/api/v1/mcp/permissions/rules/{ruleId}/status` | 启用或禁用权限规则 |
| 获取用户-工具映射 | GET | `/api/v1/mcp/permissions/matrix/users` | 获取用户-工具权限矩阵 |
| 获取应用-工具映射 | GET | `/api/v1/mcp/permissions/matrix/apps` | 获取应用-工具权限矩阵 |
| 检查权限 | POST | `/api/v1/mcp/permissions/check` | 检查指定主体对指定工具的权限 |

### 6.7 外部应用对接

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 获取应用列表 | GET | `/api/v1/mcp/apps` | 获取注册的外部应用列表 |
| 注册应用 | POST | `/api/v1/mcp/apps` | 注册外部应用 |
| 更新应用 | PUT | `/api/v1/mcp/apps/{appId}` | 更新应用信息 |
| 删除应用 | DELETE | `/api/v1/mcp/apps/{appId}` | 删除应用 |
| 生成 IDE 配置 | POST | `/api/v1/mcp/apps/{appId}/config` | 生成指定 IDE 的 MCP 配置 |
| 获取 API Key 列表 | GET | `/api/v1/mcp/apps/{appId}/api-keys` | 获取应用的 API Key 列表 |
| 生成 API Key | POST | `/api/v1/mcp/apps/{appId}/api-keys` | 生成新 API Key |
| 撤销 API Key | DELETE | `/api/v1/mcp/apps/{appId}/api-keys/{keyId}` | 撤销 API Key |
| 获取授权工具列表 | GET | `/api/v1/mcp/apps/{appId}/tools` | 获取应用已授权的工具 |
| 添加工具授权 | POST | `/api/v1/mcp/apps/{appId}/tools` | 为应用添加工具授权 |
| 撤销工具授权 | DELETE | `/api/v1/mcp/apps/{appId}/tools/{toolId}` | 撤销应用的工具授权 |
| 获取活跃连接 | GET | `/api/v1/mcp/connections/active` | 获取当前活跃连接列表 |
| 强制断开连接 | DELETE | `/api/v1/mcp/connections/{connectionId}` | 强制断开 SSE 连接 |

---

## 7. 数据模型概要

### 7.1 核心实体关系

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  mcp_server  │────<│ server_tool  │>────│    tool      │
│              │     │ (关联表)      │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
       │                                        │
       │              ┌──────────────┐          │
       └────────────<│ server_      │>─────────┘
                      │ resource    │
                      └──────────────┘
       │              ┌──────────────┐
       └────────────<│ server_      │
                      │ prompt      │
                      └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  mcp_client  │────<│ client_tool  │>────│    tool      │
│  (第三方连接) │     │ (发现工具)    │     │  (同步来源)  │
└──────────────┘     └──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ external_app │────<│  api_key     │     │ permission   │
│  (外部应用)   │     │              │     │  _rule       │
└──────┬───────┘     └──────────────┘     └──────┬───────┘
       │                                          │
       └────────────<│ app_tool_auth │>───────────┘
                      └──────────────┘

┌──────────────┐
│  call_audit  │──── Trace ID 关联 TECH-OBS
│  (调用记录)   │
└──────────────┘

┌──────────────┐
│ alert_rule   │
│ (告警规则)    │
└──────────────┘
```

### 7.2 数据表概要

#### mcp_server（MCP Server 实例）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(64) | Server 名称（唯一） |
| description | TEXT | 描述 |
| transport_type | VARCHAR(16) | 传输方式：HTTP_SSE / STDIO |
| listen_address | VARCHAR(64) | 监听地址 |
| listen_port | INTEGER | 监听端口 |
| sse_endpoint | VARCHAR(128) | SSE 端点路径 |
| auth_type | VARCHAR(16) | 认证方式：NONE / API_KEY / OAUTH2 |
| auth_config | JSONB | 认证配置（加密存储） |
| status | VARCHAR(16) | 状态：STOPPED / STARTING / RUNNING / ERROR |
| max_concurrency | INTEGER | 最大并发数 |
| timeout_seconds | INTEGER | 超时时间 |
| tags | JSONB | 标签数组 |
| created_by | UUID | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### tool（工具注册）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(64) | 工具名称（唯一，snake_case） |
| display_name | VARCHAR(128) | 显示名称 |
| description | TEXT | 工具描述 |
| category_id | UUID | 分类 ID（外键） |
| source | VARCHAR(16) | 来源：BUILTIN / CUSTOM / SYNCED |
| impl_type | VARCHAR(32) | 实现类型：ONTOLOGY / RAG / ACTION / HTTP / SCRIPT |
| impl_config | JSONB | 实现配置（关联资源 ID、HTTP 端点等） |
| input_schema | JSONB | 输入参数 JSON Schema |
| output_schema | JSONB | 输出结果 JSON Schema |
| current_version | INTEGER | 当前版本号 |
| status | VARCHAR(16) | 状态：DRAFT / PUBLISHED / OFFLINE |
| timeout_seconds | INTEGER | 超时时间 |
| is_idempotent | BOOLEAN | 是否幂等 |
| tags | JSONB | 标签数组 |
| call_count | BIGINT | 累计调用次数 |
| last_called_at | TIMESTAMP | 最后调用时间 |
| created_by | UUID | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### tool_version（工具版本历史）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| tool_id | UUID | 工具 ID（外键） |
| version | INTEGER | 版本号 |
| input_schema | JSONB | 该版本的输入 Schema |
| output_schema | JSONB | 该版本的输出 Schema |
| description | TEXT | 该版本的工具描述 |
| impl_config | JSONB | 该版本的实现配置 |
| change_log | TEXT | 变更说明 |
| created_by | UUID | 创建人 |
| created_at | TIMESTAMP | 创建时间 |

#### mcp_client（第三方 MCP Server 连接）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(64) | 连接名称（唯一） |
| description | TEXT | 描述 |
| transport_type | VARCHAR(16) | 传输方式：HTTP_SSE / STDIO |
| server_url | VARCHAR(512) | Server URL（HTTP SSE 时） |
| command_path | VARCHAR(512) | 命令路径（stdio 时） |
| command_args | VARCHAR(512) | 命令参数 |
| env_vars | JSONB | 环境变量（加密存储） |
| auth_type | VARCHAR(16) | 认证方式 |
| auth_config | JSONB | 认证配置（加密存储） |
| status | VARCHAR(16) | 状态：DISCONNECTED / CONNECTED / ERROR |
| auto_reconnect | BOOLEAN | 是否自动重连 |
| reconnect_interval | INTEGER | 重连间隔（秒） |
| timeout_seconds | INTEGER | 超时时间 |
| last_connected_at | TIMESTAMP | 最后连接时间 |
| created_by | UUID | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### external_app（外部应用）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(64) | 应用名称（唯一） |
| app_type | VARCHAR(32) | 应用类型：CURSOR / COPILOT / CLAUDE_CODE / CLAUDE_DESKTOP / CUSTOM |
| description | TEXT | 描述 |
| owner_user_id | UUID | 归属用户 ID |
| callback_url | VARCHAR(512) | OAuth2 回调 URL |
| ip_whitelist | JSONB | IP 白名单数组 |
| rate_limit | INTEGER | 速率限制（次/分钟） |
| status | VARCHAR(16) | 状态：ACTIVE / DISABLED |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### api_key（应用 API Key）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| app_id | UUID | 关联应用 ID（外键） |
| name | VARCHAR(64) | Key 名称 |
| key_hash | VARCHAR(128) | API Key 哈希值（不存储明文） |
| key_prefix | VARCHAR(16) | Key 前缀（用于展示，如 `mk_xxxx****`） |
| expires_at | TIMESTAMP | 过期时间 |
| last_used_at | TIMESTAMP | 最后使用时间 |
| status | VARCHAR(16) | 状态：ACTIVE / REVOKED |
| created_at | TIMESTAMP | 创建时间 |

#### permission_rule（权限规则）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(64) | 规则名称（唯一） |
| description | TEXT | 描述 |
| subject_type | VARCHAR(16) | 主体类型：USER / APP / ROLE |
| subject_ids | JSONB | 主体 ID 数组 |
| tool_scope_type | VARCHAR(16) | 工具范围类型：ALL / SPECIFIC / CATEGORY |
| tool_scope_ids | JSONB | 工具范围 ID 数组（SPECIFIC 时为工具 ID，CATEGORY 时为分类 ID） |
| permission_type | VARCHAR(16) | 权限类型：ALLOW / DENY |
| priority | INTEGER | 优先级（1-100） |
| condition_expr | TEXT | ABAC 条件表达式 |
| effective_from | TIMESTAMP | 生效开始时间 |
| effective_until | TIMESTAMP | 生效结束时间 |
| enabled | BOOLEAN | 是否启用 |
| created_by | UUID | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### call_audit（调用审计记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| call_id | VARCHAR(64) | 调用唯一 ID |
| trace_id | VARCHAR(64) | Trace ID（关联 TECH-OBS） |
| tool_id | UUID | 工具 ID |
| tool_name | VARCHAR(64) | 工具名称（冗余存储） |
| server_id | UUID | MCP Server ID（作为 Server 调用时） |
| client_id | UUID | MCP Client ID（作为 Client 调用时） |
| caller_type | VARCHAR(16) | 调用方类型：EXTERNAL_APP / INTERNAL_AGENT / DEBUGGER |
| caller_id | VARCHAR(64) | 调用方标识（应用 ID / Agent ID / 用户 ID） |
| request_payload | JSONB | 请求报文 |
| response_payload | JSONB | 响应报文 |
| status | VARCHAR(16) | 状态：SUCCESS / FAILED / TIMEOUT |
| error_type | VARCHAR(32) | 错误类型（失败时） |
| error_message | TEXT | 错误消息（失败时） |
| error_stack | TEXT | 错误堆栈（失败时） |
| duration_ms | INTEGER | 耗时（毫秒） |
| prompt_tokens | INTEGER | Prompt Token 数 |
| completion_tokens | INTEGER | Completion Token 数 |
| total_tokens | INTEGER | 总 Token 数 |
| cost_estimate | DECIMAL(10,4) | 成本估算 |
| called_at | TIMESTAMP | 调用时间 |

#### alert_rule（告警规则）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(64) | 规则名称 |
| scope_type | VARCHAR(16) | 监控范围：ALL / SPECIFIC |
| scope_tool_ids | JSONB | 指定工具 ID 数组 |
| trigger_type | VARCHAR(32) | 触发条件：ERROR_RATE / ERROR_COUNT / CONSECUTIVE_FAIL |
| threshold | DECIMAL(10,2) | 阈值 |
| window | VARCHAR(16) | 统计窗口：5M / 15M / 1H / 24H |
| notify_methods | JSONB | 通知方式数组 |
| webhook_url | VARCHAR(512) | Webhook URL |
| enabled | BOOLEAN | 是否启用 |
| created_by | UUID | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

## 附录

### A. 平台内置工具清单（初始）

以下工具在 P0 阶段由平台自动注册，可直接在 MCP Server 中暴露：

| 工具名称 | 分类 | 实现类型 | 说明 |
|---|---|---|---|
| ontology_concept_query | Ontology | Ontology 查询 | 查询 Ontology 概念定义 |
| ontology_entity_search | Ontology | Ontology 查询 | 搜索 Ontology 实体 |
| ontology_relation_traverse | Ontology | Ontology 查询 | 遍历实体间关系 |
| ontology_rule_validate | Ontology | Ontology 查询 | 校验业务规则合规性 |
| rag_knowledge_search | RAG | RAG 检索 | 知识库混合检索 |
| rag_document_retrieve | RAG | RAG 检索 | 获取指定文档内容 |
| rag_qa_answer | RAG | RAG 检索 | 基于知识库的问答 |
| action_execute | Action | Action 执行 | 执行指定的 Action |
| action_status_query | Action | Action 执行 | 查询 Action 执行状态 |
| action_cancel | Action | Action 执行 | 取消正在执行的 Action |
| ea_capability_map | EA | HTTP 调用 | 获取业务能力地图 |
| ea_application_list | EA | HTTP 调用 | 获取应用系统清单 |
| wfe_start_process | Workflow | HTTP 调用 | 启动流程实例 |
| wfe_query_task | Workflow | HTTP 调用 | 查询待办任务 |

### B. 错误分类标准

| 错误类型 | 错误码前缀 | 说明 | 典型场景 |
|---|---|---|---|
| 参数错误 | MCP_PARAM_* | 调用参数不符合 Schema 定义 | 必填参数缺失、类型不匹配 |
| 权限不足 | MCP_AUTH_* | 调用方无权限调用该工具 | 未授权、权限规则拒绝、API Key 无效 |
| 超时 | MCP_TIMEOUT | 工具调用超时 | 超过配置的超时时间 |
| 服务异常 | MCP_SVC_* | 底层服务异常 | TECH-ONT/RAG/ACTION 服务不可用 |
| 工具执行错误 | MCP_TOOL_* | 工具内部执行出错 | Ontology 查询语法错误、Action 执行失败 |
| 连接错误 | MCP_CONN_* | MCP 连接异常 | Server 不可达、SSE 连接断开 |

### C. 术语表

| 术语 | 说明 |
|---|---|
| MCP | Model Context Protocol，Anthropic 开源的 AI 工具调用协议 |
| MCP Server | 暴露 Tools/Resources/Prompts 的服务端 |
| MCP Client | 连接 MCP Server 并调用其能力的客户端 |
| Tool | MCP 协议中的工具，AI 模型可调用的函数 |
| Resource | MCP 协议中的资源，AI 模型可读取的数据 |
| Prompt | MCP 协议中的提示模板，预定义的 Prompt 模板 |
| JSON-RPC | MCP 通信协议基础，基于 JSON 的远程过程调用 |
| SSE | Server-Sent Events，MCP 的 HTTP 传输方式 |
| stdio | 标准输入输出，MCP 的本地传输方式 |
| RBAC | Role-Based Access Control，基于角色的访问控制 |
| ABAC | Attribute-Based Access Control，基于属性的访问控制 |
| Trace ID | 分布式链路追踪标识，贯穿请求全链路 |