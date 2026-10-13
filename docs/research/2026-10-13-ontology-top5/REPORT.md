# Ontology TOP5：代码、功能、UI 交互与 MetaPlatform 差距调研

日期：2026-10-13。状态：调研建议 / PRD 草案；本报告不修改任何 Accepted/Gate/GA 状态。MetaPlatform 代码基线：[dc8980d3e129e94f0bc55190705ede7cbe304ba0](https://github.com/Bert0000000000/MetaPlatform/commit/dc8980d3e129e94f0bc55190705ede7cbe304ba0)。

## 结论

优先修补现有业务本体能力的可靠性和交互闭环：导出语法与标题保真、导入预览、校验范围和报告对象绑定、图谱状态隔离与语义检索。MetaPlatform 已有建模、数据同步、发布版本、SHACL、公理、业务动作等能力，不需要为了追赶 Stars 替换整个内核。Semantica/TrustGraph 最适合参考 Python/React 实现；Utopia/TIS 适合参考业务交互；Protégé 适合校准语义与声明/推导区分。

## 筛选口径与排名边界

GitHub REST `search/repositories?q=topic:ontology&sort=stars&order=desc&per_page=50`，保存完整候选快照；对前 50 名进行相关性筛选，取其中 Stars 最高的五个软件项目。Ontology/语义建模须为核心代码能力。排除区块链（ontio/ontology）、清单、纯本体数据集、仅提供词汇类型声明的项目、普通自动化工具。排除位于 Protégé 前的 n8n-as-code：核心是 n8n 工作流/节点能力，不是本体建模内核。没有从榜单中排除高热度 AI 项目以制造传统编辑器排名。

这是该主题与上述筛选范围内的 TOP5，**不是所有 GitHub 仓库的全球完整排名，也不是质量排行榜**。未标该 topic 的 Jena/RDFLib 等引擎可能有更高 Stars；WebProtégé/WebVOWL 适合作为传统交互补充，但在本次范围内 Stars 不进入前五。Stars、fork、push 与 SHA 取 2026-10-13 GitHub API 快照，可随时间变化。筛选并未要求必须有 UI；实际五项均找到 UI 或官方交互材料。

| 项目 | ⭐ Stars | 🍴 Forks | 📅 Last push (UTC) | 💻 Language | License | Recommendation |
|---|---:|---:|---|---|---|---|
| [semantica-agi/semantica](https://github.com/semantica-agi/semantica) | 13,985 | 1,618 | 2026-10-12T15:01:16Z | Python | MIT | 重点借鉴 |
| [deeplethe/utopia](https://github.com/deeplethe/utopia) | 8,309 | 1,151 | 2026-10-13T02:17:01Z | Rust | Apache-2.0 | 选择性借鉴 |
| [trustgraph-ai/trustgraph](https://github.com/trustgraph-ai/trustgraph) | 2,804 | 331 | 2026-10-11T18:14:53Z | Python | Apache-2.0 | 重点借鉴 |
| [protegeproject/protege](https://github.com/protegeproject/protege) | 1,579 | 316 | 2026-10-01T16:36:14Z | Java | BSD-2-Clause（实际 license.txt） | 语义与交互参照 |
| [datavane/tis](https://github.com/datavane/tis) | 1,425 | 304 | 2026-10-11T10:10:14Z | Java | Apache-2.0 | 选择性借鉴 |


层级：重点借鉴 2 项（Semantica/TrustGraph）；选择性借鉴 2 项（Utopia/TIS）；语义与交互参照 1 项（Protégé）。这里的层级反映 MetaPlatform 技术栈与业务用途匹配度，不改变按 Stars 的名次。

## 研究方法与证据边界

- 使用 GitHub API 取得 metadata、完整递归 tree 和固定 SHA 源文件；正文链接固定到当次 SHA。`evidence/` 保留候选池、快照和下载源码的 SHA256 清单。原始 API/源码缓存保存在本地，不将第三方源码整份复制进本仓库。
- 五项均审读实际核心代码与依赖文件；TrustGraph 的 UI 在其独立 `trustgraph-ui` 仓库，固定额外 SHA 分析。TIS 当前 UI 交互依官方使用文档和主仓库控制器；找到的旧 ng-tis 仓库无法证实与当前版本一致，因此未拿其旧代码证明当前 UI。
- MetaPlatform：读取当前 AGENTS/ADR/契约、前后端代码与既有 issue；浏览器只读访问云端模型工作台、导入导出界面。没有部署第三方项目，没有运行其测试，也没有声称已完成五项项目的真实服务端端到端验收。
- UI 结论明确区分：**源码可确认**（事件、状态、请求路径）、**官方文档说明**（操作步骤）与 **本轮浏览器观察**（MetaPlatform）。项目规模、测试文件存在或 HTTP 200 不作为业务链路成功证据。
- 许可证逐项审读文件；结论仅是本轮主仓库文本识别。依赖/插件/字体等如需复制接入须逐一保留通知并审计，不能以主仓库 MIT/Apache/BSD 代替全部依赖审查。

## 功能比较

| 维度 | Semantica | Utopia | TrustGraph | Protégé | TIS | MetaPlatform 当前基线 |
|---|---|---|---|---|---|---|
| 类型/属性/关系 | 本体 registry、editor、生成/审核 | 类/关系/属性及 open/strict 场景 | ontology loader + workbench | OWL 实体与公理 | ObjectType/Linker/SharedProperty | Kernel 基元、属性、关系、接口、父类；不是空白 |
| 标准交换 | RDF/OWL、导入导出、SHACL 组件 | RDF 导入 preview/apply | UI OWL/XML/Turtle importer/exporter | OWLAPI 格式与插件 | 主要物理数据→业务语义配置 | v2 JSON-LD、Turtle 分支已存在；需修边界，不可笼统写“没有导出” |
| 数据到本体 | text/data generator + quality gate | 抽取、候选对齐/回归例子 | ontology-guided extraction | 编辑器及外围插件 | 数据源/表字段绑定、LLM 辅助（文档） | PR #98 逆向发现、来源 profile、候选证据、人工审核/发布/同步已合入 |
| 校验/推理 | ontology validator、pyshacl 分支、studio | 公理和约束、人工回归例子 | 结构检查、抽取规范、查询解释 | reasoner factory 与声明/推导层级 | 语义配置及 ChatBI query trace | SHACL Core 子集、公理运行时校验、规则推理/解释；不是完整 OWL2 reasoner |
| 图谱交互 | search/inspect、邻域、来源/时间 | graph/table + inspector/历史 | 2D/3D context 与本体树（UI 子仓库） | 实体树、frame 与 selection | 域/对象/关系配置（官方文档） | 类型树+图谱+Inspector、拖动缩放/关系选择、typeRef/q 深链接已有 |
| 身份/存储 | Explorer 部分 app.state，需继续核验 | kb_id 作用域、PG、成员权限 | 分布式运行与上下文隔离需部署核验 | 本地桌面，非多租户业务平台 | 插件/域/外部数据源，非 Kernel RLS 替代品 | tenant ctx、非特权 PG/RLS、Outbox/版本/动作架构是保留优势 |
| 部署 | Explorer/服务/依赖按可选能力 | 自托管，v0.1 schema 前进迁移 | 多组件配置和数据后端 | 桌面发行包 | Java 服务与 connector 插件 | 已有 Tencent Demo Deploy 门禁、应用回滚；本次仅规划增量，未部署 |

## MetaPlatform 基线定位

权威入口 [AGENTS.md](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/AGENTS.md)；草稿/版本 ADR-0080 与迁移 ADR-0082；API 单源 [mate-platform-backend/contracts/openapi/services/ont.yaml](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/contracts/openapi/services/ont.yaml)。

浏览器观察（2026-10-13，云端应用部署 SHA 未在本轮核定，不能把它直接等同代码基线）：

1. `/ontology/model/graph` 显示 77 类型、53 关系，类型树、图谱、缩放/适应/重置、局部关联、属性检查器；选择客户后 URL 生成 `typeRef`。已有深链接，故不提交“新增类型深链接”。
2. `/ontology/governance/import-export` 有目标类型下拉、JSON-LD 导出与 Choose File；未见格式选择或导入预览。未导入、发布、同步或修改任何存量模型。
3. 云端已存在 #111–#117 的独立人工测试问题；本报告将它们列为先处理的业务链路缺陷，而不重复创建。发布前再次 fetch 主分支，从 08a84ec1 更新至本报告所示 SHA；G03 同步改为当前 property_slug 取名导致业务标题丢失，而不重复已修的领域 slug 解析。

代码审计重点：v2 `export_object_type/import_object_type`、ModelValidationPage、AxiomsPage、OntologyGraphView/SchemaGraphCanvas/ModelInspector、EvidenceEditor 与 legacy SPARQL 兼容路由。旧 `owl/io.py` 的统计式解析不用于断言 v2 内核没有标准能力；legacy SPARQL 也不代替 v2 业务查询/写入。

## 已有 issue 去重

| 既有 issue | 处理边界 |
|---|---|
| [#111](https://github.com/Bert0000000000/MetaPlatform/issues/111) 属性 slug 重复误判 | 引用原工单；不再提交相同 RID/slug 修复 |
| [#112](https://github.com/Bert0000000000/MetaPlatform/issues/112) 注册数据源配置阻塞 | 需要真实连接配置；不伪造接入成功，不复制为新 connector 任务 |
| [#113](https://github.com/Bert0000000000/MetaPlatform/issues/113) 物化样本重复列 | 与 G03 的模型标题序列化不同，保持独立 |
| [#114](https://github.com/Bert0000000000/MetaPlatform/issues/114) Action 表单无保存/测试无反馈 | 完整动作链涉及保存/执行/审计，不以隐藏按钮当闭环 |
| [#115](https://github.com/Bert0000000000/MetaPlatform/issues/115) 使用量写统计缺失 | 不将缺指标当 0；原工单承担链路核对 |
| [#116](https://github.com/Bert0000000000/MetaPlatform/issues/116) 应用引用 500 | 原工单负责依赖恢复；不得把未知引用当无引用 |
| [#117](https://github.com/Bert0000000000/MetaPlatform/issues/117) 新建类型缺少删除入口 | 原工单处理退役/引用/删除语义，不复制成新按钮任务 |

## 高阶差异如何处理

完整 OWL2 DL reasoner、任意本体全量保真导入、人工 competency case 自动回归、跨文档事实级 provenance DAG、可维护的业务术语库，都是值得继续评估的能力差异。但 MetaPlatform 的已接受产品目标是业务本体/数字员工平台，并非完全复制 Protégé。现有源码已经包含 reasoning/explain、question_bank/evaluation、lineage、候选 evidence/aliases 等对应基础；本轮没有足够运行证据将它们判定为整项缺失。

因此本轮确认差距只进入下方 16 项可验证增量；每项 PRD 明确它解决的局部缺口。完成这些工单**不等于上述高阶能力达到对标项目全功能**。如要将完整 OWL2、外部本体迁移等升级为产品目标，先调整权威规格和评估真实语义/存储/身份成本，再形成另一轮垂直切片；不能把库安装、菜单、mock 数据或全库迁移包装成一小时独立部署成果。

## 1 小时拆分原则

16 项都是基于当前主分支即可独立做、独立验证、独立发布的增量；**不依赖本次其他工单先完成**，同文件修改可能有合并冲突，需要各分支重基并重新验证。每项交付完整局部用户行为，测试与部署包含在同一个工单，未把测试/部署分成依赖票。

每项有效工作预算 60 分钟：读基线/复现 5、实现 20、测试 15、独立发布及回滚核对 15、证据 5。前提为依赖已安装、独立测试身份/数据/端口与预热部署目标已可用。CI 排队、首次安装、大镜像下载不由功能粒度控制；现有 Tencent 发布流水线 gate/deploy timeout 为 65/80 分钟，**不能据此保证从领取到云端完成的墙钟时间必小于一小时**。如任务实做超预算，记录耗时和阻塞并继续拆小，不跳过必需测试或伪报部署完成。

最小部署单元：11 项只发 web 应用，5 项只发 ont 服务；全部无需新基础设施或数据库迁移。复用已有 CI/部署流程，禁止重建共享数据库、清理卷或停止其他工作树服务。未来实际部署必须核对 `deploy-result.json` revision、改动路径的 UI/API 行为以及持久化读回（若工单涉及写入），不能只用容器健康判通过。
