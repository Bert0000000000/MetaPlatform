# 数据逆向建模第一期：本地工程验收

日期：2026-10-10。基线 `816684e7`，功能分支 `codex/data-modeling-phase1`。依据 [ADR-0083](../active/decisions/ADR-0083-data-driven-modeling-phase1.md) 和 [分期计划](../superpowers/plans/2026-10-10-data-driven-ontology-integration.md)。本记录是本地工程证据，不能替代 CI、生产上线或业务人员签字。

## 产品边界

新增可选 `/ontology/model/from-data` 工作区：上传 → 画像/业务问题 → AI 建议 → 表单编辑/逐项确认 → 本体结构校验/语义审查 → 原生本体发布与验收。数据同步是发布后的可选操作。原有正向默认入口和页面保留；候选独立存储，只有明确发布进入正式本体。

使用现有 PageHeader、Semi UI 和主题 token；提供制造齐套、客户订单、设备继承三套工作簿，各带五个业务问题。接口、公理约束生成、业务动作、函数、自动齐套计算留待后续阶段。

## 隔离与复现

- 原目录 `D:\code\MetaPlatform` 保留 main 及原有服务；预览工作树 `C:\Users\32891\.codex\worktrees\data-modeling-phase1\MetaPlatform`。
- 预览页面 `http://127.0.0.1:9350/ontology/model/from-data`；本轮代理 8200、ONT 8207、Copilot 8701。
- PostgreSQL 16 容器 `meta-modeling-phase1-pg` 仅监听 `127.0.0.1:55440`。预览、六组回归、FORCE RLS 专项分别使用独立数据库及非超级用户、无 BYPASSRLS 角色。
- 预览 ONT/Copilot 容器分别为 `meta-modeling-phase1-ont`、`meta-modeling-phase1-copilot`；只读挂载本轮源码，AI 读取既有受控供应商配置，凭证未写入证据文件。
- 后端按工作区 uv.lock 安装，补充 openpyxl、python-multipart；前端使用 `pnpm install --frozen-lockfile --ignore-scripts`，未删除或更换前端锁文件。
- `scripts/fixtures/modeling_phase1.py` 可重新生成三套工作簿和期望问题。运行工件位于本轮 `.cache/modeling-phase1/`、`.ci/` 和前端 `test-results/`。

## 已执行证据

| 验证 | 结果与边界 | 本地工件 |
| --- | --- | --- |
| 六组原生 PG 强制门禁 | 最后运行 123 passed，0 skipped，逐条身份核对；覆盖迁移、同步、原子性、关系并发、版本、查询 | `.ci/ont-postgres-phase1-final.xml`、`pg-regression-final.log` |
| FORCE RLS 专项 | 8 passed，0 skipped；另库 9 张原生表强制 RLS | `.ci/ont-rls-phase1-final.xml`、`pg-rls-final.log` |
| Core/AI/ACL | 153 passed；受控响应验证结构、拒绝/截断、错误处理、权限、人工确认复位，以及多级继承与重复映射阻断 | `.ci/modeling-core-ai.xml` |
| 新 PG 发布/同步集成 | 18 passed；原生复用/扩展、人工覆盖、草稿竞争、任务多 worker、重复身份、租户隔离及三层继承 | `.ci/modeling-integration.xml` |
| 前端 | 类型检查、最终生产构建、13 个流程单测与 32 个既有导航回归通过 | 前端 FromDataPage 测试、构建输出 |
| 真实浏览器 | 4 passed：两领域导入/人工确认/原生发布/对象查询、制造重复同步、销售复合身份、390px 独立入口、三层继承及父查询 | `metaplatform-frontend/test-results/modeling.xml` |

最初六组误用 FORCE RLS 专项环境，raw fixture 清理失败，结果已保留为失败证据。随后按照官方门禁分工把六组 owner fixture 库设为非 FORCE，另建 FORCE RLS 专项库，两组均实际通过；未跳过或弱化用例。部分既有 FastAPI 生命周期弃用提示、构建 chunk 大小提示不影响本轮通过。

## 真实模型与业务样本

两套候选均由当前平台受控供应商真实生成，完整业务上下文与问题 ID 保留；生成后所有人工确认默认关闭。

制造样本发现仓库类漏映射，人工补仓库及跨表映射后验证为 6 类、12 对象、12 关系；正式发布并连续同步两次，原生数量分别为物料 2、仓库 2、库存 3、BOM 行 2、产品 1、工单 2，保持不变。供应商到货问题明确缺数据，工单需求乘法未伪称已提供自动派生计算。

销售样本第一次返回无法通过 ACL 的结构，旧候选未被覆盖。随后增加权威输出 Schema 指导并重新真实生成，结构有效；未捕获第一次原始错误字段，因此不声称已证明其唯一原因。人工区分制造产品和销售商品的概念标识后，验证并发布 4 类、11 对象、11 关系；连续同步两次，客户 2、订单 3、订单行 4、商品 2，保持不变。签收时间问题明确缺数据。

原生数据及人工处理后的来源保留在独立预览数据库。真实调用、人工修订、发布和重复同步记录在 `live-ai.log`、`sales-regenerate.log`、`business-publication.log`，快照在 `fixtures/*-generated*.json`、`fixtures/*-reviewed.json` 和 `fixtures/*-published.json`。另有一次真实 AI 语义审查成功，之后修改映射使该报告正确失效。

## 多级子类追加要求

用户追加要求已纳入 ADR-0083。候选 Class 新增父类和继承依据，页面展示多级层次并提供父类选择、继承属性与身份补齐；同标识类型冲突保留供校验阻断。重命名概念会同步映射、关系、继承和语义引用，已发布标识不能原地重命名。

三层真实 PostgreSQL 测试已验证设备 → 机床 → 数控机床，输入乱序也按父到子发布；父与中间层 0 直接实例，叶类 2 实例，原生父类查询返回这 2 条子孙实例。缺父类、自继承、环、身份/属性不兼容、无继承依据均被阻断。

真实供应商针对设备分类证据和数控机床工作簿，直接生成正确三层及唯一叶类映射，确定性校验 0 错误、2 实例；未对该输出人工改造层次。证据 `equipment-ai.log`、`fixtures/equipment-provider-response.json` 与 `fixtures/equipment-provider-validation.json`。

平台 ONT 异步来源 `f968c3a5-1b52-455c-b35d-17c871ec6563` 首次真实调用明确失败，重试成功后保留三层及唯一叶类映射，业务上下文/五个问题完整，所有确认默认关闭。人工审核该固定样本后未改层次或映射，完成验证、原生发布及两次同步；设备、机床、数控机床每层原生查询均返回同两条叶实例。继承语义定义的待确认提示保留为警告，不伪称业务签字。证据 `equipment-ont-retry.log`、`equipment-publication.log`、`fixtures/equipment-published.json`。

## 仍需业务验收

工程样本的概念、粒度、继承证据和主键口径需要用户或业务人员确认。AI 证据和结构校验不能保证业务语义必然正确。尚未推送、合并主分支或部署生产；原有主环境继续保留。

### 2026-10-10：用户 25 表工作簿的 DeepSeek 生成故障

- 真实调用确认：当前默认配置为自定义 Provider 下的 `deepseek-flash`。旧请求返回 HTTP 200、`finish_reason=length`，completion_tokens=16000 且 reasoning_tokens=16000，正文长度为 0。此前仅通过模拟响应测试就归因于 Markdown 包裹并宣称已修复，证据不足。
- 修复：按实际模型名兼容自定义 Provider；对 `deepseek-flash` / `deepseek-pro` 关闭默认 thinking 并设置 32768 输出预算；映射阶段仅传 mappings/notes 输出 Schema，避免重复生成整份本体。截断错误明确说明输出达到上限，仍拒绝不完整结果。
- 正式 API 对源 `ef1d844c-4899-48f1-a957-e92ecec44d7e` 重新生成成功，25 张工作表、13366 条记录得到 24 个候选类、23 个映射、23 个关系。候选已经保存，未进行人工确认或发布。
- 校验接口 HTTP 200；70 条 error 全部为「尚未审核」（24 类+23 映射+23 关系），另有 6 条 warning。POC 范围说明为说明文档、设备信息为空表，此候选未生成二者的数据映射。该结果证明真实生成链路恢复，并不代表业务语义已经通过人工验收。
- 最新 core/quality/AI/ACL 回归 153 passed；相关 Ruff 检查通过。诊断输入和结果仅保留在本地 `.cache/modeling-phase1/`，未记录密钥或推理正文。
### 2026-10-10：候选批量审核

- 对象、映射、关系、业务语义分别提供全部确认/取消确认及进度；对象详情支持逐个展开/收起与全部展开/收起。默认保留展开状态，折叠仅改变显示，不修改候选。
- 批量确认沿用单项编辑的保存、修订与失效机制；未跳过结构校验、业务确认或发布警告确认。未替用户确认其真实数据源。
- 单元测试 15 passed，前端类型检查通过。实际浏览器测试验证折叠、批量确认、撤销和重新确认，随后完成隔离测试样本的原生发布与重复同步，1 passed；本轮报告 `metaplatform-frontend/test-results/modeling.xml` 仅对应这 1 个实际运行用例，之前完整 4 用例通过记录为历史证据。

### 2026-10-10：以本体发布为完成标准的闭环调整

- 依据 [闭环实施计划](../superpowers/plans/2026-10-10-reverse-ontology-publication-loop.md)，四步主流程改为数据与建模范围、候选本体审核、本体校验与接入预览、本体发布与验收。完成页提供原生类型链接，重新打开已发布来源仍显示完成状态。
- `validation.scope=ontology` 只许可已审核且结构有效的本体；原始值缺失、映射未确认、转换或实例冲突归入嵌套 `dataValidation.scope=data/canSync`。同步前再次读取源记录执行完整校验，失败不写入实例。继承、身份定义引用、原生定义冲突、指纹及既有 WIP 保护继续生效。
- 数据问题显示分组次数，保留全部错误总数与有限样本；原生新建标识冲突一次返回全部候选，要求明确选择复用、扩展或修改不同概念的标识。没有自动填编号、合并概念或替用户发布。
- Core/quality/AI/ACL 与新增结构范围回归 **157 passed**（`.ci/modeling-core-ai-loop-final.xml`）；串行真实 PG 发布/同步集成 **19 passed，0 skipped**（`.ci/modeling-integration-loop-final.xml`）。Ruff、两份 OpenAPI YAML 解析及全部内部引用解析通过。
- 前端流程单测 **16 passed**，类型检查和生产构建通过。完整浏览器 **5 passed**（`metaplatform-frontend/test-results/modeling.xml`），新增用例使用缺失编号/补齐编号两份工作簿，实测本体发布成功、UI 禁止同步、服务端拒绝同步且实例数为零；补齐来源后显式复用原生类型，连续同步两次仍为两条实例。其余用例覆盖销售复合身份、三级继承/父查询、独立入口与 390px 页面。
- 最初并行运行集成和原生门禁共用回归库，出现跨进程 schema 锁死锁；原生门禁另出现 Windows TCP `10048` 连接错误。失败工件保留，随后改为串行执行，不修改生产代码掩盖测试环境问题。
- 最终串行六组原生 PostgreSQL 强制门禁 **123 passed，0 skipped**，逐条身份核对通过（`.ci/ont-postgres-loop-serial-final.xml`）。预检为 PostgreSQL 16、非超级用户、无 BYPASSRLS；预览 ONT/Copilot 均 healthy，原主环境未停止。
- 对用户真实来源 `2f657a33-e4ff-4943-8811-a368953bbe2e` 仅重新校验：26 个候选类、34 个关系，**8 个原生新建标识冲突，不能发布**；数据 **9,423 项错误、38 组问题，不能同步**。物料、产成品、BOM 行、仓库、生产工单、设备、机床、数控机床需人工决定复用/扩展或改名。MPS 明细 15 个空身份、库存 633 个空身份、MRP 8,746 个空身份等仅限制数据接入。未修改其确认、映射或定义，未发布。证据 `.cache/modeling-phase1/user-ontology-scope-validation.json`。
- 本轮为本地工程验收；AI 生成的业务语义仍需人工核实。主分支、原环境和真实用户本体保持原状态。

### 发布阻断提示补充

- 无待保存修改时按钮明确显示「已保存」；AI 审查标为可选，校验操作自动先保存修改。
- 发布方案禁用时，在按钮旁显示本体阻断原因和对象/关系名称，支持定位到对应候选编辑区域；不把数据同步错误当作本体发布阻断，不自动复用或发布。
- 流程单测 17 passed，类型检查通过。真实浏览器读取最新来源 `d09dfb41-ea94-4b3f-84d2-eab16d6a9b56` 修订 10，实测显示全部 4 项原生冲突并定位 BOM 行编辑区域；浏览器验证未写入来源。用户编辑期间来源从 5 项冲突变化到 9 项关系待审核，再到 4 项冲突，验证按实际读取快照核对，未将并发编辑造成的旧断言失败当作产品故障。


### 2026-10-10：逆向模型业务保证与原生验收

- 逆向候选新增业务粒度、身份状态/候选身份/替代唯一键、结构化来源证据，以及关系基数/目标选择/基数依据；来源证据引用不存在的工作表或字段会阻断校验。样本空值只影响数据同步，不自动否定业务身份。
- 复合身份关系必须覆盖完整目标身份或已确认替代唯一键；集合匹配不能声明 N:1/1:1；已确认基数会在编译关系边前检查实际度数。冲突错误显示对象粒度和来源表行，避免静默覆盖。
- AI 提案经过 provider 与 ACL 双层降级：业务身份、基数和唯一键不会被模型自动标记为已确认；AI 审查仍为可选，确定性校验和人工确认是发布门槛。
- 发布方案展示属性增量、身份/继承变化和关系基数；发布后保存只读原生验收报告，并提供重新核验接口检测原生漂移。新增复用比较接口不会自动选择、合并或修改已有类型。
- 本轮新增核心/AI/ACL 回归 **172 passed**；逆向 PostgreSQL 集成 **21 passed**；原生 PostgreSQL 强制门禁 **123 passed，0 skipped**；前端单测 **24 passed**、类型检查和生产构建通过；隔离浏览器闭环 **5 passed**。OpenAPI 两份 YAML 解析和内部引用检查通过。
- 对真实已发布来源 `d09dfb41-ea94-4b3f-84d2-eab16d6a9b56` 只读核验：修订 14，原生 26 个类型、33 个关系，验收 `passed`；核验前后来源快照一致，未修改真实本体。证据 `.ci/modeling-assurance-real-readonly.json`。


### 2026-10-10：AI 跨表生成诊断与原生样式预览图谱

- 用户来源 `84ce2287-335c-46e6-acc4-e9120c449ebc` 修订 3、25 张表，失败日志定位到 mapping 阶段的 ValueError。原日志不足以区分重复映射 ID 与越界引用；同画像旧流程只读重跑成功，不能将某一种原因冒充原失败的确证。
- 通过失败测试复现批次间相同技术映射 ID 导致整单拒绝，现仅对技术映射 ID 消歧，保留业务类/属性/关联引用。越界类、工作表、属性、字段提供一次批次修正重试；再次无效按白名单机器码失败并保留草稿。新增 ACL 白名单防止 provider 内容通过错误提示外泄。
- 修复后真实 provider 对同一画像生成 25 个类、32 个关系、25 个映射，通过严格 Draft Schema 和 ACL 去确认。确定性定义检查仍发现 1 项业务关联完整性问题，留供用户审核；不将生成成功当作业务本体正确。证据 `.ci/modeling-generation-live.json`，未修改用户来源。
- 预览步骤直接复用原生 `ModelGraphCanvas`：对象/属性/身份卡片、业务关系与基数、虚线子类继承、拖拽/缩放/适应画布和完整候选详情。数据源为本地候选，不读写原生类型；原生画布新选项缺省关闭，既有行为保持。
- 本轮核心/AI/ACL **179 passed**，前端 **26 passed**、类型检查和生产构建通过，原生 PostgreSQL 强制六组 **123 passed，0 skipped**。浏览器最初因预览 9350 和本地代理 8200 进程退出出现连接拒绝，失败报告保留 `.ci/modeling-generation-graph-browser-unavailable.xml`；仅恢复独立预览服务后完整 **5 passed**，实测预览卡片、关系基数、三级继承详情及发布重复同步。
- 用户失败来源仍修订 3、无草稿；已发布来源 `d09dfb41-ea94-4b3f-84d2-eab16d6a9b56` 仍修订 14、发布成功。只读保留证据 `.ci/modeling-generation-graph-real-preserved.json`。未替用户自动生成、确认或发布真实本体。


### 2026-10-10：模型连接失败误报 JSON 与真实接口复测

- 最新用户失败的服务日志为 `ConnectError/http_status=None/finish_reason=None`；原 complete 将 HTTP/连接/超时与 JSON 解码异常统一报成 JSON 无效。此次修正错误分类：连接、响应超时、服务商拒绝访问、限流、异常状态和格式错误分别使用静态白名单消息；不暴露服务商正文或凭证。
- 连接异常和 HTTP 429/502/503/504 每次请求最多 3 次，短暂退避；connect timeout 15 秒、read timeout 180 秒，响应读取超时不自动重复生成。真实 provider 分批复测观察到一次 ConnectError，重试后继续生成成功。
- 完整鉴权 HTTP 复测最初又发现 mapping_outside_group，严格拒绝保留；补充每批 Mapping Schema 的工作表及 classId 枚举、显式 allowedSheets、仅传递当前批次来源证据，修正重试带回有界前次映射。完整候选的来源证据不删除。
- 失败测试先证实连接/超时/401/429 被误报 JSON、短暂连接不重试、分批 Schema 未约束及来源证据串批。最终相关 **36 passed**、完整核心/AI/ACL **187 passed**，Ruff 通过。
- 已更新隔离 ONT/Copilot 服务。对最新失败来源 `6fd4463d-e277-4106-a00b-650077b02523` 修订 3，使用真实鉴权 HTTP `/api/v1/copilot/modeling/generate`、25 张表画像、已有原生类型和严格 Draft Schema：**HTTP 200，70.4 秒，26 类/28 关系/23 映射**，严格 Schema 校验通过。调用前后来源快照一致，未替用户确认或发布。证据 `.ci/modeling-provider-network-live.json`、`.ci/modeling-provider-network-tests.xml`、`.ci/modeling-provider-network-core.xml`。
