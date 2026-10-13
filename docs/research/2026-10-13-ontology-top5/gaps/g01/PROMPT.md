# G01 执行 Prompt

将下面正文复制给实施者。只实施这一项；这份 prompt 不包含其他工单的授权，也不意味着调研者已实现功能。

---

你在 Bert0000000000/MetaPlatform 实施 `G01`：Turtle 导出正确转义业务名称，特殊字符可重新解析。先读当前仓库 AGENTS.md、该工单 [PRD](PRD.md) 与 [交付要求](../../DELIVERY-STANDARD.md)，从最新 main 建隔离分支，保存 Git/WIP/工作树状态。

调研基线 `dc8980d3e129e94f0bc55190705ede7cbe304ba0`，定位文件 `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`（约第 2093 行）。必须先核对差距是否仍存在：export_object_type 的 Turtle 分支直接将 display_name 包在单引号里；引号、反斜杠或换行会破坏语法。已有导出能力，不是新增 RDF 引擎。 若已有可靠修复，输出当前代码与验收证据，不重复改代码。

只完成：仅修复 Turtle 字面量序列化/转义，保留响应 envelope、现有 RID/前缀规则与现有导出字段；复用锁定 rdflib 的 Literal.n3 或等价经过解析测试的序列化。

范围边界：本轮不定义新的 IRI 映射，不增加 OWL 导入、全量关系导出或完整 OWL2 推理。RID 规则单独评估。

操作链：已有 export?format=turtle 请求 → 服务端安全序列化 → 下载内容可用 RDFLib parse(format='turtle') 解析。

按本工单 60 分钟有效工作预算执行：5 分钟复现/设计、20 分钟实现、15 分钟测试、15 分钟独立发布/回滚、5 分钟证据。已有环境必须就绪；CI 排队、首次安装或目标不可用记录真实阻塞，不跳过门禁、不把未部署标为部署成功。

验收必须逐项核对：

- [ ] 普通中文、单/双引号、换行、反斜杠、emoji 标签均可解析，解析后的标签等于原值。
- [ ] format=jsonld 回归不变；外租户 RID 继续 403；不存在类型保持现有错误。
- [ ] 不向数据库写入；测试使用已有受控类型及真实租户上下文。

测试要求：增加现有 v2 导出 API 回归：六类特殊标签 + parser 断言、JSON-LD 回归和 cross-tenant negative；使用独立非特权 PG fixture，不允许 skip。 先写能触发当前问题的有效反例，再做最小实现。实际测试路径由你创建/确认并记入日志，不执行文档里的占位路径。前端运行当前 worktree 的 typecheck、目标 Vitest 与 build，以及必要的真实 Playwright 操作；后端使用当前 Python3.12 venv、受控非特权数据库及相关回归。契约先行，受影响 required CI 必须在当前 SHA 通过。

部署要求：仅更新 ont 服务应用镜像；无需迁移或新服务。 先在该分支独立环境验证；只有单项 PR 获准合入 main 后，走现有受信 main 发布流程核对云端。无需本轮其他新工单先完成。rollback：恢复上一 ont 应用镜像，保留数据库。

保留全部既有 WIP、工作树、数据库、卷、凭据和预览。沿用现有路由/Semi UI/Kernel/租户上下文。不要创建第二套 ontology store；不要重置共享数据库或服务。Mock、fault injection、真实接口、数据库、云端发布分别记证据。不得改 Accepted/Gate/Goal Board 状态以宣布完成。

交付一个小范围 PR，引用本工单 issue；正文说明问题→行为→测试→候选/云端部署状态→回滚证据。最终返回改动文件、真实命令/结果、SHA、耗时、验收 checklist 和仍未覆盖的边界。不要仅返回“已完成”或“CI 绿”。

## 给用户看的文案示例

成功：“本次操作已完成，请核对当前对象与结果。”
失败：“本次操作未完成：<服务返回的可理解原因>。”
范围：“结果仅覆盖本次选择与已执行能力。”

上面的例句仅作语气参考；实施时必须替换为本项真实动作/对象，不能显示技术占位符或泛化成全部本体已正确。
