# G15 PRD：SHACL 报告按真实 severity 展示 Warning 和 Info

状态：待实现 / 调研建议。优先级：P2。有效工作预算：60 分钟。发布单元：web 静态应用。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：约束结果优先级。

当前证据：每条 SHACL 结果 Tag 均用 red；虽然显示 severity 字符串，Warning/Info 和 Violation 缺少视觉区分。契约已有 severity_counts。

基线固定源码：[metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx#L217)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：Semantica / TrustGraph，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

依据现有 severity 显示不同标签与计数；仍仅按服务端 conforms 判断违规结论，未知 severity 清晰展示原值。

边界：不改变后端 severity 判定，不依赖 G07/G08，不把 warning 当发布阻断，也不掩盖 violation。

## 用户操作、结果与文案

校验返回混合等级 → 明确显示违规/警告/信息数量 → 审核者先处理违规。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/model/validation/ModelValidationPage.tsx#L217) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] Violation 红、Warning 警示、Info 信息色，同时保留文字，不只依赖颜色。
- [ ] 服务端 conforms=true 且只有 Warning/Info 时不显示违规阻断。
- [ ] severity_counts 与条目不一致时展示实际可用数据，不能捏造未知统计。

## 独立测试

组件覆盖三等级、未知等级及 warning-only；真实 API 显式 property_shapes 产生 Warning/Info 报告，验证展示与响应对应。

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
