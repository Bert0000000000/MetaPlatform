# 5. datavane/tis

快照：2026-10-13T07:35:57.990290+00:00；commit `afc1595326264947cf52791d13e81dbcee808e78`；Stars 1,425；forks 304；last push 2026-10-11T10:10:14Z；created 2019-01-23T13:44:33Z；size 42,054 KB。

技术栈：Java/Maven + 数据集成插件 + 配置驱动 Web UI。主仓库许可：Apache-2.0。匹配度：选择性借鉴。

## 关键代码路径

| 固定 SHA 文件 | 审读/定位结论 |
|---|---|
| [pom.xml](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/pom.xml) | Java 多模块构建与 tis-console/tis-plugin 等模块；插件生态不是一个 Python 可直接导入的库。 |
| [tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/Ontology.java](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/Ontology.java) | 本体域、对象、关系、共享属性、词典等插件分类及按域加载。 |
| [tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/OntologyObjectType.java](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/OntologyObjectType.java) | 物理数据源/对象属性绑定的核心类型；需要配套 connector。 |
| [tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/OntologyGlossary.java](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/OntologyGlossary.java) | 词典的 target 与 synonyms 结构，业务词与技术字段之间的语义连接。 |
| [tis-console/src/main/java/com/qlangtech/tis/runtime/module/action/OntologyAction.java](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/tis-console/src/main/java/com/qlangtech/tis/runtime/module/action/OntologyAction.java) | getObjectType/getOntologyDetail 配置控制器及 ChatBI 流式 TraceStep 输出。 |
| [tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/chatbi/ChatBIService.java](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/tis-plugin/src/main/java/com/qlangtech/tis/plugin/ontology/chatbi/ChatBIService.java) | ChatBI ask/查询结果接口；不能仅因接口存在就认为执行后端全部可用。 |

### 功能与代码判断

本体以插件分类组织 Domain、ObjectType、Linker、SharedProperty、ValueType、Glossary、Action/Function。Ontology 类按 domain 和 plugin metadata 加载，主存储/物理表/字段绑定依赖配套 connector。Glossary 的 target/synonyms 将业务术语指向语义资源，ChatBIService 接口和控制器的 TraceStep 输出体现语义层驱动查询的设计。

这是数据集成/语义层平台，与 MetaPlatform 的源绑定、共享属性、动作有交集。当前主仓库含配置控制器，完整当版 Web UI 不在此次固定主仓库 tree 中；旧 robincoin/ng-tis 不能证实是当前版本，因此没有用 Angular9 旧仓库替当前功能背书。

### UI 操作链（官方使用文档 + 控制器，非现场体验）

1. 建本体域 → 从物理表引入 ObjectType → 定义属性/共享属性/值类型 → 配置 LinkType 的外键、关联表或中间对象方式。
2. 配置 Glossary 术语及同义词，关联业务实体/属性；帮助 ChatBI 消除不同字段命名与业务语言之间的差异。
3. 官方 AI 推理操作是勾选已引入的对象表、调整提示与审核建议；本轮没有验证“自动完成 90%”等营销比例。
4. ChatBI 输出 SQL/结果与处理步骤，需要真实数据源才能验证问数是否正确，不能用控制器存在判完成。

官方材料：https://tis.pub/docs/guide/ontology/ 和 https://www.tis.pub/docs/guide/ontology/skill/skill-inference-ontology-res/ 。

### 对 MetaPlatform 的适用性

借鉴业务语义可发现性、属性标题和来源证据就地复核；保留已有逆向建模人工审查/发布/同步流程，不能说它尚未存在。Java plugin 与 XML/外部存储的治理成本不同，不推荐照搬为 Kernel 的第二套定义库。相关差距：G03、G11、G16；真实数据源阻塞沿用 #112，业务 Action 阻塞沿用 #114。

## 许可核对与复用范围

[LICENSE](https://github.com/datavane/tis/blob/afc1595326264947cf52791d13e81dbcee808e78/LICENSE)。本轮主仓库文件未见额外的非商业/托管服务/嵌入用途限制；仍须保留通知并核对实际复制的依赖与插件许可证。主仓库许可判断不等同全依赖批准。
