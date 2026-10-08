# R1 远端集成记录

用户已授权推送合并到 main。[PR #96](https://github.com/Bert0000000000/MetaPlatform/pull/96) 的检查、受检 head 和合并记录是本次远端结果入口；[本地验收](2026-10-08-metaplatform-r1.md) 与部署、业务验收仍分别登记。

## 首次远端执行

受检 head 为 `062914bd944e3ce4e86318ec071c79a002405332`，base 为 `e965d866b20dddf8d9ebb0418869b58a4697ee32`。

| 检查 | 实际结果 | 远端来源 |
| --- | --- | --- |
| PostgreSQL 必需回归 | 123 executed，0 skipped，六组完整；123 passed，5 条弃用警告 | [PR GA run](https://github.com/Bert0000000000/MetaPlatform/actions/runs/37728485695) |
| 非特权 FORCE RLS | 8 executed，0 skipped，8 passed | 同上 |
| 核心浏览器闭环 | 9 passed | [PR ontology run](https://github.com/Bert0000000000/MetaPlatform/actions/runs/37728485657) |
| 迁移浏览器 | 安全清单 2 个必需用例，实际 2 passed；Node 22.23.3 | 同上 |
| 其他必需检查 | 首次仅聚合格式检查失败；仍须核对修复 head | PR checks |

首次成功结果不替代修复提交的远端检查。最终准入和主干状态查阅 PR 的实际受检提交及对应 workflow；本文件保存首次发现和集成修复的来源，不声明部署或业务试点完成。

## 集成修复及判断

- 两条 oasdiff 门准确检出了迁移 run 请求 8 项新增必填计划字段。完整规范计划是 ADR-0082 §2.7 的安全要求，明确登记为兼容性收紧；不完整计划客户端须使用 assess 返回的完整计划再执行。当前页面使用该路径。
- 控制端判断：保留安全要求，用同一方法/路径/完整诊断清单仅认可这 8 项；其他变更仍按 ERR 阻断。代价：旧客户端的部分计划请求会拒绝，需要更新调用方式。这不是无破坏变更的声明，也不放宽服务端校验。
- `820f87b8` 统一了两条门的精确清单。[本地工具证据](evidence/2026-10-08-metaplatform-r1/integration-oasdiff-results.json) 保存 CI 实际观察到的镜像 digest、八项 RED/GREEN 和两种负例；[独立审查](evidence/2026-10-08-metaplatform-r1/integration-compat-review.md)通过，无 Critical / Important / Minor。
- 原始 7 个成功 XML/JSON 证据各追加一个末尾换行；解析结果完全不变，记录[字节与语义核对](evidence/2026-10-08-metaplatform-r1/integration-eof-normalization.json)。AGENTS/契约 YAML 仅按既定 Prettier 格式化，契约解析值不变。
- kernel 的 `options` 参数标注改为 `object | None`，对应实际运行时输入边界；保留原类型拒绝逻辑。改前本文件 Pyright 1 error，改后 0 errors / 0 warnings；Ruff 检查与格式检查通过。未用诊断豁免或移除检查。
- 格式和标注修复后，34 条契约测试再次通过，15.96 秒，零跳过、无警告。

## 已有边界

`Architecture kernel governance` 在主干基线已有 Pyright 294 条错误，并由既定 workflow 的 `continue-on-error` 单独登记。首次 R1 为 295 条：对照两次真实 job 日志，仅多出 `migration.py` 运行时类型检查的一条诊断，已修正；其余基线错误身份完全相同。当前修复 head 的远端复核与合并结果以 PR 为准。没有更改这条已有 workflow 的豁免策略，也不把该项标成无错误。

原有 R1 后续轮次、模型回滚、生产规模和业务试点边界继续有效。没有修改部署、分支保护、其他工作树或既有服务。
