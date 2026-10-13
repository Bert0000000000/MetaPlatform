# G13 PRD：SPARQL 兼容端点明确拒绝未执行的 INSERT/DELETE

状态：待实现 / 调研建议。优先级：P1。有效工作预算：60 分钟。发布单元：ont 应用服务。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：查询接口结果可信度。

当前证据：parser 识别 INSERT/DELETE，但 execute_sparql 非 SELECT 直接返回 []，端点仍可能 200；调用者会把空成功当写入已执行。该路径是 legacy 兼容 API，不能替代 v2 Kernel。

基线固定源码：[mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/api.py](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/api.py#L54)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：TrustGraph / Semantica，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

仅在 HTTP 执行端点显式拒绝 INSERT/DELETE/UNKNOWN，返回明确的既有错误结构/受契约支持状态；保留 SELECT 与独立解释/翻译工具。

边界：不实现 SPARQL UPDATE，不引入 RDF store，不改变 v2 对象写入接口或 Neo4j 占位路径。

## 用户操作、结果与文案

兼容端点收到写语句 → 明确不支持且无写入；支持的 SELECT 仍返回原结果。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/api.py](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/api.py#L54) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] INSERT、DELETE、未知操作不能以 200+空绑定表示已执行。
- [ ] 有/无 tenant context 与外租户负例保留；任何拒绝请求均无实例变更。
- [ ] SELECT 行为与返回结构回归，不把 explain 的翻译结果当执行结果。

## 独立测试

ASGI/API 回归覆盖三类拒绝、SELECT、缺身份与拒绝后的存储计数；如现有 contract 未登记该兼容 route，先对齐契约并完成相关 lint。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：仅 ont 应用镜像，现有兼容消费者需确认错误语义；无迁移。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：上一 ont 应用镜像，记录兼容端点行为变化。

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
