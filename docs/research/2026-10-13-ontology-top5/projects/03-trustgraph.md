# 3. trustgraph-ai/trustgraph

快照：2026-10-13T07:35:59.329691+00:00；commit `ea19308aaeb8458b9d988794eff7d4c0016bd43f`；Stars 2,804；forks 331；last push 2026-10-11T18:14:53Z；created 2024-07-10T19:14:04Z；size 104,157 KB。

技术栈：Python 分布式 flows + 独立 React UI。主仓库许可：Apache-2.0。匹配度：重点借鉴。

## 关键代码路径

| 固定 SHA 文件 | 审读/定位结论 |
|---|---|
| [trustgraph-flow/pyproject.toml](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-flow/pyproject.toml) | flow 服务依赖与分布式运行组成；接入需要平台运维成本。 |
| [trustgraph-flow/trustgraph/extract/kg/ontology/run.py](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-flow/trustgraph/extract/kg/ontology/run.py) | 本体抽取运行入口（目录树定位，未作为完整执行验证）。 |
| [trustgraph-flow/trustgraph/extract/kg/ontology/ontology_loader.py](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-flow/trustgraph/extract/kg/ontology/ontology_loader.py) | 类、父类、property、equivalent/disjoint/domain/range/基数等结构解析与结构检查。 |
| [trustgraph-flow/trustgraph/extract/kg/ontology/extract.py](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-flow/trustgraph/extract/kg/ontology/extract.py) | 本体引导的抽取管道；需要 ontology config 与处理上下文。 |
| [trustgraph-flow/trustgraph/query/ontology/query_explanation.py](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-flow/trustgraph/query/ontology/query_explanation.py) | 按处理元数据组织 query explanation；含模板措辞，不能把说明文本单独当真实推理证据。 |
| [trustgraph-base/trustgraph/provenance/triples.py](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/trustgraph-base/trustgraph/provenance/triples.py) | 来源链三元组构造，而不是只显示一条来源链接。 |
| [tests/unit/test_extract/test_ontology/test_ontology_loading.py](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/tests/unit/test_extract/test_ontology/test_ontology_loading.py) | 存在加载结构的测试源码；本轮仅审读，未运行对方测试。 |

额外 UI SHA：`02efcac8adf04a1de1a4f601c1ecbb70ed910d6d`。实际审读：

- [packages/portal/package.json](https://github.com/trustgraph-ai/trustgraph-ui/blob/02efcac8adf04a1de1a4f601c1ecbb70ed910d6d/packages/portal/package.json)
- [packages/trustkit/src/components/ontology/OntologyWorkbench.tsx](https://github.com/trustgraph-ai/trustgraph-ui/blob/02efcac8adf04a1de1a4f601c1ecbb70ed910d6d/packages/trustkit/src/components/ontology/OntologyWorkbench.tsx)
- [packages/trustkit/src/utils/ontology-importer.ts](https://github.com/trustgraph-ai/trustgraph-ui/blob/02efcac8adf04a1de1a4f601c1ecbb70ed910d6d/packages/trustkit/src/utils/ontology-importer.ts)
- [packages/trustkit/src/utils/ontology-exporter.ts](https://github.com/trustgraph-ai/trustgraph-ui/blob/02efcac8adf04a1de1a4f601c1ecbb70ed910d6d/packages/trustkit/src/utils/ontology-exporter.ts)
- [packages/trustkit/src/components/ontology/OntologyValidationPanel.tsx](https://github.com/trustgraph-ai/trustgraph-ui/blob/02efcac8adf04a1de1a4f601c1ecbb70ed910d6d/packages/trustkit/src/components/ontology/OntologyValidationPanel.tsx)

### 功能与代码判断

主仓库是 Python 分布式 flow/runtime，OntologyLoader 为抽取建立 classes/properties/hierarchy/约束结构。extract.py 消费本体指导抽取；来源三元组在 provenance 模块有实际构造代码。query_explanation 将处理元数据转换为步骤，部分内容是模板文本，单独的“置信度/解释句子”不能证明事实来源和执行轨迹正确。

UI 在同组织独立 trustgraph-ui 仓库，当前 Workbench、Importer、Exporter、ValidationPanel 均有源文件。Importer 使用 DOMParser 处理 XML，并有专门 Turtle 解析逻辑；Exporter 区分 owl/rdf/turtle 与 MIME/扩展名。虽然存在测试和 round-trip 宣称，本轮没有跑真实部署或遍历全部 OWL 语法，不将其记为完整 OWL2 保真结论。

### UI 操作链（源码可确认，未部署对方服务）

1. Ontology 列表选择 → 类/属性树 → 右侧编辑器或 metadata；校验面板可切换显示，供发布前核对。
2. Importer 读取文件识别 XML/Turtle → 解析结果或 importError → 本体状态更新。多格式能力由真实 parser 支撑，不只是文件过滤器。
3. Export 操作选择格式 → 对应 serializer → 对应 MIME/后缀下载。删除有显式确认；确认本身不等同服务端引用检查。
4. Agent/GraphRAG 的解释与 context 视图依赖部署 backend，与 ontology workbench 是不同消费者，不能由 UI 源码证明完整业务链成功。

### 对 MetaPlatform 的适用性

标准格式与报告组件适合参考；完整 runtime 需要数据存储、flow、队列/服务配置，不是给现有平台装一包即可上线。沿用 Kernel 权威，优先修已有序列化、显示完整性与错误边界。相关差距：G01、G02、G03、G04、G06、G08、G13、G14、G15。

## 许可核对与复用范围

[LICENSE](https://github.com/trustgraph-ai/trustgraph/blob/ea19308aaeb8458b9d988794eff7d4c0016bd43f/LICENSE)。本轮主仓库文件未见额外的非商业/托管服务/嵌入用途限制；仍须保留通知并核对实际复制的依赖与插件许可证。主仓库许可判断不等同全依赖批准。
