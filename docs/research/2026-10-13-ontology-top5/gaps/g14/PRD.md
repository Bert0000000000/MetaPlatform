# G14 PRD：SPARQL 简化解析器对 FILTER/OPTIONAL 明确报不支持

状态：待实现 / 调研建议。优先级：P1。有效工作预算：60 分钟。发布单元：ont 应用服务。无本轮其他工单依赖。

## 用户、问题与价值

用户：业务本体建模/审核者及接口消费者。差距类别：查询语言边界透明度。

当前证据：parse_sparql 通过 WHERE 文本拆分提取 triples，没有 FILTER/OPTIONAL 语义实现；这类输入可能被忽略或误解析，缺少明确支持边界。

基线固定源码：[mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py#L51)。行号用于定位，实际实施前核对最新 main，不能将调研时状态当未来现状。

对标依据：TrustGraph / Semantica / Protégé，详见 [项目报告](../../REPORT.md) 的功能表及 `projects/` 固定 SHA 源链接；这是功能/交互参考，不代表复制许可已覆盖所有依赖。业务价值是让本项局部行为可理解、可核对、可正确使用。

## 本轮范围与边界

仅增加 FILTER/OPTIONAL 的拒绝校验；识别语法关键词时避开字符串字面量与 IRI 中的同名内容。API 返回明确不支持，支持的简单 SELECT 保持行为。

边界：不依赖 G13；不承诺完整 SPARQL parser，不实现表达式、联邦查询或新的 RDF 后端。其他语法列入后续评估。

## 用户操作、结果与文案

含真实 FILTER/OPTIONAL 的查询 → parse error / 明确不支持 → 用户改用已支持简单查询；普通字符串不误报。

加载期间明确“处理中”；没有有效结果时显示“尚未完成”，故障显示可定位错误与可行重试。成功文案只表达本轮实际完成行为，不写“全平台通过”或“完整 OWL2 支持”。具体文案随组件语境采用原有中文风格。

## 数据、API 与权限

以 [mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py](https://github.com/Bert0000000000/MetaPlatform/blob/dc8980d3e129e94f0bc55190705ede7cbe304ba0/mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py#L51) 及现有客户端/ont.yaml 为准；不建第二套定义库。Frontend 项使用已有响应和可信当前身份，不从 URL 推断租户权限。Backend 项先核对正式契约登记与错误/字段兼容性，再改变实现。所有实际请求保留 tenant ctx 和平台权限；任何 UI 预检都不能替代后端校验。

## 验收标准

- [ ] 真实 FILTER/OPTIONAL 语法明确拒绝；大小写变化、注释有测试。
- [ ] 字面量文本和 IRI 路径含 FILTER/OPTIONAL 不触发错误。
- [ ] 支持的简单 SELECT/LIMIT 回归，租户上下文只由中间件取得。

## 独立测试

parser 表驱动正负用例 + API 错误回归；使用已有 tenant-bound InstanceStore 验证支持的简单查询仍可读回本租户合成实例。

测试需记录当前 SHA、具体命令、实际执行数量、失败/skip 与输出。组件故障注入与真实接口验证分开登记。共用命令与资源要求见 [DELIVERY-STANDARD](../../DELIVERY-STANDARD.md)。

## 独立部署和回滚

部署：仅 ont 应用镜像，无数据库迁移。 基于最新 main 的单个改动即可在本项独立预热环境部署，无需先做其他 TOP5 工单。云端发布复用受信 main 的现有流水线，不跳过 required CI。核对实际 revision 和本项用户/API 行为。

回滚：上一 ont 应用镜像；保留输入/错误类型作为兼容验收记录，不记录真实敏感查询内容。

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
