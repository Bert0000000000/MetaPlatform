# ADR-0080：草稿与版本机制（不可变快照 · 当前生效 · 冲突 · 回滚范围）

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0021（Kernel 12 基元之 `Version`）、PRD-36 / ONT-G8+G19（版本管理）、
  ADR-0074（模型写入原子性）、MP-DEDUP-01（`(tenant, slug)` 唯一）、
  ADR-0072（预检 fail-closed 与状态口径）
- **范围**：**补齐既有草稿 / 版本机制**，不新建发布平台、不新增表族、不新增端点

## 1. 背景

本体已有四个互不衔接的版本相关面，实测存在五类缺陷：

| 面 | 位置 | 原状 |
| --- | --- | --- |
| 草稿 | `ont_schema_wip` + `POST /object-types/wip/{rid}/apply` | — |
| 版本历史 | `ont_type_version` + `GET/POST /versions/{class_rid}` | **`list_versions` 恒返回 `[]`**（注释自陈"MVP 不在范围"） |
| 版本操作 | `branch` / `diff` / `rollback` | 只记 `parent_rid` 血缘，**不保存定义** |
| 前端 | `ReleasesPage`（`/ontology/governance/releases`） | 直接拿 `listObjectTypes()` 的**同族 rid 列表**冒充"版本" |

1. **草稿的显式确认被丢弃**：`apply_schema_wip` 里 `del confirm_name`，且 `save_schema_wip`
   存 payload 时 `exclude={"confirm_name"}` —— 破坏性草稿**永远发不出去**（409 循环），
   合法的确认在到达门禁前就被扔掉了。
2. **"历史"不是历史**：`ont_type_version` 只存 `(rid, parent_rid, note)`。覆盖发布
   （同 rid upsert 新定义）后，**旧定义无处可读**；`rollback` 也只能"回滚到同族另一个
   仍然存活的类型"，一旦旧版本 rid 不存在就无源可回。
3. **Diff 不可重现**：diff 两侧都读 live 行 —— 一方被覆盖后，同一对输入得到不同结果。
4. **并发编辑静默覆盖**：两人各存草稿、先后发布，后者覆盖前者，无任何提示。
5. **回滚范围未定义**：文档与 UI 都没有说清回滚是否动数据、是否补偿副作用。

## 2. 决策

### 2.1 四层概念口径（唯一权威来源）

| 概念 | 存储 | 是否占版本号 | 权威性 |
| --- | --- | --- | --- |
| **草稿** | `ont_schema_wip`（含 `base_checksum` 基线） | 否 | 个人未发布工作副本 |
| **已发布版本** | `ont_type_version` 的**不可变定义快照** | 是（`version_no`，家族内单调） | **唯一权威版本历史** |
| **当前生效定义** | `ont_object_type` 的 live 行 | 否（是"最新已发布版本"的镜像） | 权威"当前" |
| 版本血缘 | `ont_type_version.parent_rid` | — | 派生视图，非独立事实源 |

**家族（family）= `(tenant, slug)`**，与 rid 的版本后缀 `vN` 无关：`...deal.v1` 与
`...deal.v2` 属于同一家族，共享一份版本历史。`(tenant, slug)` 唯一约束
（`uq_ont_ot_tenant_slug`，仅约束 `archived = FALSE`）保证**生效集合里一个家族至多一个类型**。

**"当前生效版本"的判定**：家族中 `checksum` 与当前 live 定义一致的那一条快照。
两个指纹必须由**同一个函数**算出（`mate_kernel.ontology.identity.definition_checksum`，
读写在 `Version`/`pg_repo`/`api` 三处共用），否则比对失真。

### 2.2 版本 = 不可变定义快照 + 必要依赖

`ont_type_version` 扩列：`tenant_id` / `class_rid` / `slug` / `definition`(JSONB) /
`checksum` / `version_no` / `author` / `change_set` / **`dependencies`**(JSONB)。

- 凡经 `upsert_object_type` 的发布路径（直接 `POST /object-types`、草稿 apply、branch、
  rollback）都写一条**该定义自身**的快照，与类型行**同一事务**，失败一起回滚；
- 同 `checksum` 幂等复用，不制造噪声历史；`rid` 属于定义内容，因此同内容不同 rid 是两条版本；
- `dependencies` = 该定义引用的 property / interface / parent_class rid（排序去重），
  用途是**影响分析**（"退役 X 会影响哪些已发布版本"），不是存在性校验（属性可内嵌、不必单独注册）；
- 写路径为该版本的 `version rid = ont.<tenant>.ver.<slug>.v<version_no>`，`ON CONFLICT DO NOTHING`
  —— **已存在的版本行永不覆盖**；
- 读路径 `list_versions` 在 SQL 层过滤 ONT-VERSION-MECHANISM **之前的旧血缘行**
  （无 `class_rid`/`definition`），否则读历史整段 500。

### 2.3 草稿的确认必须抵达门禁；发布前做静态校验

- **确认透传**：`apply_schema_wip` 的 `confirm_name` 覆盖草稿 payload 后交给
  `_upsert_object_type_gated` —— 与 `POST /object-types` 同一门禁。**未确认仍然 409**（不放松）。
- **发布前静态校验**：新增 `_assert_publishable`（`validate_model`），两条发布路径都调用；
  模型错误 → **422 `invalid_model`**。补的是构造器管不到的：rid 形制、属性 slug 重复、属性 rid 形制。
- **发布前预检（只读）**：`POST /object-types/validate` 在静态校验之上返回 `destructive`
  （与当前生效定义的破坏性差异）与 `references{resolved,unresolved,dependencies}`。
  未解析引用**只报告不阻断** —— 仓库语义允许"先声明后注册"（`_assert_parent_acyclic`、
  `_validate_registered_interfaces` 同理），此处不改该宽松口径。

### 2.4 同族发布 = 新版本；异族 = 副本（supersede 语义）

`branch_object_type(rid → new_rid)`：

- **同族**（同 tenant+slug，如 `deal.v1 → deal.v2`）＝"发布新版本"：`upsert_object_type`
  在**同一事务**内先把旧 rid 置 `archived = TRUE` 再写新版 —— 否则唯一约束不允许两个同族
  类型同时生效，也不允许"发布 v2 却留着 v1 当当前生效"。旧版定义**不丢**：live 行按 rid
  仍可读（`get_object_type` 不过滤 archived），且其快照早已在版本历史里；
- **异族**（不同 slug，如 `deal → deal-ex`）＝独立副本，源类型不受影响。

不采用"放宽 slug 唯一约束"的替代方案：那会让 `slug → rid` 的解析产生歧义。

### 2.5 并发编辑：默认不静默覆盖

两条乐观并发路径，都由服务端判定，**不依赖客户端自觉**：

1. **草稿基线（默认开启）**：`save_schema_wip` 记录保存**当时**的 live `checksum`
   （类型尚不存在则为空串）。apply 时基线 ≠ 当前 live → **409 `E409_VERSION_CONFLICT`**，
   提示"重新打开并保存草稿后再发布"。客户端可用查询参数 `expected_checksum` 显式声明
   "我已看过新状态"来覆盖基线；
2. **显式声明**：`POST /versions/{class_rid}` 的 `VersionCreateDTO.expected_checksum`
   与 live 不一致 → 409（`VersionConflict` 在 repo 层抛出，API 层翻译）。

冲突一律 **409 + 明细 code**，草稿**不删除**（冲突后仍可修改重发）。

### 2.6 回滚范围：模型 / 数据 / 补偿三层分家

`rollback_object_type(rid, from_rid)` **只回滚模型定义（schema）**：

- **回滚**：`ont_object_type` 的属性集合、主键、format、parent 等定义内容；
- **不回滚**：实例数据（`ont_individual`）、关系实例（`ont_link_instance`）—— 删属性/改主键后
  存量数据保持原样（可能悬空，这属于数据迁移范畴，见 §5）；
- **不补偿**：已发生的 Action 副作用 / 外联写入；
- `from_rid` 可以是**同族旧版本类型 rid** 或 **`ont.<tenant>.ver.<slug>.vN` 版本快照 rid**
  （后者更稳：快照不可变）。回滚本身也是一次发布（写新快照），因此可再回滚回来。

## 3. 不做的

- 不新建发布平台 / 不引入新表族 / **不新增端点**：全部落在既有 `ont_type_version`、
  `ont_schema_wip` 与既有 5 个操作（apply / versions / branch / diff / rollback）上。
- 不做**数据迁移**与**补偿**（§2.6 明确不承诺）：本批只保证"不谎称数据已回滚"。
- 不改 `MP-DEDUP-01` 的 slug 唯一语义；不改"声明了但未注册的 Interface/parent 可先落库"的宽松口径。
- 不做版本审批流（Review/Approve）—— 属 `MP-ONTOLOGY-RELEASE-01` 后续增量。

## 4. 实施与验证

- **实现**
  - `mate-kernel/ontology/identity/version.py`：`Version` 增 `definition`/`checksum`/`version_no`/
    `dependencies`/`status`；新增唯一指纹函数 `definition_checksum`（经 `identity/__init__` 导出）；
  - `mate-tech-ont/v2_kernel/pg_repo.py`：`ont_type_version` 扩列 + `_family_of_rid` /
    `_dependencies_of` / `_row_to_version` / `_insert_version_snapshot`；`snapshot_version`
    落库（含 `expected_checksum` 冲突）、`get_version`、`list_versions`（真快照 + 过滤旧血缘）；
    `definition_checksum`、`resolve_references`；`upsert_object_type` 增 `supersede_rids`/`author`/`note`
    并写快照；`branch_object_type` 同族 supersede 语义；`_definition_for` + 按快照的
    `diff` / `rollback`；`save_schema_wip` 记 `base_checksum`；
  - `mate-tech-ont/v2_kernel/api.py`：`apply_schema_wip` 确认透传 + 冲突 409；`_assert_publishable`
    → 422；`VersionDTO`/`VersionCreateDTO`/`ObjectTypeResponse` 增字段；`ontValidateV2Model`
    → 发布前预检；rollback 接受 `ver` 快照 rid；branch 传发布者身份。
- **测试**：`tests/integration/test_ont_version_mechanism.py`（16 项，先红后绿）
  —— 草稿确认透传、快照与版本史、同族发布 supersede、Diff 可重现、并发冲突、
  过期草稿拒绝与显式覆盖、发布前预检、引用解析、回滚只回滚模型。
- **证据**：`docs/active/delivery/evidence/ONT-VERSION-MECHANISM-ACCEPTANCE.md`。

## 5. 已知边界

- **回滚不动数据，也不补偿副作用**（§2.6）。删属性/改主键后存量实例可能悬空 ——
  需要 `Migration Plan` 的能力明确不在本批，作为后续增量的输入条件。
- **未解析引用不阻断发布**（沿用"先声明后注册"），因此一次发布可能引用尚不存在的 Interface /
  parent；`resolve_references` 只如实报告。
- **同内容不同 rid 记为两条版本**（`rid` 属于定义内容）。因此"分叉后立刻改动"会在家族史里
  留下一条与源同形、仅 rid 不同的中间版本 —— 真实但略显冗余。
- **版本历史截至"已发布"**：草稿不占版本号，因此家族历史里看不到未发布草稿（草稿在
  `/ontology/governance/drafts`）。
- `ont_type_version` 中 ONT-VERSION-MECHANISM **之前**的旧血缘行保持原样、被读路径跳过；
  不做数据回填（它们不携带定义，回填无源）。
- 并发保护是**乐观**的：不做悲观锁；库不一致时以先提交者为准，后提交者收到 409。

## 6. 2026-10-09 兼容纠正：草稿丢弃路由

2026-09-23 的“不新增端点”是原版本机制实施批的范围。本补记纠正既有草稿丢弃操作的
规范入口与路由登记，不改变草稿、发布版本或正式对象的仓储语义。

- 草稿丢弃的规范入口为 `DELETE /api/v1/ont/v2/object-types/{rid}/wip`，保持
  `operationId: ontDiscardV2SchemaWip`。只删除该 RID 的 WIP，保留已发布的 ObjectType。
- 原 `DELETE /api/v1/ont/v2/object-types/wip/{rid}` 保留为兼容别名，与规范入口调用
  **同一 handler**，保留相同租户校验及响应。已有前端调用可继续使用原路径；不要求
  运行中的服务或预览立即切换入口。
- 两个草稿丢弃路由必须登记在通配 `DELETE /object-types/{rid:path}` 之前，否则旧入口
  会被解释为删除 `wip/<rid>` 类型，并错误地返回跨租户拒绝。
- 公开 OpenAPI 的 `paths` 只登记规范入口；兼容别名使用 `include_in_schema=False`，
  其方法、完整路径、废弃标记及 schema 可见性必须在规范操作的 description 与
  `x-mate-compatibility-aliases` 中明确登记。保留真实兼容功能与文档，不关闭或忽略
  `no-ambiguous-paths`。该规则只比较路径形状，无法利用 HTTP 方法及 RID 约束区分
  `wip/{rid}` 与 `{rid}/branch` 等接口。
- 回归必须通过真实 HTTP 路由验证：规范入口和旧别名都丢弃 WIP且保留正式定义、拒绝
  外租户请求；正式对象 DELETE 仍调用原行为。契约验证规范 operationId、兼容记录及
  生成物，traceability 的 operationId 与需求映射保持不变。

这项纠正的源码与契约测试是本地证据；运行服务的行为、远端 CI 和部署验收分别记录。

## 7. 2026-10-09 兼容纠正：属性输入与显示响应

属性请求与属性显示响应使用独立契约，避免请求的可选标题改变历史响应保证。

- 请求保留既有 `PropertyDTO` 的空标题能力。未提供 `title` 或显式提供空串，都按请求
  原值写入；不把显示回退写回 `Property.title`。请求 `format` 枚举完整覆盖内核既有的
  15 项 `PropertyFormat`，包括原七项以及地理、时序、媒体、struct、vector 格式；
  数组由已有 `array` 字段声明，不把 value-type 注册表里的 `type_id` 当作新 format。
- 属性显示响应保留 `title` 非空保证：唯一序列化入口 `_prop_to_dto` 使用原始非空
  `Property.title`，空标题则显示该属性的完整 RID。嵌套 struct 字段递归使用同一入口；
  ObjectType、LinkType、Interface、ActionType、类 inspect 不另设回退规则。
- 回退仅作用于响应 DTO 的显示标题，不修改原始 `Property.title`、持久化定义、
  `definition_checksum`、已发布不可变版本快照或迁移计划。响应中的 `checksum` 仍对应
  存储定义，不能从包含显示回退的 DTO 重新推导。无需修改或回填存量空标题。
- 响应 `format` 保持既有 DTO 的字符串语义，文档列明已实现格式；请求使用真实的有限
  枚举。保留原七种格式的读写兼容，不虚构后端未实现格式，也不放宽 oasdiff 忽略清单。
- 验证须覆盖全部 15 种请求格式、原七种格式往返、空标题与嵌套标题的实际 HTTP 响应，
  并核对原定义、校验和及版本快照不变。契约及两套 oasdiff 使用原门禁与原忽略清单。
