# MP-SAL-03 ACCEPTANCE — Function 沙箱生产化（生产门）

> **Batch**: MP-SAL-03（Semantic layer AI Landing · 03 · 生产门，对位差距 G5）
> **日期**: 2026-08-17 · **分支**: `refactor/mp-sal-01`
> **ADR**: ADR-0040 §2.5（双轨）· spec v0.3 §4.2 SAL-03

## 1. 交付范围

| 项 | 落点 | 状态 |
|---|---|---|
| **K8s Job 真接（L2）** | `mate_kernel/sandbox/k8s.py` 新增 `K8sJobExecutor`：`K8sSandboxSpec` → batch/v1 Job manifest 渲染（ResourceLimits→Limits/activeDeadlineSeconds、backoffLimit=0、restartPolicy=Never、最小 serviceAccount、NetworkPolicy egress 白名单以注解携带对齐集群 default-deny）；经 `kubectl` 子进程零新依赖执行全生命周期 apply→wait→logs→delete（失败路径取日志、异常降级为执行失败、finally 必清理） | ✅ |
| **backend 开关** | `SANDBOX_BACKEND=k8s` 启用；默认 subprocess（dev 双轨，ADR-0040 §2.5.1 保持） | ✅ |
| **copilot 真鉴权** | 核实机制已完备：copilot `install_auth` 已装（SEC-IAM-01 规范中间件）；`mate_platform/auth/config.py:72-87` production profile 在 `LEGACY_LOGIN_COMPAT=false`（默认）时强制 KEYCLOAK_URL + SERVICE_CLIENT_SECRET，否则拒启（硬规则 5 guard）。**代码无缺口**；生产部署动作（Keycloak 接入配置）属部署 checklist | ✅（机制核实） |
| **L3 MicroVM** | 仍留 Marketplace 后续（ADR-0040 决策不变） | 出范围 |

## 2. 测试证据

`test_k8s_job_executor.py` 9 项全绿：manifest 映射（资源/deadline/restartPolicy/SA/egress 注解/源码内联）、fake-kubectl 全生命周期（apply→wait→logs→delete 时序断言）、apply 失败路径、Job 失败取日志、backend 开关（k8s 选中 / 默认仍 subprocess 双轨）。真集群执行用例由 `SANDBOX_BACKEND=k8s` + KUBECONFIG 的生产环境验证（本机无集群，CI 不 gate）。

既有 `test_execution_authenticity.py` 2 项按 ADR-0044 收紧语义更新（proposal_id 必须真实已确认——旧测试断言的是透传占位符，属 SAL-04 契约变更的合法回归更新）。

**全套：kernel 476 passed。**

## 3. 回滚方案（硬规则 8）

`SANDBOX_BACKEND` 单开关回滚：k8s 异常（集群不可达/镜像拉取失败）时 executor 返回执行失败（不抛出、不阻断服务），运维只需切回 `subprocess`（L1）即恢复 dev 语义；Job 自带 `ttlSecondsAfterFinished=600` 自动清理 + finally delete 兜底，无残留孤儿 Job。

## 4. 程序完成声明

**SAL-01 读 ✅ + SAL-02 想 ✅ + SAL-04 写 ✅（核心闭环）+ SAL-03 生产门 ✅ = MP-SAL 程序（spec §4.0 北极星）四批全部 Accepted。**
生产上线的部署面动作（K8s 集群接入、Keycloak 生产配置、pgvector 升级）按 `2026-08-17-ai-launch-prompt-mp-sal-program.md` §接力交接由部署流程承接。
