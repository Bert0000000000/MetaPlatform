# R1 远端集成收口

用户已授权推送并合并到 main。来源为 [R1 实施计划](2026-10-08-metaplatform-r1-implementation.md)、[ADR-0082 §2.7](../../active/decisions/ADR-0082-ontology-migration-plan.md) 与 PR #96 的当前远端结果。

## 约束

- 保持迁移完整规范计划校验、实际用例门禁和分支保护，不绕过失败检查。
- 本轮兼容性收紧是拒绝不完整/未知/伪造计划；默认页面继续按 assess 返回的完整计划执行。只允许 ADR 明确列出的 8 项新增必填计划字段，不豁免其他接口、其他字段或其他错误。
- 保留现有服务、工作树和未跟踪资源；只在当前分支修复集成问题。
- 本地、PR、主干 CI、部署与业务验收分别登记。

## 步骤

1. 将 8 项契约兼容性收紧和客户端影响明确登记在 ADR；两条 oasdiff 门使用同一精确变更清单。实际执行证明这 8 项通过、额外字段或其他接口破坏仍失败，并独立审查。
2. 修复远端 pre-commit 指出的 EOF 和格式问题；校验证据语义不变，执行契约与适用静态门。
3. 推送修复，核对 PR 必需检查、R1 新增数据库门与浏览器真实结果；合并并验证远端 main 包含本次提交。当前远端结果以 [PR #96](https://github.com/Bert0000000000/MetaPlatform/pull/96) 的检查及合并记录为准。

## 当前远端发现

- `ga-001 oasdiff` 和 `breaking-change` 只报告 run 请求下 8 项新增必填字段。
- pre-commit 指出 7 个证据文件末尾换行，以及 AGENTS/ont.yaml 格式。
- `Architecture kernel governance` 的 Pyright 检查为工作流内既有 `continue-on-error` 项，须对照基线登记；不能声称全部检查零失败。
