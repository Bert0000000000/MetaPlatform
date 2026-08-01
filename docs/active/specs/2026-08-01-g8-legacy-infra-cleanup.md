# G8 旧 infra 清理需求规范

> 版本:v1.0 · 2026-08-01
> 关联:`PROGRAM-BOARD.md` G8 项 + `architecture-implementation.md` §1.2 + `infra/helm/charts/`
> 状态:**Active**(供 P3-W12 code 模式做清理)
> 修订人:需求层(TRAE)

---

## 1. 背景与目标

### 1.1 背景

main 分支 `infra/` 下保留着 docker-compose 时代的**7 个旧配置目录**:

- `infra/otel/`
- `infra/prometheus/`
- `infra/grafana/`
- `infra/keycloak/` (与 helm chart 的 keycloak 配置并存)
- `infra/traefik/`
- `infra/lightrag/`
- `infra/promtail/`

这些目录**已经被 `infra/helm/` 下的 sub-chart 取代**(v3.0 PLATFORM-K8S-01 收口):

| 旧目录 | K8s 替代 | 状态 |
|---|---|---|
| `infra/otel/` | `infra/helm/charts/otel-collector/` | ✅ 真实化 |
| `infra/prometheus/` | `infra/helm/charts/prometheus/`(未来扩展)| 🟡 部分(目前靠 sub-chart 没建) |
| `infra/grafana/` | 同上 | 🟡 |
| `infra/keycloak/` | `infra/helm/charts/keycloak/`(helm chart) + `infra/keycloak/realm-mate.json` | 🟡 保留(配置源) |
| `infra/traefik/` | `infra/helm/charts/network-policies/`(替代部分) | 🟡 保留作为本地 dev |
| `infra/lightrag/` | (无 K8s 替代) | 🔴 旧 |
| `infra/promtail/` | 已被 OTel collector 包含 | 🔴 旧 |

### 1.2 目标

G8 = **清理 7 个旧目录**,统一到 helm chart 与 docker-compose profile:

- **删**:已被 K8s sub-chart 完全替代的旧目录
- **保留**:本地 dev 用的配置文件(docker-compose.override.yml 引用)
- **新增迁移路径**:删除前给出明确的迁移方案,避免误删

### 1.3 风险

- **误删本地 dev 配置**:docker-compose.override.yml 还引用部分旧目录
- **遗漏引用**:`scripts/` / `start-*.ps1` / `docker-compose.yml` 中可能有硬编码路径
- **CI 失效**:某些 workflow / 测试可能依赖旧目录

---

## 2. 清理决策矩阵(7 个目录)

### 决策原则

- **删**:完全被 K8s sub-chart 替代,无本地 dev 依赖
- **保留**:本地 docker-compose dev 还需要,或作为 helm chart 配置源
- **迁移**:从旧位置移到新位置(如 `infra/helm/charts/prometheus/`)

### 2.1 逐项决策

| # | 目录 | 当前用途 | 决策 | 理由 |
|---|---|---|---|---|
| 1 | `infra/otel/otel-collector.yaml` | OpenTelemetry collector 配置(已在 PLATFORM-K8S-01 被 `helm/charts/otel-collector/` 取代) | **删** | 已替代 |
| 2 | `infra/prometheus/prometheus.yml` | Prometheus 抓取配置 | **迁移** | 移到 `infra/helm/charts/prometheus/`,但 helm chart 还没建,先保留作为 dev 参考 |
| 3 | `infra/grafana/provisioning/` | Grafana 数据源 + dashboard 配置 | **迁移** | 移到 `infra/helm/charts/grafana/`,保留作为 dev 参考 |
| 4 | `infra/keycloak/realm-mate.json` | Keycloak realm 配置(被 helm chart 引用) | **保留** | helm chart 的 configmap 仍 mount 此文件 |
| 5 | `infra/traefik/dynamic.yml` + `certs/` | Traefik 动态配置 + 本地证书 | **保留** | docker-compose dev 仍用 Traefik |
| 6 | `infra/lightrag/Dockerfile` | LightRAG 容器镜像 | **删** | mate-tech-rag 客户端已使用 httpx 直接对接,不需要这个 Dockerfile |
| 7 | `infra/promtail/promtail-config.yml` | Promtail 日志收集配置 | **删** | OTel collector 已包含日志收集 |

### 2.2 总结

| 操作 | 数量 | 目录 |
|---|---:|---|
| 删 | 3 | `infra/otel/`、`infra/lightrag/`、`infra/promtail/` |
| 迁移 | 2 | `infra/prometheus/` → `infra/helm/charts/prometheus/`、`infra/grafana/` → `infra/helm/charts/grafana/` |
| 保留 | 2 | `infra/keycloak/`(realm 配置源)、`infra/traefik/`(本地 dev) |

---

## 3. 引用关系梳理(避免误删)

### 3.1 现有引用

```
docker-compose.yml
  ├── infra/otel/otel-collector.yaml           (被 prometheus 用作 scrape)
  ├── infra/prometheus/prometheus.yml            (直接 mount)
  ├── infra/grafana/provisioning/              (直接 mount)
  ├── infra/keycloak/realm-mate.json           (mount 到 keycloak 容器)
  ├── infra/traefik/dynamic.yml                (mount 到 traefik 容器)
  ├── infra/traefik/certs/                      (mount 到 traefik 容器)
  ├── infra/lightrag/Dockerfile                (build 引用)
  └── infra/init-multiple-databases.sql        (创建多 schema)

scripts/:
  ├── start-dev.ps1                              (引用 docker-compose.override.yml)
  ├── start-tech-services.ps1                     (无 infra/ 引用)
  ├── start-dashboard-dev.ps1                    (无 infra/ 引用)
  ├── start-swagger.ps1                           (无 infra/ 引用)
  └── build-all-7.bat / build-services.bat        (build 引用)
```

### 3.2 引用清理表

| 目录 | 引用点 | 清理后操作 |
|---|---|---|
| `infra/otel/otel-collector.yaml` | `docker-compose.yml` 的 prometheus scrape_config | **删 yaml 文件 + 删 docker-compose 中的引用** |
| `infra/prometheus/prometheus.yml` | `docker-compose.yml` mount + `scripts/build-services.bat` | **保留文件,只更新 mount**(待 helm chart 接管) |
| `infra/grafana/provisioning/` | `docker-compose.yml` mount | **保留目录,只更新 mount** |
| `infra/keycloak/realm-mate.json` | `docker-compose.yml` + `infra/helm/charts/keycloak/values.yaml` | **保留(被 helm 引用)** |
| `infra/traefik/dynamic.yml` + `certs/` | `docker-compose.yml` mount | **保留(本地 dev)** |
| `infra/lightrag/Dockerfile` | (无外部引用)| **删文件** |
| `infra/promtail/promtail-config.yml` | (无外部引用,OTel 已替代)| **删文件** |

---

## 4. 实施步骤(给 code 模式)

### 步骤 1:依赖引用扫描

```bash
# 在 main 分支根目录
grep -rn "infra/otel" infra/helm/ docker-compose.yml scripts/ || true
grep -rn "infra/lightrag" infra/helm/ docker-compose.yml scripts/ || true
grep -rn "infra/promtail" infra/helm/ docker-compose.yml scripts/ || true
grep -rn "infra/prometheus" infra/helm/ docker-compose.yml scripts/ | head
grep -rn "infra/grafana" infra/helm/ docker-compose.yml scripts/ | head
```

### 步骤 2:删除 3 个旧目录

```bash
git rm -r infra/otel/
git rm -r infra/lightrag/
git rm -r infra/promtail/

# 检查 docker-compose.yml 中相关 mount / scrape_config 引用
# 删除对应行
```

### 步骤 3:更新 docker-compose.yml

- 删除 `infra/otel/otel-collector.yaml` 引用
- 保留 `infra/prometheus/prometheus.yml` 和 `infra/grafana/provisioning/` mount(带 `# TODO: 迁移到 helm chart` 注释)

### 步骤 4:更新 .gitignore

`infra/prometheus/prometheus.yml` 与 `infra/grafana/provisioning/` 保留但**不再被 docker-compose 用**,可考虑 gitignore,但目前**保守保留**(避免误删)

### 步骤 5:更新 docs/

- `architecture-implementation.md` §1.2 服务全景表:删除 `infra/otel` / `infra/lightrag` / `infra/promtail` 行
- `PROGRAM-BOARD.md` G8 状态:Not Started → Accepted

### 步骤 6:更新 PROFILES.md

移除对 otel / lightrag / promtail 的引用

---

## 5. 验收标准

### 5.1 必须通过的验证

| 验证项 | 工具 | 标准 |
|---|---|---|
| 旧目录已删 | `ls infra/otel infra/lightrag infra/promtail` | 目录不存在 |
| docker-compose 启动 | `docker compose --profile infra up -d` | exit 0,服务起来 |
| helm chart 启动 | `helm install test infra/helm/umbrella/` | exit 0 |
| Keycloak realm 启动 | helm + Keycloak 真实启动 | exit 0 |
| 全后端回归 | `pytest packages/` | 通过 |
| infra 测试 | `pytest infra/tests/` | 通过(122 → 119 tests,删 3 个对应) |
| ruff + pyright | CI | 通过 |

### 5.2 不应存在的回归

- 任何 workflow / 测试不应引用 `infra/otel` / `infra/lightrag` / `infra/promtail`
- `docker-compose.yml` 不应再有这些路径的 mount

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 本地 dev 启动失败 | docker-compose 找不到配置 | 步骤 3 同步更新 docker-compose.yml |
| helm chart 缺 Prometheus 配置 | staging 集群无 Prometheus | 步骤 2 / 步骤 3 保守保留 + 标注 TODO |
| 删除错文件 | 误删有用配置 | 步骤 1 扫描 + 步骤 2 三重确认 + git revert 预案 |
| CI workflow 引用 | CI 失败 | grep 扫描所有 .yml |
| 其他模块依赖 | 不可知 | 步骤 5 docs 同步更新 |

---

## 7. 后续 PR 计划

```
PR #N (P3-W12 — G8):
  - 删:   infra/otel/ (1 文件)
  - 删:   infra/lightrag/ (1 文件)
  - 删:   infra/promtail/ (1 文件)
  - 改:   docker-compose.yml (删 3 处引用)
  - 改:   docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md (§1.2 表格删 3 行)
  - 改:   docs/active/specs/PROFILES.md (移除对 otel/lightrag/promtail 的引用)
  - 改:   docs/active/delivery/PROGRAM-BOARD.md (G8 状态 Not Started → Accepted)
  - 验证: docker compose --profile infra up -d / pytest infra/tests / helm install
```

---

## 8. 关联文档

- `architecture-implementation.md` §1.2 — 服务全景表
- `PROFILES.md` — 启动 profile
- `PROGRAM-BOARD.md` — G8 状态
- `infra/helm/charts/` — K8s 替代
- `infra/tests/` — 测试套

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-01 | v1.0 初版(3 删 + 2 迁移 + 2 保留 + 实施步骤 + 验收) | 需求层(TRAE) |