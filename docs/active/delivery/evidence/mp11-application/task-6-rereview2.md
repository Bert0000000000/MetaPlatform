# Task6 Fix round2 scoped re-review

## Finding Verdicts

- **N1 — Important — 历史查询遗漏已验证归属的 edit-set 别名回执 — ADDRESSED。** `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:4593` 按持久化 proposal kind 选择唯一路径：`edit_set` 读取 `parameters.parameters.provenance`，`action` 读取 `parameters.provenance`，其他 kind 为 NULL。不会用另一种形状补全或覆盖归属。限定包外只读了这一个具体存储形状风险的 cutoff `_propose_edit_set_pg`：`:6717` 实际落库 kind=`edit_set`，`:6724` 保存 `{edits: ..., parameters: dict(parameters)}`，因此修复路径与已有存储一致。原 `action` 路径保持不变。
- **N1 过滤与覆盖 — ADDRESSED。** 同文件 `:4580` 保留 Action 条件；`:4583`–`:4589` 要求完整 app/page/snapshot 归属与当前 tenant，按 proposal_id+tenant 联结 audit/proposal；`:4595`–`:4603` 全部归属条件位于 ORDER BY/LIMIT 之前，`:4605` 保留 finally 关闭连接。`tests/test_apphub_order_binding.py:182`–`:226` 将原实际 PG 测试参数化为 action/edit_set，各自真实确认/执行后插入更新的 other-app/page/version/无归属记录，再用 LIMIT1 找回第一条 audit；`:205`–`:215` 加入另一形状的伪归属，证明不被 coalesce；`:216` 验证跨租户为空，`:218`–`:226` 验证独立 Python 子进程找回相同 audit。该测试没有生成不同 Action 的竞争回执；Action 隔离结论来自仍在 LIMIT 前的明确 SQL 条件及原已接受授权边界，并未把测试数当作额外分支覆盖。
- **N1 实际合法别名与重开 — ADDRESSED。** 现有 `task-6-fix1-provenance-check.py` 的两种合法 HTTP 路径都使用保存的已发布应用/page/Action，无 custom edits：先建唯一真实订单、确认在当前 ObjectSet；propose-edit-set 经 confirm→execute，apply-edit-set 经既有 immediate-confirm 路径；以 execute 返回的 audit_id 在已授权应用历史中匹配，读取对应持久化 Proposal 核对 kind=`edit_set`、target 与 Action，再确认订单离开 ObjectSet。`task-6-fix2-provenance-evidence.json` 记录 `prop-44e84e655718 / audit-ab1b8291ac8d` 和 `prop-b30f296f9da3 / audit-071ebc1b5bda`，同一 app/page/publication 下两者 `left_object_set=true`。脚本 `--recover` 从此证据取精确 proposal_id/audit_id，在重启后的应用 history 匹配且再次确认目标不在集合；recovery log 与 `new_api_process_same_alias_receipts=PASS` 一致。
- **N1 拒绝边界 — ADDRESSED / 保留。** 同一实际脚本仍断言 top/nested 伪 app/page/version 返回 404/422、两种别名 forged attribution 返回404/custom edits返回422；green log 和 safe JSON 保存相同结果。这轮没有修改验证、鉴权、确认、执行或幂等路径。实际脚本对持久化 Proposal 显式检查 kind/Action/target，但没有把原始完整 parameters JSON 写入 safe evidence；嵌套 provenance 形状核对来自存储 cutoff、kind-specific SQL 与实际 alias 历史成功的组合证据，不声称 safe JSON 自身含该完整参数样本。
- **M1 — Minor — release task 完成时间字段错名 — ADDRESSED。** `mate-platform-backend/contracts/openapi/services/apphub.yaml:3200` 将可选 `completedAt` 改为实际 `endTime: string`，required 列表不变。`tests/test_apphub_order_binding.py:313`–`:326` 除 schema validation 外明确要求 completed sample 的全部 keys 被 properties 声明、properties 不含 completedAt。该单元样本是代码内构造样本；实际已捕获的 COMPLETED 响应位于 `task-6-fix1-api-evidence.json:73`–`:80`，包含非空 endTime、无 completedAt，字段与修后声明逐项一致。实际 API 脚本还直接读取该历史响应并执行同样 keys-subset/no-completedAt 断言，green log 到达其后 PASS；`task-6-fix2-canonical-evidence.json` 明确记录 actual completed sample declared PASS、仅字段重命名、paths/operations unchanged。没有依赖 additionalProperties 的宽松行为来宣布字段准确。
- **M2 — Minor — 继承 warnings — NOT ADDRESSED / 既定 Task8 承接，不阻断本轮。** Fix2 covering log 仍有1个 Starlette/httpx 弃用 warning；此前完整 backend/build warnings 保持原记录与 Task8 归属。没有将结果宣称 warning-free，也没有要求本轮升级依赖。
- **原 I1–I6 — 维持上一轮 ADDRESSED。** 依据限定复审指令，不重新审查或重跑这些已接受项。

### New Breakage in the Fix Diff

- **None。** 完整固定包仅含3文件、42 additions/5 deletions。SQL CASE 只在完整 application-attribution 查询内新增分支，未改变非应用 audit 查询、排序/limit、连接释放或执行语义；kind 对应路径为严格选择，错误形状/NULL 均不会取得应用归属。改动的回归保留此前行为断言并增加实际 edit_set 覆盖；唯一 OpenAPI 差异与实际 completion 字段一致。
- **新增问题计数：Critical 0 / Important 0 / Minor 0。**

### Out-of-Scope Observations

- **None。** Task7 approval deadline、Task8 signed issuer USER/SERVICE 分类及 inherited warnings 保持既有承接，不扩展本轮修复范围。

### Checks Reviewed

- **固定范围：** 完整读取 `task-6-rereview2-instructions.md`（含上一轮原文与约束）、`task-6-brief.md`、最新 `Fix round2 — 2026-10-12 01:44` 报告和供应的 `review-e6eb1564..0f68c3d8.diff`。BASE `e6eb1564565ca6df0efa9fd263505809eec9f09a`；HEAD `0f68c3d86cf311fd79e66c73d235f84221590480`；9759-byte 包记录1 commit/3文件。没有重新生成 git diff 或运行 git 检查。
- **已有 focused RED/GREEN：** 报告命令为项目 Python `-m pytest mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py -k 'actual_pg_history or completed_release_task' -q -p no:cacheprovider --tb=short`。RED log 明确 edit_set history为空和 endTime未声明两个失败，2 failed/1 passed/31 deselected/3.68s；GREEN log为3 passed/31 deselected/4.22s。失败指向本轮两个具体缺陷。
- **已有最终 covering 输出：** 报告命令为项目 Python `-m pytest mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py -q -p no:cacheprovider --tb=short`；`task-6-fix2-final-tests.log` 为34 passed/1 warning/8.35s，没有 skip 行。PG 测试源码本身要求显式环境变量并断言 `127.0.0.1:55497/codex_mp11_`；本轮没有再次连接数据库或运行测试。报告记录 exit0；日志没有独立打印 shell exit code，未把这一事实隐去。
- **已有 actual HTTP/PG 输出：** 报告命令为项目 Python执行现有 `task-6-fix1-provenance-check.py`，恢复时加 `--recover`。API RED log先通过负向检查，再以 propose-edit-set历史缺失断言失败；当时脚本仍假设 execute receipt含proposal_id，报告明确记录后续纠正。修后脚本以 audit_id→history→持久化Proposal建立匹配，GREEN log同时通过拒绝和两合法别名完整执行/退出/history。Recovery log明确通过新 API 进程同一两条回执恢复；与 safe JSON 的精确 IDs 相符。
- **已有进程与安全边界：** `task-6-listeners.json`/`task-6-processes.json` 记录最终 API listener62164/launcher65568/start2026-10-12T01:41:41.430158+08、实际task-6-ui-api.py参数；Vite9367 listener66080保持原start23:34:03.671721+08。这里只核对现有ledger与报告，不将其称为本次实时OS进程观测。报告记录仅重启55510独立API、保留保护预览和专用PG；本次没有服务/DB/容器操作。
- **已有 canonical 输出：** safe JSON记录metadata errors0、missing refs0、paths/operations unchanged、仅completedAt→endTime；供应fixed diff支持唯一schema delta。报告说明inline validator与固定BASE整文比较，没有保留完整inline命令正文/单独退出日志；本次精确字段核对另由实际样本、当前properties和实际API脚本显式断言支持。未将summary JSON单独当作所有validator分支重新验证。
- **执行纪律：** 没有suite/build/frontend/browser/migration重跑，没有nested agent，没有改生产代码/index/HEAD/service/DB；仅写本复审报告。默认工具一度遇到Windows sandbox helper setup refresh基础设施错误，后使用父任务指定并获自动审查接受的窄范围require_escalated入口完成只读行号检查及报告落盘；这不是代码失败。
- **证据界限：** actual API identity仍为signature-bypass USER fixture；handler/tenant/scope/PG行为证据不等于Task8真实签名人类登录验收。应用归属是经验证的真实binding关联，不是browser-origin证明。继承前端/迁移/build结果未重标为Fix2新结果。

### Verdict

- **Fix round：All in-scope findings addressed, no new Critical/Important breakage。** N1与M1已关闭；M2保持Task8承接。
- **本轮须处理残留：Critical 0 / Important 0 / Minor 0。含既定跨任务承接的总残留：Critical 0 / Important 0 / Minor 1（M2）。**
- **不声明Task6/整体Goal或Task8正式验收完成。**
