# Ontology TOP5：代码、功能、UI交互复核与18项差距

日期2026-10-13。MetaPlatform源码基线dc8980d3e129e94f0bc55190705ede7cbe304ba0；既有研究基线939aae37d28c03493c06947619766d78a124b2c0。本轮是既有研究的交叉复核与增量，未运行五套产品、未实施功能、未部署云端。

## 1. 排名口径与已有成果

原仓库已有G01–G16 / #118–#133，每项PRD、Prompt与仓库存档ZIP。本轮保留，不重复创建；补充G17/G18，修订G03。原详细报告见[REPORT.md](REPORT.md)，五项目专篇见projects/；历史索引见ISSUES.md，增量实际编号见AUDIT-ISSUES.md。

候选池为GitHub topic:ontology按Stars降序前50项，排除区块链、纯词表/数据集/索引及非本体核心软件后，取其中前五。**不是整个GitHub全部语义技术项目的穷尽排名，也不是质量/成熟度排行榜。**未标该topic的引擎不在此候选池，Stars不证明正确性。候选快照见evidence/candidate-pool.json，原SHA/源清单见evidence/。

| 项目 | Stars：2026-10-13原始快照 | 代码SHA短标识 | 主要参考价值 |
|---|---:|---|---|
| semantica-agi/semantica | 13985 | e247b94 | Python本体生成/质量组合、SHACL编辑与来源查看 |
| deeplethe/utopia | 8309 | cda3747 | KB作用域、统一图谱/详情选择、导入审核 |
| trustgraph-ai/trustgraph | 2804 | ea19308 | 约束引导抽取、结构检查、多格式编辑/导出 |
| protegeproject/protege | 1579 | bf03ccc | OWLAPI、声明/推导分离、层级与reasoner生命周期 |
| datavane/tis | 1425 | afc1595 | 数据绑定驱动业务本体、共享属性、词典、人审配置 |

原项目报告识别主许可证为MIT/Apache-2.0/Apache-2.0/BSD-2-Clause/Apache-2.0；仅是原主仓库文本识别，不代表全部插件/依赖复用批准。没有因Stars高就推荐替换MetaPlatform内核。

## 2. 五项目代码与UI复核

### Semantica

[OntologyEngine](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/semantica/ontology/engine.py)组合generator、class/property推断、OWL、evaluator、validator、quality_gate、LLM、VersionManager；alignment要求明确store和完整predicate URI。模块存在不代表当前部署已配置运行。

[ShaclStudio](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/explorer/src/workspaces/OntologyWorkspace/ShaclStudio.tsx)操作链：选择本体→形状库→Monaco编辑完整/选中shapes→生成或validate→结果/节点回跳。fullShacl与当前片段分开，加载有取消逻辑。**切换目标清空validation，但handleValidate的await回调仍缺同等代际保护，不可直接拷贝为竞态已解决。**MetaPlatform自己的OntologyGraphView已有generation模式，更适合复用。

原报告app.state草稿/候选不能成为第二套多实例模型权威。主要借鉴G07/G08/G15/G17的报告与状态可信表达；大规模SHACL编辑器不包装成1小时任务。

### Utopia

[ontology_routes.rs](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/crates/utopia-server/src/api/ontology_routes.rs)读要求KB Viewer、写要求Editor；key/label分开，父类列表、disjoint缺省不修改；改动后排补索引和对齐任务。部分audit调用best-effort，不可移植为强制审计保证。

[Ontology.tsx](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/web/src/pages/Ontology.tsx)以统一sel联动Classes/Properties资源栏、图/表、definition/relations/attributes/instances详情；修改在弹窗，import/refine/misses/regressions单独接管区域，减少导航丢失上下文。图/表偏好有意按浏览器共用，不等于含RID的布局可跨用户租户共享。源码已有RulesPanel，不能笼统声称所有业务规则只在roadmap；也不能仅凭组件名证明全部运行。

借鉴G05预览确认、G10上下文、G12父类导航、G16证据邻接，不引入Rust后端或第二工作室壳。

### TrustGraph

[OntologyLoader](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-flow/trustgraph/extract/kg/ontology/ontology_loader.py)用dataclass表示类/属性/domain/range/inverse/基数，validate_structure检查继承环、未知引用和互斥引用；subclass_of单值、配置事件更新内存定义。这是抽取结构上下文，不是完整OWL2 DL引擎或共享持久化权威。

UI另在trustgraph-ui，固定SHA02efcac8adf04a1de1a4f601c1ecbb70ed910d6d。[exporter](https://github.com/trustgraph-ai/trustgraph-ui/blob/02efcac8adf04a1de1a4f601c1ecbb70ed910d6d/packages/trustkit/src/utils/ontology-exporter.ts)明确分派格式/拒绝未知值，MIME与后缀一致，XML/Turtle转义分开，propId与label分开。**XML分支有inverseOf/functional/inverseFunctional，Turtle分支未同等输出，多格式不等于全语义无损。**UI链为选择本体/类属性→编辑→校验→选择导出格式；未做本轮端到端点击和性能测试。

借鉴G01–G04/G06/G18的局部正确性，不整体移植flow运行时。

### Protégé

原[专篇](projects/04-protege.md)覆盖Java/Swing、Maven、OWLAPI、reasoner manager及Told/Inferred视图。本轮复读[InferredOWLClassHierarchyViewComponent](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/protege-editor-owl/src/main/java/org/protege/editor/owl/ui/view/cls/InferredOWLClassHierarchyViewComponent.java)：明确inferred provider、专属背景、实体finder和selection。价值是结果来源可辨，不是同一列表换色。

交互：实体搜索/选择→声明编辑→选择运行reasoner→推导层级。MetaPlatform应清楚显示是否执行、是否新鲜和覆盖范围，G09/G12/G17可做局部增量。完整推理器生命周期/语义性能为后续设计，不能等同UI标签修复。

### TIS

[Ontology.java](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/Ontology.java)由Describable/Descriptor、domain/plugin metadata组织对象、Linker、SharedProperty、ValueType、Glossary、Action、Function，按域加载。配置XML辅助操作不能替代MetaPlatform Kernel/RLS，也不据此断言上层无鉴权。

UI以[官方指南](https://tis.pub/docs/guide/ontology/)和原专篇的控制器证据为依据，未拿旧Angular仓库冒充当前版本。流程：物理表→对象/属性语义角色→关系→共享属性/值类型→业务词典→AI建议人工审核。营销百分比不作为实测准确率。MetaPlatform已有profile、候选证据、人审，差距是来源统计邻接、标题与可发现性，非整个逆向建模从零缺失。对应G03/G11/G16，真实连接与Action阻塞保留#112/#114。

## 3. 18项差距及局部边界

| ID | Issue | 优先级 | 代码影响 | 验收目标 |
|---|---|---|---|---|
| G01 | #118 | P1 | ont | Turtle名称转义后可解析 |
| G02 | #119 | P2 | ont | 明确JSON-LD扩展词汇；不等于原JSON-LD必然语法非法 |
| G03 | #120 | P1 | ont | 标题往返，且不污染Turtle属性身份；本轮v2修订 |
| G04 | #121 | P2 | web | 连接已有Turtle下载能力 |
| G05 | #122 | P1 | web | 导入前摘要与确认，取消零POST |
| G06 | #123 | P2 | web | 区分类型加载失败/空列表并可重试 |
| G07 | #124 | P1 | web | SHACL结果绑定目标、防迟到响应 |
| G08 | #125 | P2 | web | 完整JSON校验报告下载，自带目标保护不依赖G07 |
| G09 | #126 | P1 | web | 公理零执行/部分覆盖不显示全通过 |
| G10 | #127 | P2 | web | 可信用户/租户布局缓存分区，不据此声称后端泄露 |
| G11 | #128 | P2 | web | 搜索业务说明、属性标题/RID |
| G12 | #129 | P2 | web | 直接父类显示与就地导航 |
| G13 | #130 | P1 | ont | legacy SPARQL明确拒绝未执行写操作 |
| G14 | #131 | P1 | ont | legacy parser拒绝FILTER/OPTIONAL，不冒充完整SPARQL |
| G15 | #132 | P2 | web | Violation/Warning/Info按真实等级展示 |
| G16 | #133 | P2 | web | 引用来源列统计就地展开，不展示敏感samples |
| G17 | 见增量索引 | P1 | web | lint加载中不提前报零问题 |
| G18 | 见增量索引 | P2 | ont | 未知导出格式明确4xx，而非静默JSON-LD |

共12项web代码、6项ont代码增量，指修改边界，不证明正式云端已支持单应用任意分支发布。新票分别只改变lint状态和format参数。G03不等G01，G08不等G07；同文件合并冲突仍须重基/串行领取。

## 4. MetaPlatform直接审读依据

以下均固定本轮代码SHA，前后端不是凭旧README判断缺失：

- [export/import后端](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py)：title/slug共享、Turtle转义、context、format分派。
- [导入导出UI](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx)：选文件即import、加载吞错、仅JSON-LD。
- [校验UI](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx)：lint加载、SHACL结果归属/下载/severity。
- [公理UI](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/axioms/AxiomsPage.tsx)：checked/skipped与conforms表达。
- [模型工作台](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/OntologyGraphView.tsx)：已有q/typeRef/linkRef与请求generation，搜索仅名称/RID。
- [图谱适配](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/graph/SchemaGraphCanvas.tsx)和[Inspector](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/graph/ModelInspector.tsx)：固定layoutKey、属性/关系/导航已有，直接父类未显示。
- [EvidenceEditor](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/from-data/EvidenceEditor.tsx)：profile与引用已有，统计展示未就地展开。
- [SPARQL API](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/api.py)和[parser/executor](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py)：legacy兼容路径不等于v2 PG查询/写入。

## 5. 估算、测试、部署与未覆盖

每票完整局部行为、测试、发布/回滚同票，不另拆依赖票。60分钟为预热环境有效工作预算，不包括对CI排队/审批/首次安装的时钟保证。详见[AUDIT-DELIVERY.md](AUDIT-DELIVERY.md)。现有[Tencent workflow](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/.github/workflows/tencent-demo-deploy.yml)受信main、65/80分钟任务超时不能被当作实际耗时或跳门禁理由。独立候选部署环境本轮未建立/验证，缺失则仍阻塞验收。

完整OWL2推理、任意本体语义无损往返、全SHACL编辑器、跨本体alignment治理、新三元组引擎与大规模协作不是上述18票完成后的自动成果；其是否属于产品目标、现有覆盖与运行差距仍需专门设计。现有question_bank/evaluation/lineage等不能未复核就声称完全没有。

本轮UI研究为源码事件/状态和官方文档，不是五产品逐一实机体验；原报告云端观察未在本轮复测，不把代码SHA当部署SHA。未运行应用测试或云端发布，不把文档质量检查冒充业务验证。

## 6. 文档附件

旧16票ZIP保留，Git tree已确认实际blob/大小，未逐个解压复核。G03-v2/G17/G18在Issue中增加本仓库固定SHA的独立PRD/Prompt原文件下载链接；不是声称使用GitHub原生user-attachments上传接口。新ZIP另作本次会话下载包，不能冒充已上传的GitHub ZIP。所有文档都是待实施要求，不是修复代码或上线证明。
