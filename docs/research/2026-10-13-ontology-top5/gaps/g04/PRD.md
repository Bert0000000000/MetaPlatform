# G04 PRD：导入导出页提供既有 Turtle 下载选项

状态：待实现 / 调研建议。优先级：P2。有效工作预算：60 分钟。发布单元：web 静态应用。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：格式入口完整性。

当前证据：前端 doExport 固定 JSON.stringify，文件扩展名固定 .json；后端已经接受 format=turtle。

基线固定源码：[metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx#L42)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：Semantica / TrustGraph / Protégé，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

增加 JSON-LD/Turtle 选择，通过既有 export API 传 format；Turtle 使用返回 content 原文、text/turtle 与 .ttl。默认 JSON-LD。

边界：不依赖 G01/G02/G03 才能交付；验收先用现有可解析的普通标签模型，不承诺修复后端特殊标签。

## 用户操作、结果与文案

选类型 → 选择 Turtle → 导出 → 得到 .ttl；切回 JSON-LD 仍得到 .json。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/metaplatform-frontend/apps/web/src/pages/ontology/governance/import-export/ImportExportPage.tsx#L42) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] 下载请求参数、文件扩展名、MIME 与内容一致；Turtle 文件不是被二次 JSON 编码的字符串。
- [ ] 加载/失败/无类型时按钮状态正确，重复点击不产生并发导出。
- [ ] 浏览器真实下载分别核对 JSON 与 Turtle，刷新仍能再次导出。

## 独立测试

组件测试覆盖两格式与失败；Playwright 对真实后端下载普通标签合成类型，读取下载内容并用 parser 验证。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：仅更新 web 应用镜像/静态产物，无后端升级依赖。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：恢复上一 web 应用镜像。

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
