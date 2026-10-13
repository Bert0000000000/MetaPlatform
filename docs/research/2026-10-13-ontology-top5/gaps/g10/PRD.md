# G10 PRD：模型工作台图谱布局缓存按用户和租户隔离

状态：待实现 / 调研建议。优先级：P2。有效工作预算：60 分钟。发布单元：web 静态应用。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：图谱工作状态隔离。

当前证据：layoutKey 固定 model-workbench；OntologySchemaGraph 写入同源 localStorage。RID 多数可区分租户，但同浏览器不同用户仍共享布局键与读取集合。

基线固定源码：[metaplatform-frontend/apps/web/src/pages/ontology/model/graph/SchemaGraphCanvas.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/graph/SchemaGraphCanvas.tsx#L30)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：Utopia / Semantica，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

在现有 layoutKey 加入可信登录 user/tenant 上下文；无身份时不复用持久缓存。旧未分区缓存不自动并入其他身份。

边界：只隔离既有手动节点位置，不承诺保存相机、不上传个人布局、不修改鉴权或模型数据。

## 用户操作、结果与文案

用户 A/租户 A 拖动 → 刷新恢复；切到用户 B 或租户 B → 不继承 A 布局 → 返回 A 可恢复。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [metaplatform-frontend/apps/web/src/pages/ontology/model/graph/SchemaGraphCanvas.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/graph/SchemaGraphCanvas.tsx#L30) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] 同身份刷新保留布局，不同 user 或 tenant 使用不同缓存。
- [ ] localStorage 禁用/损坏不阻塞图谱；原重置操作只清当前身份。
- [ ] DOM 图谱的选择、拖动、缩放和关系点击回归。

## 独立测试

布局 storage key 与身份切换组件测试；浏览器用两测试身份验证缓存分区，保存位置不需要模型写权限。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：仅 web 应用产物，无数据库迁移。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：上一 web 应用镜像；不批量清浏览器存储。

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
