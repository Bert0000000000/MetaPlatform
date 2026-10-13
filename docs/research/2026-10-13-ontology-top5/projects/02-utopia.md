# 2. deeplethe/utopia

快照：2026-10-13T07:35:57.520823+00:00；commit `cda374771577b2d42ed257312864ecf8e067bfbd`；Stars 8,309；forks 1,151；last push 2026-10-13T02:17:01Z；created 2026-08-07T19:33:17Z；size 12,571 KB。

技术栈：Rust/Axum/SQLx + PostgreSQL/pgvector + React。主仓库许可：Apache-2.0。匹配度：选择性借鉴。

## 关键代码路径

| 固定 SHA 文件 | 审读/定位结论 |
|---|---|
| [Cargo.toml](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/Cargo.toml) | Rust workspace 分为 store、ingest、extract、reason、search、server 等模块。 |
| [web/package.json](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/web/package.json) | React UI 与前端脚本；与 MetaPlatform 同属网页交互，但后端无法直接移植。 |
| [crates/utopia-server/src/api/ontology_routes.rs](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/crates/utopia-server/src/api/ontology_routes.rs) | 本体读写路由、导入 preview/apply 分离，改变本体时产生 ledger 记录。 |
| [crates/utopia-ingest/src/ontology_rdf.rs](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/crates/utopia-ingest/src/ontology_rdf.rs) | RDF/本体输入处理；应按支持结构逐项验证，不把文件后缀支持当全部 OWL 语义支持。 |
| [crates/utopia-store/src/ontology_regressions.rs](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/crates/utopia-store/src/ontology_regressions.rs) | kb_id 作用域查询、人的回归例子与保存的 last_result；读列表不重新执行模型。 |
| [web/src/pages/Ontology.tsx](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/web/src/pages/Ontology.tsx) | 类/属性 rail、图表视图、定义/关系/属性/实例详情，Import/Refine/Misses 为独立操作视图。 |
| [web/src/pages/EntityHistory.tsx](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/web/src/pages/EntityHistory.tsx) | 对象历史和可解释人工决策交互。 |

### 功能与代码判断

Rust workspace 通过 SQLx 与 PostgreSQL 管理类、关系、知识库作用域与回归例子。ontology_routes 中 preview_import 与 apply_import 分离，是比“选文件即 upsert”更可核对的设计；发生本体改变时留下 ledger 类型记录。ontology_regressions 查询同时绑定 kb_id、事实/实体/属性，列表读取已有结果，不以读取页面时自动跑模型替代明确评估。

项目仍标 v0.1，README 明确 schema 持续演进且迁移只有前进方向；Decision intelligence/部分 business rules 在 roadmap 中，不能作为已交付能力。MetaPlatform 也有 questions/evaluation/版本，不应因 Utopia 有回归面板就声称 MetaPlatform 完全没有评估。

### UI 操作链（源码可确认，未部署对方服务）

1. Ontology 页左侧 classes/properties rail → 中间 graph/table → 右侧 definition/relations/attributes/instances。选择模型后可在同一区域理解定义与实例，不必四次跳页。
2. Import、refine、misses 是独立操作视图；导入预览与正式 apply 不混在一个浏览文件事件中。
3. Regression panel 展示已保存例子及最近结果，和当前源标签一起读取；明确再检查才能更新结果，避免旧结果冒充本轮正确。
4. EntityHistory 给人工修改/裁决上下文。相应业务权限由 KB 成员角色约束，不能照搬为 MetaPlatform 租户权威。

### 对 MetaPlatform 的适用性

可借鉴预览确认、报告与目标绑定、父类/实例详情邻接导航。整套 Rust backend 接入成本高于界面增量；它的 KB scope 与本平台 tenant/RLS 是不同身份模型，不能仅对字段改名就迁移。相关差距：G01、G05、G06、G09、G10、G12、G16。

## 许可核对与复用范围

[LICENSE](https://github.com/deeplethe/utopia/blob/cda374771577b2d42ed257312864ecf8e067bfbd/LICENSE)。本轮主仓库文件未见额外的非商业/托管服务/嵌入用途限制；仍须保留通知并核对实际复制的依赖与插件许可证。主仓库许可判断不等同全依赖批准。
