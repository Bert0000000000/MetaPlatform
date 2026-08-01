# G5 验收证据 — per-service `security:` 段补齐

> 验收日期：2026-08-01
> 范围：17 域 service contract 的 OpenAPI `securitySchemes` + per-operation `security`
> 结论：**Accepted (G5)**

## 1. 交付目标

为每个域 service.yaml 补齐 SEC-IAM-01 安全基线（ADR-0011），使「Swagger 没有接口
不写 route」硬规则（§13 第 1 条）在契约层闭环：每个域声明统一的
`bearerAuth + tenantHeader + oidcScopes` 三 scheme，且每个端点显式引用 security。

权威标准源：`mate-platform-backend/contracts/openapi/common/security.yaml`
（SEC-IAM-01 升级后的公共 securityScheme 层）。

## 2. 任务前提修正（重要）

接力任务的前提描述与仓库实际状态不符，本批按**实际状态 + 测试门禁**收口：

| 任务前提描述 | 仓库实际（扫描结论） |
|---|---|
| 10 域已合规 | **0 / 17 域** 含 `tenantHeader`；10 域只有 `bearerAuth`，7 域是 legacy `ApiKeyAuth`+`BearerAuth`+`bearerAuth` |
| 待补 7 域含 etl / metrics / scheduler | etl / metrics / scheduler **不是独立 service.yaml**，而是 `dw.yaml` 内的数据 schema（`ETLTask` / `SchedulerTask` / `Metric`） |
| oidcScopes = `openIdConnect` | 权威 `common/security.yaml` 定义为 `type: oauth2`（client_credentials）；本批沿用权威源 |
| oidcScopes openIdConnectUrl | 沿用 `common/security.yaml` 的 `flows.clientCredentials.tokenUrl` |

按测试门禁（17 域必须含 `bearerAuth` + `tenantHeader`），**全部 17 域统一补齐到
3-scheme 标准**。实际存在 legacy 混乱 scheme 的 7 域为：
a2a / apphub / arch / copilot / data / dw / wfe（清除了 `ApiKeyAuth`、
大写 `BearerAuth`）。

## 3. 改动清单（17 个 service.yaml）

路径前缀：`mate-platform-backend/contracts/openapi/services/`

每个文件：
1. `components.securitySchemes` 标准化为 `{bearerAuth, tenantHeader, oidcScopes}`
   （清除 legacy `ApiKeyAuth` / 大写 `BearerAuth`）。
2. 每个 HTTP operation 补 `security:` 引用
   （`bearerAuth: []` + `tenantHeader: []`，AND 语义）；已有 `security:` 的端点
   （如 iam 的 5 个 public 端点 `security: []`）保持不动。
3. 顶层 `security:` 块（`bearerAuth + tenantHeader + oidcScopes:[platform.read]`）
   已存在，保持不变。

| 文件 | 改前 schemes | ops 补 security |
|---|---|---:|
| a2a.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 2/2 |
| agent.yaml | bearerAuth | 6/6 |
| apphub.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 5/5 |
| arch.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 29/29 |
| copilot.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 35/35 |
| dashboard.yaml | bearerAuth | 34/34 |
| data.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 39/39 |
| dw.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 15/15 |
| iam.yaml | bearerAuth | 38 新增（5 个 public 端点保留 `security: []`） |
| kb.yaml | bearerAuth | 6/6 |
| llmgw.yaml | bearerAuth | 4/4 |
| mcp.yaml | bearerAuth | 5 新增（1 个已声明） |
| msg.yaml | bearerAuth | 3/3 |
| obs.yaml | bearerAuth | 9/9 |
| ont.yaml | bearerAuth | 13/13 |
| rag.yaml | bearerAuth | 8/8 |
| wfe.yaml | ApiKeyAuth / BearerAuth / bearerAuth | 2/2 |

合计 **259 个 operation**，全部声明 security。

## 4. 17 域合规矩阵（改后）

| 域 | bearerAuth | tenantHeader | oidcScopes | 顶层 security | per-op security |
|---|:-:|:-:|:-:|:-:|:-:|
| a2a | ✅ | ✅ | ✅ | ✅ | ✅ |
| agent | ✅ | ✅ | ✅ | ✅ | ✅ |
| apphub | ✅ | ✅ | ✅ | ✅ | ✅ |
| arch | ✅ | ✅ | ✅ | ✅ | ✅ |
| copilot | ✅ | ✅ | ✅ | ✅ | ✅ |
| dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| data | ✅ | ✅ | ✅ | ✅ | ✅ |
| dw | ✅ | ✅ | ✅ | ✅ | ✅ |
| iam | ✅ | ✅ | ✅ | ✅ | ✅ |
| kb | ✅ | ✅ | ✅ | ✅ | ✅ |
| llmgw | ✅ | ✅ | ✅ | ✅ | ✅ |
| mcp | ✅ | ✅ | ✅ | ✅ | ✅ |
| msg | ✅ | ✅ | ✅ | ✅ | ✅ |
| obs | ✅ | ✅ | ✅ | ✅ | ✅ |
| ont | ✅ | ✅ | ✅ | ✅ | ✅ |
| rag | ✅ | ✅ | ✅ | ✅ | ✅ |
| wfe | ✅ | ✅ | ✅ | ✅ | ✅ |

## 5. 测试

新增 `infra/tests/test_service_security_segments.py`（52 tests）：

- `test_security_schemes_declared[×17]` — 每域含 `bearerAuth` + `tenantHeader`。
- `test_security_schemes_well_formed[×17]` — bearerAuth=`http/bearer`、
  tenantHeader=`apiKey/header/X-Tenant-Id`。
- `test_contract_and_endpoints_declare_security[×17]` — 顶层 `security` 声明 +
  ≥1 端点显式 `security:` 引用。
- `test_all_seventeen_domains_covered` — 守卫 17 域集合不漂移。

```text
$ python -m pytest infra/tests/test_service_security_segments.py -q
52 passed in 3.02s

$ python -m pytest infra/tests -q
330 passed in 2.84s      # 278 既有 + 52 新增，无回归
```

## 6. 实现备注

- **byte-fidelity 编辑**：service.yaml 的 git blob 为 CRLF，且顶层 `security:` 块存在
  历史 `\r\r\n` 腐败。使用 `splitlines(keepends=True)` 逐行保留原始终止符，仅替换
  securitySchemes 块与插入 per-op security，未改行保持字节一致 → `git diff` 聚焦在
  security 内容（987 insertions / 56 deletions），非整文件重写。
- **iam public 端点**：iam.yaml 原有 5 个端点声明 `security: []`（登录 / 健康检查等
  公开端点），本批保留不动，仅对其余 38 个端点补 security。
- **oidcScopes 类型**：沿用 `common/security.yaml` 的 `type: oauth2`
  （`flows.clientCredentials`），与 SEC-IAM-01 公共层一致。

## 7. 关联

- ADR-0011（SEC-IAM-01 Keycloak 迁移）
- 13 硬规则 §13 第 1 条（Swagger 没有接口，不写 route）
- 权威标准源：`contracts/openapi/common/security.yaml`
- SEC-IAM-01-ACCEPTANCE.md 第 8 节「已知遗留 #2：各 service security 段待补」→ 本批收口

## 8. 结论

17 域 service contract 全部补齐 SEC-IAM-01 三 scheme 安全基线 + per-operation
security 引用，新增 52 tests 全绿，infra 回归 330 / 330 通过。判定 **Accepted (G5)**。
