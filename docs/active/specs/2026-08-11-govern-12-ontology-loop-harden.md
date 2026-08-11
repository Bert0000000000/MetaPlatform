# GOVERN-12 — Ontology-loop 闭环硬化（实施计划）

> **编制日期**：2026-08-11  
> **来源**：`docs/active/delivery/evidence/GOVERN-11-ONTOLOGY-LOOP-ACCEPTANCE.md` §5（5 条架构 gap F1-F5）+ GOVERN-11-06 升级 DOM  
> **目标**：把 GOVERN-11 摸到的 6 个 follow-up（F1-F5 + DOM 升级）收口，让 ontology 业务闭环从"API 探针"升级到"真实业务链路"

## 0. 现状（盘点结论）

| ID | 主题 | 现状 | 修法路径 | 工作量 |
|---|---|---|---|---|
| 01 (F1) | copilot BearerAuth | `app.py:1217-1222` `match_employees` 漏传 `fallback_token`；keycloak realm 有真 secret，代码硬编 `stub` | `_get_client` 透传入站 Bearer；同 `list_ai_models` 模式 | < 10 行 |
| 02 (F2) | ont PG DDL bootstrap | `PgOntologyRepository.__init__` 不触发 DDL；`_ensure_schema` 在 pg_repo.py:497/518 重复定义；env `KERNEL_BACKEND=memory` 是默认 | `__init__` 末尾主动 `_ensure_schema()`；先 dedupe 重复定义 | ~30 行 + 1 pytest |
| 03 (F3) | A2A W3C `/messages` | mate-app-a2a 现有 `/tasks/{task_id}` 但无 W3C `Message` envelope；openapi.json 与服务 router 不一致（service 暴露更多） | 加 `POST /api/v1/a2a/messages` 接受 `{messageId,role,parts,contextId?,taskId?}` → 转 internal `DelegateTask`；扩 openapi | ~80 行 + 1 pytest |
| 04 (F4) | 前端 ontology 模型编辑器路由 | App.tsx 缺 `/ontology/object-types/{rid}` 等 ~4 个 ontology 路由 + 19 个 dashboard/admin 子目录 + 7 个 agents 别名 | App.tsx 加路由；`<Suspense fallback>` 包裹 lazy；OpenAPI 重建 | ~20 行 + ontology 子模块联调 |
| 05 (F5) | dw `POST /evaluations` | 集合级 POST 不存在（已有 per-employee POST）；in-memory `append_evaluation` 已实现 | app.py L326 后加 handler；扩 openapi | ~25 行 + 1 pytest |
| 06 | 4 spec 升级 DOM 级 | 当前 4 spec 都是 API 探针；DOM 演练需要 SuperAI A2A Modal + 模型编辑器 + 评估页 UI 全部就绪 | 等 03 + 04 + 05 落地后改 spec 用 page.click / page.fill | ~120 行 spec 改造 |

## 1. 依赖与切片

```
01 (10 行) ─── 独立
02 (30 行) ─── 独立
03 (80 行) ─── 独立，但 06 依赖
04 (20 行) ─── 独立
05 (25 行) ─── 独立
06 (120 行) ─ 依赖 03 + 04 + 05（DOM 链路需要端点 + UI 都 ready）
```

建议 **4 个 PR / 4 个 commit**：

1. **PR-1（P0 链路修复）**：01 + 02 并行（无依赖）
2. **PR-2（P1 接口完整性）**：03 + 04 + 05 并行（无依赖）
3. **PR-3（P2 DOM 升级）**：06（依赖 PR-1 + PR-2）
4. **PR-4（CI + 验收）**：更新 ontology-loop.yml + acceptance/GOVERN-12-ACCEPTANCE.md

## 2. PR-1 详情：P0 链路修复

### PR-1.1 — copilot BearerAuth 端到端修复（GOVERN-12-01）

**文件**：`mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py:1196-1222`

**改法**：
```python
# 现状（L1217-1222）
client = _get_client(request)
dw_list = await client.list_dw_employees(tenant_id, keyword, size=200)

# 改为
client = _get_client(request)
# 透传入站 Authorization，避免 keycloak client_credentials 不可用
fallback_token = (
    getattr(ctx, "authorization", None)
    or request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    or None
)
dw_list = await client.list_dw_employees(
    tenant_id, keyword, size=200, fallback_token=fallback_token
)
```

**验收**：
- 同源链路 consistency.spec.ts 的 `copilot match endpoint 形如 {items,total}` 升级为 `dwById.has(m.employeeId) === true`
- 1 个 pytest：`test_match_employees_fallback_token.py` 验证透传

### PR-1.2 — ont PG DDL bootstrap（GOVERN-12-02）

**文件**：`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`

**改法**：
1. **dedupe** L497-511 与 L518-532 两个 `_ensure_schema`
2. `PgOntologyRepository.__init__`（L416-429）末尾加：
   ```python
   try:
       self._ensure_schema()  # 自动 DDL bootstrap
   except Exception as exc:
       logger.warning("pg_schema_bootstrap_failed", error=str(exc))
   ```
3. 不改 `main.py` `on_startup`（保持契约自包含）

**验收**：
- docker compose up `KERNEL_BACKEND=pg` → `psql -c '\dt'` 见 9 张表
- `SELECT count(*) FROM ont_individual WHERE rid LIKE 'ont.tenant-default.ind.dw-%'` ≥ 7
- 1 个 pytest：`test_pg_repo_bootstrap.py` 验证 schema 自动建

## 3. PR-2 详情：P1 接口完整性

### PR-2.1 — A2A W3C `/messages`（GOVERN-12-03）

**文件**：`mate-platform-backend/packages/mate-app-a2a/src/mate_app_a2a/api/app.py` + `repositories/in_memory.py` + `sql_models.py`

**改法**：
```python
# 新增 Pydantic 模型（接受 W3C A2A Message envelope）
class A2APart(BaseModel):
    kind: Literal["text", "file", "data"]
    text: str | None = None
    data: dict | None = None

class A2AMessage(BaseModel):
    messageId: str
    role: Literal["user", "agent"]
    parts: list[A2APart]
    contextId: str | None = None
    taskId: str | None = None

@router.post("/messages")
async def send_message(
    msg: A2AMessage,
    request: Request,
    ctx: RequestContext = Depends(...),
) -> dict:
    """W3C A2A messages endpoint - 接受 envelope，内部转 DelegateTask。"""
    # ... 走 sql_store 或 in_memory store
    return {"task": task.to_dict()}  # W3C Task schema
```

**注意**：
- 现有 `/delegate` POST 不删，标 `deprecated` 头 + `X-Sunset: 2026-12-31`
- 扩 `docs/api/openapi.json` 与服务 router 同步（agent 报"service 暴露更多"）

**验收**：
- 1 个 pytest：`test_a2a_messages_envelope.py` 验证 W3C schema
- ontology-loop-a2a spec 升级：POST `/messages` → 拿 taskId → GET `/tasks/{id}` → 状态 completed

### PR-2.2 — 前端 ontology 模型编辑器路由（GOVERN-12-04）

**文件**：`metaplatform-frontend/apps/web/src/App.tsx:168-323`

**改法**：
```tsx
// 新增 ontology 子模块路由（用 React.lance + Suspense）
const ObjectTypeDetailPage = lazy(() => import('@/pages/ontology/object-types/ObjectTypeDetailPage'));
const ObjectTypeListPage = lazy(() => import('@/pages/ontology/object-types/ObjectTypeListPage'));
// ... 其他 ~4 个 ontology 路由

<Route path="/ontology/object-types" element={<Suspense fallback={<Loading />}><ObjectTypeListPage /></Suspense>} />
<Route path="/ontology/object-types/:rid" element={<Suspense fallback={<Loading />}><ObjectTypeDetailPage /></Suspense>} />
// ... 4 个 ontology 子路由
```

**重要**：dashboard/admin 子目录（~10 个）+ agents 别名（~7 个）属于 GOVERN-13 范围，本批只收 ontology（GOVERN-08 命中）。

**验收**：
- `pnpm --filter @mate/web exec tsc --noEmit` 0 错
- 浏览器访问 `/ontology/object-types/ont.tenant-default.obj.leave-request.v1` 不再 404
- 1 个 Playwright smoke：`tests/e2e/smoke/ontology-routing.spec.ts`

### PR-2.3 — dw `POST /evaluations`（GOVERN-12-05）

**文件**：`mate-platform-backend/packages/mate-tech-dw/src/mate_tech_dw/api/app.py:326`

**改法**：
```python
class EvaluationCreateRequest(BaseModel):
    employee_id: str
    score: float  # [0, 100]
    passed: bool
    qa_set_id: str | None = None
    comment: str | None = None

@router.post("/evaluations", status_code=201)
async def submit_evaluation(
    payload: EvaluationCreateRequest,
    request: Request,
    ctx: RequestContext = Depends(...),
) -> dict:
    """集合级 POST /evaluations（区别于 /employees/{id}/evaluations 的批量/迁移场景）。"""
    repo = _dw_repo(request)
    evaluation = DwEvaluation(
        id=f"dw-eval-{uuid4().hex[:8]}",
        employee_id=payload.employee_id,
        score=payload.score,
        passed=payload.passed,
        qa_set_id=payload.qa_set_id,
        comment=payload.comment,
        evaluated_at=datetime.utcnow(),
    )
    repo.append_evaluation(ctx.tenant_id, evaluation)
    _emit("dw.evaluation.submitted", {...})
    return {"data": _serialize_evaluation(evaluation)}
```

**验收**：
- POST 后 GET 见新行
- 1 个 pytest：`test_evaluations_post.py`
- ontology-loop-evaluation spec 升级：POST → GET 含新 evaluation

## 4. PR-3 详情：P2 DOM 升级（GOVERN-12-06）

**前置**：PR-1 + PR-2 全部合并 + 端到端链路 ready。

**4 个 spec 升级**：
- consistency.spec.ts：从 API 探针升级到 `/dw/employees` + `/superai/employee-match` 双页 DOM 字段一致性比对
- a2a.spec.ts：从 API 探针升级到 `/superai/a2a` Modal 打开 → 填 intent → 提交 → 看 taskId → 看结果
- evaluation.spec.ts：从 GET-only 升级到 `/dw/employees/{id}` → execute → `/evaluations` → 看到新行
- model-edit.spec.ts：从 API 探针升级到 `/ontology/object-types/{rid}` 编辑器 → 加 property → 立即看 dashboard 反映

**验收**：5/5 spec DOM 级；CI artifact 含 trace.zip + DOM snapshot。

## 5. PR-4 详情：CI + 验收收口

**文件**：
- `.github/workflows/ontology-loop.yml`：spec 列表加 `ontology-loop-*` 全部 4 个
- `docs/active/delivery/evidence/GOVERN-12-ONTOLOGY-LOOP-HARDEN-ACCEPTANCE.md`

**验收门槛**：
- 6 个 follow-up 全部 0 标记入 FOLLOW-UP-BOARD
- 4 spec 升级到 DOM 级（如果 PR-3 完成）
- ontology-loop CI 5/5 + 主仓 pytest 全绿

## 6. 节奏（4 周）

| 周 | PR | 切片 | 估时 |
|---|---|---|---|
| W1 | PR-1 | 01 + 02 P0 链路修复 | 1 d |
| W2 | PR-2.1 + PR-2.2 | A2A /messages + 前端 ontology 路由（并行） | 2 d |
| W3 | PR-2.3 + PR-4 | dw POST + CI 收口 | 1 d |
| W4 | PR-3 | 4 spec DOM 升级 | 3 d |

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| PG DDL bootstrap 失败阻断启动 | try/except 包裹，仅 warn 不 raise（dev 友好）|
| W3C Message 与现有 `/delegate` body 字段不兼容 | 新 endpoint 独立，不删旧（双轨 30 天 + Sunset 头）|
| 前端 ontology 页面 lazy 加载慢 | `<Suspense fallback>` + 路由 prefetch |
| DOM spec flake（前端改动快） | `--workers=1` + `trace: retain-on-failure` |
| PR-3 卡 PR-1/PR-2 不合并 | 拆 spec 升级独立成 follow-up，PR-3 不阻塞 |

## 8. 关联文档

- GOVERN-11 acceptance：`docs/active/delivery/evidence/GOVERN-11-ONTOLOGY-LOOP-ACCEPTANCE.md`
- 13 硬规则 §3 tenant guard：`docs/superpowers/specs/2026-07-30-backend-production-readiness-design.md:185`
- ADR-0021 kernel 12 primitives：`docs/active/decisions/ADR-0021-kernel-12-primitives.md`
- 计划输入：`cozy-orbiting-wombat.md` Part B Step 7

---

**启动 PR-1**：GOVERN-12-01（copilot BearerAuth）+ GOVERN-12-02（ont PG DDL bootstrap）