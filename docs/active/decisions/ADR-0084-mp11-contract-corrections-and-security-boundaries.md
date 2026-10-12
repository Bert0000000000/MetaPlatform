# ADR-0084：1.1 契约纠错与权限边界

- 日期：2026-10-13（Asia/Shanghai）
- 状态：Proposed，供兼容门禁逐项复核；不代表新增豁免已获批准、业务验收、GA 或上线。
- 依据：[1.1 规格](../specs/2026-10-11-metaplatform-product-v1.1.md)、[1.1 实施计划](../../superpowers/plans/2026-10-11-metaplatform-product-v1.1-implementation.md)、ADR-0062、ADR-0080、ADR-0081、ADR-0082、ADR-0083。
- 审计清单：[oasdiff-mp11-diagnostics-review.yaml](../../../mate-platform-backend/contracts/openapi/oasdiff-mp11-diagnostics-review.yaml)。该文件是复核数据，不是 err-ignore 输入。

## 1. 固定比较与结论

比较旧 main `303d3ca69cbe0d4f817cf2f4ca3294c8c9f0b7e5` 与修复提交 `a2d0aa8695ebf2fd67aa8c6ddcf3e703a8a32c98` 的 canonical 生成 bundle。使用已核验官方校验和的 oasdiff 1.33.0，执行 `breaking --fail-on ERR --allow-external-refs=false -f json`，原始结果仍为 **exit 1：270 ERR、37 WARN**。本 ADR 不把这个结果改写为门禁通过。

其中 266 条 ERR、36 条 WARN 是旧合同与既有源码不符；4 条 ERR 对应本轮实际权限政策；1 条 WARN 是保持字段保证的 allOf 扁平化。清单逐条保存诊断 ID、HTTP 方法、原路径、operationId、fingerprint、精确文本和旧/新操作语义哈希，关联以下证据组。分类不是按诊断类别自动放行。

| 证据组 | ERR / WARN | 旧 main 源码已证明的行为 |
| --- | --- | --- |
| C-ERROR-ENVELOPE | 157 / 0 | 上游认证返回 error/detail，HTTPException 使用 detail；网关原样透传上游内容。旧 code/message/requestId 通用包裹不是这些响应的保证。 |
| C-APPHUB-RESPONSES | 28 / 8 | 列表返回 items/total，删除返回 deleted，创建/更新返回业务记录；这些列表从未消费 page/size。 |
| C-APPHUB-REQUESTS | 28 / 16 | 四个 create DTO 与旧 main 的 AST 相同；业务 code 是长度 1..64 的 string，旧 integer enum 0 是错误声明；name/category/关联编码等早已必需。 |
| C-DATA-RESPONSES / REQUESTS | 22 / 0 | 数据源返回真实分页或记录，SourceCreate/SourceUpdate 及 typed body 早已存在。 |
| C-RUNTIME-PUBLICATION | 12 / 4 | modules 已是对象，render_tree 已是数组；publish 返回发布回执且不消费 body；成功 ActionResult.error 已可为 null。 |
| C-SHORTLINK | 10 / 6 | 创建、列表、解析是不同形状；解析从未返回 code/tenant_id，role/expiry 早已可为 null，旧入口允许无时区 ISO expiry。 |
| C-PROPOSALS | 9 / 2 | 路径参数和 Idempotency-Key 已存在；批准主体早已不来自 JSON；不同执行 kind 的无关结果 RID 已为 null。 |
| E-MCP-COMPOSITION | 0 / 1 | 新 create 响应仍要求 id/name/prefix/createdAt/enabled/key，并始终返回 scopes；没有丢失旧字段保证。 |
| S-MCP-HUMAN / S-DATA-READ | 4 / 0 | 只涉及下文列出的四条精确安全诊断。 |

证据组记录 `git show 303d3ca6:<path>` 与新提交对应函数/DTO 的行号和 AST SHA-256。修改旧合同不意味着删除既有线上字段；依赖错误合同生成的 SDK 应重新生成，已经消费真实响应的客户端保持原格式。

## 2. 先修复可避免的兼容弱化

以下项已经修复，不进入候选豁免：

- `BackingDatasourceDeclaration.dsn_env/priority` 恢复 required；响应 `last_error/ts_column` 恢复非 null。请求 DTO 仍允许省略 legacy 默认字段，注册源与响应存储形状分别描述。
- 同步 POST 200 使用独立 `BackingSyncCompletedRun`，保留 `ok/sources/total_synced/total_failed/total_deleted` 必需保证。历史仍使用 `BackingSyncRun`，真实 running/interrupted 记录可以没有完成计数。
- `BackingSyncFailure.pk` 恢复必需键。source_read/source_changed 的未知行边界明确为 null，不能伪造主键；实现的 source_changed 分支同时补了 `pk=None`。
- `AppHubShortlink.created_at` 保留 date-time。独立 `AppHubShortlinkResolved` 保留解析器实际返回的四个必需键，role/expiry 可为 null。
- `AppHubRenderNode` 在真实 render_tree 数组元素内保留五个必需字段；`AppHubRuntimeResult.data` 保留 object。
- 18 条 Proposal 与 2 条 MCP 可空诊断来自 `type: [string, null]` 与等价 anyOf 的工具差异。最小双契约已复现，恢复原编码后 20 条噪音消失，可空语义不变。execute 的两个 RID 是旧合同确实漏声明 null，仍作为合同纠错登记。

ONT 保留全部旧 125 个 schema 名称、84 个路径；新增 completed shape 后共 126 schemas。Builder/WIP、原生 CAS、迁移、Modeling、`preparePublication`、`rejection_reasons.items` 与原有可空 CAS 语义均保留。

## 3. 本轮权限决策与迁移边界

### 3.1 MCP 管理与 Agent 调用

1.1 规格 §7、MP11-AGENT-02 要求工具可见性、可调用性和批准主体由后端校验。这项增量有限修订 ADR-0062 §2 中“与 JWT 一致、不强制 per-key scope”的旧范围说明：

- API Key 管理的 GET/POST `/api/v1/mcp/api-keys` 和 DELETE `/api/v1/mcp/api-keys/{kid}` 要求已认证 `AuthMethod.USER` 与真实 tenant。API_KEY、SERVICE、匿名及其他主体不能管理凭据。
- Bearer 和 tenant 的 AND 条件保留。这三个入口不虚构实现没有要求的 OIDC read/write 管理 scope；canonical 以 `x-mate-required-auth-method: USER` 明确额外主体限制。
- 签发时 requested grants 必须非空、属于支持的 `platform.read/platform.write/ont.read/ont.write`，且是已验证签发者 scopes 的子集。角色不能推导 scope；请求中的 tenant 不能改变绑定租户。
- 保留 ADR-0062 的密钥形态、散列存储、一次性明文返回、吊销和租户边界。本 ADR 不修改其历史文本或扩大凭据权限。

对应的三个 `api-security-removed` fingerprint 为 `203f928fc4be`、`b35ce11c67f9`、`89a888ed73af`。旧 main 的 `_api_key_tenant` 仅排除 API_KEY，并未执行旧合同所写的 OIDC scope；新实现增加了严格 USER 守门。工具把安全方案替换报告为 removed，不表示 Bearer/tenant 校验被撤销。

迁移时，管理员用人类 JWT 管理密钥，并在 JWT 与签发请求中选择真实能力。旧空 grants 密钥需要重新签发后才能调用所选外部工具；Agent 只返回 Proposal 深链，由人完成确认。不能通过给 Agent 管理员角色或信任 `__caller__`、`confirmed_by` 绕过后端。

### 3.2 读操作与人工写操作

数据源 POST `/api/v1/data/sources/{id}/test` 是连接/Schema 探测，使用实际 `platform.read`，不是因 POST 就赋予写能力。该唯一新增 scope 诊断 fingerprint 为 `03ed41635066`。实现通过 `_tid(require_read=True)` 校验；缺 scope 或只有 write 的请求在仓库/连接器操作前返回 403。

AppHub GET/HEAD/OPTIONS 和显式只读 POST（包括 proposal-context）要求 read，写路径要求 write。Native confirm/reject/execute 另要求 USER + write，actor 来自已验证身份；原有 Idempotency-Key 和批准期限继续执行。旧合同已经声明 scope 的入口可能没有新增 oasdiff 诊断，不能因此漏审实际权限变化。

迁移时为合法读用户提供真实 read grant，为需要写或批准的已认证人提供真实 write grant；write 不自动包含 read。保持普通只读用户的读操作成功，禁止通过降低权限守门修复失败测试。

## 4. 精确门禁方案，默认拒绝

新增清单所有条目当前为 `reviewDecision: pending`、`ignoreEnabled: false`。`policyCandidateFingerprints` 只有上述四项，不把 266 条合同纠错当成已批准的整体豁免。根任务逐组核对后再决定具体合同纠错与政策诊断的处置；真正意外破坏先修兼容实现或合同。

若复核后需要接入清单，必须满足全部条件：

1. 固定旧 main commit；校验旧/新完整 bundle 的语义 SHA-256，同时保留原文件 SHA-256 供追溯。
2. 重新计算关联实现函数的 AST 哈希和已展开本地 schema 引用的旧/新操作语义哈希。语义规范化仅移除 description/summary/title/example/examples/externalDocs 注释，保留 properties/schemas 等名称字典中的同名业务字段，规范化纯类型分支的等价 union。
3. 仅匹配复核通过的精确 method、原路径、ID、fingerprint、诊断全文以及这些固定哈希。不得按类别、路径前缀或全 changes 放行。
4. 任意新 ERR、文本/路径变化、源函数变化、schema/security 语义变化或基线漂移都使匹配失败并重新审计。文档分类不替代运行时回归。
5. 临时生成选定诊断输入并重跑 oasdiff；其他诊断仍应失败。ADR-0082 原八条文件保持独立和原样。本次未修改 workflow、旧 err-ignore 或启用新忽略输入。

| 固定快照 | SHA-256 |
| --- | --- |
| baseline bundle 文件 | `26279279db51c64888bb1bd519d2ccf681c54acdf8a522a9861e3b3d255d609a` |
| revision bundle 文件 | `65e3638da06334a680b65540755460526917c4dca558e6369dab1bfb8d2afa4d` |
| baseline 语义 | `e6dae4caadfff0a60ff56b3227c3a65b7a86ad71c7aa011b0f3b4a8b55fa4631` |
| revision 语义 | `13f56a35c64e1548140fce55f1f235760026d98265414cd3073f34a7d7e910ee` |

## 5. 本轮证据与尚未完成的边界

- `build_platform`、bundle + Redocly + Spectral、`validate_contracts.py`、`validate_traceability.py` 均 exit 0；契约测试 40/40。
- G5 两套件 1958 passed、0 failed，3 条原有公开 login `security=[]` 跳过项单独保留；不能拿这些结果替代真实数据库或浏览器门禁。
- Data/AppHub 新读 scope 回归 9 + 7 = 16/16；缺 scope/只有 write 均 403 且操作 spy 为零，合法 read 200。
- MCP 单文件最初的依赖路径收集错误已定位；补 child PYTHONPATH 后 17 passed、1 SQLite fixture 注册失败。根任务另行修复 `_fresh_store` 的 ORM 注册顺序，未完成的复跑不记为通过。

私有日志与固定快照保存在本轮独立 .tmp 目录，清单保留命令和计数，不包含 DSN、凭据或业务数据。新提交的主干/PR CI、全部真实 PG、浏览器、Tencent 部署和实际业务验收分别以新证据为准；本 ADR 不新增 Accepted 或 GA 状态。
