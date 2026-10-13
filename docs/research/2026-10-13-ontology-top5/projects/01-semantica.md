# 1. semantica-agi/semantica

快照：2026-10-13T07:35:57.270908+00:00；commit `e247b94fbe4fc3a52bafae5997e48f1839e13b87`；Stars 13,985；forks 1,618；last push 2026-10-12T15:01:16Z；created 2025-06-25T10:41:00Z；size 50,080 KB。

技术栈：Python + FastAPI + React/TypeScript。主仓库许可：MIT。匹配度：重点借鉴。

## 关键代码路径

| 固定 SHA 文件 | 审读/定位结论 |
|---|---|
| [pyproject.toml](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/pyproject.toml) | Python 依赖与可选能力边界；不能只依据前端菜单推断服务都已启用。 |
| [semantica/explorer/app.py](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/semantica/explorer/app.py) | Explorer 应用入口，组合 API 路由与运行状态。 |
| [semantica/explorer/routes/ontology.py](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/semantica/explorer/routes/ontology.py) | 本体 HTTP 调度；registry/drafts/proposals 等部分状态放在 app.state，不能直接当企业级共享持久化方案。 |
| [semantica/ontology/engine.py](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/semantica/ontology/engine.py) | 生成器、验证器、质量门、版本管理和对齐接口组合；复用算法前要检查 store 与可选依赖。 |
| [explorer/src/workspaces/OntologyWorkspace/ShaclStudio.tsx](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/explorer/src/workspaces/OntologyWorkspace/ShaclStudio.tsx) | SHACL shapes 生成/选择/编辑/验证、结果回跳节点的交互。 |
| [explorer/src/workspaces/GraphWorkspace/GraphInspectorPanel.tsx](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/explorer/src/workspaces/GraphWorkspace/GraphInspectorPanel.tsx) | 来源字段、置信度、时间字段等分区；source/evidence 是被保留的元数据。 |
| [explorer/src/workspaces/OntologyWorkspace/ontologyUrlState.ts](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/explorer/src/workspaces/OntologyWorkspace/ontologyUrlState.ts) | 本体工作区可分享的 URL 状态；并不是所有画布相机状态都有持久化保证。 |

### 功能与代码判断

OntologyEngine 组合数据/文本生成、class/property 推断、验证/质量门、版本及 alignment。用户入口不只是 Python SDK：Explorer 具有 OntologyEditor、ProposalReview、ShaclStudio、Versions/Alignments/Vocabulary 等组件。SHACL validator 中有独立 pyshacl 路径；不要将自建约束表替代标准 SHACL 引擎。API 路由的部分 registry/proposals/drafts 使用进程 app.state，这在单实例交互中可用，但不能直接移植作为 MetaPlatform 多实例持久化或 RLS 权威。

### UI 操作链（源码可确认，未启动对方服务）

1. Ontology 工作区选择本体 → Loader/Editor 查看类/属性 → 修改表单/候选 → API 提交；必须追踪具体 endpoint，菜单出现不证明持久化。
2. SHACL Studio 选择本体 → 生成严格 shapes → 点 shape 聚焦文本 → 人工编辑 → validateShacl → 展示结果/节点跳转。loading/error 与成功结果分开，校验不是自动修复。
3. Graph Inspector 将来源/置信度和内容区分，便于用户沿 source/evidence 复核；时间字段参与其他 workspace，不应将全部界面字段视为不可变审计记录。
4. URL 状态帮助本体资源定位；MetaPlatform 已有 typeRef/q，可借鉴更精细状态，但不能重复造已有深链接。

### 对 MetaPlatform 的适用性

UI 组织与 Python 模块拆分直接相关；优先借鉴 SHACL 报告与候选证据复核、标准 context、检索与工作区状态。接入成本在 store/进程状态适配、依赖体积、身份/租户边界及模块实际执行证据。建议参考实现原则，在现有 Kernel/契约上增量开发，勿将 Explorer app.state 变成第二套模型权威。

相关差距：G02、G04、G07、G08、G10、G11、G13、G14、G15、G16。

## 许可核对与复用范围

[LICENSE](https://github.com/semantica-agi/semantica/blob/e247b94fbe4fc3a52bafae5997e48f1839e13b87/LICENSE)。本轮主仓库文件未见额外的非商业/托管服务/嵌入用途限制；仍须保留通知并核对实际复制的依赖与插件许可证。主仓库许可判断不等同全依赖批准。
