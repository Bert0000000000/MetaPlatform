"""SAL §5 风险消化证据（RISK MITIGATION）。

> 日期: 2026-09-09 · 状态: [~] 两项措施已落地；OAG 成本与 Accepted 语义合档留尾

## 措施 ①：工具爆炸护栏（tool budget）

- 位置：`mate-app-copilot` `GET /agent-tools`（agent loop 的真实注册面）。
- 机制：`AGENT_TOOLS_BUDGET`（默认 64）截断 FC 工具清单并返回
  `truncated: true`——注册面无界增长时 prompt 规模有硬上限。
- 后续：按使用率淘汰（需要一个 tool 使用统计窗口）。

## 措施 ②：Scenario 写回一致性门

- 位置：`mate_kernel/ontology/writeback.py` `validate_write_back`。
- 机制：场景执行器写库前调用；校验 unknown_class / tenant_mismatch /
  duplicate_target / missing_pk 四类问题，非空即拒绝写回。
- 单测：`test_sal5_writeback_consistency.py` 6 passed。

## 留尾（如实）

- OAG 成本（Ontology Access Graph 检索成本）未量化。
- "20/20 Accepted" 语义部分合档（G 版本验收范围宽于最小闭环）——
  以 V31-ONTOLOGY-BOARD 各批次的 [x]/[~] 边界为准。
  """
