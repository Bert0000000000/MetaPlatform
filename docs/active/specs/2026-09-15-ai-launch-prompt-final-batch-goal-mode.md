# GOAL 模式启动提示词 —— 最终批：CI 全绿 + 安全债收口 + 小项清零

> **用途**：整段复制粘贴到新 AI 会话开头，或本会话直接执行。目标驱动、自验证。
> **写成时间**：2026-09-15（PR #37 合并 main fa685592 之后；ADR-0064 已全量落地）
> **性质**：**最后一批修复项**（11 项，A/B/C 三组）——做完即收口，出口标准见文末。

---

你是一名自主执行工程师，在 MetaPlatform 仓库完成下述 GOAL。**按组推进（A→B→C），每项先验证根因再修，完成后跑对应验证并 git commit；全部完成后输出完成报告。** 只有在"完成判据"无法自行达成、且继续执行会造成破坏时才停下来问人。

## GOAL（一句话）

**main 上全部 workflow 绿** + **RLS 真生效（非特权角色）** + **16 处 rid 端点守门实测通过** + **5 个小项清零**——最终批 11 项全部收口。

## 任务清单（11 项）

### A 组 · CI 预存红清零（main 上即红，已逐一核实根因）

| # | 项 | 已核实根因 | 处置方向 |
|---|---|---|---|
| A1 | ruff 债 7 条（Lint ruff / ga-006 / kernel governance 三 job 同源） | `mate-kernel/src/mate_kernel/ontology/function_resolver.py:110` + `tests/test_function_resolver_git.py:25`（S607 partial-path subprocess）；`test_ontology_api.py:3`（I001）；`test_agent_metrics.py:11,320`；`tests/integration/test_v2_kernel_preflight_gate.py:469`；copilot `clients/base.py:211` | `ruff check --fix` 先清自动项；S607 用 `shutil.which("git")` 或绝对路径；确属模式者在 `ruff.toml` per-file-ignores 登记（仓库既有惯例），不盲豁免 |
| A2 | ga pre-commit job 红 | `test_function_resolver_git` 在 CI checkout（浅克隆/无 ref）上 `git show` exit 128 → 断言炸 | fixture 自建临时 git repo（init+commit 测试源码）而非依赖仓库历史；或 CI 环境检测收紧 skip 条件 |
| A3 | ga-014 RLS job 红 | `pg_schema_bootstrap_failed`——CI PG 非特权角色 bootstrap 失败 | 与 B5（GOVERN-09）同一件事：把非特权角色 bootstrap 脚本修对，job 自然绿 |
| A4 | cowork-prd-ci 红 | ①存量 PRD 文件缺 §0-§6 节 / FR-* / AC-* / NFR-* 编号（`2026-08-20-ai-launch-prompt-cowork-prd.md` 等）；②pymarkdownlnt **安装失败**（npm 源） | 看 `scripts/ci/check_prd_skeleton.py` 的白名单逻辑——要么补文件骨架、要么把历史 launch-prompt 类文件移出扫描范围（治标但合理：它们不是 PRD）；md-lint 换 pinned 版本/官方 registry |

### B 组 · 安全债（做完平台安全才有"双保险"）

| # | 项 | 现状 | 处置方向 |
|---|---|---|---|
| B5 | **GOVERN-09 非特权角色** | 应用角色 `meta` 是 rolsuper+rolbypassrls 恒绕过 RLS；26 张表 ENABLE+FORCE 形同虚设，租户隔离全压应用层 | dev 栈 + CI 双侧：PG 建非特权角色（如 `mate_app`，仅 CONNECT + 目标库 schema 权限 + GRANT 表级），compose/测试 DSN 切换；先跑 `security/test_tenant_isolation_hard.py`（现有 SKIP 门槛就是等这个角色）验证真拦截 |
| B6 | **16 处 rid 端点守门实测** | 带 `{rid}` 路径参数的端点约 18 处无源码级 `ont.{tenant}.` 前缀守门；已修 2 处（`/functions/{rid}/versions`、`/object-types/{rid}/datasources`，F8 同族） | 枚举 `v2_kernel/api.py` 全部 `{rid}` 端点 → 写一个实测脚本（双 token 双租户打全清单断言 403/404）→ 逐个补守门 → 脚本入库 `scripts/smoke/` |

### C 组 · 小项收尾（小时级）

| # | 项 | 说明 |
|---|---|---|
| C7 | InMemory `revert_proposal` 补齐 | 与 PG/API 签名对称（executed→reverted + edit_set 逆编辑补偿）；补齐后 API 级 revert 测试脱离 PG-only |
| C8 | Interface/ObjectType DELETE 端点 | 现无 DELETE，演练残留（drill-poly 等）删不掉；复用 GOV-17 使用量保护（有读量禁删 409）语义 |
| C9 | propose-edit-set 空 edits 时 expected_diff 预装配 | 现在 0 ops 占位；propose 侧预跑 assemble（dry-run）填真实 ops 数 |
| C10 | llmgw 容器重建 | P0-P6 已落地但容器跑旧镜像；按 `.tmp-build-context` 惯例同步重建（注意：llmgw 曾烧死需 docker cp site-packages，见记忆 tmp-build-context-pitfalls） |
| C11 | copilot 4 个在途文件验证入库 | `agent_loop.py` / `api/app.py` / `ontology_tools.py` / `test_agent_loop_ontology.py`（+457 行，聊天 evidence/proposal 持久化 + interaction context 注入，另一会话在途交付）——跑测试验证后单独 commit |

## 硬约束（违反任何一条 = 立即停止）

1. **不绕过 13 条硬规则**；不动门禁脚本语义（只能修被检对象或按惯例登记豁免）。
2. **测试只用 `mate-platform-backend/.venv`**；三包合跑基线 **1437 passed / 8 skipped**（main @ fa685592），任何提交不得低于；合跑抖动先单包复跑。
3. **网络走代理 7897**；`git -c http.proxy=http://127.0.0.1:7897 push`；`gh` 前 export。
4. **Conventional Commits + 按文件 add**；禁 `git add -A`（C11 的 4 个 copilot 文件单独一个 commit，不与其它项混）。
5. **从 main 开分支 `feat/final-batch-cleanup`**；push 后开 PR（引用本文件 + 验收证据）；完成后 `gh pr merge --admin --merge`（用户已授权本次直接合并）。
6. **改 B5 后必须跑 `packages/mate-tech-ont/tests/security/test_tenant_isolation_hard.py`**（当前因特权角色 SKIP 的那 4 条要真跑真绿）；dev 栈切换 DSN 后重启相关容器并网关探活（login admin/admin123 → GET /api/v1/ont/v2/value-types 200）。
7. **C10 llmgw 重建后探活**：`GET /api/v1/llmgw/providers` 200 + copilot chat 冒烟不 500；失败回滚到旧镜像（docker tag 备份先行）。
8. **B6 实测脚本用 drill- 前缀**造数，跑完清理。

## 环境事实卡

| 事实 | 细节 |
|---|---|
| main | `fa685592`（PR #37 已合并，ADR-0064 全量落地） |
| PG | dev 栈 `meta:meta@localhost:5432`（超级用户）；内核数据在 **metaplatform** 库（非 metaplatform_ont）；测试库 `metaplatform_ont` |
| 容器 | `mate-tech-ont` 挂载主树 `mate-platform-backend/packages`，改码 `docker restart` 生效；重启上游后注意网关连接池（已带重试，探活确认即可） |
| RLS 测试门槛 | `test_tenant_isolation_hard.py` 的 SKIP 条件就是「连接角色是 superuser/BYPASSRLS」——B5 做对它自动转绿 |
| cowork CI | `scripts/ci/check_prd_skeleton.py`；扫描范围与白名单逻辑先读再改 |
| ADR-0064 语义 | 已固化：显式 edits=全集跳过 function；execute 带 markings 闸门；契约 response required——本批不回退这些语义 |

## 出口标准（完成判据，全部满足才算收口）

- [ ] main 目标分支上 **7 个 workflow 全绿**（ga-acceptance / CI / OpenAPI Contract CI / Architecture Governance CI / ontology-loop / Python Backend CI / cowork-prd-ci）——CI 结论以合并前 PR checks 为准，合并后 main 复核一轮
- [ ] `test_tenant_isolation_hard.py` 4 条真跑真绿（非 SKIP）
- [ ] B6 实测脚本入库且全清单 403/404 断言通过
- [ ] 三包回归 ≥1437 passed
- [ ] C7-C11 五项各自有独立 commit + 验证证据
- [ ] 完成报告落档（本文件追加 §收口记录 或 ADR/ACCEPTANCE 段落）

## 边界（不要做）

- 不做新 feature（出站三通道 / target selector / Scenario UI / G44 等——已明确另立轨道）
- 不动 ADR-0064 固化语义
- 不重构与本批无关的模块；顺手发现的问题记入报告"遗留与建议"
- secret 不进 git
- 不删 legacy 路径
