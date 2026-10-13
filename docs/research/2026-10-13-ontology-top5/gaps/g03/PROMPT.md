# G03 执行 Prompt

将下面正文复制给实施者。只实施这一项；这份 prompt 不包含其他工单的授权，也不意味着调研者已实现功能。

---

你在 Bert0000000000/MetaPlatform 实施 `G03`：类型 JSON-LD 往返保留属性业务标题。先读当前仓库 AGENTS.md、该工单 [PRD](PRD.md) 与 [交付要求](../../DELIVERY-STANDARD.md)，从最新 main 建隔离分支，保存 Git/WIP/工作树状态。

调研基线 `dc8980d3e129e94f0bc55190705ede7cbe304ba0`，定位文件 `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`（约第 2101 行）。必须先核对差距是否仍存在：最新主分支已用 property_slug 修复含领域 RID 的取名，但 schema:name 仍是技术 slug，导入以其回填 title，因此原 p.title 业务标题仍会丢失。不能重复已修的 RID 解析。 若已有可靠修复，输出当前代码与验收证据，不重复改代码。

只完成：导出 schema:name 优先采用真实 p.title，无标题才走既有规范 fallback；导入保持对应 title。只闭合标题往返。

范围边界：属性 format/unit/metadata、父类和关系的完整往返均不在此工单；不与 #113 的物化样本列归一重复。

操作链：创建有中文标题的独立类型 → 导出 → 同 RID 回灌 → 刷新读取，业务标题一致。

按本工单 60 分钟有效工作预算执行：5 分钟复现/设计、20 分钟实现、15 分钟测试、15 分钟独立发布/回滚、5 分钟证据。已有环境必须就绪；CI 排队、首次安装或目标不可用记录真实阻塞，不跳过门禁、不把未部署标为部署成功。

验收必须逐项核对：

- [ ] 含领域与不含领域的属性 RID，标题均来自模型 title。
- [ ] 中文及空标题 fallback 行为有测试；primary_key/type_id/nullable 不漂移。
- [ ] 真实 PG 上回灌后重新 GET 读回标题，跨租户仍拒绝。

测试要求：在现有 v2 export/import fixture 中用同一测试类型做写入→导出→回灌→读回；不要以只比较 JSON 字符串代替持久化证据。 先写能触发当前问题的有效反例，再做最小实现。实际测试路径由你创建/确认并记入日志，不执行文档里的占位路径。前端运行当前 worktree 的 typecheck、目标 Vitest 与 build，以及必要的真实 Playwright 操作；后端使用当前 Python3.12 venv、受控非特权数据库及相关回归。契约先行，受影响 required CI 必须在当前 SHA 通过。

部署要求：ont 应用镜像，不迁移 schema。 先在该分支独立环境验证；只有单项 PR 获准合入 main 后，走现有受信 main 发布流程核对云端。无需本轮其他新工单先完成。rollback：上一 ont 应用镜像；只操作本轮合成模型，不回灌任何存量生产模型。

保留全部既有 WIP、工作树、数据库、卷、凭据和预览。沿用现有路由/Semi UI/Kernel/租户上下文。不要创建第二套 ontology store；不要重置共享数据库或服务。Mock、fault injection、真实接口、数据库、云端发布分别记证据。不得改 Accepted/Gate/Goal Board 状态以宣布完成。

交付一个小范围 PR，引用本工单 issue；正文说明问题→行为→测试→候选/云端部署状态→回滚证据。最终返回改动文件、真实命令/结果、SHA、耗时、验收 checklist 和仍未覆盖的边界。不要仅返回“已完成”或“CI 绿”。

## 给用户看的文案示例

成功：“本次操作已完成，请核对当前对象与结果。”
失败：“本次操作未完成：<服务返回的可理解原因>。”
范围：“结果仅覆盖本次选择与已执行能力。”

上面的例句仅作语气参考；实施时必须替换为本项真实动作/对象，不能显示技术占位符或泛化成全部本体已正确。
