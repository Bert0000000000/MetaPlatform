- **I1 同族发布与 set_property + add_link edit-set 的反向锁序** — **ADDRESSED**。`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:6712` 在同一 `_execute_edit_set_proposal` 事务、ops 循环和首个 individual FOR UPDATE 之前取得当前租户 shared schema-definitions 锁。限定上下文确认 `pg_repo.py:3401` 使用 `pg_advisory_xact_lock_shared`，`:3402` 与发布独占锁使用相同的 tenant|schema-definitions key；发布入口已有对应独占调用 `:1689`，执行器直到 `:6899` 才 commit、`:6901` 异常 rollback。因而先开始的 edit-set 持共享锁完成后，supersede 才能取得独占锁并迁移；先开始的发布也会让 edit-set 在任何 individual 锁前等待，原 I → L / L → I 环不再可达。普通 create_link_instance 未修改。
- **I1 回归证据** — `mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_object_type_creation.py:298` 的新增 PostgreSQL 用例使用公共 apply_edit_set_now、实际 FOR UPDATE 后的屏障、第二发布连接以及第三只读 observer；`:381` 读取 pg_blocking_pids 确定真实阻塞后再释放 edit-set。`:389` 要求两项操作提交，`:392`–`:395` 验证版本迁移、属性保留、LinkType 重绑及 peer traversal。已读取 `task-4-fix1-pg-red.log` 末段：真实 DeadlockDetected，publisher 的 transaction ShareLock 与 edit-set 的 advisory ShareLock 成环，发生于 ont_individual 更新；GREEN 为 1 passed / 1 InMemory-only skipped / 46 deselected。差异与报告所称原缺陷的 RED/GREEN 一致，未重跑。
- **I2 比较 B 后的破坏性确认重发回退到 A** — **ADDRESSED**。`metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx:391` 计算实际 submittedChecksum；`:396` 将其与 pending destructive confirmation 一同存储；`:762` 的确认重发明确传入 destructiveChecksum，因此不再因临时 retry 参数消失而回退旧 baseline。新增状态在初始化、发起提交与取消确认时清空；本次 submit 的实参已在调用前捕获，清空状态不会擦掉正在提交的 checksum。`:399`、`:405` 在返回错误和异常时清空 latest，后续冲突必须重新比较最新版本。
- **I2 回归证据** — `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx:143` 的参数化两例串起原 baseline → 409 → 比较 B → destructive confirmation；`:159` 同时断言 confirm_name、保留的 description 和 B。第二例在确认时再发生冲突，验证旧 retry 按钮消失、抽屉未关闭，并在重新比较后于 `:169` 断言 C；最后要求成功关闭。已读取 UI RED 末段，原实现两例确实把 B 发成 baseline；GREEN 为 14 passed / 1 file。差异与报告所称恢复链一致，未重跑。

### New Breakage in the Fix Diff

- **None** — 新 Critical 0 / Important 0 / Minor 0。固定五文件差异中生产变化限于前述事务共享锁与确认 checksum 生命周期；新增回归具有可观察结果断言，未发现修复自身引入的新阻断。
- **Approved fixture adjustment checked** — `mate-platform-backend/packages/mate-tech-ont/tests/test_ont_act05_unified.py:685` 的 scopes 参数默认仍为空，`:739` 的 s3_write_client 仅授予 platform.write。`:902`、`:911` 两项合法 ObjectType 删除测试切换到该 fixture，原 200/409 和实例保护断言保留，其余 readonly/cross-tenant fixture 没有全局提权。按父控制器明确授权将其纳入五文件修复附属范围，不计越界。

### Out-of-Scope Observations

- **M1 retained, non-blocking** — 原审查已记录的 warning 噪音仍见于已保存日志：affected 87 warnings（Starlette httpx 弃用、fixture HMAC 长度）和 Vite chunk 提示。它们不是本修复引入的新缺陷，不延长限定复审循环；继续留给 Task 8 / 最终审查。
- **None otherwise** — 未重新审查未改生产代码；Task 5 真实源发现、Task 6 app references、Task 8 集成及 live identity 边界按既有报告保留，不将它们计作这轮新缺陷或完整 Goal 验收。

### Checks and Scope

- **Fixed range checked** — Fix base `1a3bfebc30e3c92fc6eb1eda0afd65e54d5117db` → Head `12c8d79965d13f7da13edec461bf7991e6853b34`；一次读取 `review-1a3bfebc..12c8d799.diff`，5 files / 157 insertions / 9 deletions，无截断；没有重新生成或重拉 diff、没有运行 git 命令。
- **Single focused context check** — 仅为确认新增共享锁与发布锁的同 key / transaction lifetime，补读 pg_repo.py:3400–3412 的必要上下文并定位已知调用/commit/rollback 行；没有重读完整已改文件。未提出需要执行新测试才能解答的疑点，因此 focused test 0、suite 0、build 0。
- **Saved evidence checked** — 已读取修复报告及指定 RED/GREEN、affected、typecheck/build 日志尾部。affected 实际输出 123 passed / 5 skipped；五项 skips 明确为 InMemory 的 PostgreSQL 专项对应项，Pg 用例执行通过。UI 实际输出 14 passed；typecheck 日志为 tsc -b --noEmit 且无 diagnostics，报告明确 process exit 0；build 日志实际输出 built in 20.88s。以上均为已有本地日志证据，不声称本复审重新执行，亦不提升为正式 Gate、发布或完整业务 Goal。
- **Read-only boundary checked** — 未派子代理，未改生产源码、index、HEAD、branch，未连接/修改数据库、9200 preview 或运行容器；唯一写入是本复审报告。

### Verdict

- **Fix round 1: All findings addressed, no new Critical/Important breakage** — I1、I2 均关闭；新增 Critical 0 / Important 0。Task 4 此轮限定复审通过，原 M1 warning 与既有跨任务验收边界保留。
