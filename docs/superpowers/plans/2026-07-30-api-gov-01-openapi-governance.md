# API-GOV-01 OpenAPI/Swagger 统一治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立唯一 OpenAPI 3.1 契约源、聚合 Swagger/Redoc/Prism、PRD 追踪和 CI 契约门禁，使所有当前及目标业务域都由 Swagger 契约先行治理。

**Architecture:** `mate-platform-backend/contracts/openapi/` 成为唯一可编辑契约源；服务契约通过 Redocly bundle 生成 `generated/bundled.yaml`。Python 验证器负责 Mate Platform 特有规则、PRD 追踪和 FastAPI runtime 路由对账，Node 工具负责 OpenAPI lint/bundle/mock。旧 `docs/swagger/specs` 与包内 `openapi/` 在迁移完成后删除，避免多真相源。

**Tech Stack:** OpenAPI 3.1、Redocly CLI、Spectral、Swagger UI 5、Redoc、Prism、Python 3.12、PyYAML、pytest、GitHub Actions、Docker Compose（仅 local/docs profile）。

---

## 一、文件结构与职责

### 新建

- `mate-platform-backend/contracts/package.json`：契约工具版本和统一命令。
- `mate-platform-backend/contracts/package-lock.json`：锁定 Node 工具依赖。
- `mate-platform-backend/contracts/redocly.yaml`：聚合入口及 Redocly lint。
- `mate-platform-backend/contracts/.spectral.yaml`：OpenAPI 通用规则。
- `mate-platform-backend/contracts/openapi/platform.yaml`：聚合根契约。
- `mate-platform-backend/contracts/openapi/common/*.yaml`：错误、分页、安全、Tracing、Tenancy 组件。
- `mate-platform-backend/contracts/openapi/services/*.yaml`：17 个领域契约。
- `mate-platform-backend/contracts/openapi/generated/.gitkeep`：生成目录标记；`bundled.yaml` 由命令生成且提交。
- `mate-platform-backend/contracts/openapi/manifest.yaml`：领域、Owner、可见性、source、runtime app 映射。
- `mate-platform-backend/contracts/scripts/validate_contracts.py`：平台规则验证器。
- `mate-platform-backend/contracts/scripts/validate_traceability.py`：PRD追踪验证器。
- `mate-platform-backend/contracts/scripts/runtime_openapi.py`：导出 FastAPI runtime schema。
- `mate-platform-backend/contracts/scripts/compare_runtime.py`：契约与 runtime operation 对账。
- `mate-platform-backend/contracts/tests/test_contract_rules.py`：规则验证器测试。
- `mate-platform-backend/contracts/tests/test_traceability.py`：追踪矩阵测试。
- `mate-platform-backend/contracts/tests/test_runtime_comparison.py`：runtime diff测试。
- `docs/active/delivery/REQUIREMENT-MATRIX.yaml`：需求—契约—实现—测试追踪。
- `docs/active/delivery/API-OWNERS.yaml`：领域Owner配置。
- `docs/swagger/redoc.html`：Redoc聚合页。
- `docs/swagger/README.md`：新治理方式说明，替换旧说明。
- `.github/workflows/openapi-ci.yml`：独立契约门禁。

### 修改

- `docs/swagger/index.html`：只加载生成的聚合契约，并提供领域过滤。
- `start-swagger.ps1`：先校验/bundle，再启动静态站点。
- `docker-compose.yml`：增加 `swagger-ui`、`redoc`、`prism` 的 local/docs profile。
- `CLAUDE.md`、`agent.md`：记录唯一契约源和接口开发顺序。
- `.gitignore`：忽略 runtime 临时导出，保留 bundled契约。

### 删除（仅在迁移对账成功后）

- `docs/swagger/specs/*.yaml`
- `mate-platform-backend/packages/*/openapi/*.yaml`
- `mate-platform-backend/services/*/openapi/*.yaml`
- 旧的手工生成脚本 `mate-platform-backend/scripts/gen_*_openapi.js`
- `mate-platform-backend/scripts/gen_iam_openapi.py`

不得删除 `docs/active/api/openapi.yaml`，先移动为 `docs/legacy/api/openapi-pre-api-gov-01.yaml`，保留历史审计证据但不再作为运行契约。

---

### Task 1: 建立契约工具工作区

**Files:**
- Create: `mate-platform-backend/contracts/package.json`
- Create: `mate-platform-backend/contracts/package-lock.json`
- Create: `mate-platform-backend/contracts/redocly.yaml`
- Create: `mate-platform-backend/contracts/.spectral.yaml`
- Test: `mate-platform-backend/contracts/tests/test_tooling_files.py`

- [ ] **Step 1: 编写失败的工具配置测试**

```python
from pathlib import Path
import json
import yaml

ROOT = Path(__file__).parents[1]


def test_contract_tool_versions_are_pinned() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert package["devDependencies"] == {
        "@redocly/cli": "1.27.2",
        "@stoplight/prism-cli": "5.12.0",
        "@stoplight/spectral-cli": "6.14.2",
    }


def test_redocly_has_single_platform_entry() -> None:
    config = yaml.safe_load((ROOT / "redocly.yaml").read_text(encoding="utf-8"))
    assert config["apis"]["platform@v1"]["root"] == "openapi/platform.yaml"
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_tooling_files.py -q`

Expected: FAIL，提示 `contracts/package.json` 不存在。

- [ ] **Step 3: 创建固定版本工具配置**

`package.json`：

```json
{
  "name": "@mate/openapi-contracts",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "lint:redocly": "redocly lint platform@v1 --config redocly.yaml --max-problems 0",
    "lint:spectral": "spectral lint openapi/platform.yaml openapi/services/*.yaml -r .spectral.yaml",
    "bundle": "redocly bundle platform@v1 --config redocly.yaml --output openapi/generated/bundled.yaml",
    "mock": "prism mock openapi/generated/bundled.yaml --host 0.0.0.0 --port 4010",
    "check": "npm run lint:redocly && npm run lint:spectral && npm run bundle"
  },
  "devDependencies": {
    "@redocly/cli": "1.27.2",
    "@stoplight/prism-cli": "5.12.0",
    "@stoplight/spectral-cli": "6.14.2"
  }
}
```

`redocly.yaml`：

```yaml
apis:
  platform@v1:
    root: openapi/platform.yaml
extends:
  - recommended
rules:
  no-unused-components: error
  operation-operationId: error
  operation-summary: error
  security-defined: error
  no-ambiguous-paths: error
```

`.spectral.yaml`：

```yaml
extends: [spectral:oas]
rules:
  operation-operationId: error
  operation-description: warn
  operation-tags: error
  path-params: error
  oas3-api-servers: error
```

- [ ] **Step 4: 安装并锁定依赖**

Run: `cd mate-platform-backend/contracts && npm install --package-lock-only`

Expected: 生成 `package-lock.json`，其中 lockfileVersion 为 3。

- [ ] **Step 5: 运行测试**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_tooling_files.py -q`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add mate-platform-backend/contracts/package.json mate-platform-backend/contracts/package-lock.json mate-platform-backend/contracts/redocly.yaml mate-platform-backend/contracts/.spectral.yaml mate-platform-backend/contracts/tests/test_tooling_files.py
git commit -m "build(openapi): establish contract tooling workspace"
```

---

### Task 2: 建立公共 OpenAPI 组件

**Files:**
- Create: `mate-platform-backend/contracts/openapi/common/errors.yaml`
- Create: `mate-platform-backend/contracts/openapi/common/pagination.yaml`
- Create: `mate-platform-backend/contracts/openapi/common/security.yaml`
- Create: `mate-platform-backend/contracts/openapi/common/tracing.yaml`
- Create: `mate-platform-backend/contracts/openapi/common/tenancy.yaml`
- Test: `mate-platform-backend/contracts/tests/test_common_components.py`

- [ ] **Step 1: 编写公共组件失败测试**

```python
from pathlib import Path
import yaml

COMMON = Path(__file__).parents[1] / "openapi" / "common"


def load(name: str) -> dict:
    return yaml.safe_load((COMMON / name).read_text(encoding="utf-8"))


def test_error_contract_is_complete() -> None:
    schema = load("errors.yaml")["components"]["schemas"]["ErrorResponse"]
    assert set(schema["required"]) == {"code", "message", "requestId"}
    assert schema["properties"]["details"]["type"] == "object"


def test_security_defines_keycloak_bearer() -> None:
    scheme = load("security.yaml")["components"]["securitySchemes"]["bearerAuth"]
    assert scheme == {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}


def test_tenant_header_is_response_only() -> None:
    params = load("tenancy.yaml")["components"]["headers"]
    assert "TenantId" in params
    assert "parameters" not in load("tenancy.yaml").get("components", {})
```

- [ ] **Step 2: 确认测试失败**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_common_components.py -q`

Expected: FAIL，公共组件文件不存在。

- [ ] **Step 3: 创建公共组件**

`errors.yaml` 必须定义 `ErrorResponse`、`ValidationIssue` 及标准 400/401/403/404/409/422/429/500/502/503/504 responses；`pagination.yaml` 定义 `PageMeta`、`CursorMeta`；`security.yaml` 定义 `bearerAuth`；`tracing.yaml` 定义 `XRequestId` 和 `Traceparent`；`tenancy.yaml` 只定义响应 Header `TenantId`，不得定义客户端可提交的可信租户参数。

核心 `ErrorResponse`：

```yaml
components:
  schemas:
    ErrorResponse:
      type: object
      additionalProperties: false
      required: [code, message, requestId]
      properties:
        code: {type: string, pattern: '^E[0-9]{3}_[A-Z0-9_]+$'}
        message: {type: string, minLength: 1}
        requestId: {type: string, minLength: 1}
        details: {type: object, additionalProperties: true}
```

- [ ] **Step 4: 运行测试和 Spectral**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_common_components.py -q`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add mate-platform-backend/contracts/openapi/common mate-platform-backend/contracts/tests/test_common_components.py
git commit -m "contract: add shared OpenAPI components"
```

---

### Task 3: 建立领域 Manifest 与 Owner 治理

**Files:**
- Create: `mate-platform-backend/contracts/openapi/manifest.yaml`
- Create: `docs/active/delivery/API-OWNERS.yaml`
- Create: `mate-platform-backend/contracts/scripts/validate_contracts.py`
- Test: `mate-platform-backend/contracts/tests/test_contract_rules.py`

- [ ] **Step 1: 编写失败测试**

测试必须断言 17 个领域完整且 Owner不为空：

```python
EXPECTED = {
    "iam", "dashboard", "msg", "obs", "mcp", "llmgw", "ont", "rag", "agent",
    "data", "kb", "copilot", "dw", "apphub", "arch", "wfe", "a2a",
}


def test_manifest_contains_every_approved_domain(manifest: dict) -> None:
    assert set(manifest["domains"]) == EXPECTED
    for domain, item in manifest["domains"].items():
        assert item["contract"] == f"services/{domain}.yaml"
        assert item["owner"]
        assert item["visibility"] in {"external", "internal"}
```

- [ ] **Step 2: 确认失败**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_contract_rules.py -q`

Expected: FAIL，Manifest不存在。

- [ ] **Step 3: 创建 Manifest**

每个领域包含 `contract`、`owner`、`visibility`、`runtimeModule`。尚无运行模块的领域将 `runtimeModule: null`，不能伪造实现状态。示例：

```yaml
version: 1
domains:
  iam:
    contract: services/iam.yaml
    owner: security-iam
    visibility: external
    runtimeModule: mate_tech_iam.main:app
  data:
    contract: services/data.yaml
    owner: data-platform
    visibility: external
    runtimeModule: null
```

- [ ] **Step 4: 实现平台验证器**

`validate_contracts.py` 必须检查：OpenAPI 3.1、`/api/v1/` path、唯一 operationId、operation tags/summary、`x-mate-owner`、`x-mate-permission`、标准错误引用、无客户端 tenant Header、Manifest文件存在。

CLI：

```python
if __name__ == "__main__":
    errors = validate_all(Path(__file__).parents[1] / "openapi")
    for error in errors:
        print(error)
    raise SystemExit(1 if errors else 0)
```

- [ ] **Step 5: 运行测试**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_contract_rules.py -q`

Expected: PASS Manifest测试；服务契约尚未建立的验证用例使用临时目录fixture。

- [ ] **Step 6: 提交**

```bash
git add mate-platform-backend/contracts/openapi/manifest.yaml docs/active/delivery/API-OWNERS.yaml mate-platform-backend/contracts/scripts/validate_contracts.py mate-platform-backend/contracts/tests/test_contract_rules.py
git commit -m "feat(openapi): enforce domain ownership and contract rules"
```

---

### Task 4: 迁移现有 11 个服务契约到唯一契约源

**Files:**
- Create: `mate-platform-backend/contracts/openapi/services/{iam,dashboard,msg,obs,mcp,llmgw,ont,rag,agent,kb}.yaml`
- Create: `mate-platform-backend/contracts/openapi/services/platform-edge.yaml`（仅内部组合 gateway/auth，最终不进入业务域计数）
- Create: `mate-platform-backend/contracts/scripts/migrate_existing_contracts.py`
- Test: `mate-platform-backend/contracts/tests/test_existing_contract_migration.py`

- [ ] **Step 1: 编写迁移守恒测试**

测试读取旧11份契约，归一化 path/method后，断言每个旧 operation都出现在新契约或 `migration_exclusions.yaml` 中。排除项必须提供 `reason`，且仅允许 health/readiness/gateway catch-all。

- [ ] **Step 2: 确认测试失败**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_existing_contract_migration.py -q`

Expected: FAIL，新服务契约不存在。

- [ ] **Step 3: 实现一次性迁移脚本**

映射：

```python
SOURCE_MAP = {
    "iam": "packages/mate-tech-iam/openapi/iam.yaml",
    "msg": "packages/mate-tech-msg/openapi/msg.yaml",
    "obs": "packages/mate-tech-obs/openapi/obs.yaml",
    "mcp": "packages/mate-tech-mcp/openapi/mcp.yaml",
    "llmgw": "packages/mate-tech-llmgw/openapi/llmgw.yaml",
    "ont": "packages/mate-tech-ont/openapi/ont.yaml",
    "rag": "packages/mate-tech-rag/openapi/rag.yaml",
    "agent": "packages/mate-tech-agent/openapi/agent.yaml",
    "kb": "packages/mate-app-kb/openapi/app-kb.yaml",
}
```

IAM中的 `/api/v1/dashboard/*` 必须拆入 `dashboard.yaml`。Auth/gateway放入 `platform-edge.yaml`，不把本地HS256描述带入目标IAM契约。

- [ ] **Step 4: 为每个 operation补齐稳定 operationId 和治理扩展**

命名格式为 lowerCamelCase，例如 `createKnowledgeBase`、`searchKnowledgeBaseDocuments`。每项增加：

```yaml
x-mate-owner: knowledge-platform
x-mate-permission: kb.document.search
x-mate-requirements: [FR-KB-SEARCH-001]
```

当前 mock/placeholder operation加入：

```yaml
x-mate-implementation-status: placeholder
```

不得写 `implemented`。

- [ ] **Step 5: 运行守恒与规则测试**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_existing_contract_migration.py contracts/tests/test_contract_rules.py -q`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add mate-platform-backend/contracts/openapi/services mate-platform-backend/contracts/scripts/migrate_existing_contracts.py mate-platform-backend/contracts/tests/test_existing_contract_migration.py
git commit -m "contract: migrate existing service APIs to canonical source"
```

---

### Task 5: 从顶层PRD契约建立7个缺失领域契约

**Files:**
- Create: `mate-platform-backend/contracts/openapi/services/{data,copilot,dw,apphub,arch,wfe,a2a}.yaml`
- Create: `mate-platform-backend/contracts/openapi/migration_exclusions.yaml`
- Test: `mate-platform-backend/contracts/tests/test_prd_domain_coverage.py`

- [ ] **Step 1: 编写失败的PRD域覆盖测试**

测试从 `docs/active/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` 提取 `/v1/{domain}`，归一化为 `/api/v1/{domain}`，断言每个顶层域在目标契约中存在；同时断言所有新领域operation均为 `planned`，因为运行代码尚不存在。

- [ ] **Step 2: 确认失败**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_prd_domain_coverage.py -q`

Expected: FAIL，缺少7个领域文件。

- [ ] **Step 3: 创建缺失领域契约**

以 `docs/active/api/openapi.yaml` 和顶层 API Contract为输入，修正为 OpenAPI 3.1和 `/api/v1`。每个operation必须带：

```yaml
x-mate-implementation-status: planned
x-mate-requirements: [对应FR编号]
x-mate-owner: 对应Owner
x-mate-permission: 对应权限码
```

不得生成空 path、固定成功响应或伪造 handler。

- [ ] **Step 4: 明确别名决策**

- `/superai/*` 不作为新主路径，归入Copilot迁移排除清单。
- `/etl/*`、`/scheduler/*`、数据指标 `/metrics/*` 归入 `data.yaml`，保留其外部path。
- `/ea/*` 与 `/arch/*` 统一由 `arch.yaml` 管理；新接口使用 `/api/v1/arch`，历史 `/ea` 记录为breaking removal。
- `/app-kb/*` 目标外部路径统一 `/api/v1/kb/*`。

- [ ] **Step 5: 运行测试与平台验证器**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_prd_domain_coverage.py contracts/tests/test_contract_rules.py -q`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add mate-platform-backend/contracts/openapi/services mate-platform-backend/contracts/openapi/migration_exclusions.yaml mate-platform-backend/contracts/tests/test_prd_domain_coverage.py
git commit -m "contract: define planned APIs for missing PRD domains"
```

---

### Task 6: 创建聚合契约和可重复Bundle

**Files:**
- Create: `mate-platform-backend/contracts/openapi/platform.yaml`
- Create: `mate-platform-backend/contracts/openapi/generated/.gitkeep`
- Create/Generated: `mate-platform-backend/contracts/openapi/generated/bundled.yaml`
- Test: `mate-platform-backend/contracts/tests/test_bundle.py`

- [ ] **Step 1: 编写失败Bundle测试**

```python
def test_bundle_is_openapi_31(bundle: dict) -> None:
    assert bundle["openapi"].startswith("3.1.")
    assert len(bundle["paths"]) > 0


def test_bundle_operation_ids_are_unique(bundle: dict) -> None:
    ids = [op["operationId"] for path in bundle["paths"].values()
           for method, op in path.items() if method in HTTP_METHODS]
    assert len(ids) == len(set(ids))
```

- [ ] **Step 2: 创建聚合根**

`platform.yaml` 通过 path item `$ref` 组合17个领域文件，并引用 common components；不复制schema内容。

- [ ] **Step 3: 安装工具并生成Bundle**

Run: `cd mate-platform-backend/contracts && npm ci && npm run bundle`

Expected: `openapi/generated/bundled.yaml` 生成成功。

- [ ] **Step 4: 运行全部契约测试与lint**

```bash
cd mate-platform-backend/contracts
npm run lint:redocly
npm run lint:spectral
cd ..
.venv/Scripts/python.exe -m pytest contracts/tests/test_bundle.py -q
```

Expected: 全部PASS，lint零error。

- [ ] **Step 5: 提交**

```bash
git add mate-platform-backend/contracts/openapi/platform.yaml mate-platform-backend/contracts/openapi/generated mate-platform-backend/contracts/tests/test_bundle.py
git commit -m "contract: bundle canonical Mate Platform OpenAPI"
```

---

### Task 7: 建立PRD—契约追踪矩阵

**Files:**
- Create: `docs/active/delivery/REQUIREMENT-MATRIX.yaml`
- Create: `mate-platform-backend/contracts/scripts/validate_traceability.py`
- Test: `mate-platform-backend/contracts/tests/test_traceability.py`

- [ ] **Step 1: 编写失败测试**

测试断言每个operationId至少关联一个Requirement；状态为implemented时必须有非空handler和至少一个contract test；planned/placeholder时handler必须为null且不能标记accepted。

- [ ] **Step 2: 创建矩阵格式**

```yaml
version: 1
requirements:
  FR-KB-SEARCH-001:
    prd: docs/active/prd/APP-KB/PRD-APP-KB-知识库_v1.2-20260727.md
    service: mate-app-kb
    operationIds: [searchKnowledgeBaseDocuments]
    handler: null
    tests: []
    implementationStatus: placeholder
    acceptanceStatus: notAccepted
```

- [ ] **Step 3: 实现追踪验证CLI**

验证器双向检查：矩阵operation存在于bundle；bundle中所有非meta operation存在于矩阵；路径引用的PRD文件存在；状态组合合法。

- [ ] **Step 4: 运行测试和CLI**

```bash
cd mate-platform-backend
.venv/Scripts/python.exe -m pytest contracts/tests/test_traceability.py -q
.venv/Scripts/python.exe contracts/scripts/validate_traceability.py
```

Expected: PASS和exit 0。

- [ ] **Step 5: 提交**

```bash
git add docs/active/delivery/REQUIREMENT-MATRIX.yaml mate-platform-backend/contracts/scripts/validate_traceability.py mate-platform-backend/contracts/tests/test_traceability.py
git commit -m "docs(api): add PRD to OpenAPI traceability matrix"
```

---

### Task 8: 建立FastAPI Runtime对账

**Files:**
- Create: `mate-platform-backend/contracts/scripts/runtime_openapi.py`
- Create: `mate-platform-backend/contracts/scripts/compare_runtime.py`
- Create: `mate-platform-backend/contracts/runtime/.gitkeep`
- Test: `mate-platform-backend/contracts/tests/test_runtime_comparison.py`
- Modify: `.gitignore`

- [ ] **Step 1: 编写比较器失败测试**

构造一个contract含GET `/api/v1/example/items`，runtime为空，断言报告 `missingInRuntime`；反向增加POST，断言 `undocumentedRuntimeOperation`。

- [ ] **Step 2: 实现Runtime导出器**

根据Manifest中非null的 `runtimeModule` 动态导入app并写入 `contracts/runtime/{domain}.json`。导入失败必须报告error并exit 1，不能静默跳过。

- [ ] **Step 3: 实现比较器**

比较标准化的 `(method, path)`；health/ready/docs路径由固定allowlist处理。planned operation允许缺少runtime；implemented operation必须存在；runtime多出的业务operation一律失败。

- [ ] **Step 4: 运行测试和当前对账**

```bash
cd mate-platform-backend
.venv/Scripts/python.exe -m pytest contracts/tests/test_runtime_comparison.py -q
.venv/Scripts/python.exe contracts/scripts/runtime_openapi.py
.venv/Scripts/python.exe contracts/scripts/compare_runtime.py
```

Expected: 单测PASS；当前对账exit 0，因为未实现目标operation明确标记planned/placeholder，所有现存runtime route均已纳入契约或合法排除。

- [ ] **Step 5: 提交**

```bash
git add .gitignore mate-platform-backend/contracts/scripts/runtime_openapi.py mate-platform-backend/contracts/scripts/compare_runtime.py mate-platform-backend/contracts/runtime/.gitkeep mate-platform-backend/contracts/tests/test_runtime_comparison.py
git commit -m "test(openapi): enforce runtime contract parity"
```

---

### Task 9: 更新Swagger UI、Redoc和本地启动脚本

**Files:**
- Modify: `docs/swagger/index.html`
- Create: `docs/swagger/redoc.html`
- Modify: `docs/swagger/README.md`
- Modify: `start-swagger.ps1`
- Test: `mate-platform-backend/contracts/tests/test_docs_assets.py`

- [ ] **Step 1: 编写静态资源失败测试**

断言Swagger只加载 `/contracts/openapi/generated/bundled.yaml`，不再列出11个旧spec；Redoc加载同一bundle；启动脚本在启动HTTP server前调用 `npm run check`。

- [ ] **Step 2: 更新Swagger UI**

保留Swagger UI 5，URL改为：

```javascript
url: "/contracts/openapi/generated/bundled.yaml",
filter: true,
displayRequestDuration: true,
persistAuthorization: true
```

页面增加Swagger/Redoc切换，不再维护手工服务下拉列表。

- [ ] **Step 3: 创建Redoc页**

使用固定版本Redoc standalone，spec-url指向同一bundle。

- [ ] **Step 4: 更新PowerShell启动脚本**

脚本流程：定位workspace；进入contracts执行`npm ci`和`npm run check`；返回workspace根启动 `python -m http.server`；访问URL指向 `/docs/swagger/index.html`。

- [ ] **Step 5: 运行测试**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_docs_assets.py -q`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add docs/swagger/index.html docs/swagger/redoc.html docs/swagger/README.md start-swagger.ps1 mate-platform-backend/contracts/tests/test_docs_assets.py
git commit -m "docs(api): serve bundled Swagger and Redoc"
```

---

### Task 10: 增加Prism与文档Compose Profile

**Files:**
- Modify: `docker-compose.yml`
- Create: `mate-platform-backend/contracts/Dockerfile.docs`
- Test: `mate-platform-backend/contracts/tests/test_docs_compose.py`

- [ ] **Step 1: 编写Compose失败测试**

测试解析Compose并断言 `swagger-ui`、`redoc`、`prism` 都只在 `docs`/`local` profile；Prism挂载canonical contracts并使用bundled.yaml；生产默认profile不会启动Editor/Prism。

- [ ] **Step 2: 创建只读文档镜像**

Dockerfile多阶段先`npm ci && npm run check`，再用nginx托管workspace内Swagger/Redoc和bundle。镜像不得包含Prism进程。

- [ ] **Step 3: 修改Compose**

- `swagger-ui`：端口8200，只读文档镜像。
- `redoc`：可复用同一镜像路径 `/docs/swagger/redoc.html`，不重复构建。
- `prism`：端口4010，命令 `prism mock ... --host 0.0.0.0`，profile仅`local`和`docs`。

- [ ] **Step 4: 验证Compose**

```bash
docker compose --profile docs config --quiet
cd mate-platform-backend
.venv/Scripts/python.exe -m pytest contracts/tests/test_docs_compose.py -q
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add docker-compose.yml mate-platform-backend/contracts/Dockerfile.docs mate-platform-backend/contracts/tests/test_docs_compose.py
git commit -m "build(openapi): add local Swagger Redoc and Prism profile"
```

---

### Task 11: 接入OpenAPI独立CI门禁

**Files:**
- Create: `.github/workflows/openapi-ci.yml`
- Modify: `.github/workflows/python-ci.yml`
- Test: `mate-platform-backend/contracts/tests/test_openapi_ci.py`

- [ ] **Step 1: 编写CI结构失败测试**

断言workflow path filter包含contracts、PRD、Swagger和runtime API代码；步骤依次包含npm ci、Redocly、Spectral、bundle drift、平台验证、traceability、runtime comparison、contract pytest。

- [ ] **Step 2: 创建Workflow**

Jobs：

1. `lint-and-bundle`
2. `traceability`
3. `runtime-parity`
4. `breaking-change`

`bundle drift`执行bundle后运行 `git diff --exit-code -- openapi/generated/bundled.yaml`。Breaking change在PR中使用oasdiff Docker/action比较base与head bundle；首次引入时仅保存baseline，后续未批准breaking change必须失败。

- [ ] **Step 3: 修正python-ci路径和命令**

确保contracts改变会触发Python CI；修正当前 `pyright mate-platform-backend/` 在已`cd mate-platform-backend`上下文中的错误路径为 `uv run pyright`。本批不负责修复既有701个类型错误，但必须记录为已知阻断，不能设置continue-on-error。

- [ ] **Step 4: 运行Workflow结构测试**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_openapi_ci.py -q`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add .github/workflows/openapi-ci.yml .github/workflows/python-ci.yml mate-platform-backend/contracts/tests/test_openapi_ci.py
git commit -m "ci(openapi): enforce contract governance gates"
```

---

### Task 12: 删除多真相源并归档旧聚合契约

**Files:**
- Move: `docs/active/api/openapi.yaml` → `docs/legacy/api/openapi-pre-api-gov-01.yaml`
- Delete: `docs/swagger/specs/*.yaml`
- Delete: `mate-platform-backend/packages/*/openapi/*.yaml`
- Delete: `mate-platform-backend/services/*/openapi/*.yaml`
- Delete: `mate-platform-backend/scripts/gen_*_openapi.js`
- Delete: `mate-platform-backend/scripts/gen_iam_openapi.py`
- Modify: `CLAUDE.md`
- Modify: `agent.md`
- Modify: `mate-platform-backend/README.md`
- Test: `mate-platform-backend/contracts/tests/test_single_source.py`

- [ ] **Step 1: 编写单一真相源失败测试**

测试扫描仓库，允许的可编辑OpenAPI仅位于`contracts/openapi`；runtime JSON和legacy归档不算可编辑契约；旧生成脚本不得存在。

- [ ] **Step 2: 运行并确认失败**

Run: `cd mate-platform-backend && .venv/Scripts/python.exe -m pytest contracts/tests/test_single_source.py -q`

Expected: FAIL，列出旧契约副本。

- [ ] **Step 3: 在迁移守恒测试通过后删除/归档**

先运行Tasks 4–8全部测试，再执行移动和删除。不得在守恒测试失败时删除源文件。

- [ ] **Step 4: 更新架构文档入口**

文档明确：唯一源、接口顺序、生成物、Swagger URL、planned/placeholder/implemented语义和breaking change流程。

- [ ] **Step 5: 运行单一真相源与全套契约测试**

```bash
cd mate-platform-backend
.venv/Scripts/python.exe -m pytest contracts/tests -q
cd contracts
npm run check
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add -A docs/active/api docs/legacy/api docs/swagger/specs mate-platform-backend/packages mate-platform-backend/services mate-platform-backend/scripts CLAUDE.md agent.md mate-platform-backend/README.md mate-platform-backend/contracts/tests/test_single_source.py
git commit -m "refactor(openapi): remove duplicate contract sources"
```

---

### Task 13: API-GOV-01 最终验收

**Files:**
- Create: `docs/active/delivery/evidence/API-GOV-01-ACCEPTANCE.md`
- Modify: `docs/active/delivery/PROGRAM-BOARD.md`（不存在则创建）

- [ ] **Step 1: 执行完整验证**

```bash
cd mate-platform-backend/contracts
npm ci
npm run check
cd ..
.venv/Scripts/python.exe -m pytest contracts/tests -q
.venv/Scripts/python.exe contracts/scripts/validate_contracts.py
.venv/Scripts/python.exe contracts/scripts/validate_traceability.py
.venv/Scripts/python.exe contracts/scripts/runtime_openapi.py
.venv/Scripts/python.exe contracts/scripts/compare_runtime.py
cd ..
docker compose --profile docs config --quiet
```

Expected: 全部exit 0。

- [ ] **Step 2: 验证Swagger和Prism运行**

```powershell
docker compose --profile docs up -d --build swagger-ui prism
Invoke-WebRequest http://localhost:8200/docs/swagger/index.html -UseBasicParsing
Invoke-WebRequest http://localhost:8200/mate-platform-backend/contracts/openapi/generated/bundled.yaml -UseBasicParsing
Invoke-WebRequest http://localhost:4010/api/v1/iam/auth/login -Method Post -ContentType 'application/json' -Body '{"username":"demo","password":"invalid"}' -UseBasicParsing
```

Expected: Swagger和bundle返回200；Prism依据契约返回mock响应，不访问真实后端。

- [ ] **Step 3: 验证门禁能失败**

在临时测试fixture中加入一个无operationId路径，确认`validate_contracts.py`失败；加入未文档化runtime route fixture，确认`compare_runtime.py`失败。不得修改生产契约完成此验证。

- [ ] **Step 4: 编写验收证据**

记录命令、版本、结果、bundle path数量、operation数量、planned/placeholder/implemented数量、breaking removals、已知阻断和截图/URL。只有全部强制门禁通过时将PROGRAM-BOARD的API-GOV-01设为Accepted。

- [ ] **Step 5: 最终提交**

```bash
git add docs/active/delivery/evidence/API-GOV-01-ACCEPTANCE.md docs/active/delivery/PROGRAM-BOARD.md
git commit -m "docs(api): accept API-GOV-01 governance baseline"
```

---

## 二、计划自检清单

- [ ] 所有17个批准业务域都有契约文件和Owner。
- [ ] 旧11份服务契约逐operation守恒，不以文件复制代替语义迁移。
- [ ] planned/placeholder不被误报为implemented。
- [ ] Swagger、Redoc、Prism使用同一bundled.yaml。
- [ ] FastAPI runtime多出路由会失败，implemented缺路由会失败。
- [ ] PRD与operationId双向追踪。
- [ ] 生产不启用Editor或Prism。
- [ ] 旧多真相源只在所有守恒测试通过后删除。
- [ ] CI不使用continue-on-error绕过契约门禁。
- [ ] API-GOV-01不修改业务逻辑、不声称补齐缺失业务实现。
