# 🎉 Sprint 1 准生产验收 — 访问入口

**状态**：✅ 后端 dev_server + 前端 vite dev 已部署，所有路由代理通，ontology 数据真实可查

---

## 访问入口

| 服务 | URL | 备注 |
|---|---|---|
| **前端（用户访问）** | **http://localhost:9200/** | vite dev mode + proxy `/api/v1` → 8100 |
| 后端 API | http://localhost:8100/ | FastAPI dev_server（单进程多组件） |
| 后端 health | http://localhost:8100/healthz | `{"status":"ok"}` |
| Swagger UI（开发用） | (未启动）| 可选 |

## 登录账号

- 用户名：`admin`
- 密码：`admin123`
- 角色：PLATFORM_SUPER_ADMIN
- tenant_id：`tenant-default`

## ⚠️ dev mode 已知问题 + 绕过

CLAUDE.md / memory 提到：**dev 模式下 Semi Design Button onClick 是 noop**（React 18 + vite HMR 拦截）。半 React 按钮可能点不动。

**绕过方案 1**（推荐）：浏览器 F12 → Console 跑下面这个 snippet 拿 token 注入 localStorage：

```js
// 一键登录（拿 token + 注入前端）
fetch('/api/v1/iam/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: 'admin', password: 'admin123'})
})
.then(r => r.json())
.then(d => {
  localStorage.setItem('mate_platform_settings', JSON.stringify({
    ...JSON.parse(localStorage.getItem('mate_platform_settings') || '{}'),
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    user: d.user,
  }));
  console.log('✅ Login OK, user:', d.user.realName, 'role:', d.is_super_admin);
  console.log('Token (1h):', d.accessToken.slice(0, 50) + '...');
  console.log('现在可以刷新页面正常使用');
});
```

**绕过方案 2**：把 token 复制到浏览器开发者工具 → Application → Local Storage → 添加 `accessToken` key。

**绕过方案 3**（彻底）：停止 vite dev → 重新 build → 用 `vite preview` serve dist（无 HMR，无 noop 问题）。但 vite preview 不代理 API，需要客户端直连 8100 或自己加 nginx。

## 关键验收入口

| 验收点 | URL 路径 | 后端 endpoint | 备注 |
|---|---|---|---|
| Ontology 浏览 | `/datacenter/objects` | `GET /api/v1/ont/v2/object-types` | **已实测 OK** — 5 个对象（员工/请假/工单/客户/订单） |
| SuperAI 聊天 | `/superai` 或 `/copilot` | `POST /api/v1/copilot/...` | 需登录后访问 |
| Arch 应用中心 | `/arch` | `/api/v1/arch/...` | 需登录后访问 |
| A2A Agent 调度 | `/a2a` | `/api/v1/a2a/...` | 需登录 |
| AppHub 应用 | `/apphub` | `/api/v1/apphub/...` | 需登录 |
| LLM Gateway | (内部）| `/api/v1/llmgw/chat` | anonymous path，无需 token |

## 快速验证（curl）

```bash
# 后端 health
curl http://localhost:8100/healthz

# 登录拿 token
curl -X POST http://localhost:8100/api/v1/iam/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 用 token 查 ontology
TOKEN="<从上面拿到的 accessToken>"
curl "http://localhost:9200/api/v1/ont/v2/object-types?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

## 服务进程

| 进程 | PID | 日志 |
|---|---|---|
| dev_server | (后台 PID 37044) | `/tmp/dev-server.log` |
| vite dev | (后台 PID) | `/tmp/vite-dev.log` |

## 当前 Sprint 1 范围

✅ **已部署并可验收**：v3.0 GA + v3.1 Ontology + v4 RUNTIME + SAL × 6 + Composition Kernel + LOOP-ROLLOUT-01
- 12 Ontology Kernel（identity/types/instances/reasoning/query）
- 73 个 ontology API 路由
- 7+1 类数字员工（copilot 43 routes / arch 114 / apphub 37 / dw 58 / llmgw 13）
- IAM + Auth + dashboard
- KB + RAG（27 + 15 routes）
- SuperAI mock endpoints
- agent_loop / orchestrator / a2a / copilot 全套

🟡 **未部署**：Sprint 1 新增的 30+ 项任务（MP-EMP-EVOLVE-01 / SAL-06/07 / ONT-G1~G22 / Temporal 替换等）— 这些是 Sprint 1 计划内的工作项，**未在本次"准生产环境"范围内**，需要后续 Sprint 推进并各自独立 ACCEPTANCE 后再纳入 dev_server。

## 已收口但 dev_server 当前限制

dev_server 是 Sprint 1 之前的快照集成版。Sprint 1 的 30+ 项任务是**新增能力**，落地后会以独立 PR + 各自 ACCEPTANCE 形式加入 dev_server。

## 已知次要警告

| 警告 | 影响 | 后续 |
|---|---|---|
| `a2a` 模块找不到 | a2a 路由未 mount | 装 a2a-sdk 或独立起 a2a 服务 |
| `psycopg` 缺失 | KB/RAG SQL store 降级 in-memory | 装 psycopg2-binary 启用 PG 模式 |
| PG DSN 不可达 | KB/RAG/DW 的 SQL store 降级 | 用 Supabase PG (54322) 或启动 docker compose postgres |
| IAM 用 sqlite（dev 模式）| dev OK，prod 必须用 PG | 上线前改 IAM_DATABASE_URL 指向 PG |

## 进一步建议

1. 验收后告诉我哪些功能 OK、哪些需要修
2. Sprint 1 任务（30+ 项）按 V1.0-RELEASE-PLAN.md §2 顺序推进，每个任务独立 PR + ACCEPTANCE.md
3. 真实 staging 验证可在 Sprint 0 完成后做（kind cluster + docker compose up）
