# MetaPlatform 1.1.0 candidate acceptance

Status: local development candidate source/review/business requirements verified. Original8 task gates, one whole-branch review, unified final fix and the explicitly recorded Ruling43 same-seat I1 residual correction/review are complete. Final reviewed HEAD94277b97; product amendment3e844b84. [Completion matrix](mp11-closure/completion-audit-matrix.md) maps original48 unchanged plan criteria and22 P0 with exact receipts/source fingerprints. Private owner-only ignored whole-Scratch recovery/removal and post-cleanup signed/runtime readback are complete, recorded in mp11-closure/scratch-recovery-retirement.json and postcleanup receipts.

Current [website](http://127.0.0.1:9368/website/) and [login](http://127.0.0.1:9368/login) use current branch source with owned Docker PG/Keycloak/Redis. Normal signed writer/readonly/neighbor/service grants and GET-only original app/version/executed proposal/history1/approved order pass; neighbor404/wrong-tenant403. See mp11-closure/controller-final-live-readback.json. Docker original37 running IDs are retained,33healthy plus4without health checks. Current host API/Auth/Web and protected credentials/manifests live outside plan Scratch; login inputs remain owner-local as documented in scripts/acceptance/mp11/README.md.

Original acceptance.json/migration-chains.json and full task reports retain actual source discovery, draft/publication, realPG/CSV ingestion, relations, published app/human receipt, signed tenants/scopes, MCP initialize/list/query/revocation, new database/0020 upgrade/restart/replay/compensation/fault proof. Existing full-suite and failure/covering histories are not overwritten. Separate default Browser44/44 runs and final47/47 are actual distinct runs. Final source fixes retain AppHub232,ONT698+13skips,MCP279,UI16,signed56,type/build0. Residual page-parent fix uses meaningful RED3 and GREEN18 over memory/SQLite/actual ownedPG plus existing compatibility5; source map and independent scoped approval are separate proof. No aggregated fresh-all-suite claim.

Eight privileged-role RLS cases remain NOT_EXERCISED; five memory parameterizations have passing PG counterparts. Native dsh/WorkBuddy/browser WS header gateway, immediate direct-API access-token revocation, external bus/client delivery, formal public deployment,72-hourSLO and user study remain explicit limits. Bounded polling plus exactly-owned API restart is the tested recovery, not automatic LISTEN reconnect. No GA claim.

Lifecycle/normal signed probe: scripts/acceptance/run-mp11-acceptance.ps1 and mp11/README.md. Verify deliberately mutates additive validation/business fixtures; it is not a read-only health command. Controller post-recovery readback used login plus GET only. Start/Stop preserve data and enforce owned target identity. LegacyTask6API55510 is absent by fresh PID/script/port checks; its complete original launch inputs were retained with exact file hashes in the owner-only ignored recovery archive before exact Scratch removal. No shared down-v/reset workflow.

Canonical structural proof remains official OpenAPI3.1 errors0, exact moved-block semantic equality and13live operationIDs; DATA seven decorator-only additions have AST equality after removing operation_id. These are specific proofs, not whole-contract runtime equivalence. Warning/formatting/raw-output boundaries and exhaustive47 rulings are in mp11-closure.

## 2026-10-13 main 整合验证记录

本节记录 [PR103](https://github.com/Bert0000000000/MetaPlatform/pull/103) 的整合检查快照。精确 commit 为 `d3539e85a58973a5531ae0585965c77bc5151619`，对照基线为 `origin/main` 的 `303d3ca69cbe0d4f817cf2f4ca3294c8c9f0b7e5`。上文任务报告、旧候选本地业务收据和 `94277b97` / `3e844b84` 等提交属于各自注明的历史验证范围，不能作为当前整合提交已全绿的证明。

当前 PR103 尚未全绿、尚未合入 main。本节中的 SUCCESS / FAILURE 是指定提交对应 CI job 的实际结果；本轮文档和 Builder 测试步骤修订仍需新提交后的 CI 复跑，不能提前把失败改为 Passed。Tencent Demo CI 的验证结果也不等同于正式部署验收；本文件继续不作 GA 声明。

### ga-001 至 ga-013 门禁

以下证据均来自同一次 [ga-acceptance PR run 38263500810](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810)，其 `headSha` 与本节 commit 相同。命令列为读取相应 job 日志的复核命令，从仓库目录执行；具体检查命令及依赖见 [.github/workflows/ga-acceptance.yml](../../../../.github/workflows/ga-acceptance.yml)。表中 commit 缩写统一指向上述精确提交。

| 门禁 | job | 状态 | 证据 | 命令 | commit |
| --- | --- | --- | --- | --- | --- |
| ga-001 | oasdiff (no unapproved breaking) | FAILURE | [job 114859721277](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721277) | `gh run view 38263500810 --job 114859721277 --log` | `d3539e85` |
| ga-002 | requirement IDs present | SUCCESS | [job 114859721019](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721019) | `gh run view 38263500810 --job 114859721019 --log` | `d3539e85` |
| ga-003 | forbid_raw_sql (rule 3) | SUCCESS | [job 114859721296](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721296) | `gh run view 38263500810 --job 114859721296 --log` | `d3539e85` |
| ga-004 | forbid_bare_httpx (rule 4) | SUCCESS | [job 114859721376](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721376) | `gh run view 38263500810 --job 114859721376 --log` | `d3539e85` |
| ga-005 | forbid_legacy_fallback (rule 5) | SUCCESS | [job 114859721295](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721295) | `gh run view 38263500810 --job 114859721295 --log` | `d3539e85` |
| ga-006 | ruff + pyright strict | SUCCESS | [job 114859721170](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721170) | `gh run view 38263500810 --job 114859721170 --log` | `d3539e85` |
| ga-007 | forbid_skip_tests (rule 7) | SUCCESS | [job 114859721211](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721211) | `gh run view 38263500810 --job 114859721211 --log` | `d3539e85` |
| ga-008 | helm lint + kubeconform | SUCCESS | [job 114859721180](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721180) | `gh run view 38263500810 --job 114859721180 --log` | `d3539e85` |
| ga-009 | OTel collector smoke | SUCCESS | [job 114859720643](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859720643) | `gh run view 38263500810 --job 114859720643 --log` | `d3539e85` |
| ga-010 | require_evidence (rule 10) | SUCCESS | [job 114859721026](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721026) | `gh run view 38263500810 --job 114859721026 --log` | `d3539e85` |
| ga-011 | helm-docs --dry-run | SUCCESS | [job 114859721142](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721142) | `gh run view 38263500810 --job 114859721142 --log` | `d3539e85` |
| ga-012 | gitleaks | FAILURE | [job 114859721255](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721255) | `gh run view 38263500810 --job 114859721255 --log` | `d3539e85` |
| ga-013 | NetworkPolicy service coverage | SUCCESS | [job 114859721463](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721463) | `gh run view 38263500810 --job 114859721463 --log` | `d3539e85` |

### 当前整合提交已通过的限定检查

| 检查范围 | 状态 | 证据 | 命令 | commit |
| --- | --- | --- | --- | --- |
| ontology PostgreSQL required regressions（原生 PG 回归） | SUCCESS | [job 114859721372](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721372) | `gh run view 38263500810 --job 114859721372 --log` | `d3539e85` |
| ga-014 Ontology PostgreSQL RLS isolation | SUCCESS | [job 114859721009](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721009) | `gh run view 38263500810 --job 114859721009 --log` | `d3539e85` |
| Frontend (metaplatform-frontend)，常规前端 CI | SUCCESS | [job 114859718570](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500871/job/114859718570) | `gh run view 38263500871 --job 114859718570 --log` | `d3539e85` |

原生 PG 回归和 RLS 的通过不能覆盖下表失败的 MP11 data / AppHub / MCP PostgreSQL 验收；常规前端 CI 的通过也不能覆盖失败的真实浏览器闭环。上文旧候选的 NOT_EXERCISED 与既有验收边界仍按其原始范围保留。

### 当前失败项与复跑要求

| 检查 | 状态 | 证据 | 当前边界 |
| --- | --- | --- | --- |
| cowork md-lint (pymarkdownlnt) | FAILURE | [job 114859718876](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500836/job/114859718876) | 本轮变更 Markdown 有 172 条格式错误；格式修订后须以新 CI 结果确认 |
| cowork PRD skeleton check | FAILURE | [job 114859719392](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500836/job/114859719392) | 原 MP11-ACCEPTANCE 缺 ga 编号、证据、命令和 commit 字段；本节补充不等同于旧 run 通过 |
| ga format | FAILURE | [job 114859721595](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721595) | 文档修订不代替 Python、JSON、workflow 等格式结果 |
| ga tests (infra + mate-platform + mate-app-kb + governance) | FAILURE | [job 114859721710](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721710) | 须完成对应失败修复并复跑；不借用旧候选测试数字 |
| MP11 data, AppHub and MCP PostgreSQL acceptance | FAILURE | [job 114859721192](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500810/job/114859721192) | 须以本次整合来源重新取得真实 PostgreSQL 验收结果 |
| ontology core e2e（含 Builder 与 Excel 建模） | FAILURE | [job 114859719425](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500946/job/114859719425) | Builder 19/21；模型名称 / WIP 选择器失败已定位，步骤修订待真实 CI 复跑；其他核心与建模失败仍需修复 |
| Architecture kernel governance | FAILURE | [job 114859719906](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500936/job/114859719906) | 独立治理门禁未通过，不能由文档或前端单测替代 |
| OpenAPI breaking-change | FAILURE | [job 114859719398](https://github.com/Bert0000000000/MetaPlatform/actions/runs/38263500988/job/114859719398) | 与 ga-001 一同保留失败状态，等待契约复核与 CI 结果 |

### 格式修订与原始证据

本轮格式修订仅处理 `origin/main..d3539e85` 范围内新增或编辑的 `docs/active/specs` / `docs/active/delivery/evidence` Markdown。空行、标题层级、链接和技术文本的 Markdown 标记修订保留原结论、命令代码块与历史证据状态；本节是追加的整合快照。原始 JSON / log 不作字节修改。

历史源清单或归档清单中若记录了 Markdown 文件摘要，该摘要仍指向格式修订前的原始字节。原文可从 `d3539e85a58973a5531ae0585965c77bc5151619` 的对应 Git blob 只读获取并复核，例如 `git show d3539e85a58973a5531ae0585965c77bc5151619:docs/active/delivery/evidence/mp11-plan/task-1-report.md`。修订后的 Markdown 哈希不能冒充旧收据哈希；无需改写原始清单来掩盖格式变化。

本轮文档复核命令与 CI 一致：使用 Python 3.12 和 `pymarkdownlnt==0.9.40` 执行 `python -m pymarkdown -d md013,md041 scan <本轮变更的 MD 文件清单>`，以及 `python scripts/ci/check_prd_skeleton.py --prd-dir docs/active/specs --evidence-dir docs/active/delivery/evidence --strict --files <同一清单>`。上述本地检查仅验证文档格式和骨架；PR103 的失败 job 仍以提交后的实际 CI 复跑为准。
