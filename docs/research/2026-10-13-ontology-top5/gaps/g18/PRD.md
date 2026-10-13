# G18 PRD：导出接口明确拒绝未知format

2026-10-13 · P2 · ont 应用增量 · 有效工作预算60分钟 · 待实施。
只改已有格式参数校验及契约/回归；无本批其他工单前置依赖。

## 问题和证据

API消费者请求某种格式，应获得该格式或明确错误，不应收到静默替换的文件。基线dc8980d3e129e94f0bc55190705ede7cbe304ba0，mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py的export_object_type(format: str='jsonld')仅在format=='turtle'进入Turtle，其他值全部落入JSON-LD。因此拼错格式或未支持的owl可能收到200/format=jsonld。此为函数控制流审读，未执行真实HTTP实验。

对标TrustGraph OntologyExporter显式分派与Unsupported export format错误原则；固定源码见../../AUDIT.md，不因此新增OWL/XML或宣称对方格式保真。

## 目标、兼容及非目标

允许jsonld/turtle，省略仍默认jsonld。未知值和显式空值返回契约登记4xx，建议按当前参数验证习惯采用422。先核对ont.yaml与消费者，不预设现有契约已经枚举或批准兼容性变化。不要未经声明引入大小写归一或别名。

接口路径、成功envelope不变，非法格式不生成替代结果；合法格式仍经过已有认证/租户校验。可用Literal/枚举或同等窄校验，不换API框架。不修G01转义/G02词汇/G03标题/G04前端入口，不重写导出器或增加DB schema。

## 行为与文案

| 输入 | 预期 |
|---|---|
| 不传format | 既有默认JSON-LD |
| jsonld | 既有JSON-LD结构与format字段 |
| turtle | 既有Turtle字符串与format字段 |
| owl/xml/yaml/错拼/空值/JSONLD | 明确4xx，不返回伪成功文件 |
| 合法格式+无身份/跨租户 | 保留既有拒绝行为，不泄漏模型 |

非法格式与非法身份同时出现时不强定错误先后，只要求无成功、无数据泄漏、无副作用。建议业务说明：“不支持该导出格式，仅支持jsonld、turtle。”结构化错误遵循既有API规范，不为中文文案破坏错误schema。本项不改web。

## 独立验收与测试

- [ ] 参数化覆盖默认、两合法值、三类未知值、拼错、空值、大小写错误。
- [ ] 非法格式返回登记4xx，不进入成功序列化、没有upsert或写入。
- [ ] 两合法格式的envelope/内容类型/普通fixture行为保持兼容，不依赖G01–G04。
- [ ] 合法格式的缺身份/跨租户仍拒绝；错误不含模型数据。
- [ ] 正式契约、生成产物、实际端点一致，必要bundle/lint与目标API回归通过。

先定位ont.yaml的真实operation/query schema及消费者。本审校没有声称已读该operation完整契约。若改变错误语义触发兼容门禁，不得添加未经批准豁免，记录阻塞并保持工单未完成。

单元测试证明分派；真实隔离候选端点用授权合成模型验证默认/turtle/未知值/跨租户，记录模型前后无变化。缺身份或环境不能以mock冒充权限和发布验收。

## 发布/回滚与完成定义

一个ont实施PR，零数据库迁移，不需web或其他新工单升级。候选应用制品在预热隔离目标单独发布，核对revision/endpoint行为；回滚上一制品，无数据回滚。云端仍走受信main、审批和required CI。

预算5分钟核查、20实现、15验证、15候选部署/回滚、5证据；CI/环境等待不保证一小时。必须有测试/契约/实际候选发布/回滚证据才能完成，详见../../AUDIT-DELIVERY.md；提示见PROMPT.md。
