# G07 PRD：SHACL 类型切换立即清空旧报告并拒绝迟到响应

状态：待实现 / 调研建议。优先级：P1。有效工作预算：60 分钟。发布单元：web 静态应用。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：校验结果与对象绑定。

当前证据：报告只在 runShacl 时清空；修改 shaclClass 不清空报告，且请求完成后没有类型/请求序号校验。旧类型的通过结果可显示在新类型下。

基线固定源码：[metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx#L83)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：Semantica / Protégé，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

类型变化清空报告/错误，记录请求序号与目标 RID；只接受当前目标的最后一次返回。

边界：不改 SHACL 引擎或约束集，不新增后端依赖。

## 用户操作、结果与文案

校验 A → 选择 B → 展示未校验 B；A 的迟到结果丢弃 → 校验 B 后只展示 B 报告。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx#L83) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] A 通过后切到 B 不显示 A 的 conforms。
- [ ] A/B 反序返回、失败后切换、页面卸载均无错配。
- [ ] 实时后端的当前类型报告仍正常显示，既有校验权限保持不变。

## 独立测试

用可控制 promise 的组件测试验证反序响应；真实浏览器分别校验两个合成类型，切换立即回到未校验状态。

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
