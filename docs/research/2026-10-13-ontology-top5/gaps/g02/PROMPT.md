# G02 执行 Prompt

将下面正文复制给实施者。只实施这一项；这份 prompt 不包含其他工单的授权，也不意味着调研者已实现功能。

---

你在 Bert0000000000/MetaPlatform 实施 `G02`：JSON-LD 导出显式声明 ont 扩展词汇命名空间。先读当前仓库 AGENTS.md、该工单 [PRD](PRD.md) 与 [交付要求](../../DELIVERY-STANDARD.md)，从最新 main 建隔离分支，保存 Git/WIP/工作树状态。

调研基线 `dc8980d3e129e94f0bc55190705ede7cbe304ba0`，定位文件 `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`（约第 2130 行）。必须先核对差距是否仍存在：JSON-LD 输出含 ont:type_id、ont:nullable、ont:primary_key，而 @context 只有 owl/rdfs/schema；扩展项依赖未声明的命名空间。 若已有可靠修复，输出当前代码与验收证据，不重复改代码。

只完成：在既有 JSON-LD @context 明确 ont 扩展命名空间，补一份扩展词汇说明和解析用例；不改变 RID 或导入字段。

范围边界：不宣称导出已满足完整 OWL round-trip；不更换 Kernel identity 规则。

操作链：导出当前类型 → 在 JSON-LD 消费者中解析 → 扩展字段能映射到文档声明的稳定谓词。

按本工单 60 分钟有效工作预算执行：5 分钟复现/设计、20 分钟实现、15 分钟测试、15 分钟独立发布/回滚、5 分钟证据。已有环境必须就绪；CI 排队、首次安装或目标不可用记录真实阻塞，不跳过门禁、不把未部署标为部署成功。

验收必须逐项核对：

- [ ] 每个 ont:* 导出键在 @context 中有明确展开规则，谓词命名空间与说明一致。
- [ ] 旧导入代码仍能读取同一 envelope 与属性类型、nullable、primary_key。
- [ ] 旧 JSON-LD 文件仍可导入，外租户导出/导入拒绝。

测试要求：检查 JSON-LD context 展开及三个扩展谓词的解析结果；使用既有 export/import 独立 PG 测试核对字段，明确该测试不代表完整本体保真。 先写能触发当前问题的有效反例，再做最小实现。实际测试路径由你创建/确认并记入日志，不执行文档里的占位路径。前端运行当前 worktree 的 typecheck、目标 Vitest 与 build，以及必要的真实 Playwright 操作；后端使用当前 Python3.12 venv、受控非特权数据库及相关回归。契约先行，受影响 required CI 必须在当前 SHA 通过。

部署要求：ont 应用镜像增量；新增文档随源码发布，无 DB 迁移。 先在该分支独立环境验证；只有单项 PR 获准合入 main 后，走现有受信 main 发布流程核对云端。无需本轮其他新工单先完成。rollback：上一 ont 应用镜像；新增 context 向后兼容。

保留全部既有 WIP、工作树、数据库、卷、凭据和预览。沿用现有路由/Semi UI/Kernel/租户上下文。不要创建第二套 ontology store；不要重置共享数据库或服务。Mock、fault injection、真实接口、数据库、云端发布分别记证据。不得改 Accepted/Gate/Goal Board 状态以宣布完成。

交付一个小范围 PR，引用本工单 issue；正文说明问题→行为→测试→候选/云端部署状态→回滚证据。最终返回改动文件、真实命令/结果、SHA、耗时、验收 checklist 和仍未覆盖的边界。不要仅返回“已完成”或“CI 绿”。

## 给用户看的文案示例

成功：“本次操作已完成，请核对当前对象与结果。”
失败：“本次操作未完成：<服务返回的可理解原因>。”
范围：“结果仅覆盖本次选择与已执行能力。”

上面的例句仅作语气参考；实施时必须替换为本项真实动作/对象，不能显示技术占位符或泛化成全部本体已正确。
