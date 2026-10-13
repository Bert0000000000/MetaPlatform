# G14 执行 Prompt

将下面正文复制给实施者。只实施这一项；这份 prompt 不包含其他工单的授权，也不意味着调研者已实现功能。

---

你在 Bert0000000000/MetaPlatform 实施 `G14`：SPARQL 简化解析器对 FILTER/OPTIONAL 明确报不支持。先读当前仓库 AGENTS.md、该工单 [PRD](PRD.md) 与 [交付要求](../../DELIVERY-STANDARD.md)，从最新 main 建隔离分支，保存 Git/WIP/工作树状态。

调研基线 `dc8980d3e129e94f0bc55190705ede7cbe304ba0`，定位文件 `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py`（约第 51 行）。必须先核对差距是否仍存在：parse_sparql 通过 WHERE 文本拆分提取 triples，没有 FILTER/OPTIONAL 语义实现；这类输入可能被忽略或误解析，缺少明确支持边界。 若已有可靠修复，输出当前代码与验收证据，不重复改代码。

只完成：仅增加 FILTER/OPTIONAL 的拒绝校验；识别语法关键词时避开字符串字面量与 IRI 中的同名内容。API 返回明确不支持，支持的简单 SELECT 保持行为。

范围边界：不依赖 G13；不承诺完整 SPARQL parser，不实现表达式、联邦查询或新的 RDF 后端。其他语法列入后续评估。

操作链：含真实 FILTER/OPTIONAL 的查询 → parse error / 明确不支持 → 用户改用已支持简单查询；普通字符串不误报。

按本工单 60 分钟有效工作预算执行：5 分钟复现/设计、20 分钟实现、15 分钟测试、15 分钟独立发布/回滚、5 分钟证据。已有环境必须就绪；CI 排队、首次安装或目标不可用记录真实阻塞，不跳过门禁、不把未部署标为部署成功。

验收必须逐项核对：

- [ ] 真实 FILTER/OPTIONAL 语法明确拒绝；大小写变化、注释有测试。
- [ ] 字面量文本和 IRI 路径含 FILTER/OPTIONAL 不触发错误。
- [ ] 支持的简单 SELECT/LIMIT 回归，租户上下文只由中间件取得。

测试要求：parser 表驱动正负用例 + API 错误回归；使用已有 tenant-bound InstanceStore 验证支持的简单查询仍可读回本租户合成实例。 先写能触发当前问题的有效反例，再做最小实现。实际测试路径由你创建/确认并记入日志，不执行文档里的占位路径。前端运行当前 worktree 的 typecheck、目标 Vitest 与 build，以及必要的真实 Playwright 操作；后端使用当前 Python3.12 venv、受控非特权数据库及相关回归。契约先行，受影响 required CI 必须在当前 SHA 通过。

部署要求：仅 ont 应用镜像，无数据库迁移。 先在该分支独立环境验证；只有单项 PR 获准合入 main 后，走现有受信 main 发布流程核对云端。无需本轮其他新工单先完成。rollback：上一 ont 应用镜像；保留输入/错误类型作为兼容验收记录，不记录真实敏感查询内容。

保留全部既有 WIP、工作树、数据库、卷、凭据和预览。沿用现有路由/Semi UI/Kernel/租户上下文。不要创建第二套 ontology store；不要重置共享数据库或服务。Mock、fault injection、真实接口、数据库、云端发布分别记证据。不得改 Accepted/Gate/Goal Board 状态以宣布完成。

交付一个小范围 PR，引用本工单 issue；正文说明问题→行为→测试→候选/云端部署状态→回滚证据。最终返回改动文件、真实命令/结果、SHA、耗时、验收 checklist 和仍未覆盖的边界。不要仅返回“已完成”或“CI 绿”。

## 给用户看的文案示例

成功：“本次操作已完成，请核对当前对象与结果。”
失败：“本次操作未完成：<服务返回的可理解原因>。”
范围：“结果仅覆盖本次选择与已执行能力。”

上面的例句仅作语气参考；实施时必须替换为本项真实动作/对象，不能显示技术占位符或泛化成全部本体已正确。
