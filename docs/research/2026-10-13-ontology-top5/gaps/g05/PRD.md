# G05 PRD：JSON 文件导入前展示摘要并要求明确确认

状态：待实现 / 调研建议。优先级：P1。有效工作预算：60 分钟。发布单元：web 静态应用。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：导入交互可控性。

当前证据：选中文件并完成 JSON.parse 后直接调用 importObjectTypes；同 RID upsert 缺少导入前核对步骤。

基线固定源码：[metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx#L63)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：Utopia / Semantica，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

增加本地预览：文件名、目标 RID、标题、属性数、同 RID 已存在提醒；明确确认后才发送原 payload。取消不提交。

边界：本地预览不是服务端 dry-run，不证明发布/迁移安全；不新增替代后端权限判断或全本体批量导入。

## 用户操作、结果与文案

选 .json → 预览摘要 → 确认导入 → 成功/失败 → 刷新读回；取消或重新选文件只更新预览。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx#L63) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] 选择文件、解析、取消三个操作均没有 import POST。
- [ ] 无效 JSON/错误 envelope 显示明确错误；预览不能将未知结构当可安全导入。
- [ ] 确认一次只请求一次；403/422 保留错误；真实合成类型确认后读回。

## 独立测试

组件测试断言确认前零 POST、取消零 POST、重复点击单 POST；真实浏览器用本轮合成 JSON 完成预览→确认→读回。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：仅 web 应用产物。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：上一 web 应用镜像；不清除已导入数据。

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
