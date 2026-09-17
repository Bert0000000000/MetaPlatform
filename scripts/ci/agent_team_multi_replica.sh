#!/usr/bin/env bash
# =============================================================================
# Agent 产品层多副本实起判据（2.1-B §6 建议 2：把 kind 手工验证收进 CI）
# =============================================================================
# 2.1-B 的 `MP-REPLICA-READINESS-01` 是**手敲**出来的：
#
#     kind create → docker save → ctr images import → helm install
#
# 于是 `platform-k8s-ci.yml` 只有静态 lint，"真的能起 3 个副本"这条判据不在
# CI 里。本脚本就是那串命令的可重复形态。
#
# 判据（脚本自己断言，不靠人眼看）：
#   ① 3 个 `mate-tech-agent-team-*` Pod 全部 Ready；
#   ② Deployment 的 readyReplicas == replicaCount；
#   ③ 每个副本的 /healthz 都回 200（副本之间是**各自独立的进程**，不是一份）；
#   ④ 迁移 Job 跑完（B-4：建表/授权在运行 Pod 之外）。
#
# 为什么用 kind 而不是 Docker Desktop 内置 K8s：后者的 containerd 镜像源在本机
# 是坏的（`registry-mirror:1273` 对 `docker.io/library/*` 一律回 500），镜像既拉
# 不下来、也不与宿主 Docker 共享存储（`imagePullPolicy: Never` 实测
# `ErrImageNeverPull`）。kind 的 node 镜像本地有缓存，配 `ctr images import`
# 可以离线灌镜像。这是环境事实，不是选择偏好（见 2.1-B 验收 §1 前置）。
#
# 用法：
#   scripts/ci/agent_team_multi_replica.sh
#   KEEP_CLUSTER=1 scripts/ci/agent_team_multi_replica.sh   # 留着环境做手工排查
#
# 依赖：docker / kind / kubectl / helm（都在 PATH 上）。
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CLUSTER_NAME="${CLUSTER_NAME:-mate-agent-team-e2e}"
KIND_NODE_IMAGE="${KIND_NODE_IMAGE:-kindest/node:v1.29.2}"
KIND_WAIT="${KIND_WAIT:-180s}"
NAMESPACE="${NAMESPACE:-mate-agent-team}"
RELEASE="${RELEASE:-agent-team}"
CHART_DIR="${CHART_DIR:-infra/helm/charts/agent-team}"
IMAGE="${IMAGE:-mate-tech-agent-team:dev}"
DOCKERFILE="${DOCKERFILE:-mate-platform-backend/packages/mate-tech-agent-team/Dockerfile}"
BUILD_CONTEXT="${BUILD_CONTEXT:-mate-platform-backend}"
#: auto = 本地镜像不在才 build；1 = 强制 build；0 = 不 build（镜像必须已在）
BUILD_IMAGE="${BUILD_IMAGE:-auto}"
#: 1 = 把镜像灌进 kind 节点（CI 必须）。0 = 跳过（本地已在节点里时省几分钟）。
LOAD_IMAGES="${LOAD_IMAGES:-1}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://mirrors.aliyun.com/pypi/simple/}"
CONTROL_PASSWORD="${CONTROL_PASSWORD:-mate_control_pw}"
REPLICAS="${REPLICAS:-3}"
READY_TIMEOUT="${READY_TIMEOUT:-300s}"
HELM_TIMEOUT="${HELM_TIMEOUT:-6m}"
KEEP_CLUSTER="${KEEP_CLUSTER:-0}"

log() { printf '\n=== %s ===\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ── 收尾 ─────────────────────────────────────────────────────────────────────
cleanup() {
  local rc=$?
  if [[ "$rc" -ne 0 ]]; then
    echo "---- 失败现场：Pod / 事件（最后 40 行）----" >&2 || true
    kubectl -n "$NAMESPACE" get pods -o wide >&2 2>/dev/null || true
    kubectl -n "$NAMESPACE" get events --sort-by=.lastTimestamp 2>/dev/null | tail -40 >&2 || true
    kubectl -n "$NAMESPACE" logs -l app.kubernetes.io/component=superbrain --tail=60 --all-containers 2>/dev/null >&2 || true
  fi
  if [[ "$KEEP_CLUSTER" == "1" ]]; then
    echo "KEEP_CLUSTER=1：保留集群 '${CLUSTER_NAME}' 与命名空间 '${NAMESPACE}' 供排查。"
  else
    kind delete cluster --name "$CLUSTER_NAME" >/dev/null 2>&1 || true
  fi
  return "$rc"
}
trap cleanup EXIT

for tool in docker kind kubectl helm; do
  command -v "$tool" >/dev/null 2>&1 || die "缺少 $tool"
done

# ── 1. kind 集群 ─────────────────────────────────────────────────────────────
log "1. kind 集群 (${CLUSTER_NAME})"
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  echo "已存在，复用。"
else
  kind create cluster --name "$CLUSTER_NAME" --image "$KIND_NODE_IMAGE" --wait "$KIND_WAIT"
fi
kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null
# kind 自己的 `--wait` 在慢机器上会超时**但不算失败**（它只是警告）。真正要断言
# 的是节点到了 Ready —— 这一条我们自己再等一次，免得后面每步都撞 API 超时。
kubectl wait --for=condition=Ready node --all --timeout=180s

# ── 2. 镜像 ──────────────────────────────────────────────────────────────────
# kind 的 node 是 Docker 容器，它**不共享宿主 Docker 的镜像存储**。两条路都试过：
#
#   * `kind load docker-image` —— 在本机的 node 镜像（containerd 2.x）上直接失败：
#     `ERROR: failed to detect containerd snapshotter`。kind 的 loader 认不出新的
#     containerd 布局（2.1-B 实测同一个坑，所以当时手敲了 `ctr images import`）。
#   * `docker save <img> | docker exec -i <node> ctr -n k8s.io images import -`
#     —— 走 stdin 管道，**实测可用**（Git Bash / WSL2 下也二进制安全）。
#
# 取后者。`ctr` 会把 `mate-tech-agent-team:dev` 规范成
# `docker.io/library/mate-tech-agent-team:dev`，正好对上 values-local.yaml 里的
# `registry: docker.io` + `repository: library/mate-tech-agent-team`。
load_image_into_node() {
  local image="$1"
  local node="${CLUSTER_NAME}-control-plane"
  echo "  载入 ${image} → ${node}"
  docker save "$image" | docker exec -i "$node" ctr -n k8s.io images import - >/dev/null
}

log "2. 镜像"
if [[ "$BUILD_IMAGE" == "1" ]] || { [[ "$BUILD_IMAGE" == "auto" ]] && ! docker image inspect "$IMAGE" >/dev/null 2>&1; }; then
  echo "  构建 ${IMAGE}（context=${BUILD_CONTEXT}）"
  docker build -f "$DOCKERFILE" -t "$IMAGE" --build-arg "PIP_INDEX_URL=${PIP_INDEX_URL}" "$BUILD_CONTEXT"
else
  #: **把"复用了哪个镜像"打出来**，带上构建时刻。`auto` 的语义是"本地没有才建"，
  #: 于是本地跑第二次时会**静默复用上一次的旧镜像**——而验证脚本最怕的就是这个：
  #: 你以为在验当前源码，其实在验几小时前的。实测踩过一次（改完的 `start_rescanner`
  #: 根本不在跑起来的镜像里，白白追了一轮"为什么没接管"）。
  #: 要验当前源码就显式 `BUILD_IMAGE=1`。
  echo "  复用已存在的本地镜像 ${IMAGE}（构建于 $(docker image inspect -f '{{.Created}}' "$IMAGE" 2>/dev/null））"
  echo "  ⚠️  验当前源码请用 BUILD_IMAGE=1；否则你验的是这个时刻的镜像"
fi
if [[ "$LOAD_IMAGES" == "1" ]]; then
  load_image_into_node "$IMAGE"
  load_image_into_node "postgres:16-alpine"
else
  echo "  LOAD_IMAGES=0：跳过灌镜像（节点里必须已经有了）"
fi

# ── 3. 命名空间 + 自带 PG ────────────────────────────────────────────────────
# 为什么自带一个 PG：kind 集群与 compose 网络不互通，且 `host.docker.internal`
# 在 kind 的 network 里不成立。一个一次性 PG 让这次验证**自成一体**。
log "3. 命名空间 + PG"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl apply -n "$NAMESPACE" -f "$CHART_DIR/verify/postgres.yaml"

# 注意：values-local.yaml 里 `image.repository` 是 `library/mate-tech-agent-team`
# ——`ctr images import` 会把 `mate-tech-agent-team:dev` 规范成
# `docker.io/library/mate-tech-agent-team:dev`，正好对上。`verify/postgres.yaml`
# 那边同样走 `imagePullPolicy: Never`。
kubectl -n "$NAMESPACE" rollout status statefulset/agent-team-pg --timeout=180s

# B-5 / B-4：运行态用的是受 RLS 约束的 `mate_app`。迁移 Job 只 GRANT、不建角色
# （角色是集群管理员的活），所以这里建一次。
log "3b. 建 app 角色 (mate_app)"
kubectl -n "$NAMESPACE" exec agent-team-pg-0 -- psql -U meta -d metaplatform -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='mate_app') THEN CREATE ROLE mate_app LOGIN PASSWORD 'mate_app'; END IF; END \$\$; GRANT CONNECT ON DATABASE metaplatform TO mate_app;"

# ── 4. Secret（三个 DSN + 服务密钥）──────────────────────────────────────────
# 硬规则 12：Secret 不进 git。这里造的是**本地开发口令**（compose 栈公开的那套），
# 不是任何真实凭据——它们只活在这个一次性 kind 集群里。
log "4. Secret"
kubectl -n "$NAMESPACE" create secret generic agent-team-secret \
  --from-literal=MATE_AGENT_TEAM_ADMIN_DSN="postgresql://meta:meta@agent-team-pg:5432/metaplatform" \
  --from-literal=MATE_AGENT_TEAM_DSN="postgresql://mate_app:mate_app@agent-team-pg:5432/metaplatform" \
  --from-literal=MATE_AGENT_TEAM_CONTROL_DSN="postgresql://mate_control:${CONTROL_PASSWORD}@agent-team-pg:5432/mateplatform" \
  --from-literal=SERVICE_CLIENT_SECRET="${SERVICE_CLIENT_SECRET:-local-dev-service-secret}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

# ── 5. helm install ──────────────────────────────────────────────────────────
log "5. helm install ${RELEASE}"
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  --values "$CHART_DIR/values-local.yaml" \
  --set "migration.controlPassword=${CONTROL_PASSWORD}" \
  --set "replicaCount=${REPLICAS}" \
  --wait --timeout "$HELM_TIMEOUT"

# ── 6. 判据 ──────────────────────────────────────────────────────────────────
log "6. 判据：3 副本真的起来了"
kubectl -n "$NAMESPACE" get pods -o wide

DEPLOY="$(kubectl -n "$NAMESPACE" get deployment -l app.kubernetes.io/component=superbrain -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$DEPLOY" ]] || die "找不到 superbrain Deployment"

kubectl -n "$NAMESPACE" rollout status "deployment/${DEPLOY}" --timeout="$READY_TIMEOUT"

READY="$(kubectl -n "$NAMESPACE" get deployment "$DEPLOY" -o jsonpath='{.status.readyReplicas}')"
READY="${READY:-0}"
echo "readyReplicas=${READY}（期望 ${REPLICAS}）"
[[ "$READY" -eq "$REPLICAS" ]] || die "readyReplicas=${READY}，期望 ${REPLICAS}"

# 逐个副本打 /healthz —— 断言的是"每个副本都是活的进程"，不是"有一个副本活着"。
PODS="$(kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/component=superbrain -o name)"
COUNT="$(printf '%s\n' "$PODS" | grep -c . || true)"
echo "superbrain Pod 数=${COUNT}"
[[ "$COUNT" -eq "$REPLICAS" ]] || die "Pod 数=${COUNT}，期望 ${REPLICAS}"

for pod in $PODS; do
  name="${pod#pod/}"
  # MSYS_NO_PATHCONV：Git Bash 会把 `-o /dev/null` 里的 `/dev/null` 改写成 Windows
  # 路径再交给 kubectl → curl 在容器里定位不到它，退出码 23（write error）。
  # Linux CI 上这个变量无副作用。
  code="$(MSYS_NO_PATHCONV=1 kubectl -n "$NAMESPACE" exec "$name" -- \
    curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8013/healthz)"
  echo "  ${name} /healthz -> ${code}"
  [[ "$code" == "200" ]] || die "${name} 的 /healthz 回 ${code}"
done

# B-4：迁移 Job 必须跑完（schema / RLS / GRANT 都靠它）。
# 名字来自 chart 的 `fullnameOverride`（values-local.yaml 固定为 mate-tech-agent-team）。
MIGRATE_JOB="$(kubectl -n "$NAMESPACE" get job -l app.kubernetes.io/component=migration \
  -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$MIGRATE_JOB" ]] || die "找不到迁移 Job"
MIGRATE_STATE="$(kubectl -n "$NAMESPACE" get job "$MIGRATE_JOB" -o jsonpath='{.status.succeeded}')"
echo "迁移 Job succeeded=${MIGRATE_STATE}"
[[ "${MIGRATE_STATE:-0}" -ge 1 ]] || die "迁移 Job 没成功"

# B-4 的反面判据：运行 Pod 的 env 里**不该**有 admin DSN。
ENVNAMES="$(kubectl -n "$NAMESPACE" get deployment "$DEPLOY" -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{"\n"}{end}')"
if printf '%s\n' "$ENVNAMES" | grep -qx "MATE_AGENT_TEAM_ADMIN_DSN"; then
  die "运行 Pod 的 env 里出现了 MATE_AGENT_TEAM_ADMIN_DSN（B-4 要求没有）"
fi

echo
echo "=== AGENT-TEAM MULTI-REPLICA PASS：${REPLICAS} 副本全部 Ready 且各自 /healthz 200 ==="
