# GOVERN-09 — Helm + NetworkPolicy + OTel 一致性 子规格

> 编制日期：2026-08-10
> 工作目录：`D:\Hermes\10_Projects\2026-07-02-MetaPlatform\infra\helm`
> 父计划：`cozy-orbiting-wombat.md §3.3 GOVERN-09`
> 上游：GOVERN-07 ✅ + GOVERN-08 ✅
> 下游：GOVERN-10（13 硬规则 × CI 矩阵收口）

---

## 0. 与父计划偏差修订

父计划 §GOVERN-09 列了 4 大块 + 4 项验收。本批次开局实地盘点
`infra/helm/` 后，发现 4 处与原计划不符的事实，先以本子规格为准：

| 原计划条目 | 实地状态 | 修订 |
|---|---|---|
| D1 "12 sub-charts 无 templates/，helm install 失败" | 17 sub-charts **全部** 已含 `templates/`（最少 2 个，最多的 9 个） | 不再"补 12 chart templates"。Chart.yaml `dependencies` 块亦已含 17 个 entry，与磁盘一致 |
| D2 "6 套 values，实际 4 套" | 5 套：`values.yaml`（默认）+ `values-local.yaml` + `values-staging.yaml` + `values-production.yaml` + `.helmignore` | 修订为「5 套 values」，CLAUDE.md "6 套" 表述删 |
| D3 "NP 仅覆盖 4 类" | NP 已覆盖 6 类：default-deny (ingress+egress) / allow-keycloak / allow-otel / allow-dataplane / allow-dns / allow-ingress | 不再"补 21 服务 NP"。`service-templates` 是 library chart，无独立 deployment；per-service NP 需 app chart 改造，超出本批次范围 |
| D4 "OTel compose ≠ Helm" | `service-templates/values.yaml` 已有 `otel.sidecar.enabled=true`，但 `_helpers.tpl` **无 OTel env block** | 改为 `_helpers.tpl` 加 `service-templates.otelEnv` 块 |

> 修订理由：先把"事实是什么"对齐到代码，再讨论"做什么"。下文动作
> 与验收按修订后口径写。

---

## 1. 现状快照（2026-08-10）

### 1.1 umbrella Chart.yaml dependencies（17 个）

```
otel-collector / postgresql / keycloak / network-policies /
service-templates / kafka / debezium / marquez / datahub / ge /
paimon / iceberg / trino / starrocks / marketplace /
deerflow-engine / observability-alerts
```

### 1.2 infra/tests 已知 1 个失败

```
test_chart_structure.py::TestUmbrellaChartYaml::test_dependencies_present FAILED
  AssertionError: expected {14 names}, got {17 names}
  Extra items in the left set: 'marketplace', 'deerflow-engine', 'observability-alerts'
```

测试硬编码 14 name set，对 umbrella "等于" 比对；新加 3 chart 后失败。
这是测试逻辑 bug，不是 chart 缺失。

### 1.3 17 sub-charts 模板文件数

| chart | templates 数 | 备注 |
|---|---:|---|
| datahub | 9 | |
| debezium | 6 | |
| deerflow-engine | 5 | |
| ge | 5 | |
| iceberg | 6 | |
| kafka | 7 | |
| keycloak | 3 | |
| marketplace | 6 | |
| marquez | 6 | |
| **network-policies** | **6** | default-deny (ingress+egress) + allow-{keycloak,otel,dataplane,dns,ingress} |
| observability-alerts | 2 | |
| otel-collector | 5 | configmap + deployment + service + servicemonitor + networkpolicy |
| paimon | 6 | |
| postgresql | **7** | GOVERN-06 加了 postgresql-config + statefulset volumeMount |
| **service-templates** | **1** | 仅 `_helpers.tpl`（25 行 library chart，无 deployment） |
| starrocks | 7 | |
| trino | 7 | |

### 1.4 service-templates/_helpers.tpl

25 行，含 `podSecurityContext` + `containerSecurityContext` 两个 helper。
**无 OTel env helper**，无 sidecar container 定义。
`values.yaml` 已有 `defaults.otel.sidecar.enabled=true`，但 template 无消费。

---

## 2. 动作范围（修订后）

### 09-01 修测试 bug：test_chart_structure.py 接受"超集"

把硬编码 `REQUIRED_SUB_CHARTS = {14 names}` 改为：

```python
def test_dependencies_present(self, helm_dir: Path) -> None:
    data = yaml.safe_load((helm_dir / "Chart.yaml").read_text(encoding="utf-8"))
    deps = data.get("dependencies", [])
    names = {d["name"] for d in deps}
    missing = REQUIRED_SUB_CHARTS - names
    assert not missing, f"umbrella Chart.yaml missing required deps: {missing}"
    # Subset check only — extra charts (marketplace / deerflow-engine /
    # observability-alerts) are intentionally part of the umbrella.
```

### 09-02 service-templates/_helpers.tpl 加 OTel env helper

```yaml
{{- define "service-templates.otelEnv" -}}
- name: OTEL_SERVICE_NAME
  value: {{ .Chart.Name }}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.defaults.otel.exporterEndpoint | default "http://otel-collector:4317" }}
- name: OTEL_RESOURCE_ATTRIBUTES
  value: {{ .Values.defaults.otel.resourceAttributes | default "service.name=$(OTEL_SERVICE_NAME)" }}
- name: OTEL_TRACES_SAMPLER
  value: {{ .Values.defaults.otel.sampler | default "parentbased_traceidratio" }}
- name: OTEL_TRACES_SAMPLER_ARG
  value: {{ .Values.defaults.otel.samplerArg | default "0.1" | quote }}
- name: OTEL_METRICS_EXPORTER
  value: {{ .Values.defaults.otel.metricsExporter | default "otlp" }}
- name: OTEL_LOGS_EXPORTER
  value: {{ .Values.defaults.otel.logsExporter | default "otlp" }}
{{- end -}}
```

`values.yaml` 同步加：

```yaml
defaults:
  otel:
    sidecar:
      enabled: true
    exporterEndpoint: "http://otel-collector:4317"
    resourceAttributes: "service.name=$(OTEL_SERVICE_NAME)"
    sampler: "parentbased_traceidratio"
    samplerArg: "0.1"
    metricsExporter: "otlp"
    logsExporter: "otlp"
```

（不实际注入到 deployment — `service-templates` 无 deployment template。
helper 就位 + values 就位即可；per-app chart 调用 helper 是各 app chart
作者的责任，超出本批次。）

### 09-03 新增 test_otl_np_coverage.py

`infra/tests/test_otl_np_coverage.py` 静态校验：
1. `network-policies` 6 个 template 全部存在
2. `service-templates/_helpers.tpl` 含 `otelEnv` helper
3. `service-templates/values.yaml` 含 `exporterEndpoint` 默认
4. `infra/helm/values-production.yaml` 不覆盖 `rowSecurity` 为 `off`
   （守住 GOVERN-06 PG RLS 默认）

### 09-04 CLAUDE.md "6 套 values" 表述修正

`D:\Hermes\10_Projects\2026-07-02-MetaPlatform\CLAUDE.md` 顶部"当前架构版本"
段附近 `grep "6 套" CLAUDE.md`，把"6 套环境 values"改成"5 套 values
（默认 + local + staging + production + .helmignore）"。

---

## 3. 验收标准

| # | 检查 | 命令 | 期望 |
|---|---|---|---|
| 1 | umbrella deps 完整 | `pytest infra/tests/test_chart_structure.py::TestUmbrellaChartYaml::test_dependencies_present -v` | PASS |
| 2 | 全套 infra/tests | `pytest infra/tests -q` | 全 PASS（≥105 + 现有失败修复） |
| 3 | OTel helper | `grep -A1 "otelEnv" infra/helm/charts/service-templates/templates/_helpers.tpl` | ≥1 命中 |
| 4 | OTel values | `grep exporterEndpoint infra/helm/charts/service-templates/values.yaml` | ≥1 命中 |
| 5 | NP 6 件齐 | `ls infra/helm/charts/network-policies/templates/` | 6 个 yaml |
| 6 | CLAUDE.md 修字 | `grep "6 套" CLAUDE.md` | 0 命中 |
| 7 | otl_np_coverage | `pytest infra/tests/test_otl_np_coverage.py -v` | 全 PASS |

---

## 4. 风险

| 风险 | 触发 | 缓解 |
|---|---|---|
| 改 `_helpers.tpl` 影响其他 chart | helper 名冲突 | 命名加 `service-templates.` 前缀；helper 已用此约定 |
| helm render CI 阻塞 | 测试改了 Chart.yaml 后别人忘了 helm dep update | 本批次不动 dependencies，只改测试断言 |
| CLAUDE.md 改字漏行 | 文件大 | grep 验证后再 diff |

---

## 5. 提交策略

Conventional Commits；2 个 commit：

```
test(helm): GOVERN-09-01 test_chart_structure dependency subset check
refactor(helm): GOVERN-09-02 service-templates OTel env helper + values
docs(governance): GOVERN-09-04 CLAUDE.md values 数量 + Board 标 Accepted
```

证据：`docs/active/delivery/evidence/GOVERN-09-SUBSPEC.md`（本文件）。

---

## 6. 不在本批次

- 21 服务 per-app chart NP（需新建 app-* chart，超出范围）
- 真实 OTLP 数据流验证（需 docker daemon + otel-collector 跑）
- helm-docs 同步（GOVERN-01 已收口）
- helm unittest（CI 范畴，GOVERN-10 处理）