# W5-4 子任务卡（ST）：tech-ont（本体服务）

> **源任务卡**：[tasks-W5.md § W5-4](./2026-07-27-mate-platform-tasks-W5.md#w5-4-tech-ont本体12-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S6（2026-09-14 ~ 2026-09-27）
> **里程碑**：M3 关键路径
> **ST 总数**：31（拆解自 12 个 TC） — 2026-07-28 完成 31 ST (100%) ✅
> **粒度**：0.5-4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.4.1 apps/tech-ont 初始化（2 ST）](#tc-541-appstech-ont-初始化2-st)
- [TC-5.4.2 Neo4j GraphRepository 实现（4 ST）](#tc-542-neo4j-graphrepository-实现4-st)
- [TC-5.4.3 本体管理 OpenAPI（4 ST）](#tc-543-本体管理-openapi4-st)
- [TC-5.4.4 SPARQL 端点（3 ST）](#tc-544-sparql-端点3-st)
- [TC-5.4.5 explain 端点（2 ST）](#tc-545-explain-端点2-st)
- [TC-5.4.6 OWL 2 导入导出（3 ST）](#tc-546-owl-2-导入导出3-st)
- [TC-5.4.7 实例管理（3 ST）](#tc-547-实例管理3-st)
- [TC-5.4.8 版本管理（2 ST）](#tc-548-版本管理2-st)
- [TC-5.4.9 双写策略（2 ST）](#tc-549-双写策略2-st)
- [TC-5.4.10 全文检索集成（2 ST）](#tc-5410-全文检索集成2-st)
- [TC-5.4.11 权限与租户隔离（2 ST）](#tc-5411-权限与租户隔离2-st)
- [TC-5.4.12 单测 + 集成（2 ST）](#tc-5412-单测--集成2-st)
- [完成度检查表](#完成度检查表)

---
### TC-5.4.1 apps/tech-ont 初始化（2 ST）

#### ST-5.4.1.1 apps/tech-ont pyproject + Dockerfile

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/pyproject.toml、Dockerfile |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(ont): scaffold |

**改动清单**：
1. uv init --package tech-ont
2. 加 fastapi、uvicorn、pydantic、neo4j、rdflib、owlready2

**DoD**：
- [ ] uv sync 成功

---

#### ST-5.4.1.2 main.py + /healthz + docker-compose

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.1 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/main.py、docker-compose.yml |
| 前置 ST | ST-5.4.1.1 |
| 输出 commit | feat(ont): main+compose |

**改动清单**：
1. FastAPI app + `/healthz`
2. docker-compose 加 tech-ont（端口 8007）

**DoD**：
- [ ] /healthz 200

---
### TC-5.4.2 Neo4j GraphRepository 实现（4 ST）

#### ST-5.4.2.1 节点 CRUD 实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.2 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/repos/neo4j_repo.py |
| 前置 ST | TC-2.1.3、TC-2.3.5 |
| 输出 commit | feat(ont): node crud |

**改动清单**：
1. `create_node(label, props)` / `get_node(id)` / `update_node(id, props)` / `delete_node(id)`

**DoD**：
- [ ] pyright strict 通过

---

#### ST-5.4.2.2 边 CRUD 实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/repos/neo4j_repo.py |
| 前置 ST | ST-5.4.2.1 |
| 输出 commit | feat(ont): edge crud |

**改动清单**：
1. `create_edge(type, src, dst, props)` / `get_edge(id)` / `delete_edge(id)`

**DoD**：
- [ ] pyright strict 通过

---

#### ST-5.4.2.3 简单查询 find_path

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/repos/neo4j_repo.py |
| 前置 ST | ST-5.4.2.2 |
| 输出 commit | feat(ont): find_path |

**改动清单**：
1. `find_path(src, dst, max_depth=5) -> list[Path]`

**DoD**：
- [ ] pyright strict 通过

---

#### ST-5.4.2.4 GraphRepository 单测 + 集成测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_neo4j_repo.py |
| 前置 ST | ST-5.4.2.3 |
| 输出 commit | test(ont): neo4j repo |

**改动清单**：
1. 单测：mock driver
2. 集成：testcontainers Neo4j

**DoD**：
- [ ] 单测 + 集成测试均绿

---
### TC-5.4.3 本体管理 OpenAPI（4 ST）

#### ST-5.4.3.1 ontologies CRUD 端点（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/ontologies.py |
| 前置 ST | TC-1.5.2、TC-5.4.2 |
| 输出 commit | feat(ont): ontologies api |

**改动清单**：
1. POST / GET / PUT / DELETE `/api/v1/ont/ontologies`

**DoD**：
- [ ] swagger-ui 列出 4 端点

---

#### ST-5.4.3.2 classes CRUD 端点（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/classes.py |
| 前置 ST | ST-5.4.3.1 |
| 输出 commit | feat(ont): classes api |

**改动清单**：
1. POST / GET / PUT / DELETE `/api/v1/ont/classes`

**DoD**：
- [ ] swagger-ui 列出 4 端点

---

#### ST-5.4.3.3 properties 端点（4 端点）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/properties.py |
| 前置 ST | ST-5.4.3.2 |
| 输出 commit | feat(ont): properties api |

**改动清单**：
1. POST / GET / PUT / DELETE `/api/v1/ont/properties`

**DoD**：
- [ ] swagger-ui 列出 4 端点

---

#### ST-5.4.3.4 本体管理 API 端到端测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_ontology_api.py |
| 前置 ST | ST-5.4.3.3 |
| 输出 commit | test(ont): api ontology |

**改动清单**：
1. 8 端点端到端
2. swagger-ui "Try it out" 跑通

**DoD**：
- [ ] 端到端通过

---
### TC-5.4.4 SPARQL 端点（3 ST）

#### ST-5.4.4.1 SPARQL → Cypher 转换器

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.4 |
| 工时 | 2.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/sparql/cypher.py |
| 前置 ST | TC-5.4.2 |
| 输出 commit | feat(ont): sparql->cypher |

**改动清单**：
1. SPARQL SELECT 子集解析
2. 输出 Cypher

**DoD**：
- [ ] SELECT 子集转换正确

---

#### ST-5.4.4.2 /api/v1/ont/sparql 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/sparql.py |
| 前置 ST | ST-5.4.4.1 |
| 输出 commit | feat(ont): sparql endpoint |

**改动清单**：
1. SELECT/INSERT/DELETE 三类型路由

**DoD**：
- [ ] 3 类型支持

---

#### ST-5.4.4.3 SPARQL 单元 + 集成测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.4 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_sparql.py |
| 前置 ST | ST-5.4.4.2 |
| 输出 commit | test(ont): sparql |

**改动清单**：
1. SELECT 转换测试
2. INSERT/DELETE 集成测试（Neo4j）

**DoD**：
- [ ] 单元 + 集成均绿

---
### TC-5.4.5 explain 端点（2 ST）

#### ST-5.4.5.1 /api/v1/ont/explain 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/explain.py |
| 前置 ST | TC-5.4.4 |
| 输出 commit | feat(ont): explain |

**改动清单**：
1. 接 SPARQL → 转 Cypher → 调 PROFILE

**DoD**：
- [ ] 返回执行计划 + 估计成本

---

#### ST-5.4.5.2 explain 测试 + 示例

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.5 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_explain.py |
| 前置 ST | ST-5.4.5.1 |
| 输出 commit | test(ont): explain |

**改动清单**：
1. 示例 SPARQL → 验证返回 PROFILE

**DoD**：
- [ ] 返回 Cypher PROFILE 信息

---
### TC-5.4.6 OWL 2 导入导出（3 ST）

#### ST-5.4.6.1 OWL 导入：RDF/XML 解析

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.6 |
| 工时 | 2.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/owl/importer.py |
| 前置 ST | TC-5.4.3 |
| 输出 commit | feat(ont): owl import |

**改动清单**：
1. 用 rdflib 解析 RDF/XML
2. 映射到 Neo4j

**DoD**：
- [ ] 解析逻辑完整

---

#### ST-5.4.6.2 /api/v1/ont/import-owl + /export-owl 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.6 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/owl.py |
| 前置 ST | ST-5.4.6.1 |
| 输出 commit | feat(ont): owl io api |

**改动清单**：
1. POST import-owl + GET export-owl

**DoD**：
- [ ] 端点工作

---

#### ST-5.4.6.3 wine 本体 roundtrip 测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.6 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_owl_io.py、tests/fixtures/wine.owl |
| 前置 ST | ST-5.4.6.2 |
| 输出 commit | test(ont): owl roundtrip |

**改动清单**：
1. 导入 wine → 导出 → 字节比对（除 blank node）

**DoD**：
- [ ] roundtrip 通过

---
### TC-5.4.7 实例管理（3 ST）

#### ST-5.4.7.1 instances CRUD + schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/instances.py |
| 前置 ST | TC-5.4.3 |
| 输出 commit | feat(ont): instances api |

**改动清单**：
1. `/api/v1/ont/instances` CRUD

**DoD**：
- [ ] swagger-ui 列出

---

#### ST-5.4.7.2 relations CRUD

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.7 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/relations.py |
| 前置 ST | ST-5.4.7.1 |
| 输出 commit | feat(ont): relations api |

**改动清单**：
1. `/api/v1/ont/relations` CRUD

**DoD**：
- [ ] swagger-ui 列出

---

#### ST-5.4.7.3 实例管理单测 + 集成

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.7 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_instances.py |
| 前置 ST | ST-5.4.7.2 |
| 输出 commit | test(ont): instances |

**改动清单**：
1. 单测 + 集成（真 Neo4j）

**DoD**：
- [ ] 单测 + 集成均绿

---
### TC-5.4.8 版本管理（2 ST）

#### ST-5.4.8.1 ontology 多版本实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.8 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/repos/neo4j_repo.py |
| 前置 ST | TC-5.4.3 |
| 输出 commit | feat(ont): versioning |

**改动清单**：
1. CRUD 端点带 `version` 参数
2. 同 ontology_id 多个 version 隔离

**DoD**：
- [ ] 多 version 互不干扰

---

#### ST-5.4.8.2 版本隔离测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.8 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_versioning.py |
| 前置 ST | ST-5.4.8.1 |
| 输出 commit | test(ont): versioning |

**改动清单**：
1. 同 id 不同 version 验证

**DoD**：
- [ ] 隔离测试通过

---
### TC-5.4.9 双写策略（2 ST）

#### ST-5.4.9.1 CRUD 双写 PG + Neo4j + 事务

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.9 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/api/dual.py |
| 前置 ST | TC-5.4.3 |
| 输出 commit | feat(ont): dual write |

**改动清单**：
1. CRUD 同时写 PG 元数据 + Neo4j 关系
2. 失败回滚（先 Neo4j 再 PG）

**DoD**：
- [ ] Neo4j 故障时 PG 也不写

---

#### ST-5.4.9.2 双写失败回滚测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.9 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_dual_write.py |
| 前置 ST | ST-5.4.9.1 |
| 输出 commit | test(ont): dual write |

**改动清单**：
1. mock Neo4j 故障 → 验证 PG 没写

**DoD**：
- [ ] 回滚逻辑工作

---
### TC-5.4.10 全文检索集成（2 ST）

#### ST-5.4.10.1 PG tsvector 模糊搜索实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.10 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/search/fulltext.py |
| 前置 ST | TC-5.4.3 |
| 输出 commit | feat(ont): full text |

**改动清单**：
1. tsvector 列 + GIN 索引
2. 中文 + 英文模糊搜索

**DoD**：
- [ ] 1000 实例下查询 < 100ms

---

#### ST-5.4.10.2 全文检索单测 + 性能

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.10 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_fulltext.py |
| 前置 ST | ST-5.4.10.1 |
| 输出 commit | test(ont): full text |

**改动清单**：
1. 中文 + 英文关键词搜索
2. 性能基准

**DoD**：
- [ ] 性能达标

---
### TC-5.4.11 权限与租户隔离（2 ST）

#### ST-5.4.11.1 X-Tenant-Id 强制 + 403

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.11 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-ont/src/tech_ont/deps.py |
| 前置 ST | TC-3.3.5、TC-5.4.3 |
| 输出 commit | feat(ont): tenant |

**改动清单**：
1. 所有 CRUD 强制带 `X-Tenant-Id`
2. 跨租户访问 → 403

**DoD**：
- [ ] 强制 header

---

#### ST-5.4.11.2 跨租户单测

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.11 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/test_tenant.py |
| 前置 ST | ST-5.4.11.1 |
| 输出 commit | test(ont): tenant |

**改动清单**：
1. 跨租户 unit test 全 403

**DoD**：
- [ ] 跨租户 403

---
### TC-5.4.12 单测 + 集成（2 ST）

#### ST-5.4.12.1 tests/conftest.py fixtures

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.12 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/conftest.py |
| 前置 ST | TC-5.4.1 ~ TC-5.4.11 |
| 输出 commit | test(ont): conftest |

**改动清单**：
1. neo4j_driver + pg fixtures

**DoD**：
- [ ] fixtures 可复用

---

#### ST-5.4.12.2 覆盖率 ≥80% + CI 绿

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.4.12 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-ont/tests/ |
| 前置 ST | ST-5.4.12.1 |
| 输出 commit | test(ont): full suite |

**改动清单**：
1. 补齐缺失测试

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

## W5-4 完成度检查表

| 子领域 | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|
| W5-4 tech-ont | **是** | 12 | 31 | ~52h | 🟢 31/31 完成 (100%) ✅ |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-4 TC（12 条）拆出 ST（31 条） | 单回合执行避免 Token 超限 |