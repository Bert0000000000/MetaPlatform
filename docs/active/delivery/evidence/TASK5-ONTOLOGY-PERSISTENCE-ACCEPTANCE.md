# Task5 Ontology PostgreSQL Persistence — Local Acceptance

> 日期：2026-08-31
> 实现提交：`c9ffb44d14963ef3f661f7fe661c40dd1f651cd3`
> 结论：`[x] local Docker acceptance only`

## 验收范围

Task5 的 `mate-tech-ont` 在 Docker Compose 覆盖层中明确使用 v2 PostgreSQL
kernel。现有的 `ONT_SEED_DEMO=1` 幂等种子向 `metaplatform_ont` 写入语义对象
类型；本验收仅重建 ontology 服务，并比较重启前后的 PostgreSQL 对象类型数量。

使用的 Compose 组合为：

```text
docker-compose.yml
docker-compose.override.yml
docker-compose.task5.yml
docker-compose.acceptance.yml
```

## 执行证据

```text
pytest mate-platform-backend/packages/mate-tech-ont/tests/test_production_guards.py
2 passed in 9.40s

pwsh -NoProfile -File scripts/ci/task5_ontology_persistence_smoke.ps1
Task5 ontology persistence verified: 14 -> 14 object types
```

烟测在两次 `--force-recreate mate-tech-ont` 之间读取
`metaplatform_ont.ont_object_type`。两次读数均为 14，且服务在每次重建后健康。
容器的生效配置为 `KERNEL_BACKEND=pg`，并连接 Compose 内的
`metaplatform_ont` 数据库。

## 明确不覆盖的事项

本结果是 **local Docker acceptance only**，不证明真实 staging、PostgreSQL RLS
policy enforcement、外部 LLM providers、Sandbox L2 或 v1.0 GA。Task5 acceptance
profile 的 PostgreSQL 使用临时数据目录；本证据只证明同一 acceptance stack
生命周期内，ontology 服务重启不会丢失已写入的语义数据。
