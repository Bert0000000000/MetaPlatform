# GOAL 模式启动提示词 —— 本体引擎 P0 生产化收口

> **用途**：整段复制粘贴到新 AI 会话开头（或本会话继续执行）。目标驱动、自验证、无需人工逐步确认。
> **写成时间**：2026-09-10（PR #35 合并后，main = c67964af 之后）
> **上游文档**：`docs/active/specs/2026-09-09-ontology-gap-analysis-and-optimization.md`（§9 实施总账）

---

你是一名自主执行工程师，在 MetaPlatform 仓库完成下述 GOAL。**按任务顺序推进，每完成一个任务必须跑对应验证并 git commit；全部完成后输出完成报告。** 只有在"完成判据"无法自行达成、且继续执行会造成破坏时才停下来问人。

## GOAL（一句话）

本体引擎从"功能全量交付"推进到"生产可信"：**生产 embedding 通道接通 + CI 预存红清零 + dev 栈双轨归一**，三个任务全部达成完成判据且全量回归绿。

## 硬约束（违反任何一条 = 立即停止）

1. **不绕过 13 条硬规则**（CLAUDE.md §13）：tenant 上下文守门 / 禁裸 httpx / production 禁 fallback / secret 不进 git。
2. **测试只用 `mate-platform-backend/.venv`**：全局 Python 无依赖。命令：
   ```
   cd mate-platform-backend && .venv/Scripts/python.exe -m pytest packages/mate-kernel/tests packages/mate-tech-ont/tests packages/mate-app-copilot/tests -q
   ```
   基线：**1196 passed / 57 skipped**。任何提交后不得低于此基线。
3. **网络操作走代理 7897**：`git -c http.proxy=http://127.0.0.1:7897 push`；`export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897` 后用 `gh`。
4. **Conventional Commits**；每任务至少一个独立 commit；不合并无关改动。
5. **在 main 上直接做**（PR #35 已合并）；如需隔离可开 `feat/ont-p0-production` 分支，完成后开 PR 并 `gh pr merge --admin --merge`。
6. **重启任何上游域容器后必须验证网关恢复**（网关已有陈旧连接重试，但探测命令要会）：
   ```
   TOKEN=$(curl -s -X POST http://localhost:8100/api/v1/iam/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/api/v1/ont/v2/value-types -H "Authorization: Bearer $TOKEN"
   ```

## 环境事实卡（本会话实跑验证过的坑，省你半天排障）

| 事实 | 细节 |
|---|---|
| 测试 venv | `mate-platform-backend/.venv`（a2a-sdk 只在此） |
| 登录 | POST `/api/v1/iam/auth/login`（admin/admin123）→ accessToken 存 `/tmp/ont_token.txt` 备用 |
| llmgw 容器 | `mate-tech-llmgw:8008`；embedding 端点 `POST /api/v1/llmgw/embeddings`，body `{"input": ["文本"], "model": ..., "tenant_id": ...}`（**input 必须是数组**），响应含 `dimensions` 字段 |
| llmgw 认证 | Keycloak client_credentials：`POST http://localhost:8180/realms/metaplatform/protocol/openid-connect/token`，client_id=`metaplatform-backend`，secret 在 `.worktrees/prd-05-08-sprint-0/.env` 的 `KEYCLOAK_CLIENT_SECRET`（容器网络内用 `http://keycloak:8080`） |
| 现有 embedder | `mate-tech-ont/src/mate_tech_ont/v2_kernel/object_search.py` 的 `LlmgwServiceEmbedder`（env：`ONT_EMBEDDER=llmgw` / `LLMGW_EMBED_MODEL` / `SERVICE_CLIENT_SECRET`）——**已实现并真栈验证过**，当前 model 返回 384 维兜底 |
| 向量列维度 | `ONT_VECTOR_DIM` 环境变量控制 halfvec(N) 列宽，**必须在 PgOntologyRepository 构造前设置**（构造时即跑 pgvector 升级，维度漂移会 DROP 重建列）；改维度后必须重跑 reindex |
| ARK embedding | ARK Plan 唯一可用 embedding 模型 = `doubao-embedding-vision`（2048 维）；llmgw 的 provider 路由按 model 名推断（openai/doubao/local），llmgw 容器 env 有 `ARK_API_KEY=`（当前为空——需确认 llmgw 侧 doubao provider 配置是否就绪，未就绪则走 llmgw 管理端点/配置文件补齐） |
| lint 配置 | `mate-platform-backend/ruff.toml`，`[lint.per-file-ignores]` 已有 tests/ 惯例条目（mate-app-copilot/mate-tech-mcp 等） |
| CI 结构 | `.github/workflows/ga-acceptance.yml`（16 个 job，含本次新增 `ont-kernel-tests`）；`ga-006` job 跑 `ruff check mate-platform-backend`；**main 上 ga-acceptance / platform-k8s-ci / python-ci / OpenAPI Contract CI / Architecture Governance / ontology-loop 本来就红**（预存债务） |
| dev 栈双轨 | 运行容器挂载 `.worktrees/prd-05-08-sprint-0/mate-platform-backend/packages`（旧 worktree 副本）；compose 权威文件在 worktree 与仓库根各一份（内容当前同步） |
| 镜像 | `mate-tech-ont:dev` / `mate-api-gateway:dev` / `mate-app-copilot:dev` / `mate-tech-orchestrator:dev` 已从最新代码重建 |

## 任务 1：生产 embedding 通道接通

**背景**：容器当前用 384 维兜底模型，语义检索质量受限。目标：`doubao-embedding-vision`（2048 维）跑通端到端。

**步骤**：
1. 确认 llmgw doubao provider：容器内 `curl http://localhost:8008/api/v1/llmgw/providers`（或 openapi 对应端点）；若 `ARK_API_KEY` 缺失/provider 未配，在 compose（worktree + 根两份）`mate-tech-llmgw` 服务补 env（值从平台管理员/`.env` 取，**secret 不进 git**——用 `${ARK_API_KEY}` 变量引用）。
2. 容器内验证模型可用：
   ```
   curl -s -X POST http://mate-tech-llmgw:8008/api/v1/llmgw/embeddings -H "Authorization: Bearer <client_credentials token>" -H "Content-Type: application/json" -d '{"input":["测试"],"model":"doubao-embedding-vision","provider":"doubao","tenant_id":"tenant-default"}'
   ```
   确认 `dimensions == 2048`。
3. compose 的 `mate-tech-ont`：`LLMGW_EMBED_MODEL=doubao-embedding-vision`、`ONT_VECTOR_DIM=2048`（两份 compose 同步改）。
4. `docker compose up -d --no-deps mate-tech-ont`（重建容器拿新 env）→ 重启网关 → `POST /api/v1/ont/v2/object-search/reindex` → hybrid 检索验证返回卡片。
5. 若 2048 维触发 pgvector 半精度问题（>2000 用 halfvec 是既有逻辑），确认 `_try_pgvector_upgrade` 正确重建列；reindex 后 `SELECT COUNT(*) FROM ont_object_embedding WHERE embedding_vec IS NOT NULL` > 0。

**完成判据**：
- [ ] hybrid 检索经网关 200 且返回 cards
- [ ] `ont_object_embedding.embedding_vec` 全部非空且维度 2048
- [ ] 测试套件不低于基线（本地跑）

**commit**：`feat(ontology): 生产 embedding 通道接通 doubao-embedding-vision（2048 维）`

## 任务 2：CI 预存红清零（lint 主线 + 三 workflow 摸底）

**背景**：`ga-006` 因 `ruff check mate-platform-backend` 报 429 条失败（其中 ~263 条是 PLC0415 惰性 import + PTH118/120 路径风格的系统性模式）；另有 platform-k8s-ci / cowork / OpenAPI Contract CI 在 main 预存红。

**步骤**：
1. 跑 `cd mate-platform-backend && .venv/Scripts/python.exe -m ruff check packages/mate-kernel packages/mate-tech-ont packages/mate-app-copilot 2>&1 | tail -3` 拿当前条数；再对全仓库（ga-006 的实际范围 `ruff check mate-platform-backend`）分类统计：
   ```
   .venv/Scripts/python.exe -m ruff check mate-platform-backend --statistics
   ```
2. **系统性模式登记豁免**（仓库既有惯例，`ruff.toml` 的 per-file-ignores）：PLC0415（函数内 import 是惰性加载惯例）、PTH118/PTH120（os.path 惯例）按目录登记；只登记"确实是模式"的，不盲豁免。
3. 剩余真问题逐条修（预计 <100 条，多为 unused import / f-string 等 safe fix：可先 `ruff check --fix`，人工复核 diff）。
4. `ruff check mate-platform-backend` 归零后，本地全量测试确认无回归。
5. 三个预存红 workflow 摸底：`gh run view --log-failed <run_id>` 逐个定位（kind=infra/helm 模板问题、cowork=md 规范、OpenAPI=契约 diff）。**能 30 分钟内修的修；修不了的在 workflow 对应 job 上加 `continue-on-error: true` + 注释说明债务登记**（不得静默）。
6. push 后 `gh pr checks` 确认 ga-006 / 新增豁免生效。

**完成判据**：
- [ ] `ruff check mate-platform-backend` 本地归零
- [ ] `ga-acceptance.yml` 全 job 在 CI 绿（或显式 continue-on-error + 注释）
- [ ] 测试不低于基线

**commit**（可多个）：`chore(lint): ...` / `fix(ci): ...`

## 任务 3：dev 栈双轨归一

**背景**：容器挂载旧 worktree 副本运行；PR 已合并，代码事实源应回到 main 检出。

**步骤**：
1. 确认仓库根 `docker-compose.yml` 与 worktree 版 diff（应为任务 1/2 改动后同步状态）；以根为准。
2. 修改根 compose 的挂载：`./mate-platform-backend/packages:/app/packages`（main 检出即事实源）；确认 `.worktrees/prd-05-08-sprint-0` 不再被任何运行容器引用（`docker inspect $(docker ps -q) | grep prd-05-08`）。
3. `docker compose up -d --no-deps --force-recreate mate-tech-ont` 等本体相关服务 → 网关探活 → 冒烟（value-types / hybrid search）。
4. 在 `.worktrees/` 评估 `prd-05-08-sprint-0` 是否可 `git worktree remove`（确认无未提交内容、无容器引用后删除；有疑虑则保留并在报告说明）。

**完成判据**：
- [ ] 无运行容器引用 prd-05-08-sprint-0
- [ ] 本体端点经网关冒烟 200
- [ ] 测试不低于基线

**commit**：`chore(deploy): dev 栈挂载归一到 main 检出，解除 prd-05-08-sprint-0 双轨`

## 验证循环（每任务后必跑）

```
cd mate-platform-backend && .venv/Scripts/python.exe -m pytest packages/mate-kernel/tests packages/mate-tech-ont/tests packages/mate-app-copilot/tests -q
```
低于 1196 passed → 修复后再继续。涉网关/容器的任务加冒烟探测（见硬约束 6）。

## 完成报告格式

```
## P0 生产化收口完成报告
- 任务 1 生产 embedding：<模型/维度/检索验证结果>
- 任务 2 CI 清零：<lint 前后条数 / 豁免登记清单 / 三 workflow 处置>
- 任务 3 双轨归一：<挂载切换验证 / worktree 处置>
- 回归：<测试数字> | commits：<hash 列表> | PR：<链接或"直推 main">
- 遗留与建议：<...>
```

## 边界（不要做）

- 不动 13 硬规则的任何门禁脚本语义
- 不重构与三任务无关的模块（看到问题记入报告"遗留与建议"）
- 不删除 legacy 路径（OWL/SPARQL/SHACL/Neo4j）
- 不做 P1 任务（调度化 / WS NOTIFY / edit-set 万级 / 使用量维度——留给下一轮）
- secret 值不进 git（compose 用 `${VAR}` 引用）
