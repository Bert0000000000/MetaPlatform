# AI 助手启动 Prompt 模板（K3-3 子批次 · 租户双轨清理）

> 版本：v1.0 · 2026-08-02
> 用途：K3 拆分第 3 份 — **K3-3 租户双轨清理**
> 前置：K3-1 SQL 持久化 + K3-2 OTel 已合并
> 接力父：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 后端工程师，正在执行 K3 子批次 **K3-3 租户双轨清理**。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
接力：K3-1 SQL + K3-2 OTel 已合并
目标：消除 _runtime_tenant_id 双轨制，统一 _tenant_id(request)，满足 §13 硬规则 3 + 5

## 背景

K1-B 阶段（53c5c71b）引入的 `_runtime_tenant_id` 函数保留 X-Tenant-Id HTTP 头回退逻辑，
导致 6 个 runtime / shortlink / publish 端点有"两条 tenant 解析路径"。
该路径在 prod profile 下可能被绕过中间件，违反 §13 第 3 条（tenant 守门）+ 第 5 条（production profile 禁止 fallback）。

K3-3 任务：删除 _runtime_tenant_id，6 端点统一走 _tenant_id(request)（与业务 CRUD 端点一致）。

## 必读文档

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md
   — K3 大剧本（仅 K3-3 阶段，约 80 行）
2. 现存 _runtime_tenant_id 实现：
   - src/mate_app_hub/api/app.py L128-147
3. 现存 _tenant_id(request) 实现（参考）：
   - src/mate_app_hub/api/app.py L91-101
4. docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md
   — _tenant_id 行为约束
5. 现存 6 个 K3 端点（runtime/shortlink/publish 共 6 个）：
   - L517 GET /apps/{app_id}/runtime
   - L534 POST /apps/{app_id}/runtime/execute
   - L557 POST /apps/{app_id}/publish
   - L581 GET /shortlinks/{code}
   - L592 POST /shortlinks
   - L611 GET /shortlinks

## 你的任务（3 项）

### 1. 删除 _runtime_tenant_id 函数

在 `src/mate_app_hub/api/app.py` 删除整个 `_runtime_tenant_id` 函数（L128-147）。

```python
# 删除如下整段
def _runtime_tenant_id(request: Request) -> str:
    ctx = getattr(request.state, "ctx", None)
    if ctx is not None:
        if ctx.tenant_id:
            return str(require_tenant(ctx))
    header_tenant = request.headers.get("X-Tenant-Id")
    ...
    raise HTTPException(status_code=400, detail="missing tenant context...")
```

注意：函数体里的 `require_tenant(ctx)` 已经被 `_tenant_id(request)` 调用，删除后不破坏现有逻辑。

### 2. 6 个端点切到 _tenant_id(request)

修改 6 个 endpoint 内的 tenant_id 解析：

| 端点 | 行号 | 改前 | 改后 |
|---|---|---|---|
| `GET /apps/{app_id}/runtime` | 517 | `tid = _runtime_tenant_id(request)` | `tid = _tenant_id(request)` |
| `POST /apps/{app_id}/runtime/execute` | 534 | 同上 | 同上 |
| `POST /apps/{app_id}/publish` | 557 | 同上 | 同上 |
| `GET /shortlinks/{code}` | 581 | 同上 | 同上 |
| `POST /shortlinks` | 592 | 同上 | 同上 |
| `GET /shortlinks` | 611 | 同上 | 同上 |

执行后 grep 验证：
```bash
grep -n "_runtime_tenant_id" packages/mate-app-hub/src/mate_app_hub/api/app.py
# 期望输出：0 命中
```

### 3. 5 个 negative tenant 测试

在 `tests/test_apphub_runtime_01.py` 追加 5 个测试用例：

```python
import pytest

def test_get_runtime_without_ctx_returns_401(client):
    """无 ctx 调 GET /apps/{app_id}/runtime → 401/403"""
    response = client.get("/api/v1/apphub/apps/app-1/runtime")
    assert response.status_code in (401, 403)

def test_post_runtime_execute_without_ctx_returns_401(client):
    response = client.post(
        "/api/v1/apphub/apps/app-1/runtime/execute",
        json={"action_type": "submit_form", "target": "form-1", "payload": {}}
    )
    assert response.status_code in (401, 403)

def test_post_publish_without_ctx_returns_401(client):
    response = client.post("/api/v1/apphub/apps/app-1/publish")
    assert response.status_code in (401, 403)

def test_get_shortlink_without_ctx_returns_401(client):
    response = client.get("/api/v1/apphub/shortlinks/ABC123")
    assert response.status_code in (401, 403)

def test_post_shortlink_without_ctx_returns_401(client):
    response = client.post(
        "/api/v1/apphub/shortlinks",
        json={"app_id": "app-1", "role": "viewer"}
    )
    assert response.status_code in (401, 403)
```

**前提**：仓内若有 `conftest.py` 提供 `client` fixture（fastapi TestClient），
且 `_tenant_id(request)` 在无 ctx 时走 `require_tenant` 抛 401/403。
若 conftest 没有 client fixture，参考该文件其他测试并复用。

要求：5 个测试必须 0 skip。

## 13 条硬规则（本子批次触发的）

- **§13 第 3 条**：没有 tenant 上下文，不访问 repository → 6 端点统一守门
- **§13 第 5 条**：production profile 禁止 fallback → 移除 X-Tenant-Id 头回退

## 启动方式

1. 切到 K3-3 接力 worktree：`git worktree add .worktrees/apphub-runtime-04c -b codex/apphub-runtime-04c main`
2. 跑基线：`cd mate-platform-backend/packages/mate-app-hub && pytest -q -m "not integration"`
3. 按 3 项顺序推进
4. 全部完成 commit 一次：`refactor(apphub): K3-3 租户双轨清理 删 _runtime_tenant_id + 6 端点统一 + 5 negative tests`
5. commit 前必跑：
   - `pytest -q` 0 failed
   - `ruff check packages/mate-app-hub/`
   - `python scripts/ci/forbid_skip_tests.py packages/mate-app-hub/`

## 已知陷阱

1. **delete function 后续未有引用**——删 _runtime_tenant_id 前先 grep 全文确认无遗漏
   ```bash
   grep -rn "_runtime_tenant_id" packages/mate-app-hub/
   ```
2. **client fixture 来源**——看 conftest.py 怎么造的；可能用 fastapi TestClient
3. **负测试的 status_code**——ADR-0011 升级后 `_tenant_id` 无 ctx 抛 401 / 403
   别写 400（K3 prompt 旧版误写 400，请严格按 401/403）
4. **保留 require_tenant 抛异常**——`_tenant_id` 内部应仍走 `require_tenant(ctx)`，
   不要直接把 X-Tenant-Id 头逻辑搬到 _tenant_id

## 验收清单

- [ ] src/mate_app_hub/api/app.py 全文 _runtime_tenant_id 0 命中
- [ ] 6 个端点全部用 _tenant_id(request)
- [ ] tests/test_apphub_runtime_01.py 追加 5 个 negative tests
- [ ] pytest -q 0 failed
- [ ] 1 个 Conventional Commit
```

## 关联文档

- K3 大剧本：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`
- K3-1 SQL：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04a.md`
- K3-2 OTel：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04b.md`
- 待续：K3-4 executor 真实化

## 元说明

- **本子批次解决**：K3-