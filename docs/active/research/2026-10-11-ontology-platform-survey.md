# MetaPlatform 1.1：Ontology 开源平台深度调研

> 调研日期：2026-10-11（Asia/Shanghai） · 20 个仓库 · GitHub API 实时元数据 + 许可证原文 + 固定提交源码。
> 本地基线：`feat/ont-migration-plan` / `2c13952c`。结论是产品设计与源码审计，不是部署、兼容性或整个平台验收报告。

## 1. 一句话判断

**保留 MetaPlatform 现有本体内核、身份与编排，1.1 以“真实数据 → 业务对象 → 可运行应用 → 外部 Agent → 可恢复结果”的完整链路补差。优先借鉴 OpenMetadata 的数据体验、Appsmith/NocoBase 的应用体验和 WebProtégé 的本体编辑方式，复用已有标准 MCP 端点接入 dsh 与 WorkBuddy。**

调研对象分为六类：专业本体/语义工具 6 个、图存储 3 个、元数据平台 2 个、应用平台 4 个、Agent/MCP 基础 3 个、图检索/记忆 2 个。高 star 的数据目录、低代码与 Agent 项目能补足相关体验，但不等同于一个完整的业务 Ontology 平台。

产品 1.1 与仓库既有 v3.x 架构版本分开。研究不把历史 GA 文档当作当前全部功能稳定的证据，不改现有 Accepted 或交付看板。

## 2. 20 个候选：真实 star、活跃度与许可

以下按实际 star 降序。最后 push 不是最后正式发布，star 不是质量评分，语言是 GitHub 主语言而不是完整运行栈。许可证栏依据本轮固定提交原文；API 的 `NOASSERTION` 不表示无许可证。商业复用必须落到具体包与目标用途，尤其付费模块与商标。

| ⭐ Stars | 🍴 Forks | 📅 Last push（UTC） | 💻 Language | License / 商业复用边界 | Recommendation |
|---|---|---|---|---|---|
| 247058 | 29678 | 2026-10-09 | TypeScript | [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/LICENSE) | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)：Agent 客户端；复用官方 MCP 接入，非本体替代品 |
| 41048 | 4796 | 2026-10-11 | TypeScript | [Apache-2.0（根许可；EE 另审）](https://github.com/appsmithorg/appsmith/blob/fb3eb95595936113995bc04bc3933570c46c392d/LICENSE) | [appsmithorg/appsmith](https://github.com/appsmithorg/appsmith)：应用中心重点对标：绑定、预览、发布体验 |
| 40057 | 5680 | 2026-10-08 | Python | [MIT](https://github.com/HKUDS/LightRAG/blob/453dce83d6d0354a06e46c8d4029a0895c4e054b/LICENSE) | [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)：当前栈已采用；优化现有接入，不重复新增 GraphRAG |
| 38388 | 4965 | 2026-10-09 | TypeScript | [MSCL-1.0-GPL；限制竞争用途，4 年后 GPL](https://github.com/directus/directus/blob/8e140f94250834cea0a0fb6eb822cac39ed9faec/license) | [directus/directus](https://github.com/directus/directus)：source-available；不建议作为 MetaPlatform 商业底座 fork |
| 31630 | 3248 | 2026-10-10 | Python | [Apache-2.0](https://github.com/getzep/graphiti/blob/964bb11d1e7020e3cc67fab244268b0736b6c219/LICENSE) | [getzep/graphiti](https://github.com/getzep/graphiti)：时态 Agent 记忆候选，1.2 后独立 PoC |
| 28331 | 2231 | 2026-10-10 | TypeScript | [总体 GPLv3；客户端 MPL；pro BSL](https://github.com/Budibase/budibase/blob/b2e164ceb76e2ffbff3f632536bc4d8081eeb254/LICENSE) | [Budibase/budibase](https://github.com/Budibase/budibase)：操作流参考；源码嵌入按包审计 |
| 28034 | 2457 | 2026-10-10 | Python | [Apache-2.0](https://github.com/PrefectHQ/fastmcp/blob/e2fcc412001ff7414095c5dc282f94c70299a612/LICENSE) | [PrefectHQ/fastmcp](https://github.com/PrefectHQ/fastmcp)：MCP 框架备选；先保留现有官方 SDK |
| 24538 | 4029 | 2026-10-05 | Python | [MIT](https://github.com/modelcontextprotocol/python-sdk/blob/91941ed4d3985d59def99e090baa3f880c626cc8/LICENSE) | [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk)：现有协议基础，保持版本兼容 |
| 24521 | 2907 | 2026-10-11 | TypeScript | [Apache + 根补充协议；头部另有 AGPL 口径](https://github.com/nocobase/nocobase/blob/e9a8cbd4ae03d68a5bbc1bd2c6d3a9ba7704bc7c/LICENSE.txt) | [nocobase/nocobase](https://github.com/nocobase/nocobase)：业务模型与插件 UX 重点参考；不直接复制或整体 fork |
| 17293 | 2703 | 2026-10-09 | Java | [GPL-3.0（当前仓库）](https://github.com/neo4j/neo4j/blob/54a7dcf7c2501b31866199143364c5332da8936f/LICENSE.txt) | [neo4j/neo4j](https://github.com/neo4j/neo4j)：图存储备选；1.1 不换内核 |
| 15436 | 2441 | 2026-10-11 | TypeScript | [Apache-2.0](https://github.com/open-metadata/OpenMetadata/blob/12f9e16ed2693af671179c81ce847438d44d3ceb/LICENSE) | [open-metadata/OpenMetadata](https://github.com/open-metadata/OpenMetadata)：数据体验首选；元数据 adapter 首选 PoC |
| 12811 | 3710 | 2026-10-11 | Python | [Apache-2.0](https://github.com/datahub-project/datahub/blob/1634c4f8f7d30eaeb6b1afaf81f1f3a18a54e3e5/LICENSE) | [datahub-project/datahub](https://github.com/datahub-project/datahub)：数据目录/血缘强备选；不与 OpenMetadata 同时引入 |
| 3436 | 158 | 2026-10-10 | Prolog | [Apache-2.0](https://github.com/terminusdb/terminusdb/blob/06eb243b0a298b728157d10166b2da4f933fab44/LICENSE) | [terminusdb/terminusdb](https://github.com/terminusdb/terminusdb)：数据版本思路参考；迁移成本需评估 |
| 3191 | 641 | 2026-10-10 | Java | [Apache-2.0](https://github.com/apache/hugegraph/blob/36bc1c64ba2db23c40965ad952f3942cca31b1a7/LICENSE) | [apache/hugegraph](https://github.com/apache/hugegraph)：图数据库，测得容量瓶颈后才评估 |
| 1571 | 313 | 2026-10-01 | Java | [BSD-2-Clause（license.txt）](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/license.txt) | [protegeproject/protege](https://github.com/protegeproject/protege)：专业桌面 OWL 编辑；专家互操作参考 |
| 1468 | 719 | 2026-10-10 | Java | [Apache-2.0](https://github.com/apache/jena/blob/3014246b382d2439f4cd81aa72a7383ba0f9b3d5/LICENSE) | [apache/jena](https://github.com/apache/jena)：RDF/SPARQL/SHACL 标准验证参考 |
| 1007 | 279 | 2026-06-04 | JavaScript | [MIT](https://github.com/VisualDataWeb/WebVOWL/blob/28e7dd9540622e8cb723dc000824b5eef5ae775f/license.txt) | [VisualDataWeb/WebVOWL](https://github.com/VisualDataWeb/WebVOWL)：OWL 图交互参考；更新较久，非关键 UI 依赖 |
| 972 | 205 | 2026-09-21 | Java | [Apache-2.0](https://github.com/ontop/ontop/blob/b529b39db0519aa2db3200095b24f705135d75f3/LICENSE.txt) | [ontop/ontop](https://github.com/ontop/ontop)：关系数据库 → 虚拟 RDF 映射参考 |
| 805 | 280 | 2026-07-28 | Java | [BSD-2-Clause（license.txt）](https://github.com/protegeproject/webprotege/blob/1e84fa02aef68be45f18c08dbeae94bec9b04a41/license.txt) | [protegeproject/webprotege](https://github.com/protegeproject/webprotege)：本体编辑/权限/变更协作重点参考 |
| 42 | 8 | 2025-03-13 | JavaScript | [Apache-2.0（LICENSE.txt）](https://github.com/ge-semtk/semtk/blob/07c7d5cf29ae4b5f29d6898454585f66a7489a95/LICENSE.txt) | [ge-semtk/semtk](https://github.com/ge-semtk/semtk)：2025 后未 push；本轮仅历史参考 |

本轮查明两处容易误判的许可：NocoBase 根目录是 2026-02-24 更新的补充协议，§5.4/§7.4 限制公开低代码或 AI 平台 SaaS/PaaS，源码头部与包 LICENSE 又有不同历史口径；Directus 当前是 **MSCL-1.0-GPL**，不是可以照搬旧文章中的 BSL 结论。两者作为 MetaPlatform 平台源码底座均不宜直接采用。Budibase 根许可明确要求按包检查，总体 GPL、客户端 MPL、付费 pro BSL 不应混成单一许可。

## 3. 三档推荐与落地方式

| 档位 | 候选 | MetaPlatform 的具体用法 |
|---|---|---|
| 重点对标 | OpenMetadata、Appsmith、WebProtégé | 分别补数据发现与可信上下文、应用绑定/预览/发布、本体编辑与变更协作；保留 MetaPlatform 权威模型与运行 |
| 有条件采用 | DataHub、NocoBase、Ontop/Jena | DataHub 是元数据接入备选；NocoBase 只做体验与生命周期设计参考；Ontop/Jena 作为语义互操作模块评估 |
| 后续 PoC | Graphiti、TerminusDB/WebVOWL | 按需验证时态记忆、版本思路与图交互；不进入首条 1.1 闭环的关键依赖 |

MCP Python SDK 与 dsh 是接入基础；独立 FastMCP 是框架备选。LightRAG 已在当前架构中，优先检查现有链路。Neo4j、HugeGraph 提供图存储，缺少需要替换现有内核的性能证据。Directus 商业竞争用途限制、Budibase 分包许可与重复应用运行栈、旧 SemTK 活跃度使它们不适合作为本轮整体 fork 方案。

### 3.1 OpenMetadata：数据平台最值得借鉴的完整操作链

固定提交：[`12f9e16e`](https://github.com/open-metadata/OpenMetadata/commit/12f9e16ed2693af671179c81ce847438d44d3ceb)。已读入口、Java 服务资源、React 接入页面、MCP 与依赖，而非只读 README。

| 核心文件 | 核实内容 | 对 MetaPlatform 的意义 |
|---|---|---|
| `openmetadata-ui/src/main/resources/ui/package.json` | React/TypeScript/Vite 前端与生成代码/构建链 | 能借鉴交互模式，不能把页面文件直接搬入 Semi UI |
| `README.md`、`pom.xml` | 元数据/语义/质量/目录定位，Java 多模块与 Python 采集侧 | 属于额外运行平台；完整部署有独立存储和搜索等依赖 |
| `OpenMetadataApplication.java` | Dropwizard 应用初始化、实体仓库与搜索服务；源码包含 RDF 初始化 | 当前已演进至语义上下文层，须区分启用条件 |
| `resources/services/database/DatabaseServiceResource.java` | 数据库服务 REST 资源、权限和连接测试类型 | 源、实体和操作有结构化契约与鉴权 |
| `AddServicePage.component.tsx` | 多步连接配置、验证状态、过滤设置、保存、未保存导航保护 | DATA-01..04 的向导与失败恢复参考 |
| `openmetadata-mcp/.../McpServer.java` | 按启用状态筛选工具，RDF 关闭时不暴露依赖工具；OAuth/stateless 传输 | 插件能力应与实际运行条件一致，工具发现不能列出必然失败的能力 |

关键源码：[接入向导](https://github.com/open-metadata/OpenMetadata/blob/12f9e16ed2693af671179c81ce847438d44d3ceb/openmetadata-ui/src/main/resources/ui/src/pages/AddServicePage/AddServicePage.component.tsx)、[MCP 能力过滤](https://github.com/open-metadata/OpenMetadata/blob/12f9e16ed2693af671179c81ce847438d44d3ceb/openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java)。官方[数据契约文档](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-contracts/spec)提供 Schema、语义、质量和 SLA 的产品模型。

建议先复用操作设计，在现有 MetaPlatform 数据后端把真实连接、采集、质量与本体映射接线。若现有连接器覆盖仍不足，再做**单个源的元数据 adapter PoC**：OpenMetadata ID/FQN ↔ MetaPlatform RID、租户/权限、字段与血缘语义、删除事件、冲突与刷新策略。PoC 估算 5–10 人日，仅针对一个源和有限元数据；批量复制所有数据、替换身份或整个平台 fork 不在该估算中。

### 3.2 NocoBase / Appsmith：应用中心参考，授权与运行边界要分开

NocoBase 固定提交：[`e9a8cbd4`](https://github.com/nocobase/nocobase/commit/e9a8cbd4ae03d68a5bbc1bd2c6d3a9ba7704bc7c)。本轮实际读取：

| 核心文件 | 核实内容 | 对 MetaPlatform 的意义 |
|---|---|---|
| `package.json` | TypeScript/Node >=22 多包平台；package 的 Apache 字段不能代替根协议 | 不能从一个标签推导整个平台可商业嵌入 |
| `README.md` | AI + no-code 与业务系统定位 | 作为业务操作体验对照 |
| `packages/core/server/src/application.ts` | Application 装配 PluginManager、加载和启动 | 插件由平台宿主管理，非任意前端代码热插入 |
| `packages/core/server/src/plugin-manager/plugin-manager.ts` | 兼容性校验、持久插件状态、安装/启用/停用、依赖排序、失败恢复 | 现有 marketplace 补依赖、健康与升级影响，避免重建市场 |
| `plugin-data-source-main/src/server/index.ts` | 数据源插件导出与宿主接入边界 | 业务数据模型、资源和 UI 可分层 |
| `plugin-workflow/src/server/index.ts`、`plugin-acl/src/server/index.ts` | 工作流与权限按插件组织 | 仅借鉴呈现与职责；MetaPlatform 业务可靠编排仍遵循 Temporal ADR |

关键源码：[插件管理器](https://github.com/nocobase/nocobase/blob/e9a8cbd4ae03d68a5bbc1bd2c6d3a9ba7704bc7c/packages/core/server/src/plugin-manager/plugin-manager.ts)、[当前根协议](https://github.com/nocobase/nocobase/blob/e9a8cbd4ae03d68a5bbc1bd2c6d3a9ba7704bc7c/LICENSE.txt)。根协议、包 LICENSE 与源码头部有差异，直接复用前需确定具体适用授权，本轮按“只做设计参考”处理。

Appsmith 有更直接的应用绑定/预览/发布产品参考，根 Apache 2.0 已核验；本轮未将企业模块视为根许可覆盖，也未对整个 Appsmith 做源码级深挖。应用中心先在现有 AppHub 上完成对象驱动的订单模板；新增完整 Node/Java 低代码平台会引入第二套数据绑定、权限、发布和运行系统，当前收益不足以支持这种迁移。

### 3.3 DataHub：强备选，元数据不是业务数据

固定提交：[`1634c4f8`](https://github.com/datahub-project/datahub/commit/1634c4f8f7d30eaeb6b1afaf81f1f3a18a54e3e5)。读取了 `datahub-web-react/package.json`、Python ingestion `api/source.py`、`emitter/rest_emitter.py` 以及 `IngestionSourceBuilder.tsx`。接入向导使用多步表单上下文并保护未保存编辑，采集与元数据投递有单独层次。

[多步接入组件](https://github.com/datahub-project/datahub/blob/1634c4f8f7d30eaeb6b1afaf81f1f3a18a54e3e5/datahub-web-react/src/app/ingestV2/source/multiStepBuilder/IngestionSourceBuilder.tsx)与[Python 采集抽象](https://github.com/datahub-project/datahub/blob/1634c4f8f7d30eaeb6b1afaf81f1f3a18a54e3e5/metadata-ingestion/src/datahub/ingestion/api/source.py)可以补充 OpenMetadata 对标。DataHub 内部的 MCP 还可能指 **MetadataChangeProposal**，不能把该缩写自动当作 Model Context Protocol。选择它时仍需验证实际 Agent 接口、运行成本与权限映射。

### 3.4 专业本体工具与 Agent 记忆

WebProtégé star 只有 805，但本轮读到 `ChangeManager.java` 的项目锁、RevisionManager、权限与变更处理，及项目共享设置管理。这些比高 star 的通用图数据库更直接服务本体编辑体验。[源码快照](https://github.com/protegeproject/webprotege/blob/1e84fa02aef68be45f18c08dbeae94bec9b04a41/webprotege-server-core/src/main/java/edu/stanford/bmir/protege/web/server/project/chg/ChangeManager.java)。不建议把老 Java/GWT UI 搬入 React；借鉴草稿、改动说明、影响与共享权限。

Ontop 面向关系数据库上的虚拟 RDF 查询，Jena 面向 RDF/SPARQL/SHACL；本轮确认了 Jena `ShaclValidator` 的 conforms 与完整验证报告接口。它们是标准语义互操作参考，不提供现成的业务应用发布与 Action 执行产品。

Graphiti `edges.py` 和 `graphiti.py` 提供关系、分组与时态属性，是 Agent 记忆候选；分组字段不自动等于 MetaPlatform 的租户隔离。1.1 不把推断的时态记忆作为已批准业务事实，不替换现有 LightRAG 和本体权威层。

## 4. 当前 MetaPlatform：有源码依据的差距

下面是源码事实及其风险条件。没有对用户现有生产环境注入故障；源代码缺口不等于已复现的线上事故。

| 区域 | 当前事实与定位 | 影响/条件 | 1.1 增量 |
|---|---|---|---|
| 应用元数据 | `src/api/apphub/apps.ts:54–57` 固定 `PUBLISHED`，tags 数量投影成 moduleCount，version 投影成创建/更新时间 | 调用者无法从这些字段判断真实状态和时间；AppListPage 已绕开部分显示 | MP11-APP-01：后端/映射/卡片字段统一，未知字段明确未知 |
| 应用运行 | `pages/apphub/runtime/AppRuntimePage.tsx:67` 空 render_tree 使用内置 demo，运行壳已有 isDemo 标识 | 正式未完成应用也进入演示渲染；流程与空绑定体验易混淆 | MP11-APP-04：仅显式演示使用 demo，正式应用检查缺失依赖 |
| 数据源探测 | `mate-tech-data/repositories/__init__.py:16` 无条件导入内存 schema/test helpers；`api/app.py:472/485` 调用这些 helper | SQL sources 与内存 schema/status 分离；测试根据源状态模拟，而非探测真实连接 | MP11-DATA-01：连接与发现接真实 adapter，覆盖 SQL 注册路径 |
| 时间列 | `BackingDatasourcePanel.tsx:41/300` 有时间列输入；声明 payload 未传 tsColumn | 用户填入增量时间列，但该提交路径没有保存该值 | MP11-DATA-03：字段从表单到 API、存储、同步端到端一致 |
| 同步错误 | `SyncJobsPage.tsx:25–28` await 后才关闭 loading，缺少 catch/finally | 查询拒绝时不会执行 setLoading(false)，没有页级恢复说明 | MP11-REL-01 / DATA-04：错误态、finally、重试与记录深链 |
| 应用持久化 | AppHub 既有 SQLStore；注册 API 仍导入内存接口，`main.py` 的 factory 对 production fallback 有拒绝保护 | 需要验证目标 host 接线；不能因为 SQL 测试存在就宣称所有创建/发布路径持久化 | MP11-APP-02：创建 → 发布 → 运行 → 重启的一致存储验收 |
| 数据入口 | 当前八域路由含数据架构与本体映射/同步；未发现独立连接源管理主路由直接调用 `/api/v1/data/sources` | 后端已有能力，首次用户操作入口仍需串联 | MP11-UX-01 / DATA-02：任务向导和资产详情统一深链 |
| MCP 接入 | 已有标准 HTTP 协议、动态工具、caller/tenant 绑定、Keycloak + API Key | 重点是实际客户端配置、授权/撤销、写操作和故障兼容，不能重建一套 MCP 服务 | MP11-AGENT-01..04：客户端引导与真实兼容矩阵 |
| 官网 | `metaplatform-website/index.html` 存在；CTA 指旧 demo 域名；含仓库相对文档、占位 GitHub 与联系信息 | 未形成当前官网 → 当前平台可验证入口 | MP11-WEB-01..03：清理内容，公开 `/website/`，真实 `/home` 登录入口 |

现有本体模型/数据/查询/逻辑/治理路由均已实现拆分，1.1 不重复建设 IA v2。本轮也确认 SQL 仓库和 Debezium adapter 已经存在，部分 README 仍写“未来实现”，因此以源码接线为准。

## 5. dsh 与 WorkBuddy：两种产品方向与可验证接入

**1.1 做“外部 Agent 使用 MetaPlatform”；“MetaPlatform 托管外部 Agent”需要单独设计官方生命周期/API，不从 MCP 支持自动推导。**

| 项目 | 当前已证实 | 采用路径 | 验收边界 |
|---|---|---|---|
| dsh | 固定官方源码支持 stdio 与 streamable-http、自定义 headers、超时和重连；master package 为 alpha | 原生 MCP client + Cordis 配置指向 `/api/v1/mcp/protocol/mcp`；固定目标发行版本 | 配置导入、真实发现/查询、身份/租户、断线、撤销与写操作确认 |
| WorkBuddy | 官方文档提供 MCP、用户/项目级 mcp.json、command/args/env 的 stdio 示例；有 Skill/MCP/Hook/Agent/Rule 插件 | 优先受控本地 stdio 桥访问平台 HTTP；插件/Skill 提供安装与业务操作说明 | 原生 HTTP/headers 与插件打包未实测；不承诺两个客户端使用同一个插件包 |

[dsh 传输实现](https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/mcp/mcp-client/src/transport.ts)、[官方使用说明](https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/mcp/mcp-client/README.md)、[WorkBuddy MCP 文档](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)、[WorkBuddy 插件文档](https://www.workbuddy.cn/docs/workbuddy/Plugins)。本轮 WorkBuddy 原文已直接获取 HTTP 200 并缓存；浏览检索器打开失败不代表官方站没有内容。

工具沿用实际 `ont_list_classes / ont_inspect_class / ont_object_query` 等名称，默认只读；写入复用现有 `ont_preview_proposal / ont_confirm_proposal / ont_execute_proposal`。后端验证权限、批准主体、租户与幂等，模型提示词不能代替执行检查。短期复用已有可撤销凭据，后续 HTTP OAuth 完整发现、PKCE 与续期按[协议规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)及目标客户端能力逐项验收。

标准 MCP HTTP 路径已存在；1.1 不以新增独立 FastMCP 为前置条件。官方 Python SDK 内置的 FastMCP 与 PrefectHQ 的独立包名称相似，升级必须根据实际 API 和协议版本验证。

## 6. 产品 1.1：优先级与可见变化

| 优先级 | 用户能看到的结果 | 验收重点 |
|---|---|---|
| P0 真实与可靠 | 可进入平台的官网、真实字段、真实连接、完整增量参数、失败后可重试、正式运行状态明确 | 真实 PG/CSV → 对象 → 订单应用 → 人工批准 → 回执 → 重启恢复 |
| P0 易用性 | 初次任务向导、基础/高级建模、就地错误、草稿保护、发布预检 | 5 名首次用户至少 4 名在 30 分钟完成样例任务（拟定目标） |
| P1 管理与扩展 | 资产详情、质量/血缘、数据契约、应用版本、插件依赖、dsh/WorkBuddy 配置与诊断 | 两客户端兼容矩阵；越权、过期、重放、断线恢复与撤销 |
| 后续候选 | 更多 CDC、图存储扩展、时态记忆、托管外部 Agent | 先测出需求和收益，独立 PoC 与 ADR |

完整 29 条需求、交互、源码落点、测试与依赖见本次[产品 1.1 设计](../specs/2026-10-11-metaplatform-product-v1.1.md)。规划建议 6–8 周，假设 2 前端 + 2 后端 + 1 QA/产品投入；是工作量估算，不能作为当前交付承诺。

## 7. 官网具体设计与入口

官网沿用现有静态页面而做内容和部署接线更新，统一为 MetaPlatform：产品主张、数据 → 本体 → 应用 → Agent 链路、实际能力、订单场景、1.1 规划、常见问题。清除未核实的 demo/邮箱/客户/测试数/GA 口径，开发中的能力明确标注规划。

本地与现有部署：**公开 `/website/` → “进入平台” → `/home` → 现有登录 → 工作台**。原有八域业务路由与鉴权不被官网代替。独立官网部署用公开平台地址配置，公网域名/DNS 尚未提供。

预期改动：现有 `metaplatform-website/index.html`；前端 Vite 的开发/构建静态接线；Docker 构建确保官网源文件可用；官网 README 和入口测试。关键验收是页面匿名可打开、主按钮可进入真实平台登录、移动端与键盘可用、生产产物包含官网。

**状态：方案已拟定，官网实现等待本次设计确认。** 这是源码仓库的设计确认步骤，不是对外发布许可或生产状态声明。

## 8. 三种下一步路径

| 选项 | 范围 | 判断 |
|---|---|---|
| A 现有平台增量补差 | 官网确认后落地；按数据 → 本体 → 订单应用 → Agent → 恢复闭环交付 | **推荐**。复用已存在能力，直接解决当前差距 |
| B 增加元数据平台 adapter | 在 A 的数据阶段增加 OpenMetadata 单源 PoC；若收益不足则保持当前后端 | 对大量异构源有价值，但要承担额外运行与映射成本 |
| C 整体 fork 另一应用/数据平台 | 迁移数据、权限、模型、应用运行和发布体系 | 本轮不推荐：许可、双运行栈与重建成本高，缺少替换内核的证据 |

## 9. 调研证据与未完成的验证

采集脚本、20 个 API 原响应、提交 SHA、源码与许可证原文保存在 `research/2026-10-11-ontology-v1.1/`。缓存目录不进入 Git；`github-metadata.json`、`commit-snapshots.json`、`source-manifest.json` 与脚本用于复核和重取。原始源码使用提交 SHA 固定；失败的路径没有列入成功源码 manifest。

本轮已完成：Git/WIP 与 authority 读取、路由/入口/数据探测/应用/MCP 源码审计、3 类 GitHub 搜索、20 个候选元数据和许可证审核、主要两候选的关键源码及 7 个配套项目抽查、官方客户端说明、产品 1.1 设计。没有修改共享数据库、重启现有服务、改变身份配置或替换内核。

本轮未完成：20 个候选逐个部署、跨客户端真实联调、PG 全链路故障注入、平台全量回归、72 小时试运行、公网官网发布。这些属于后续实现与验收，不以静态调研、历史测试记录或容器健康代替。

整合 HTML 报告已用本地 Playwright 检查：20 行候选、29 个唯一需求、搜索/空结果、内容切换、键盘和章节跳转、内部锚点，以及 360/390/768/1440 宽度的页面溢出和无 JS 离线阅读。结果与截图保存在缓存工件 artifacts/report-qa.json。此项只验证报告显示与交互，不验证平台功能。
