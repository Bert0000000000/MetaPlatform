# G11 PRD：模型工作台搜索可命中业务说明和属性标题

状态：待实现 / 调研建议。优先级：P2。有效工作预算：60 分钟。发布单元：web 静态应用。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：语义模型发现效率。

当前证据：顶层筛选只包含 display_name 与 rid；用户知道属性业务词或对象说明时，现有模型仍搜不到。

基线固定源码：[metaplatform-frontend/apps/web/src/pages/ontology/model/OntologyGraphView.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/OntologyGraphView.tsx#L74)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：TIS / Protégé / Semantica，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

仅在已加载类型上扩展检索 description、properties.title 与 properties.rid；复用同一筛选结果供列表、资源树和图谱。

边界：不是向量搜索，不增加别名存储/AI 请求、不搜索实例敏感值、不重建索引服务。

## 用户操作、结果与文案

输入属性词（如客户编号） → 找到拥有该属性的类型 → 选择并打开属性检查器；清空恢复全部。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [metaplatform-frontend/apps/web/src/pages/ontology/model/OntologyGraphView.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/OntologyGraphView.tsx#L74) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] 名称/RID/说明/属性标题/属性 RID 均可命中，忽略大小写及空值。
- [ ] 结果只包含当前已授权租户加载的类型；关系筛选仍只连接可见端点。
- [ ] 搜索值维持现有 q URL 语义与刷新恢复。

## 独立测试

组件测试四字段命中、空值与无结果；真实浏览器用现有合成模型的属性标题查到类型，再清空恢复计数。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：仅 web 应用产物。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：上一 web 应用镜像。

## 60 分钟实施预算

| 操作 | 分钟 |
|---|---:|
| 读基线、核对复现 | 5 |
| 实现最小完整行为 | 20 |
| 目标回归与所需真实接口检查 | 15 |
| 独立环境发布及回滚核对 | 15 |
| 保存 evidence、说明边界 | 5 |

前置环境：依赖、独立测试资源、身份及预热发布目标已就绪。CI 排队/首次安装不是该功能粒度的保证；没有所需前提时记录阻塞，不能用省略测试补足时钟。实做超预算必须再拆范围；不能增加大能力后仍标 1h。

## 完成定义

差距在最新代码仍成立 → 改动与目标行为对应 → 正反例通过 → 独立应用发布/回滚有证据 → reviewer 可核对。写入项必须持久化读回；不涉及写入的项验证只读与零副作用。未完成任何一项即不能记 Done；本 PRD 本身不是实现/部署通过证据。
