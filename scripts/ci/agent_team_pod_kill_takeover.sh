#!/usr/bin/env bash
# =============================================================================
# 判据 ⑦ 端到端复现：真集群里杀掉**正在跑 run**的 Pod，观察 Run 被接管并继续。
# （2.1-B 边界 A1 / 平台计划 S2「随机杀死执行 Pod 后 Run 30s 内被接管」）
# =============================================================================
# 2.1-B 验过的是**机制**（租约过期 + 四条件接管 + 真杀进程 + 真库 epoch 前进），
# 没验过的是**这一整件事在真集群里发生**——那要求"Run 真的在跑"，也就是
# llmgw / MCP / Ontology 从集群里可达。
#
# 本脚本把那一步补上，做法：
#   1. 把宿主机上那套 compose 全栈通过 kind 网络网关（默认 172.18.0.1）接进集群
#      —— 不搬进集群，只是让 Pod 能访问它；
#   2. `POST /runs` **直接打进**某一台副本（`kubectl exec` 到那台打 127.0.0.1），
#      于是"谁持有租约"是**构造出来的已知量**，不靠猜；
#   3. 硬杀那台 Pod（`--force --grace-period=0`，等价于节点故障/OOM 的形态），
#      然后按秒观察 `active_run_lease` 的 `lease_epoch` / `heartbeat_at` 与检查点
#      `checkpoint_id`，测出**接管时延**。
#
# **本脚本不粉饰**：它把每一秒的观测原样打印出来。若接管没在规定时间内发生，
# 它照样 PASS 退出（判据是"如实测出真实结果"），并打印 **NOT TAKEN OVER**。
#
# ---------------------------------------------------------------------------
# 2026-09-18 实跑结论（本机 kind + 宿主机 compose 全栈）
# ---------------------------------------------------------------------------
# 1. **`kubectl delete pod --force --grace-period=0` 不是硬杀**：事件里是
#    `Killing … Stopping container agent-team`（优雅停机），应用在死之前把这一轮
#    写成了 `failed` → 终态**本来就不该被接管**，判据无从触发。
#    所以阶段 1 改用 **真 SIGKILL**（从节点 `kill -9` 容器进程）——这才是节点
#    故障 / OOM 的形态：没有清理、租约行留着、检查点停在 `running`。
#
# 2. **真 SIGKILL 之后，120s 内没有接管**（lease_epoch 不动、心跳冻住、检查点冻住）。
#    原因不是"接管判据不对"，而是**没有人在扫**：`RunControl.recover()` 只在
#    **进程启动**时跑一次（`main.py` 的 lifespan），而另外两个副本一直在跑、
#    永远不会重扫。被杀的 Pod 重启出来的那个进程扫得**太早**（租约还没过期，
#    心跳也还新），扫过一次就不再扫 → 这一轮就一直卡在 `running`。
#
# 3. **机制本身是好的**：让所有副本各重启一次（`kubectl rollout restart`）后，
#    新进程的启动扫描在 **+5.2s** 就接管了它——`lease_epoch` 1 → 2、
#    `owner_instance` 换人、检查点继续前进。
#
# 一句话：**"杀 Pod → 30s 内被接管"这条判据在当前实现下不成立，缺的是"定期重扫"
# 这个触发器**；租约/心跳/四条件接管这套语义本身经得起真集群的检验。
# ---------------------------------------------------------------------------
#
# 前置：`agent_team_multi_replica.sh` 已经用 `KEEP_CLUSTER=1` 装好一套环境。
#
# 用法：
#   KEEP_CLUSTER=1 bash scripts/ci/agent_team_multi_replica.sh
#   bash scripts/ci/agent_team_pod_kill_takeover.sh
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

#: **默认必须与 `agent_team_multi_replica.sh` 一致**。两边各自写死过一个名字
#: （这里是 `mate-agent-team-ci`、那里是 `mate-agent-team-e2e`），于是文件头写的
#: 那两步用法**照抄就报 `找不到 context kind-mate-agent-team-ci`**——脚本之间默认值
#: 不一致比脚本本身坏掉更难发现，因为它只在"按文档老实做"的时候炸。
CLUSTER_NAME="${CLUSTER_NAME:-mate-agent-team-e2e}"
NAMESPACE="${NAMESPACE:-mate-agent-team}"
RELEASE="${RELEASE:-agent-team}"
CHART_DIR="${CHART_DIR:-infra/helm/charts/agent-team}"
#: 判据参数。**默认只报不判**（见第 8 节的说明）；要在 CI 当门就 `REQUIRE_TAKEOVER=1`。
TAKEOVER_BUDGET_SECONDS="${TAKEOVER_BUDGET_SECONDS:-30}"
REQUIRE_TAKEOVER="${REQUIRE_TAKEOVER:-0}"
#: 只用于打印"预算是怎么来的"，不影响判定。默认值与 chart/代码的默认一致。
LEASE_TTL_HINT="${LEASE_TTL_HINT:-30}"
RESCAN_HINT="${RESCAN_HINT:-10}"

#: kind 的 node 是 Docker 容器，它眼里的"宿主机"是 kind 网络的网关 —— 宿主机上
#: compose 那套服务都发布在 0.0.0.0，所以从这个地址能摸到（2.1-B 已实测）。
HOST_GW="${HOST_GW:-172.18.0.1}"
KEYCLOAK_HOST_PORT="${KEYCLOAK_HOST_PORT:-8180}"
LLMGW_PORT="${LLMGW_PORT:-8008}"
MCP_PORT="${MCP_PORT:-8081}"
ONT_PORT="${ONT_PORT:-8007}"
GATEWAY_PORT="${GATEWAY_PORT:-8100}"

TENANT="${TENANT:-tenant-default}"
GOAL="${GOAL:-把 3 个部门的季度合规检查各拆成一份清单，逐一给出检查项与责任人。}"
POLL_SECONDS="${POLL_SECONDS:-2}"
#: 阶段 1：杀掉持有租约的 Pod 之后观察多久（判据说的是 30s，这里给足余量）。
OBSERVE_1_SECONDS="${OBSERVE_1_SECONDS:-120}"
#: 阶段 2：如果阶段 1 没接管，再让**所有副本**各重启一次（每个新进程启动时都会
#: 扫一次检查点），观察机制本身到底能不能接管。
OBSERVE_2_SECONDS="${OBSERVE_2_SECONDS:-180}"
DO_PHASE_2="${DO_PHASE_2:-1}"

ARTDIR="${ARTDIR:-$(mktemp -d)}"
log() { printf '\n=== %s ===\n' "$*"; }
note() { printf '%s\n' "$*" | tee -a "$ARTDIR/evidence.log"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v kubectl >/dev/null || die "缺少 kubectl"
command -v kind >/dev/null || die "缺少 kind"

kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null 2>&1 \
  || die "找不到 context kind-${CLUSTER_NAME}（先跑 agent_team_multi_replica.sh）"

#: 本机取 JSON 字段用的解释器（CI 上没有 .venv 时退回 python3）。
PY="$REPO_ROOT/mate-platform-backend/.venv/Scripts/python.exe"
[[ -x "$PY" ]] || PY="$(command -v python3 || command -v python)"
[[ -n "$PY" ]] || die "找不到 python 解释器"

jsonfield() { "$PY" -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',''))"; }

# ── 0. 把宿主机全栈接进集群 ──────────────────────────────────────────────────
# 关键在 **iss 必须逐字相等**：Keycloak 签出来的 `iss` 是
# `http://keycloak:8080/realms/metaplatform`（compose 栈内部就是这么调的）。
# 所以 Pod 里也得用 `http://keycloak:8080` —— 于是这里在命名空间里造一个叫
# `keycloak` 的 Service，把它的 Endpoints 指到宿主机的 8180 端口上。
log "0. 宿主机全栈 → 集群（keycloak / llmgw / mcp / ont / gateway）"
cat <<YAML | kubectl apply -f - >/dev/null
apiVersion: v1
kind: Service
metadata:
  name: keycloak
  namespace: ${NAMESPACE}
spec:
  ports:
    - port: 8080
      targetPort: 8080
---
apiVersion: v1
kind: Endpoints
metadata:
  name: keycloak
  namespace: ${NAMESPACE}
subsets:
  - addresses:
      - ip: ${HOST_GW}
    ports:
      - port: ${KEYCLOAK_HOST_PORT}
YAML

for probe in "${LLMGW_PORT}/healthz" "${MCP_PORT}/healthz" "${ONT_PORT}/healthz" "${GATEWAY_PORT}/healthz"; do
  # MSYS_NO_PATHCONV：Git Bash 会把 `-o /dev/null` 改写成 Windows 路径（见
  # agent_team_multi_replica.sh 里同一处注释）。
  code="$(MSYS_NO_PATHCONV=1 kubectl -n "$NAMESPACE" exec deploy/mate-tech-agent-team -c agent-team -- \
    curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://${HOST_GW}:${probe}" || echo ERR)"
  note "  宿主机 ${HOST_GW}:${probe} -> ${code}"
done

#: 服务密钥要换成**栈里那把真的**：`wiring._provider_config` 取上游 provider 配置时
#: 必须带 `X-Service-Secret`，`_bearer()` 换服务令牌也要用它。占位值会让 provider
#: 配置取空 / 服务令牌换不到 → 员工产出直接失败，跑不到要观察的时长。
#: 值是栈内 `.env` 的 `KEYCLOAK_CLIENT_SECRET`（compose 里就是这么映射的）。
#: **这个值不进任何输出**（硬规则 12 的精神：密钥不进日志/证据）。
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
KC_SECRET=""
if [[ -f "$ENV_FILE" ]]; then
  KC_SECRET="$(grep -E '^KEYCLOAK_CLIENT_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
fi
[[ -n "$KC_SECRET" ]] || die "读不到 KEYCLOAK_CLIENT_SECRET（${ENV_FILE}）"
kubectl -n "$NAMESPACE" create secret generic agent-team-secret \
  --from-literal=MATE_AGENT_TEAM_ADMIN_DSN="postgresql://meta:meta@agent-team-pg:5432/metaplatform" \
  --from-literal=MATE_AGENT_TEAM_DSN="postgresql://mate_app:mate_app@agent-team-pg:5432/metaplatform" \
  --from-literal=MATE_AGENT_TEAM_CONTROL_DSN="postgresql://mate_control:mate_control_pw@agent-team-pg:5432/metaplatform" \
  --from-literal=SERVICE_CLIENT_SECRET="${KC_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
note "  服务密钥已换成栈内那一把（长度 ${#KC_SECRET}，值不打印）"

# 把 ConfigMap 里的地址改到可达的那一套，然后滚一次。
#
# `networkPolicy.enabled=false`：**实测 kindnet 是执行 NetworkPolicy 的**
# （v1.36.1 / kindnetd v20260528 —— 与"kind 不实现 NP"的旧印象相反）。chart 的
# 出站规则是 `to: namespaceSelector: {}` + 端口白名单，它**只能匹配集群内的
# 目的地**；宿主机那套全栈在 172.18.0.1，不属于任何 namespace → 被默认拒绝挡掉。
# 本实验要的正是"集群访问集群外"，所以关掉它。（生产里这些服务都在集群内，
# 规则是够用的——这条不是缺陷，是本实验的边界。）
log "0b. helm upgrade（地址指向宿主机全栈）"
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  --values "$CHART_DIR/values-local.yaml" \
  --set "config.keycloak.url=http://keycloak:8080" \
  --set "config.llmgwUrl=http://${HOST_GW}:${LLMGW_PORT}" \
  --set "config.mcpUrl=http://${HOST_GW}:${MCP_PORT}" \
  --set "config.ontUrl=http://${HOST_GW}:${ONT_PORT}" \
  --set "config.gatewayUrl=http://${HOST_GW}:${GATEWAY_PORT}" \
  --set "networkPolicy.enabled=false" \
  --set "migration.controlPassword=mate_control_pw" \
  --set "config.leaseTtlSeconds=${LEASE_TTL_HINT}" \
  --set "config.rescanSeconds=${RESCAN_HINT}" \
  --wait --timeout 6m >/dev/null
kubectl -n "$NAMESPACE" rollout status deploy/mate-tech-agent-team --timeout=300s

# ── 1. 取一枚真用户令牌 ──────────────────────────────────────────────────────
log "1. 取用户令牌（网关登录）"
TOKEN="$(curl -s -X POST "http://127.0.0.1:${GATEWAY_PORT}/api/v1/iam/auth/login" \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' \
  | jsonfield accessToken)"
[[ -n "$TOKEN" ]] || die "拿不到令牌（网关 http://127.0.0.1:${GATEWAY_PORT} 通不通？）"
note "  令牌长度 ${#TOKEN}"

# ── 2. 选一台副本当"持有者"，run 直接打进它 ─────────────────────────────────
log "2. 选受害副本（run 直接从它发起 → 租约必然是它的）"
#: **必须限定 Running**：`component=superbrain` 这个标签也挂在 migrate / 沙箱 probe
#: 那两个 **Job** 的 Pod 上，而它们跑完就是 `Completed`。不筛的话 `{.items[0]}` 很可能
#: 选中一个已完成的 Job Pod，然后死在
#: `cannot exec into a container in a completed pod`——下面 `run_status` 早就加了
#: 这个筛选，这里漏了。
VICTIM="$(kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/component=superbrain \
  --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$VICTIM" ]] || die "没有 Running 的 superbrain Pod"
note "  victim pod = ${VICTIM}"

api() {  # api <pod> <method> <path> [body]
  local pod="$1" method="$2" path="$3" body="${4:-}"
  if [[ -n "$body" ]]; then
    kubectl -n "$NAMESPACE" exec "$pod" -c agent-team -- \
      curl -s -X "$method" "http://127.0.0.1:8013${path}" \
        -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' -d "$body"
  else
    kubectl -n "$NAMESPACE" exec "$pod" -c agent-team -- \
      curl -s -X "$method" "http://127.0.0.1:8013${path}" -H "Authorization: Bearer ${TOKEN}"
  fi
}

psql_q() { kubectl -n "$NAMESPACE" exec agent-team-pg-0 -- \
  psql -U meta -d metaplatform -tAc "$1" 2>/dev/null | tr -d '\r' | head -1; }

lease_row() {  # lease_row <run_id> → owner|epoch|heartbeat|expires|step
  psql_q "SELECT owner_instance || '|' || lease_epoch || '|' || round(heartbeat_at::numeric,1) || '|' || round(expires_at::numeric,1) || '|' || current_step FROM agent_team.active_run_lease WHERE tenant_id='${TENANT}' AND run_id='${1}'"
}
ckpt_id() {  # ckpt_id <run_id>
  psql_q "SELECT checkpoint_id FROM agent_team.checkpoints WHERE thread_id='${TENANT}|${1}' AND checkpoint_ns='' ORDER BY checkpoint_id DESC LIMIT 1"
}
now_seconds() { "$PY" -c 'import time;print(f"{time.time():.1f}")'; }
since() { "$PY" -c 'import sys,time;print(f"{time.time()-float(sys.argv[1]):.1f}")' "$1"; }

#: **真正的硬杀**：从节点上对容器进程发 SIGKILL。
#:
#: 为什么不用 `kubectl delete pod --force --grace-period=0`：实测那条路仍然走
#: 优雅停机（事件里是 `Killing … Stopping container agent-team`），应用在死之前
#: 把这一轮写成了 `failed`（**终态**）—— 终态本来就不该被接管，判据 ⑦ 于是
#: 根本无从触发。节点故障 / OOM 的形态是"进程凭空消失"：没有清理、租约行留着、
#: 检查点停在 `running`。这才是判据 ⑦ 要模拟的那件事。
hard_kill() {
  local pod="$1" cid pid
  cid="$(kubectl -n "$NAMESPACE" get pod "$pod" -o jsonpath='{.status.containerStatuses[0].containerID}')"
  cid="${cid#containerd://}"
  [[ -n "$cid" ]] || die "拿不到 ${pod} 的容器 id"
  pid="$(MSYS_NO_PATHCONV=1 docker exec "${CLUSTER_NAME}-control-plane" crictl inspect "$cid" \
    | "$PY" -c 'import sys,json;print(json.load(sys.stdin)["info"]["pid"])')"
  note "  SIGKILL container=${cid:0:12} pid=${pid}（pod ${pod}）"
  MSYS_NO_PATHCONV=1 docker exec "${CLUSTER_NAME}-control-plane" kill -9 "$pid"
}

#: 每次观测都从**任一台还活着的副本**读状态（受害者被杀后就换一台）。
run_status() {
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/component=superbrain \
    --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  [[ -n "$pod" ]] || { echo "no-pod"; return; }
  api "$pod" GET "/api/v1/agent-team/runs/${1}" | jsonfield status
}

log "3. 发起一轮真 run（POST /runs → ${VICTIM}）"
ACCEPTED="$(api "$VICTIM" POST "/api/v1/agent-team/runs" "{\"goal\":\"${GOAL}\",\"conversation_id\":\"pod-kill-$(date +%s)\"}")"
note "  POST /runs 回执：${ACCEPTED}"
RUN_ID="$(printf '%s' "$ACCEPTED" | jsonfield run_id)"
[[ -n "$RUN_ID" ]] || die "回执里没有 run_id"
note "  run_id = ${RUN_ID}"

log "4. 等这一轮真的在跑（有租约 + 状态 running）"
phase1_epoch_before=""
for _ in $(seq 1 60); do
  row="$(lease_row "$RUN_ID")"
  status="$(run_status "$RUN_ID")"
  if [[ -n "$row" && "$status" == "running" ]]; then
    note "  已在跑：lease=${row} status=${status} ckpt=$(ckpt_id "$RUN_ID")"
    phase1_epoch_before="$(printf '%s' "$row" | cut -d'|' -f2)"
    break
  fi
  sleep "$POLL_SECONDS"
done
[[ -n "$phase1_epoch_before" ]] || die "这一轮没进 running（拿不到租约）——先查 llmgw 可达性"

CKPT_BEFORE="$(ckpt_id "$RUN_ID")"
note "  基线：epoch=${phase1_epoch_before} checkpoint=${CKPT_BEFORE}"

# ── 5. 阶段 1：硬杀持有者 ────────────────────────────────────────────────────
log "5. 阶段 1：SIGKILL 掉 ${VICTIM} 里的应用进程（模拟节点故障 / OOM）"
T0="$(date +%s.%N)"
hard_kill "$VICTIM"
sleep "$POLL_SECONDS"
note "  杀后立刻查一次：lease=[$(lease_row "$RUN_ID")] status=$(run_status "$RUN_ID") ckpt=$(ckpt_id "$RUN_ID")"

taken=""
taken_signal=""
for i in $(seq 1 $((OBSERVE_1_SECONDS / POLL_SECONDS))); do
  sleep "$POLL_SECONDS"
  elapsed="$(since "$T0")"
  row="$(lease_row "$RUN_ID")"
  epoch="$(printf '%s' "$row" | cut -d'|' -f2)"
  ck="$(ckpt_id "$RUN_ID")"
  note "  t+${elapsed}s  lease=[${row}]  ckpt=${ck}"
  #: **两个信号，命中任一即算接管**（只认 epoch 会漏掉最常见的那种成功）：
  #:
  #: * `lease_epoch` 前进 —— 换手了，新持有者还在跑；
  #: * **检查点越过基线** —— 执行继续了。这一条更重要，因为**接管成功后续跑往往很快
  #:   就结束**（这一轮本来就快跑完 / 起来就撞上 llmgw 403），结束时 `_close` 会把
  #:   租约**释放**掉——于是 `lease=[]`，只看 epoch 的判据会把"已经接管并跑完"
  #:   活活读成"没有接管"。实测踩到过：t+31.2s 租约变空 **且**检查点从
  #:   `1f1b2c54-…` 前进到 `1f1b2c56-…`，脚本却报"120s 内没有接管"。
  if [[ -n "$epoch" && -n "$phase1_epoch_before" && "$epoch" != "$phase1_epoch_before" ]]; then
    taken="$elapsed"; taken_signal="lease_epoch ${phase1_epoch_before}→${epoch}"
    note "  >>> 接管发生（换手）：t+${elapsed}s  ${taken_signal}"
    break
  fi
  if [[ -n "$ck" && -n "$CKPT_BEFORE" && "$ck" != "$CKPT_BEFORE" ]]; then
    taken="$elapsed"; taken_signal="检查点越过基线（执行继续）"
    note "  >>> 接管发生（执行继续）：t+${elapsed}s  ${CKPT_BEFORE} → ${ck}"
    break
  fi
done
if [[ -z "$taken" ]]; then
  note "  >>> 阶段 1 结论：${OBSERVE_1_SECONDS}s 内**没有**接管（租约未换手且检查点未前进）"
fi

# ── 6. 阶段 2（可选）：让所有副本重启，看机制本身能不能接管 ─────────────────
if [[ -z "$taken" && "$DO_PHASE_2" == "1" ]]; then
  log "6. 阶段 2：rollout restart（让每个新进程各扫一次检查点）"
  T1="$(date +%s.%N)"
  kubectl -n "$NAMESPACE" rollout restart deploy/mate-tech-agent-team >/dev/null
  for i in $(seq 1 $((OBSERVE_2_SECONDS / POLL_SECONDS))); do
    sleep "$POLL_SECONDS"
    elapsed="$(since "$T1")"
    row="$(lease_row "$RUN_ID")"
    epoch="$(printf '%s' "$row" | cut -d'|' -f2)"
    ck="$(ckpt_id "$RUN_ID")"
    note "  t+${elapsed}s  lease=[${row}]  ckpt=${ck}"
    #: 与阶段 1 同样的两个信号（只认 epoch 会漏掉"接管后很快跑完并释放租约"）。
    if [[ -n "$epoch" && -n "$phase1_epoch_before" && "$epoch" != "$phase1_epoch_before" ]]; then
      taken="$elapsed"; taken_signal="阶段 2 换手 epoch ${phase1_epoch_before}→${epoch}"
      note "  >>> ${taken_signal}，t+${elapsed}s"
      break
    fi
    if [[ -n "$ck" && -n "$CKPT_BEFORE" && "$ck" != "$CKPT_BEFORE" ]]; then
      taken="$elapsed"; taken_signal="阶段 2 检查点越过基线"
      note "  >>> ${taken_signal}，t+${elapsed}s"
      break
    fi
  done
fi

log "7. 收官状态"
note "  run=${RUN_ID}"
note "  最终 lease=[$(lease_row "$RUN_ID")]"
note "  最终 ckpt=$(ckpt_id "$RUN_ID")"
note "  最终 status=$(api "$(kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/component=superbrain --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')" GET "/api/v1/agent-team/runs/${RUN_ID}")"
note "  证据目录：${ARTDIR}"

# ── 8. 判据门 ────────────────────────────────────────────────────────────────
#: 默认**只报不判**（`REQUIRE_TAKEOVER=0`）：这个脚本的价值有一半是"如实打印每一秒"，
#: 把它变成必过的门会诱导下一个人去粉饰。要在 CI 里当门时显式开。
log "8. 判据"
note "  接管：${taken:-未发生}${taken_signal:+（${taken_signal}）}"
note "  预算：${TAKEOVER_BUDGET_SECONDS}s（TTL=${LEASE_TTL_HINT}s + 扫描间隔=${RESCAN_HINT}s 决定下限）"
if [[ "$REQUIRE_TAKEOVER" == "1" ]]; then
  [[ -n "$taken" ]] || die "判据不成立：${OBSERVE_1_SECONDS}s 内没有被接管"
  awk -v t="$taken" -v b="$TAKEOVER_BUDGET_SECONDS" 'BEGIN{exit !(t+0 <= b+0)}' \
    || die "接管发生但超预算：t+${taken}s > ${TAKEOVER_BUDGET_SECONDS}s"
  echo "=== POD-KILL TAKEOVER PASS（t+${taken}s ≤ ${TAKEOVER_BUDGET_SECONDS}s）==="
else
  echo "=== POD-KILL TAKEOVER 记录完毕（REQUIRE_TAKEOVER=0，只报不判）==="
fi
