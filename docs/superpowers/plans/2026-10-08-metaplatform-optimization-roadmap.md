# MetaPlatform 优化与业务试点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement accepted tasks one at a time. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **日期**：2026-10-08，Asia/Shanghai。
> **状态**：Accepted；2026-10-08 用户已授权执行迭代，首先按 `2026-10-08-metaplatform-r1-implementation.md` 执行准备与 R1。
> **资源假设**：Codex 主执行，用户负责业务语义、破坏性操作和验收决策；同一核心执行链保持一个实现负责人。

**Goal:** 在现有 MetaPlatform 上，将模型发布、存量迁移、持续同步、Agent 受控写入和恢复操作连接成可真实验收的业务闭环，并形成可滚动执行的优化队列。

**Architecture:** 沿用现有 Ontology Kernel、PgOntologyRepository、数据源同步、Agent 运行时和版本机制。优先统一现有路径的租户与类型家族边界、转换语义、事务协调和命令重放；扩展采用已有组件与契约，依据实际试点瓶颈决定规模化能力。

**Tech Stack:** 本仓库既有 Python/FastAPI/PostgreSQL、React/TypeScript、pytest、Playwright、Docker/Compose 与 GitHub Actions；依赖版本以现有锁文件和后续审定的构建清单为准。

**Spec:** `docs/active/decisions/ADR-0082-ontology-migration-plan.md`、`docs/active/decisions/ADR-0080-ontology-draft-and-version-mechanism.md`、`docs/active/decisions/ADR-0081-agent-write-lease-approval-and-tool-outcomes.md` 的现有语义；[本次项目盘点](https://chatgpt.com/s/t_6ac67f2f9e3c819198552b8cc2548f70)；用户已明确后续研发以本聊天的当前 MetaPlatform 工作树为准。

## Global Constraints

- 审核基线固定为 `e965d866b20dddf8d9ebb0418869b58a4697ee32`，对应 MetaPlatform 主分支合入 PR #95 后的内容；执行前记录新的实际 HEAD 和 Git/WIP。
- 当前研发仓库为 `2026-07-02-MetaPlatform`，本聊天工作树为 `C:\Users\houuu\.codex\worktrees\c385\2026-07-02-MetaPlatform`。C0 负责同步旧迁移指针。
- 规划继承已有交付。Scenario 隔离、预检阻断、同步完整性、模型原子性、关系并发、查询语义、版本与 Agent 写入治理只做受影响回归；新功能引起的回归单独登记。
- 所有迁移引用与副作用限定在当前授权租户、类型家族和目标实例集合内；入口与 Repository 都要验证。
- 默认保留数据；显式 drop 仍属于不可逆操作。模型回滚的现有范围是模型定义，不扩大解释为实例恢复或外部副作用补偿。
- 当前迁移范围保留为 ObjectType，复合主键重派生继续明确报告不支持。单事务容量经实测确定。
- 提交顺序沿用 `docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence`。
- 现有运行服务、数据库、工作树和未提交改动保留。验证使用独立测试数据库、明确端口和 Compose 项目；清理仅作用于本任务创建的资源。
- 必需数据库与浏览器测试不得因环境缺失而在必需作业中静默跳过；本地、PR 与合并后主干证据分别记录。
- 本文为程序级路线图。各 Story 进入开发前，在对应批次详细计划中固定测试内容、接口变更和回退步骤；设计改变现有业务语义时，先修订相关 ADR/契约。

## 1. 本轮核验与判断

已通过浏览器读取分享报告全文，并对当前工作树作源码核对。以下“确认”指源码或 Git 配置证据；本轮未运行真实数据库并发、故障注入或全仓测试。

| 项目 | 本轮核验结果 | 对规划的影响 |
| --- | --- | --- |
| PR #95 迁移能力 | ADR-0082 为 Accepted；已有评估、执行、迁移记录、发布重挂实例及前端入口 | 以现有实现加固组合路径 |
| 数据库门禁 | `ga-acceptance.yml` 的 `ont-kernel-tests` 没有 PostgreSQL service；迁移测试模块使用连接不可用时 skip，现有迁移文件有 22 个测试方法 | C1 先建立真实执行门禁 |
| 浏览器门禁 | 根配置的 `testDir` 是 `tests/e2e`，核心项目只匹配 `ontology-loop/ontology-core.spec.ts`；新增迁移用例位于另一个 `apps/web/tests/e2e` 目录 | 必须明确配置与测试文件，单改 testMatch 不足以覆盖另一目录 |
| 迁移引用 | API 将 baseline/target 继续传入 Repository；`get_version()` 按 RID 查询且没有显式 tenant 条件 | 双租户、同租户跨家族引用成为 C2 必需负例 |
| 重命名范围 | 覆盖层去重 DELETE 没有当前家族/目标实例集合限制；props 与 overlay 的冲突处理方向不同 | C2 固定执行集合与冲突策略 |
| 同步连续性 | 声明与调度仍携带 class_rid；同步按传入 RID 读取类型，源写入允许更新 class_rid | 列为 C3 的真实时序复现任务；是否写回旧版以实测判断 |
| 转换与组合 | 纯函数有整数转 double 的精度保护，SQL 转换未使用同一判据；重命名后的 PK 重派生仍反向寻找旧键 | C4 同时修转换一致性与步骤组合 |
| 幂等与并发 | 后端先验证 live checksum 再读历史；历史查询按 tenant/key；前端每次调用生成新键；迁移读取模型为普通 SELECT | C5 核实重放、同键异命令和并发提交行为 |
| Agent 写入 | 现有验收保留 propose 业务键幂等缺口、外部 Runtime 范围与多进程真实写入未验边界 | C7 扩展真实联动测试，未知结果先核对 |
| 接管与仓库残留 | 根 AGENTS.md 不存在；agent.md 有旧仓库指针；Git 跟踪 168 个字节码路径与 11 个 `.worktrees` gitlink，根 `.gitmodules` 不存在 | C0 处理标准入口与 Git 跟踪关系，保护本地文件 |
| 构建 | auth-service 与 llmgw Dockerfile 仍有直接安装未固定版本依赖的路径 | C6 形成依赖与镜像来源基线 |

盘点报告中的主干 CI 运行编号及 `1122 passed / 211 skipped` 为报告提供的历史证据，本轮没有重新拉取原始作业日志。源码足以确认覆盖缺口，下一步应以新作业实际执行清单和 JUnit 结果关闭。

## 2. 优化方向与取舍

推荐按**业务闭环逐段加固**推进。它能让每轮分别交付安全迁移、持续同步、可靠重试、受控 Agent 写入和可恢复运营。全模块横向铺开会争用同一批核心文件并延后验收；优先替换架构组件的收益，目前也缺少性能或运维数据支撑。

### 2.1 迁移的数据正确性

统一引用归属、目标集合、计划白名单、冲突处理、数值精度和步骤输入输出。默认方案是新旧字段同时有有效值时中止并列出冲突，允许用户先修数据；增加其他冲突策略必须有明确业务语义和测试。

PostgreSQL 的 double precision 是非精确数值类型。转换准入需要检查有限值与业务精度；金额等精确数值保持既有精确表示，先验证现有类型声明与数据，再决定是否增补类型能力。[PostgreSQL 16 数值类型](https://www.postgresql.org/docs/16/datatype-numeric.html)

### 2.2 发布、迁移与同步共享生命周期

将类型家族的当前生效版本、数据源声明、字段映射、主键映射和同步水位作为一条连续业务路径验证。旧调度任务必须重新确认生效版本；归档版本写入的处理方式统一登记，避免各入口自行决定。

推荐在发布事务内切换同族数据源绑定与相关映射，保留已经处理的同步水位；同步入口在取得家族变更协调权后再次校验版本。涉及 PK 变化时，水位的源端排序键与目标 RID 分开核对，避免误改游标或重建旧 RID。

### 2.3 用户操作有稳定身份与可核对结果

一次确认生成一个稳定操作键，失败重试复用原键。后端将键绑定租户、目标、规范化命令与原基线指纹；相同命令回放原结果，相同键不同命令返回冲突。回放仍需当前授权校验，模型后来变化不会抹掉已完成结果。

UI 展示“待执行、执行中、完成、明确失败、结果待核对”，结果未知时优先查询已有记录。评估、确认、执行、结果核对与迁移历史形成同一操作流程。

### 2.4 Agent 与 Provider 分层验证

保留已有审批、租约和工具账本，补真实双进程与本体服务的写入联动。接收端尚无业务幂等的 propose，遇到未知结果保持禁止自动重试，给出提案查询和人工核对路径；是否增补业务键幂等作为对应接口变更审定。

核心本体测试继续使用确定性 hash 嵌入。真实 Provider 单独验证超时、限流、断连和恢复；如果确实阻塞核心写入，再通过已有后台任务或事件机制解耦索引，明确索引滞后状态与补偿查询。

### 2.5 可复现构建、恢复和容量

统一锁定依赖清单、基础镜像来源、构建工具及产物记录；两次干净构建对比依赖图与清单，保存各自镜像 Digest。依赖一致与逐字节相同的镜像是不同验收指标。[pip 可重复安装指南](https://pip.pypa.io/en/stable/topics/repeatable-installs/)

恢复演练先覆盖实例、关系、来源、编辑覆盖、数据源声明、水位与迁移记录的完整集合。以 1 千、1 万、10 万实例逐级测量单事务时长、锁等待、查询 P95 与资源占用，形成给定资源下的准入上限；更大规模和后台分批仅在实际瓶颈成立后进入下一计划。

## 3. 六轮迭代安排

时间按每轮约两周预估，前置准备约 1–2 个工作日。开始日期以正式启动为准；前两轮优先固定范围，后四轮依据真实失败项、资源和用户验收滚动调整。

| 轮次 | 用户可验收的结果 | 工作范围 | 前置 | 退出条件 |
| --- | --- | --- | --- | --- |
| 准备 | 新会话能准确定位、安装和验证当前项目 | C0；独立环境与测试采集 | 用户已指定当前仓库 | 指引、锁文件入口、测试清单和独立资源范围明确 |
| R1 | 模型管理员可安全评估与执行受支持的字段迁移 | C1 + C2 | 准备 | 原 22 项、新增范围负例与迁移浏览器用例真实执行；其他租户和类型没有被读写 |
| R2 | 模型升级后，后续源数据更新仍归属正确版本 | C3 + C4 | R1 | 发布、字段/主键迁移、增量同步、调度器重启后的数据对账一致；精度边界不丢值 |
| R3 | 响应丢失与并发操作后，用户能找到唯一且正确的结果 | C5 + 操作恢复 UI | R2 | 同键同请求回放、同键异请求冲突、并发发布/迁移/同步与快照一致性通过 |
| R4 | 数字员工在审批与失租边界完成可核对的真实业务写入 | C7 + Provider 故障验证 | R3 | 双进程、真实本体、可控停点测试通过；未知结果没有盲目重放；核心写入的故障边界明确 |
| R5 | 指定数据规模下可构建、可发布、可恢复 | C6 + 备份恢复/容量演练 | R3；Agent 路径依赖 R4 | 契约与客户端一致；构建依赖可追溯；完整恢复对账通过；容量与超限行为有实测依据 |
| R6 | 一条真实业务试点从数据变化到审批和执行结果走通 | 已有业务流程的纵向试点 | R1–R5 | 用户按业务结果验收；实际数据、操作历史、异常恢复、试点部署证据完整 |

R1/R2 的演示在隔离环境中进行；完整迁移能力的业务试点需要 C1–C5、适用恢复路径和数据规模准入都通过。已有只读能力与未受影响功能继续按原边界使用。

R6 推荐以仓库已有的订单洞察/订单审核路径为候选，将合同或客户数据作为扩展输入。试点开始前由用户确定具体业务数据、审批人和正确结果，避免工程演示替代业务验收。

## 4. 队列、文件边界与验证步骤

以下 C0–C7 沿用本次盘点的任务编号，附加任务服务于同一业务闭环。文件路径均相对仓库根目录；标记“新增”的文件是后续实施计划，不代表本轮已创建。

包内路径简写统一展开为以下根目录：`v2_kernel/` = `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/`；本体 `tests/` = `mate-platform-backend/packages/mate-tech-ont/tests/`；`mate-kernel/` = `mate-platform-backend/packages/mate-kernel/`；`mate-tech-agent-team/` = `mate-platform-backend/packages/mate-tech-agent-team/`；`contracts/` = `mate-platform-backend/contracts/`。前端文件均以 `metaplatform-frontend/apps/web/` 为应用根目录。

### C0：统一接管与验证入口

**Files:** 新增根 `AGENTS.md`；修订 `agent.md`、`CLAUDE.md`、`docs/README.md` 与 `.gitignore`；核对 Git 索引中的字节码和 worktree gitlink。

**Interfaces:** 消费用户指定的当前仓库身份和既有 ADR；产出短指引，引用现有事实源、安装入口、验证命令和运行服务保护规则。

- [ ] 固定 HEAD、WIP、已有服务与测试目标；记录本工作树没有本地后端虚拟环境或前端 node_modules 的基线。
- [ ] 修订仓库指针，建立标准入口；对旧规格与当前代码的冲突登记明确决策，保持架构内容单源维护。
- [ ] 分别确认 Windows 项目 Python 与 Linux CI 的执行入口；使用现有 uv/pnpm 锁文件安装，不直接依赖系统 Python 3.14。
- [ ] 逐项核对字节码与 gitlink 的跟踪原因，只修正确定为生成物或误登记的 Git 跟踪关系，保留本地工作树与文件。
- [ ] 以无历史聊天的新会话视角自查：仓库、权威文档、安装、测试、保护范围都能独立定位；形成单独可审查提交。

### C1：让数据库与迁移浏览器用例实际进入门禁

**Files:** `.github/workflows/ga-acceptance.yml`、`.github/workflows/ontology-loop.yml`、`scripts/ci/ontology-core-e2e.sh`、两个 Playwright 配置；本体集成测试的连接配置和环境检查；可新增专用 CI 脚本与测试配置。

**Interfaces:** 消费现有 PostgreSQL/RLS 测试准备机制和迁移测试；产出独立数据库集成作业、明确的迁移浏览器执行入口、实际执行清单与 JUnit/Playwright 产物。

- [ ] 在干净测试环境收集原 22 项与受影响旧测试，先证明当前必需作业没有覆盖它们。
- [ ] 为必需数据库作业配置隔离 PostgreSQL；统一 DSN 输入，兼容当前 `VER_PG_DSN`/`PG_DSN` 使用点，显式检查连接失败。
- [ ] 保留非特权 RLS 专项；迁移与范围负例采用完成 schema 准备后的真实业务角色，核实 owner/BYPASSRLS 不能替代隔离证明。
- [ ] 浏览器选择显式使用 `apps/web/playwright.config.ts` 或审定的新迁移专用配置；列出实际文件，保留当前核心 E2E。
- [ ] 执行迁移、同步、模型原子性、关系并发、版本与查询一致性的受影响集成回归；必需集中的环境性 skip 使作业失败。
- [ ] 以 PR 与合并后主干的新证据关闭，分别登记 passed/failed/skipped 和实际选中文件。

基线命令须在隔离 PostgreSQL 已正确注入 DSN 后执行：

```powershell
uv run --python 3.12 --directory mate-platform-backend python -m pytest packages/mate-tech-ont/tests/integration/test_ont_migration_plan.py -q --junitxml=../acceptance/ont-migration-baseline.xml
```

浏览器命令须在隔离服务与前端准备好之后执行：

```powershell
pnpm -C metaplatform-frontend exec playwright test --config=apps/web/playwright.config.ts tests/e2e/ontology-migration-plan.spec.ts --workers=1
```

作业准入还必须验证“测试被采集且没有环境性跳过”；仅凭 pytest 退出码为零不能关闭 C1。

### C2：迁移范围、引用与计划校验

**Files:** `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`、同目录 `pg_repo.py`；`mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/migration.py`；现有 `tests/integration/test_ont_migration_plan.py` 与 `contracts/openapi/services/ont.yaml`。

**Interfaces:** 消费 URL 类型、baseline、target、当前授权上下文与原迁移计划；产出通过验证的同租户同家族计划和固定目标实例集合。计划不能扩大评估范围。

- [ ] 先添加真实双租户版本快照、同租户不同类型共享属性、篡改计划属性/格式/目标的失败测试。
- [ ] 入口验证所有嵌套引用；Repository 根据当前 tenant 与快照所属类型再次验证，不能只按快照 RID 读取。
- [ ] 服务端重新校验或派生规范计划；允许的用户选项明确限定，未知字段、非法格式及范围扩大被拒。
- [ ] 迁移 SQL 共用目标集合，覆盖 props、props_src、overlay、field_mapping；统一新旧键并存时的冲突判据。
- [ ] 同时断言错误结果与数据库零变更；非目标类型的实例、覆盖和映射逐项对账。
- [ ] 更新 ADR/契约的错误语义，跑 C1 的真实门禁，再形成代码与证据提交。

### C3：发布—迁移—持续同步

**Files:** `v2_kernel/pg_repo.py`、`v2_kernel/sync_scheduler.py`、`v2_kernel/backing_datasources.py`；现有 `test_ont_data_sync_integrity.py`、`test_ont_p1_sync_scheduler.py` 和迁移集成测试。

**Interfaces:** 消费类型家族当前生效版本、数据源声明、field_mapping 与源端水位；产出版本一致的持续同步结果。C3 建立必要的家族协调与提交时版本校验，C5 扩展同一协议的并发验收。

- [ ] 先复现 v1 同步、v2 发布、旧任务再次派发的时序，记录实例实际归属；如果现有路径已拒绝旧写，也要核实任务如何恢复到新版。
- [ ] 在发布事务中协调数据源绑定与相关映射；同步取得协调权后重新检查生效版本，处理过期调度参数。
- [ ] 验证迁移前已开始的同步任务，不得在新版生效后提交旧归属或旧字段形态。
- [ ] 验证 PK 迁移后增量同步与源端删除，不创建旧 RID、不遗留关系端点、不复活已删除字段；保留正确源端水位。
- [ ] 重启调度器后重复源数据更新，对实例、关系、来源、编辑覆盖和水位全量对账。
- [ ] 回归已有同步一致性与家族发布用例，登记可演示业务结果。

### C4：数值语义与组合步骤

**Files:** `mate-kernel/src/mate_kernel/ontology/migration.py`、`v2_kernel/pg_repo.py`；新增纯函数语义测试与真实数据库差分测试，扩展迁移集成测试。

**Interfaces:** 消费 old/new ObjectType 与受限 options；产出语义一致的计划、评估计数、执行数据及 preserved/coerced 报告。

- [ ] 对 `2**53` 附近整数、超范围整数、高精度小数、`1e309`、非法文本、bool 和 NULL 建立参数化用例。
- [ ] 比较纯函数、评估计数和 PostgreSQL 执行；不满足有限值与精度规则的值保留并可见报告。
- [ ] 定义每步输入/输出，PK 重派生使用重命名后的有效键；属性换 RID 与改格式同时发生时仍有转换判断。
- [ ] 覆盖 rename + coerce + PK + link + overlay + datasource mapping 的组合，冲突时整个事务无部分写。
- [ ] 将超出支持范围的组合明确阻断；更新评估与 UI 提示，重新跑 C1/C3 门禁。

首个可独立验证的纯函数回归例：

```python
from mate_kernel.ontology.migration import coerce_value

def test_overflowing_exponent_is_preserved():
    assert coerce_value("string", "double", "1e309") == "1e309"
```

该测试只锁定极大指数保留行为；数据库精度和组合执行仍须真实 PostgreSQL 验证。

### C5：命令重放与并发操作

**Files:** `v2_kernel/pg_repo.py`、`v2_kernel/api.py`；`metaplatform-frontend/apps/web/src/api/ont/kernel.ts` 与 `pages/ontology/governance/releases/ReleasesPage.tsx`；版本/迁移并发测试与前端 API 测试。

**Interfaces:** 消费稳定操作键、目标类型、规范化命令指纹与原 expected_checksum；产出同请求的原结果或明确冲突。复用 C3 的家族协调协议。

- [ ] 响应丢失后重试、模型后来变化后重试、相同键不同类型/计划先写失败测试。
- [ ] 用户确认时生成并保存稳定操作键；请求函数接受调用方传入的键，失败重试与查询复用。
- [ ] 验证当前授权后识别原命令；同键异命令拒绝，同请求已完成优先回放原结果，再对新命令验证当前模型。
- [ ] 并发同键以数据库唯一约束/协调产生一条执行记录；冲突等待后读取并核对原命令，不能把所有数据库冲突吞成成功。
- [ ] 并发发布、迁移、同步和独立快照时，核对模型/数据/版本 RID/指纹对应同一次事实；统一锁顺序与超时处置。
- [ ] UI 对未知结果先查历史，展示可核对状态；同键重试、页面重载恢复和冲突提醒的浏览器用例通过。

### C6：契约与构建来源

**Files:** `contracts/openapi/services/ont.yaml`、`docs/active/delivery/REQUIREMENT-MATRIX.yaml`、现有契约测试；auth-service/llmgw Dockerfile、相应 pyproject 与 uv.lock；前端生成类型及调用测试。

**Interfaces:** 消费真实接口清单、现有 operationId 与依赖锁；产出版本化契约、可追溯依赖清单和镜像产物。

- [ ] 核对 branch/diff/rollback/wip 的真实路由及消费者，补齐契约与 Requirement 对位。
- [ ] 固定业务语义和错误码后更新类型与调用测试，执行 OpenAPI 差异检查。
- [ ] 将两服务直接安装路径收敛到审定的锁定依赖与基础镜像来源；保留已补齐的异步数据库依赖。
- [ ] 在干净构建环境重建两次，对比依赖图与来源清单，记录镜像 Digest、构建配置和 SBOM。
- [ ] 启动检查之外执行登录、授权请求与受影响 Provider 路径；验证上一产物回退。

### C7：Agent 真实写入联调

**Files:** `mate-tech-agent-team/src/mate_tech_agent_team/run_lease.py`、`tool_ledger.py` 与现有执行面；`tests/test_agent_write_correctness.py`、`test_replica_two_process.py`；MCP 本体代理与所需本体接收端。

**Interfaces:** 消费已审批命令、运行身份、lease epoch、工具账本与本体结果；产出实际副作用、结果核对与恢复证据。

- [ ] 在真实本体服务和隔离数据库上增加可控停点：派发前、请求已到达、数据库已提交但响应未到达。
- [ ] 两个真实进程验证失租、接管、断连、超时、审批与恢复；检查本体事实，而不只检查运行时日志。
- [ ] 已具备幂等语义的相同命令只产生一份业务结果；明确当前接收端尚未具备幂等的命令范围。
- [ ] 对 indeterminate 先查业务对象/提案/执行记录；无法证明结果时进入人工核对，不自动再写。
- [ ] 本体 propose 的业务键幂等若为试点必需，独立完成契约和测试；外部 Runtime 验收独立登记。
- [ ] 租约、审批和真实写入联合通过，形成用户可验收的数字员工业务操作。

### 附加任务：真实 Provider、恢复容量与业务试点

**Files:** `v2_kernel/object_search.py` 与索引写入路径、llmgw 既有 Provider 测试；现有恢复 runbook、备份与业务流程入口；新增受影响路径的故障/容量/试点验收文件。

- [ ] R4 对真实 Provider 注入不可用、延迟、限流、响应中断和恢复，记录核心数据提交与索引状态；以实测决定解耦范围。
- [ ] R5 建立完整迁移前恢复点，在独立环境验证失败事务回退、迁移后数据恢复及模型回滚的区别。
- [ ] R5 逐级压测 1 千、1 万、10 万实例，记录执行时长、锁等待、读写 P95、吞吐、资源与恢复时间；发布已验证容量与超限处置。
- [ ] R6 由用户固定一个真实业务场景和预期结果，执行正常、拒绝、未知结果与恢复四条路径。
- [ ] 只按已验收能力做受控试点，记录试点推广与回退证据；正式上线沿用现有发布准入规则。

## 5. 第一条贯穿验收场景

```text
两个租户 + 两个共享属性的类型
→ 为其中一类创建 v1 模型与数据源映射
→ 首次同步并添加用户编辑、关系
→ 发布 v2、评估并执行 rename/coerce/PK 适配
→ 源端新增/更新/删除
→ 增量同步、重启调度器、再次同步
→ 核对实例归属、值、关系、来源、覆盖层和水位
→ 模拟迁移响应丢失，复用操作键查询与重试
→ 数字员工在审批后执行受支持业务动作
→ 注入失租/断连，核对实际副作用
→ 独立环境恢复，对账业务事实与操作记录
```

负例固定包含：跨租户 baseline、同租户跨家族引用、计划扩大范围、共享属性非目标类型、极大数、PK 重命名、相同键不同命令、并发模型变化。每个负例同时断言响应和数据库状态。

## 6. 交付与协作方式

- 一个 Story 对应一个用户结果、一个负责人、一个主要变更范围和一组必需验证；核心 `pg_repo.py`/`api.py` 的变更串行整合。
- 每轮先演示，再报告实现、测试、实际业务结果、剩余边界与回退方式。局部通过只关闭对应 Story。
- 证据记录 source commit、环境/镜像来源、配置摘要、实际选中的文件、passed/failed/skipped、数据对账和恢复结果；不包含 Secret。
- Codex 负责复现、实现、测试、文档与可审查提交；用户负责冲突值处理语义、破坏性迁移、业务结果及试点/发布决策。
- 将现有任务板保持为真实状态；本文中的计划日期与待办框不改变已验收结论。

## 7. 试点后优化队列

按试点反馈与指标准入，优先考虑：迁移影响/历史/失败处置的一体化操作流程；索引补偿与可解释查询状态；大规模迁移检查点、分批与在线窗口；高频查询和同步热点；被真实业务调用的合同、客户、数据质量与工作台增量。

复合主键、其他本体原语迁移、新消息/工作流系统和更多员工类型，分别在具体业务需要、兼容契约和验证方案成立后单独立项。

## 8. 规划自查

- C0–C7 均已映射到轮次、文件和验收条件；数值精度 P0 在 R2 关闭，范围/计划 P0 在 R1 关闭，完整迁移试点以前置验收为准。
- C3 的最小版本协调是自身验收条件；C5 在同一协议上完成命令与并发范围，避免依赖倒置。
- Provider、恢复与业务试点是本次规划提出的后续工作；没有写成现有能力或已通过证据。
- 本轮仅做源码/Git 配置核验和规划撰写；动态风险以失败测试、真实执行和数据对账确认。
