# G02 PRD：JSON-LD 导出显式声明 ont 扩展词汇命名空间

状态：待实现 / 调研建议。优先级：P1。有效工作预算：60 分钟。发布单元：ont 应用服务。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：标准词汇语义。

当前证据：JSON-LD 输出含 ont:type_id、ont:nullable、ont:primary_key，而 @context 只有 owl/rdfs/schema；扩展项依赖未声明的命名空间。

基线固定源码：[mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py#L2130)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：Semantica / TrustGraph，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

在既有 JSON-LD @context 明确 ont 扩展命名空间，补一份扩展词汇说明和解析用例；不改变 RID 或导入字段。

边界：不宣称导出已满足完整 OWL round-trip；不更换 Kernel identity 规则。

## 用户操作、结果与文案

导出当前类型 → 在 JSON-LD 消费者中解析 → 扩展字段能映射到文档声明的稳定谓词。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py#L2130) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] 每个 ont:* 导出键在 @context 中有明确展开规则，谓词命名空间与说明一致。
- [ ] 旧导入代码仍能读取同一 envelope 与属性类型、nullable、primary_key。
- [ ] 旧 JSON-LD 文件仍可导入，外租户导出/导入拒绝。

## 独立测试

检查 JSON-LD context 展开及三个扩展谓词的解析结果；使用既有 export/import 独立 PG 测试核对字段，明确该测试不代表完整本体保真。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：ont 应用镜像增量；新增文档随源码发布，无 DB 迁移。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：上一 ont 应用镜像；新增 context 向后兼容。

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
