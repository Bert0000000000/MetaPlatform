const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        Header, Footer, AlignmentType, PageOrientation, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
        TableOfContents } = require('docx');
const fs = require('fs');
const path = require('path');

const cjkFont = "Microsoft YaHei";
const latinFont = "Arial";
const FONT = { ascii: latinFont, hAnsi: latinFont, eastAsia: cjkFont };

const DIAGRAM_DIR = "c:\\Users\\houuu\\.trae-cn\\work\\6a57afd9ba92720d9a267a80\\diagrams";

function text(str, opts = {}) {
  return new TextRun({ font: FONT, size: opts.size || 24, bold: opts.bold || false,
    color: opts.color || "000000", text: str });
}

function p(str, opts = {}) {
  const children = Array.isArray(str) ? str : [text(str, { size: opts.size })];
  return new Paragraph({
    spacing: { before: opts.before || 120, after: opts.after || 120, line: 360 },
    alignment: opts.align || AlignmentType.LEFT,
    children
  });
}

function h1(str) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 240 },
    children: [new TextRun({ font: FONT, size: 36, bold: true, text: str })]
  });
}

function h2(str) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 180 },
    children: [new TextRun({ font: FONT, size: 30, bold: true, text: str })]
  });
}

function h3(str) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ font: FONT, size: 26, bold: true, text: str })]
  });
}

function bullet(textStr, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: [text(textStr)]
  });
}

function numbered(textStr, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 60, after: 60 },
    children: [text(textStr)]
  });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(content, opts = {}) {
  const children = typeof content === "string" ? [new Paragraph({ children: [text(content, { size: opts.size || 20 })] })] : content;
  return new TableCell({
    borders,
    width: { size: opts.width || 2000, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children
  });
}

function table(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerCells = headers.map((h, i) => cell(h, { width: colWidths[i], shading: "D5E8F0" }));
  const dataRows = rows.map(row => new TableRow({
    cantSplit: true,
    children: row.map((c, i) => {
      if (typeof c === "string") return cell(c, { width: colWidths[i] });
      return cell(c, { width: colWidths[i] });
    })
  }));
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ cantSplit: true, children: headerCells }),
      ...dataRows
    ]
  });
}

function img(fileName, width, height) {
  const filePath = path.join(DIAGRAM_DIR, fileName);
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(filePath),
      transformation: { width, height },
      altText: { title: fileName, description: fileName, name: fileName }
    })]
  });
}

const children = [];

// Cover
children.push(p("Mate Platform", { size: 52, align: AlignmentType.CENTER, before: 2400, after: 200 }));
children.push(p("平台建设策略、应用架构与技术架构", { size: 36, align: AlignmentType.CENTER, before: 200, after: 400 }));
children.push(p("基于 Ontology 本体论引擎的企业级决策与运营提效平台", { size: 24, align: AlignmentType.CENTER, before: 200, after: 1200 }));
children.push(p("版本：v1.0", { size: 22, align: AlignmentType.CENTER, before: 200, after: 60 }));
children.push(p("日期：2026-07-16", { size: 22, align: AlignmentType.CENTER, before: 60, after: 60 }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// TOC
children.push(h1("目录"));
children.push(new Paragraph({ children: [new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1
children.push(h1("1. 项目背景与目标"));
children.push(h2("1.1 背景"));
children.push(p("企业在数字化转型过程中积累了大量业务系统（ERP、CRM、OA、HR 等），但这些系统往往以流程或功能为中心建设，数据之间缺乏统一的语义关联，导致决策链路断裂、运营动作迟缓。与此同时，大量制度、流程、访谈等非结构化知识难以被机器理解和复用，形成信息化凹陷点。"));
children.push(p("Mate Platform 的定位是构建一个企业级操作系统：以 Ontology 本体论引擎为核心，将企业内外的数据、知识、流程、动作统一建模，形成可推理、可联动、可执行的语义网络，从而提升决策效率与运营效率。"));
children.push(h2("1.2 核心目标"));
children.push(bullet("决策提效：通过本体关联与推理，辅助管理者快速识别问题、预测风险、生成决策建议。"));
children.push(bullet("运营提效：通过 Action Engine 将识别到的数据变化自动转化为业务动作，减少人工操作。"));
children.push(bullet("填补信息化凹陷点：通过低代码 / 零代码应用构建器和 AI 辅助开发，快速补齐现有系统未覆盖的业务场景。"));
children.push(bullet("知识资产化：将制度、流程、访谈等隐性知识转化为结构化的本体与知识图谱，支持检索与推理。"));

// 2
children.push(h1("2. 核心概念与价值主张"));
children.push(h2("2.1 Ontology 本体论引擎"));
children.push(p("Ontology 本体论引擎是 Mate Platform 的核心。它定义企业中的概念（Concept）、实体（Entity）、关系（Relation）、属性（Attribute）、规则（Rule）和动作（Action），形成企业级的语义网络。"));
children.push(p("与传统数据模型不同，Ontology 不仅描述“是什么”，还描述“为什么相关”以及“可以做什么”。例如："));
children.push(bullet("数据联动：当“客户”实体的“合同到期日”发生变化时，Ontology 可以推导出“续约风险”上升。"));
children.push(bullet("动作触发：当“库存”低于“安全库存”时，自动触发“采购申请”动作。"));
children.push(bullet("知识推理：根据制度文件中的规则，判断某项操作是否符合合规要求。"));
children.push(h2("2.2 信息化凹陷点"));
children.push(p("信息化凹陷点是指企业现有系统未覆盖或覆盖不足的业务场景。这些场景通常具有以下特征："));
children.push(bullet("业务流程短、变化快，不值得投入传统开发。"));
children.push(bullet("涉及多个系统数据，但缺乏集成能力。"));
children.push(bullet("依赖个人经验或线下文档，知识难以沉淀。"));
children.push(p("Mate Platform 通过低代码构建器 + AI 辅助开发 + Ontology 建模，将凹陷点快速转化为在线应用，并纳入统一的数据与知识网络。"));

// 3
children.push(h1("3. 总体建设策略"));
children.push(p("平台建设应采取“核心引擎先行、场景驱动落地、AI 持续赋能”的策略。"));
children.push(table(
  ["策略维度", "核心原则", "落地方式"],
  [
    ["产品策略", "平台 + 应用双轮驱动", "先建设 Ontology 引擎与低代码构建器，再孵化垂直应用"],
    ["技术策略", "模块化、可扩展、云原生", "采用微服务-ready 的模块化架构，支持渐进式拆分"],
    ["数据策略", "统一语义、分层治理", "建立企业级 Ontology，作为数据集成与语义查询的统一层"],
    ["AI 策略", "Ontology + LLM 协同", "用 Ontology 约束和增强 LLM，用 LLM 降低 Ontology 构建成本"],
    ["生态策略", "开放 API、MCP/CRI 对接", "与 Cloud Code、Codex 等 AI 工具以及企业既有系统互联互通"]
  ],
  [2000, 2600, 4760]
));

// 4
children.push(h1("4. 应用架构"));
children.push(h2("4.1 能力分层"));
children.push(p("应用架构从下到上分为基础设施层、平台核心能力层、应用构建层和用户触点层。"));
children.push(img("application_architecture.png", 580, 420));
children.push(h2("4.2 用户触点层"));
children.push(bullet("应用门户 / 工作台：聚合企业应用、待办、通知、报表的统一入口。"));
children.push(bullet("数字员工 / Copilot：基于自然语言的交互界面，支持问答、任务执行、数据分析。"));
children.push(bullet("AI 开发工具：通过 CRI / MCP 协议对接 Cloud Code、Codex、Cursor 等，支持专业开发者快速生成代码与配置。"));
children.push(h2("4.3 应用构建层"));
children.push(bullet("低代码 / 零代码应用构建器：提供表单、流程、报表、看板等可视化设计能力，支持业务人员快速搭建应用。"));
children.push(bullet("AI 辅助开发：通过自然语言生成页面、流程、数据模型，降低开发门槛。"));
children.push(bullet("应用市场 / 模板中心：沉淀行业模板与最佳实践，支持快速复制与定制。"));
children.push(h2("4.4 平台核心能力层"));
children.push(table(
  ["模块", "职责", "关键能力"],
  [
    ["Ontology 本体引擎", "统一语义建模与推理", "概念定义、关系建模、规则推理、版本管理"],
    ["知识图谱引擎", "构建企业级语义网络", "实体链接、图谱存储、路径查询、可视化"],
    ["流程引擎 / BPM", "业务流程建模、执行与监控", "BPMN 建模、人工审批、会签、SLA 监控"],
    ["Action 动作引擎", "将数据变化转化为执行", "规则触发、流程编排、RPA、API 编排"],
    ["企业级 RAG 知识库", "支持结构化与非结构化知识", "文档切片、向量检索、图谱检索、混合排序"],
    ["数据集成 / Data Fabric", "连接企业内外数据", "连接器、CDC、ETL/ELT、数据目录"],
    ["AI 服务层", "统一 AI 能力入口", "LLM 路由、Agent 框架、Prompt 管理、模型评估"],
    ["企业 EA 架构资产", "架构资产沉淀与对齐", "业务能力地图、应用组合、架构治理、影响分析"]
  ],
  [2200, 2600, 4560]
));

children.push(h2("4.5 企业 EA 架构（Enterprise Architecture）"));
children.push(p("企业 EA 架构是 Mate Platform 中用于沉淀和对齐企业级架构资产的能力。它将业务战略、业务能力、业务流程、应用组合、数据模型、技术平台映射为统一的架构视图，并通过 Ontology 本体模型建立各层之间的语义关联。"));
children.push(p("EA 架构不是额外的一层，而是贯穿业务、应用、数据、技术四层的治理框架。Mate Platform 通过 EA 架构资产库帮助企业回答以下问题："));
children.push(bullet("当前具备哪些业务能力？哪些能力由哪些应用支撑？"));
children.push(bullet("某个业务流程变更会影响哪些系统、数据、接口？"));
children.push(bullet("数据资产的定义来源是业务对象还是技术表？"));
children.push(bullet("技术平台建设是否对齐了业务战略？"));
children.push(img("enterprise_architecture.png", 580, 520));
children.push(h3("4.5.1 EA 四层架构模型"));
children.push(table(
  ["层级", "核心元素", "与 Ontology 的关系"],
  [
    ["业务架构", "业务能力地图、价值链、业务流程、组织角色", "Ontology 中的 Concept 与 Capability 对齐"],
    ["应用架构", "应用组合、应用服务、接口、集成关系", "应用服务与 Ontology 中的 Action / API 对齐"],
    ["数据架构", "数据域、数据实体、数据标准、数据血缘", "Ontology 中的 Entity / Attribute 直接作为数据标准"],
    ["技术架构", "技术平台、基础设施、安全与合规", "技术组件作为平台能力支撑 Ontology 与流程执行"]
  ],
  [1800, 3600, 3960]
));
children.push(h3("4.5.2 EA 架构资产管理"));
children.push(bullet("架构资产目录：管理业务能力、应用、数据实体、技术组件等资产。"));
children.push(bullet("影响分析：当 Ontology、流程或应用发生变更时，自动分析受影响范围。"));
children.push(bullet("架构对齐检查：校验应用、数据、技术是否覆盖了业务能力需求。"));
children.push(bullet("可视化视图：提供分层视图、矩阵视图、热力图、路线图等 EA 视图。"));
children.push(h3("4.5.3 EA 与 Ontology 的协同"));
children.push(p("Ontology 提供了 EA 所需的语义精确性，EA 提供了 Ontology 落地的业务上下文。例如："));
children.push(bullet("业务能力“客户续约管理”可以映射到 Ontology 中的“客户 - 合同 - 续约风险”关系。"));
children.push(bullet("业务流程“合同审批”可以直接引用 Ontology 中的“合同金额”属性和“审批规则”。"));
children.push(bullet("应用架构中的“CRM 系统”可以被标注为支撑“客户管理”能力的实现系统。"));

// 5
children.push(h1("5. 技术架构"));
children.push(h2("5.1 总体技术栈"));
children.push(table(
  ["层级", "推荐技术", "说明"],
  [
    ["前端", "React / Vue + TypeScript", "门户、构建器、Copilot UI"],
    ["后端", "Java / Go / Node.js + Python", "按服务特点选择语言，Python 主导 AI 服务"],
    ["图数据库", "Neo4j / JanusGraph / Dgraph", "存储 Ontology 与知识图谱"],
    ["关系数据库", "PostgreSQL / MySQL", "元数据、业务数据、权限"],
    ["向量数据库", "Milvus / PGVector / Weaviate", "RAG 向量检索"],
    ["对象存储", "MinIO / S3", "文档、附件、模型文件、数据湖原始文件"],
    ["数据仓库", "ClickHouse / StarRocks / Snowflake", "结构化历史数据、报表、OLAP 分析"],
    ["数据湖", "Iceberg / Hudi / Delta Lake + OSS/S3", "原始/半结构化数据、长期归档、数据科学"],
    ["消息队列", "Kafka / RabbitMQ / Pulsar", "事件驱动、异步任务"],
    ["缓存", "Redis / KeyDB", "会话、热点数据、限流"],
    ["容器编排", "Kubernetes", "云原生部署与弹性伸缩"]
  ],
  [1600, 3400, 4360]
));
children.push(h2("5.2 服务分层"));
children.push(p("技术架构采用“模块化单体优先、服务按需拆分”的演进策略。初期将核心能力组织为清晰的模块，部署在一个或多个可独立扩展的单元中；当某个模块成为独立演进瓶颈时，再拆分为独立服务。"));
children.push(img("technical_architecture.png", 580, 480));
children.push(h3("5.2.1 前端技术栈"));
children.push(bullet("应用门户：React 18 + Ant Design / Arco Design，支持主题与权限配置。"));
children.push(bullet("低代码设计器：自研可视化设计器，基于 JSON Schema 描述页面与流程。"));
children.push(bullet("Copilot UI：流式输出、富文本、代码高亮、图表渲染。"));
children.push(h3("5.2.2 后端服务"));
children.push(table(
  ["服务", "推荐语言", "核心职责"],
  [
    ["Ontology Service", "Go / Java", "本体建模、推理、版本控制、API 发布"],
    ["App Builder Service", "Node.js / Java", "应用设计、表单渲染、页面编排"],
    ["Workflow Service", "Java / Go", "BPMN 建模、流程执行、任务调度、SLA 监控"],
    ["EA Service", "Java / Go", "架构资产目录、影响分析、架构对齐检查"],
    ["Data Integration Service", "Python / Go", "连接器、ETL、数据质量、数据目录"],
    ["AI Service", "Python", "LLM 路由、RAG、Agent、模型管理"],
    ["Action Engine Service", "Java / Go", "规则触发、自动化执行、RPA 调度"],
    ["Identity Service", "Java / Go", "用户、组织、RBAC/ABAC、审计"]
  ],
  [2400, 2200, 4760]
));

children.push(h2("5.3 数据架构"));
children.push(p("数据架构以 Ontology 为统一语义层，形成“采、存、算、用”四层结构。"));
children.push(img("data_flow.png", 580, 280));
children.push(h3("5.3.1 数据分层"));
children.push(table(
  ["层级", "数据形态", "存储与工具"],
  [
    ["数据源层", "ERP/CRM/OA/HR/外部 API/文件", "JDBC、REST、SFTP、消息队列"],
    ["集成层", "原始数据、变更事件、任务日志", "Kafka、Airbyte、DBT、自研连接器"],
    ["语义层", "Ontology、知识图谱、数据目录", "Neo4j、PostgreSQL、元数据服务"],
    ["知识层", "向量索引、文档切片、规则库", "Milvus、对象存储、图数据库"],
    ["消费层", "应用数据、报表、决策建议", "API、OLAP、Copilot"]
  ],
  [1800, 3200, 4360]
));
children.push(h3("5.3.2 数据仓库、数据湖与 ETL"));
children.push(p("Mate Platform 的数据架构需要同时支持实时运营、历史分析、数据科学三类场景，因此必须引入数据仓库、数据湖和 ETL/ELT 体系。"));
children.push(table(
  ["组件", "定位", "典型场景", "推荐技术"],
  [
    ["数据湖（Data Lake）", "存储原始、半结构化、非结构化数据的统一存储池", "日志、IoT、文档、外部数据长期归档、数据科学探索", "S3/MinIO + Iceberg/Hudi/Delta Lake"],
    ["数据仓库（Data Warehouse）", "面向主题、集成、稳定、随时间变化的数据集合", "BI 报表、经营分析、KPI 计算、历史趋势", "ClickHouse / StarRocks / Snowflake"],
    ["ETL / ELT 引擎", "将源系统数据抽取、转换、加载到湖/仓/应用", "数据清洗、格式转换、数据建模、血缘追踪", "Airflow / DBT / Spark / Flink / 自研"],
    ["数据目录", "统一的数据资产地图与元数据管理", "找数据、理解数据、追溯血缘", "DataHub / Apache Atlas / 自研"]
  ],
  [1800, 3000, 3200, 2360]
));
children.push(h3("5.3.3 ETL 架构设计"));
children.push(p("ETL 是 Mate Platform 数据治理的主动脉，负责将外围系统的数据转化为平台可理解、可计算、可治理的资产。"));
children.push(bullet("抽取（Extract）：支持批量抽取、CDC 实时捕获、API 拉取、消息订阅、文件导入等多种方式。"));
children.push(bullet("转换（Transform）：支持数据清洗、格式标准化、编码映射、Ontology 语义映射、数据质量校验。"));
children.push(bullet("加载（Load）：支持加载到关系库、图库、数仓、数据湖，并自动更新数据目录与血缘。"));
children.push(bullet("调度与监控：可视化编排、依赖管理、重跑、失败告警、SLA 统计。"));
children.push(h3("5.3.4 数据治理"));
children.push(bullet("数据目录：基于 Ontology 自动生成数据资产目录，支持血缘追踪。"));
children.push(bullet("数据质量：内置数据校验规则、异常检测、自动修复建议。"));
children.push(bullet("主数据管理：通过 Ontology 定义主数据实体，统一编码与映射。"));
children.push(bullet("安全与合规：字段级加密、脱敏、分级分类、访问审计。"));

children.push(h2("5.4 AI 架构"));
children.push(p("AI 架构围绕“Ontology 增强 LLM，LLM 降低 Ontology 构建成本”的协同思路设计。"));
children.push(h3("5.4.1 LLM 网关"));
children.push(bullet("统一接入多个模型供应商（OpenAI、Anthropic、火山方舟、通义千问等）。"));
children.push(bullet("流量控制、成本核算、模型路由、Fallback 机制。"));
children.push(bullet("Prompt 版本管理、A/B 测试、效果评估。"));
children.push(h3("5.4.2 RAG  pipeline"));
children.push(bullet("文档解析：支持 PDF、Word、PPT、网页、音视频转写。"));
children.push(bullet("混合检索：向量检索 + 关键词检索 + 图谱检索，支持多路召回与重排序。"));
children.push(bullet("上下文生成：基于 Ontology 进行实体链接与知识补全，提升回答准确性。"));
children.push(h3("5.4.3 Agent 框架"));
children.push(bullet("规划：将复杂任务拆解为可执行的子任务。"));
children.push(bullet("工具调用：对接 Ontology、Action Engine、外部 API、数据库。"));
children.push(bullet("记忆：支持短期会话记忆与长期知识记忆。"));
children.push(bullet("评估：内置 Agent 执行轨迹记录与效果评估。"));
children.push(h3("5.4.4 数字员工"));
children.push(p("数字员工是面向具体岗位的 AI 代理，其能力来源于："));
children.push(bullet("制度与流程提炼：通过 LLM 从制度文件中抽取 Ontology 概念、实体、规则与动作。"));
children.push(bullet("访谈信息结构化：将访谈录音/纪要转化为知识图谱中的实体与关系。"));
children.push(bullet("持续学习：通过人工反馈（RLHF）和 Ontology 校验不断优化。"));

children.push(h2("5.5 集成架构"));
children.push(h3("5.5.1 对外 Open API"));
children.push(bullet("基于 RESTful / GraphQL 提供统一 API 网关。"));
children.push(bullet("API 版本管理、限流、认证、审计。"));
children.push(bullet("自动生成 SDK（Java、Python、JavaScript）。"));
children.push(h3("5.5.2 AI 工具对接"));
children.push(bullet("CRI（Code Runtime Interface）：向 Cloud Code、Codex 等工具提供代码生成、调试、部署能力。"));
children.push(bullet("MCP（Model Context Protocol）：让 AI 工具能够安全地访问平台数据与知识。"));
children.push(bullet("插件市场：为常见 IDE 和 AI 工具提供插件。"));
children.push(h3("5.5.3 企业系统连接器"));
children.push(table(
  ["连接对象", "连接方式", "典型场景"],
  [
    ["ERP (SAP/金蝶/用友)", "JDBC / API / RFC", "财务、采购、库存数据集成"],
    ["CRM (Salesforce/纷享销客)", "REST / Webhook", "客户、商机、合同同步"],
    ["OA (钉钉/飞书/泛微)", "Open API / 事件订阅", "审批、待办、组织架构"],
    ["HR (北森/Moka)", "REST / SFTP", "员工、组织、绩效数据"],
    ["外部数据源", "API / 爬虫 / 文件", "行业数据、政策法规、市场情报"]
  ],
  [2200, 2600, 4560]
));

children.push(h2("5.6 安全与治理"));
children.push(bullet("身份安全：SSO、多因素认证、零信任访问。"));
children.push(bullet("权限模型：RBAC + ABAC，支持数据行级、字段级权限。"));
children.push(bullet("数据安全：传输加密（TLS 1.3）、存储加密（AES-256）、敏感字段脱敏。"));
children.push(bullet("审计合规：全量操作日志、数据血缘、变更审计。"));
children.push(bullet("模型安全：Prompt 注入检测、输出合规审查、模型调用审计。"));

// 6
children.push(h1("6. 流程引擎设计"));
children.push(p("流程引擎是 Mate Platform 中将业务规则与人工协作转化为可执行流程的核心组件。它与 Ontology 本体引擎深度集成：Ontology 提供流程所需的业务概念、角色、规则和语义约束，流程引擎负责将这些定义驱动为可运行的 BPMN 流程实例。"));
children.push(img("workflow_engine.png", 580, 440));
children.push(h2("6.1 核心能力"));
children.push(table(
  ["能力", "说明", "典型场景"],
  [
    ["可视化流程建模", "基于 BPMN 2.0 的拖拽式流程设计器，支持子流程、会签、条件分支", "合同审批、采购申请、入职办理"],
    ["流程运行时", "支持串行、并行、会签、子流程、事件子流程等执行模式", "复杂审批、跨部门协作"],
    ["规则驱动", "流程网关条件由 Ontology 规则或 DMN 决策表驱动", "金额阈值审批、风险等级路由"],
    ["任务中心", "统一的待办、已办、委托、催办、会签任务管理", "员工工作台、管理驾驶舱"],
    ["流程监控", "实时流程实例状态、SLA 预警、瓶颈分析、流程热力图", "运营效率分析、流程优化"],
    ["版本与迁移", "流程定义版本管理、运行中实例迁移、灰度发布", "流程优化不停机"]
  ],
  [2200, 3600, 3560]
));
children.push(h2("6.2 流程与 Ontology 的协同"));
children.push(p("流程引擎与 Ontology 本体引擎之间是双向增强关系："));
children.push(bullet("Ontology -> 流程：流程节点引用的业务对象、角色、属性均来自 Ontology，确保流程语义与企业数据模型一致。"));
children.push(bullet("流程 -> Ontology：流程执行过程中产生的事件、状态、决策结果会回流到 Ontology，丰富实体状态和关系。"));
children.push(bullet("规则 -> 流程：Ontology 中的业务规则可以直接作为流程网关的决策条件，实现“业务规则驱动流程”。"));
children.push(h2("6.3 流程与 Action 的衔接"));
children.push(p("流程引擎中的服务任务、发送任务、接收任务可以调用 Action Engine 中的动作，实现人工审批与自动执行的闭环。例如："));
children.push(bullet("合同审批流程的“财务审核”节点可由规则自动判断，无需人工介入。"));
children.push(bullet("审批通过后，自动调用 Action Engine 生成合同编号、发送通知、更新 CRM。"));
children.push(bullet("流程超时或异常时，自动触发升级动作并通知相关责任人。"));
children.push(h2("6.4 技术选型建议"));
children.push(table(
  ["方案", "适用场景", "推荐技术"],
  [
    ["轻量级流程", "审批流、表单流，快速上线", "自研状态机 + BPMN 子集"],
    ["企业级 BPM", "复杂流程、高并发、强合规", "Camunda / Flowable / Activiti"],
    ["规则引擎", "复杂决策、频繁变更的业务规则", "Drools / Easy Rules / DMN"],
    ["任务调度", "定时任务、批处理、异步补偿", "Quartz / XXL-Job / Temporal"]
  ],
  [2000, 3200, 4160]
));

// 7
children.push(h1("7. Ontology 本体引擎设计"));
children.push(h2("7.1 元模型"));
children.push(p("Ontology 的元模型定义了构建企业语义网络所需的最小概念集合。"));
children.push(table(
  ["元模型元素", "说明", "示例"],
  [
    ["Concept（概念）", "对企业中某类事物的抽象定义", "客户、合同、采购订单"],
    ["Entity（实体）", "概念的具体实例", "客户 A、合同 #2026-001"],
    ["Attribute（属性）", "概念或实体的特征", "客户.名称、合同.金额"],
    ["Relation（关系）", "概念或实体之间的语义联系", "客户-签订-合同"],
    ["Rule（规则）", "基于 Ontology 的业务约束或推导逻辑", "合同金额 > 100 万需二级审批"],
    ["Action（动作）", "可执行的业务操作", "创建采购申请、发送续约提醒"]
  ],
  [2000, 3600, 3760]
));
children.push(h2("7.2 核心能力"));
children.push(bullet("建模工具：可视化本体建模、导入导出（OWL / RDF / JSON-LD）。"));
children.push(bullet("版本管理：支持 Ontology 的版本发布、差异对比、回滚。"));
children.push(bullet("推理引擎：支持子类推理、传递闭包、属性约束、业务规则执行。"));
children.push(bullet("自然语言抽取：利用 LLM 从制度、流程、访谈中自动抽取 Ontology 元素。"));
children.push(bullet("数据映射：将 Ontology 概念映射到物理表、API 字段、文档片段。"));
children.push(h2("7.3 与 AI 的协同"));
children.push(p("Ontology 为 LLM 提供结构化上下文，LLM 为 Ontology 构建提供自动化能力。"));
children.push(table(
  ["方向", "说明"],
  [
    ["Ontology -> LLM", "在 RAG 和 Agent 中注入 Ontology 关系，减少幻觉，提升推理准确性"],
    ["LLM -> Ontology", "从非结构化文本中自动抽取概念、关系、规则，降低建模成本"],
    ["Ontology -> Action", "基于规则和关系自动生成或推荐业务动作"]
  ],
  [2200, 7160]
));

// 8
children.push(h1("8. 企业级 RAG 知识库设计"));
children.push(h2("8.1 知识来源"));
children.push(bullet("制度文件：公司章程、管理制度、合规要求。"));
children.push(bullet("流程文件：SOP、业务流程图、审批矩阵。"));
children.push(bullet("访谈信息：高管访谈、专家经验、会议纪要。"));
children.push(bullet("业务数据：经授权的结构化数据与数据字典。"));
children.push(h2("8.2 切片策略"));
children.push(table(
  ["知识类型", "切片方式", "存储形式"],
  [
    ["结构化制度条款", "按条款、章节、责任主体切片", "图节点 + 关系 + 元数据"],
    ["流程文件", "按步骤、角色、输入输出切片", "流程节点 + 边 + 规则"],
    ["访谈/会议纪要", "按话题、决策点、行动项切片", "文本块 + 向量 + 实体链接"],
    ["业务数据", "按实体、时间、事件切片", "表/时序 + 图谱 + 索引"]
  ],
  [2200, 3600, 3560]
));
children.push(h2("8.3 向量与非向量混合检索"));
children.push(bullet("向量检索：基于 Embedding 的语义相似度检索，适合开放性问题。"));
children.push(bullet("图谱检索：基于 Ontology 关系的精确推理，适合制度合规、流程判断。"));
children.push(bullet("关键词检索：基于 BM25 / TF-IDF，适合专有名词与精确匹配。"));
children.push(bullet("混合排序：多路召回后通过 Reranker 融合排序，提升准确率。"));

// 9
children.push(h1("9. 数据治理与集成"));
children.push(h2("9.1 数据集成模式"));
children.push(table(
  ["模式", "适用场景", "目标存储", "技术实现"],
  [
    ["CDC 实时同步", "核心系统高频数据", "关系库 / 图库 / 消息队列", "Debezium / Flink CDC"],
    ["ETL 批量集成", "历史数据、报表数据、数仓加载", "数据仓库 / 数据湖", "Airflow / DBT / Spark / 自研"],
    ["ELT 模式", "先加载后转换，保留原始数据", "数据湖 / 数仓", "Airbyte / Fivetran / DBT"],
    ["API 编排", "SaaS 系统、外部服务", "业务库 / 数据湖", "自研连接器 + API Gateway"],
    ["虚拟化查询", "低频、敏感数据", "直连查询", "Data Virtualization / Trino / Dremio"],
    ["文件/消息集成", "日志、文档、IoT", "数据湖 / 对象存储", "SFTP / Kafka / S3 / MinIO"]
  ],
  [1800, 2600, 2200, 2760]
));
children.push(h2("9.2 数据治理体系"));
children.push(bullet("数据标准：基于 Ontology 定义企业级数据标准与编码规范。"));
children.push(bullet("数据目录：自动采集元数据，生成数据资产目录与血缘图谱。"));
children.push(bullet("数据质量：规则引擎 + 异常检测 + 质量评分卡。"));
children.push(bullet("主数据管理：统一客户、供应商、物料、组织等主数据。"));
children.push(bullet("数据安全：分类分级、脱敏、加密、访问控制、审计。"));

// 10
children.push(h1("10. 项目文档结构与规范"));
children.push(h2("10.1 文档目录结构"));
children.push(p("项目文档按照“目标 - 架构 - 产品 - 工程 - 运营 - 治理”六维组织，确保信息可查找、可维护。"));
children.push(table(
  ["目录", "说明", "典型文档"],
  [
    ["/docs/01-vision", "愿景与目标", "产品愿景、价值主张、OKR"],
    ["/docs/02-architecture", "架构设计", "应用架构、技术架构、数据架构、EA 架构、流程规范"],
    ["/docs/03-product", "产品需求", "PRD、用户故事、原型、竞品分析"],
    ["/docs/04-engineering", "工程规范", "编码规范、接口规范、测试策略、CI/CD"],
    ["/docs/05-operations", "运营与运维", "部署手册、监控告警、灾备方案"],
    ["/docs/06-governance", "治理与合规", "数据治理、安全合规、审计制度"]
  ],
  [2600, 2600, 4160]
));
children.push(h2("10.2 命名规范"));
children.push(h3("10.2.1 仓库命名"));
children.push(bullet("主平台：mate-platform"));
children.push(bullet("本体引擎：mate-ontology-engine"));
children.push(bullet("流程引擎：mate-workflow-engine"));
children.push(bullet("EA 服务：mate-ea-service"));
children.push(bullet("应用构建器：mate-app-builder"));
children.push(bullet("AI 服务：mate-ai-service"));
children.push(bullet("数据集成：mate-data-integration"));
children.push(bullet("Action 引擎：mate-action-engine"));
children.push(bullet("门户前端：mate-portal-web"));
children.push(h3("10.2.2 模块与服务命名"));
children.push(table(
  ["对象", "规范", "示例"],
  [
    ["代码包 / 目录", "kebab-case", "ontology-engine, app-builder"],
    ["后端服务", "mate-{domain}-{service}", "mate-ontology-service"],
    ["前端模块", "{feature}-module", "workflow-module, form-module"],
    ["数据库表", "snake_case, 复数", "ontology_concepts, user_profiles"],
    ["GraphQL / REST 资源", "kebab-case, 复数", "/api/v1/ontology-concepts"],
    ["Kafka Topic", "mate.{domain}.{event}", "mate.ontology.concept-created"],
    ["Docker 镜像", "mate/{service}:{version}", "mate/ontology-service:1.0.0"]
  ],
  [2400, 2600, 4360]
));
children.push(h3("10.2.3 代码命名"));
children.push(table(
  ["语言", "类型", "规范"],
  [
    ["TypeScript / JavaScript", "变量 / 函数", "camelCase"],
    ["TypeScript / JavaScript", "类 / 接口 / 类型", "PascalCase"],
    ["TypeScript / JavaScript", "常量", "UPPER_SNAKE_CASE"],
    ["Java / Go", "包名", "全小写，点分隔"],
    ["Java", "类", "PascalCase"],
    ["Go", "导出成员", "PascalCase"],
    ["Python", "模块 / 包", "snake_case"],
    ["Python", "类", "PascalCase"],
    ["Python", "函数 / 变量", "snake_case"]
  ],
  [2800, 3000, 3560]
));
children.push(h2("10.3 模块编码规范"));
children.push(bullet("单一职责：每个模块只负责一个明确的业务领域。"));
children.push(bullet("接口优先：模块间通过定义良好的 API / 事件进行通信，避免直接依赖实现。"));
children.push(bullet("可测试性：核心业务逻辑必须可单元测试，测试覆盖率目标 ≥ 70%。"));
children.push(bullet("可观测性：关键路径必须输出 Trace、Metrics、Logs。"));
children.push(bullet("向后兼容：公共 API 变更必须保证版本兼容，重大变更需走 deprecation 流程。"));
children.push(bullet("配置与代码分离：环境相关配置通过环境变量或配置中心注入，禁止硬编码。"));
children.push(h2("10.4 API 与数据库规范"));
children.push(bullet("RESTful API：使用 HTTP 动词表达操作，路径使用复数名词，返回统一响应结构。"));
children.push(bullet("版本控制：API 路径包含主版本号，如 /api/v1/ontology-concepts。"));
children.push(bullet("分页：列表接口必须支持分页，默认 pageSize = 20，最大 100。"));
children.push(bullet("数据库设计：每张表必须包含 id、created_at、updated_at、created_by、updated_by 字段。"));
children.push(bullet("索引规范：外键、查询字段、排序字段必须建立索引，避免全表扫描。"));
children.push(bullet("敏感字段：密码、Token、身份证号等必须加密存储，禁止明文落库。"));

// 11
children.push(h1("11. 实施路线图"));
children.push(p("平台建设分为四个阶段，每个阶段交付可用的能力并验证业务价值。"));
children.push(table(
  ["阶段", "周期", "核心交付", "关键里程碑"],
  [
    ["第一阶段：基础平台", "3-4 个月", "Ontology 元模型、低代码构建器 MVP、BPMN 流程引擎、基础 IAM", "完成 1-2 个试点应用与审批流程"],
    ["第二阶段：数据与知识", "3-4 个月", "数据集成、知识图谱、企业级 RAG、数字员工 POC、EA 架构资产初建", "打通 3-5 个核心系统，上线知识问答与能力地图"],
    ["第三阶段：智能动作", "3-4 个月", "Action Engine、Agent 框架、MCP/CRI 对接、流程与 Action 闭环", "实现 3 个以上自动化运营场景"],
    ["第四阶段：生态与规模化", "6-12 个月", "应用市场、Open API、多租户、EA 治理、性能与安全加固", "对外发布平台，支持规模化交付"]
  ],
  [1800, 1600, 3400, 2560]
));

// 12
children.push(h1("12. 风险与治理"));
children.push(h2("12.1 主要风险"));
children.push(table(
  ["风险", "影响", "应对措施"],
  [
    ["Ontology 建模复杂度高", "项目周期长，业务参与度不足", "提供可视化工具与 LLM 辅助抽取，分阶段迭代"],
    ["数据源异构", "集成成本高，数据质量差", "建设统一连接器框架，优先接入高价值系统"],
    ["LLM 幻觉与合规", "决策错误，合规风险", "Ontology 约束 + 人工复核 + 输出审计"],
    ["组织 adoption 阻力", "平台价值难以体现", "选择业务痛点明确的试点场景，快速验证 ROI"],
    ["安全与隐私", "数据泄露，合规处罚", "零信任架构、字段级权限、全链路审计"]
  ],
  [2600, 2600, 4160]
));
children.push(h2("12.2 治理机制"));
children.push(bullet("架构治理：成立架构评审委员会（ARB），重大技术决策需评审通过。"));
children.push(bullet("数据治理：明确数据owner，建立数据质量 SLA 与考核机制。"));
children.push(bullet("AI 治理：建立模型上线审批、输出审查、伦理与安全评估机制。"));
children.push(bullet("产品治理：建立需求优先级评审机制，避免功能蔓延。"));

// 13
children.push(h1("13. 总结"));
children.push(p("Mate Platform 的建设应以 Ontology 本体论引擎为核心，以数据联动与动作自动化为手段，以低代码 / AI 辅助开发为交付方式，逐步构建企业的决策与运营提效基础设施。通过统一语义层、企业级 RAG、数据治理和开放集成，平台能够将分散的业务系统、隐性的组织知识、滞后的运营动作转化为可理解、可计算、可执行的数字资产，最终帮助企业实现从“信息化”到“智能化运营”的跃迁。"));

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24 },
        paragraph: { spacing: { line: 360 } }
      }
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: FONT },
        paragraph: { spacing: { before: 400, after: 240 }, outlineLevel: 0, keepNext: false, keepLines: false } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: FONT },
        paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 1, keepNext: false, keepLines: false } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2, keepNext: false, keepLines: false } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ children: [text("Mate Platform 平台建设方案")] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text("第 "), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }), text(" 页")]
      })] })
    },
    children
  }]
});

const outPath = "d:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\Mate_Platform_架构设计_v1.0.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log("Document saved to " + outPath);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
