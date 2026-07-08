# metaplatform-runtime

独立运行的镜像 —— 每个发布的 MetaPlatform 应用都跑在自己一个容器里，
互不依赖主平台进程。

镜像内容：
- 极简 Node.js Express，只对外提供只读 API。
- 只挂载该应用专属的 sqlite 文件 `/data/app.db` (ro)。
- 不访问任何外部服务（无 Kafka / Redis / Postgres / Flowable）。
- 资源隔离：CPU/内存限额、只读 rootfs、tmpfs /tmp、非 root 用户、
  no-new-privileges。

构建：

```bash
docker build -t metaplatform-runtime:v1 ./metaplatform-runtime
```

入口由 orchestrator 调度；不要直接手动跑。

## 隔离模型 (Isolation)

Runtime 是 **read-only data plane**，由五层防御保证：

1. **Image-level**（`Dockerfile`）
   - `node:20-bookworm-slim`（建议 pin digest）
   - `USER node` (uid 1000)
   - HEALTHCHECK 内置
2. **Pod-level**（`runtime-deployment.yaml`）
   - `runAsNonRoot: true` + `runAsUser: 10001`
   - `seccompProfile: RuntimeDefault`（prod overlay 切到自定义 profile）
   - `automountServiceAccountToken: false`（不持有 SA 凭据）
   - `hostNetwork/PID/IPC: false`
3. **Container-level**
   - `readOnlyRootFilesystem: true`
   - `allowPrivilegeEscalation: false`
   - `capabilities.drop: [ALL]`
   - `/tmp` + `/tmp/runtime` 都是 Memory-backed emptyDir (tmpfs)
4. **Network**（`runtime-networkpolicy.yaml`）
   - 默认 deny all
   - 只放行 platform-api / platform-frontend / ingress-nginx
   - 出站仅允许 kube-system DNS
5. **Application-level**
   - `app.disable('x-powered-by')` + `app.disable('etag')`
   - 所有路由**只允许 GET**
   - CORS 全开（前提：Service 是 ClusterIP，外部根本拿不到）
   - Body limit 256KB（runtime 永远不需要大请求体）
   - `/health` 需要 `Authorization: Bearer <RUNTIME_ADMIN_TOKEN>`
     → 错误/缺失 token 一律返回 404（避免探测）
   - `/healthz` 是公开探针，只回 `{status:"ok"}`
   - `access-log` 中间件把 `/health` 路径打印为 `<redacted>` 防 token 泄漏

## 端点

| 路径 | 鉴权 | 说明 |
|---|---|---|
| `GET /healthz` | 无 | 公开探针，k8s liveness/readiness 用 |
| `GET /health` | Bearer token | 详细 metadata：app_id / counts / db_path |
| `GET /api/apps/slug/:slug` | 无 | 应用元信息（镜像平台 `/api/apps/slug/:slug`） |
| `GET /api/objects/...` | 无 | ontology 字段 (供 PublishedApp 页面渲染) |
| `GET /api/pages/...` | 无 | 页面 schema |
| `GET /api/processes/...` | 无 | 流程定义 |

POST/PATCH/DELETE 一律 404（没有路由匹配）。

## 本地开发

```bash
cp .env.example .env
# 编辑 .env，至少设 RUNTIME_DB_PATH=./dev-data/app.db
# 可选 RUNTIME_ADMIN_TOKEN=<openssl rand -hex 32>
npm install
npm start
```

## K8s 部署

由 platform orchestrator 拉起：

```bash
kubectl apply -k deploy/kubernetes/overlays/prod
```

manifest 由 [`deploy/kubernetes/base/runtime-*.yaml`](../../deploy/kubernetes/base) 五个文件组成，外加 runtime-secret.yaml。

