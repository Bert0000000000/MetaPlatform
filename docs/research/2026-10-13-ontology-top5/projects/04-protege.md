# 4. protegeproject/protege

快照：2026-10-13T07:35:58.685482+00:00；commit `bf03cccc65ea664e139d6829bba6d209ef58ee55`；Stars 1,579；forks 316；last push 2026-10-01T16:36:14Z；created 2013-08-20T01:26:26Z；size 44,245 KB。

技术栈：Java/Swing + OWLAPI + reasoner 插件。主仓库许可：BSD-2-Clause（实际 license.txt）。匹配度：语义与交互参照。

## 关键代码路径

| 固定 SHA 文件 | 审读/定位结论 |
|---|---|
| [pom.xml](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/pom.xml) | 多模块 Maven 与插件构建入口。 |
| [protege-editor-owl/pom.xml](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/protege-editor-owl/pom.xml) | OWL 编辑器与 OWLAPI 依赖边界，reasoner 可作为插件。 |
| [protege-editor-owl/src/main/java/org/protege/editor/owl/model/inference/OWLReasonerManagerImpl.java](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/protege-editor-owl/src/main/java/org/protege/editor/owl/model/inference/OWLReasonerManagerImpl.java) | reasoner factory 注册、NoOpReasoner、实例生命周期、进度及推理状态管理。 |
| [protege-editor-owl/src/main/java/org/protege/editor/owl/ui/view/cls/ToldOWLClassHierarchyViewComponent.java](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/protege-editor-owl/src/main/java/org/protege/editor/owl/ui/view/cls/ToldOWLClassHierarchyViewComponent.java) | 声明类层级与选择/编辑视图。 |
| [protege-editor-owl/src/main/java/org/protege/editor/owl/ui/view/cls/InferredOWLClassHierarchyViewComponent.java](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/protege-editor-owl/src/main/java/org/protege/editor/owl/ui/view/cls/InferredOWLClassHierarchyViewComponent.java) | 使用 inferred hierarchy provider，背景区分推导视图，并复用实体搜索/选择。 |
| [license.txt](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/license.txt) | API 为 NOASSERTION，但实际许可证是 BSD 两条款；应以真实文件核对，不能误记无许可。 |

### 功能与代码判断

Java/Swing 桌面编辑器以 OWLAPI 管理本体，reasoner factory/插件负责推理；没有 reasoner 时存在 NoOpReasoner。Told 与 Inferred hierarchy 使用不同 provider；Inferred 视图使用专门背景与选择路径，这是区分声明事实和推导事实的可靠产品表达。推理进度、缓冲与模型变更必须同步，不能以点击过 reasoner 菜单就宣称结果是新鲜的。

主仓库 API license 为 NOASSERTION，而 license.txt 明确两条款 BSD；本轮已审读。发行版可能组合第三方插件，主仓库许可不覆盖所有插件。这里借鉴交互/语义，不将整个 Swing 桌面 UI 嵌入 Web 平台。

### UI 操作链（源码与官方资料确认，未运行桌面包）

1. 选择实体/类树 → frame 编辑属性/公理 → 选择模型保持各 view 同步。
2. 选择 reasoner → 初始化/计算 → inferred hierarchy provider 更新；声明层级与推导层级各有来源，用户可分辨。
3. 通过 entity finder 查类，再在层级定位；同名实体需要 IRI 上下文，而不是用显示名称唯一匹配。
4. 语义编辑是学术/标准本体工具的优势；数据源同步、Action/数字员工、平台租户不是同一产品范围。

### 对 MetaPlatform 的适用性

优先借鉴父类可见性、校验覆盖/新鲜度、标题往返与实体检索。完整 OWL2 语义若成为新产品目标，需要 reasoner 性能、身份映射、数据边界和专门一致性数据集，不能当成一个 1 小时工单。相关差距：G01、G03、G04、G07、G09、G11、G12、G14。

## 许可核对与复用范围

[license.txt](https://github.com/protegeproject/protege/blob/bf03cccc65ea664e139d6829bba6d209ef58ee55/license.txt)。本轮主仓库文件未见额外的非商业/托管服务/嵌入用途限制；仍须保留通知并核对实际复制的依赖与插件许可证。主仓库许可判断不等同全依赖批准。
