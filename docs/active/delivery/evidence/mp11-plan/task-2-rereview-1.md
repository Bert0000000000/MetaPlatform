# Task 2 scoped re-review — fix round 1

Fix base: be62f0898157016e05d9313cc775c3d503a03a4f
Head: 635163f544c1e73640610f401800faaf4c8edeca

## Finding Verdicts

- **I1 / Important — unknown/failed/stale catalog allowed new upsert to overwrite an existing RID: ADDRESSED.**
  - 目录成功状态独立建模，加载前复位、失败保留错误；新建提交和按钮同时在 catalogReady=false 时关闭，并提供保留输入的重试：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:20、:28、:69；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx:50、:95、:101。
  - 新建明确发送 create_only=true，编辑保留默认 upsert；后端把 typed conflict 映射为 409，DTO/operationId 不变：metaplatform-frontend/apps/web/src/api/ont/kernel.ts:116；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx:59；mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:4553、:4592；mate-platform-backend/contracts/openapi/services/ont.yaml:744。
  - Memory 在同一 RLock 下查重和写入；PG 在定义事务锁内查重，strict 分支使用 ON CONFLICT DO NOTHING，rowcount 非 1 时 rollback/冲突。因此先前失败目录和读取后同名竞争都不能覆盖胜出定义：mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py:324；mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:2837、:2851、:2885。
  - 回归断言包含重复创建的完整原 DTO 不变、Memory/PG 双写单胜者、读取后另会话抢占及默认编辑仍可用：mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py:591、:605、:625、:648。UI/真实 E2E 保留错误输入并验证胜出描述：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx:127、:137；metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts:123。

- **I2 / Important — authorized endpoint types stopped at the first 100 rows: ADDRESSED.**
  - wrapper 支持真实 limit/offset，编辑器每页 100 循环至短页、RID 去重，并对未前进的整页响应报错；完整读取完成前不开放保存：metaplatform-frontend/apps/web/src/api/ont/kernel.ts:102；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx:33、:35、:37、:43、:50。
  - 后页 source 深链及目标选择有 102 类型 UI fixture 与 104 自有类型真实 PG fixture 验证；真实接口结果检查当前租户前缀：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx:147；metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts:13、:20、:97。

- **M1 / Minor — fake individual load-more used unsupported limit/offset: ADDRESSED.**
  - 移除无效 offset/limit 状态与按钮，按当前 API 读取完整授权 class 列表：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkInstanceEditor.tsx:18、:22、:49。
  - 200/201 UI 边界验证最后对象可见且没有假续页；真实 E2E 检查 C201：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx:155；metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts:50。大列表仍为全量/native select，报告已明确范围，没有假称实现 API 分页。

- **M2 / Minor — a failed next page also disabled previous navigation: ADDRESSED.**
  - 上一页只在实际 loading（rows=null 且无 error）或第一页禁用；错误存在时可切回前页并触发原有真实读取，未伪造成功数据：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:107。
  - UI 行为覆盖第二页失败→上页可点→第一页重新显示→错误消失；真实 E2E 对专用 helper 注入的 503 执行正常点击并返回真实 PG 第一页：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx:162；metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts:138。

## New Breakage in the Fix Diff

None. 未发现本修复引入的新 Critical/Important 阻断，也无新增 Minor 记录。严格创建保持默认编辑兼容；SQL conflict 片段仅来自内部常量，值仍参数化，冲突回滚；fixture-only 错误注入保留在既有 loopback 专用 helper 内：mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:2851、:2885；metaplatform-frontend/apps/web/tests/e2e/helpers/mp11-relationship-api.py:70。

## Out-of-Scope Observations

- M3 继承警告继续保留：backend covering 日志 38 passed / 33 warnings、最终 create_only 4 passed / 4 warnings；构建仍有大 chunk warning。证据：.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-2-fix1-api-green.log:13；task-2-fix1-api-final.log:14；task-2-fix1-build-final.log:261。
- M4 旧 Proposal fixture 仍按 Task 8/final review 处理。原 71/72 是历史全套结果，不是本轮含新增用例的完整回归；本轮未重跑该套件，不据此宣称全套绿色。
- 未新发现完全位于修复外的代码问题。

## Checks and Scope

- 本次沿用已读取的 Task 2 brief/global constraints，读取 scoped re-review 指引与实施报告修复附录。
- 固定 fix diff 仅从文件读取一次，然后在工具会话存储中分段展示，未截断、未重复读文件、未运行 Git。
- 无额外源码搜索/读取，无测试/build 重跑，无子 agent；没有未被既有执行回答且需要 focused 执行的新疑点。
- 报告列出覆盖命令/结果；另读取对应现有日志摘要确认：backend covering 38 passed；最终 create_only 4 passed / 31 deselected；UI 12 passed；build 19.67s；真实 E2E 1 passed / 10.2s。证据：task-2-fix1-api-green.log:13、task-2-fix1-api-final.log:14、task-2-fix1-ui-final.log:10、task-2-fix1-build-final.log:265、task-2-fix1-e2e.log:9（均位于本报告同目录）。
- typecheck exit 0 保持实施报告的既有执行证据身份，没有冒充本审查执行。错误注入验证 HTTP 错误恢复，不代表真实 PostgreSQL outage。
- 未改源码、索引、HEAD、分支或 Goal；唯一写入为本 scoped review 文件。

## Verdict

**Fix round: All findings addressed, no new Critical/Important breakage.**

I1、I2、M1、M2 均关闭。M3/M4 按既定后续边界保留；本结论仅批准本轮修复，不等同正式发布或全分支最终验收。
