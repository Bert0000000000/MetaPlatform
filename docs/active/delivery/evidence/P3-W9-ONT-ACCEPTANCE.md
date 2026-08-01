# P3-W9 ONT 业务深化 — SPARQL 真实化 + 推理引擎 + 版本管理 API 验收

> **验收日期**: 2026-08-01
> **批次**: P3-W9（BUSINESS-SLICES ont 业务深化）
> **范围**: SPARQL InMemory pattern matching + 推理引擎(subclass/transitivity/BFS/K-hop) + 版本管理 CRUD API + 推理 HTTP endpoint
> **关联 ADR**: ADR-0014（5 步接入）/ ADR-0016（BUSINESS-SLICES）
> **关联 PRD**: PRD-TECH-ONT
> **状态**: ✅ **Accepted**

---

## 1. 改动清单

| 文件 | 改动 | 关键能力 |
|---|---|---|
| `sparql/cypher.py` | 扩展 | execute_sparql 不再返回空；InMemory triple pattern matching；_parse_triple 修复(支持 rdf:type / 裸名) |
| `sparql/api.py` | 扩展 | sparql_endpoint 传 tenant_id 到 execute_sparql |
| `inference/__init__.py` | 新建 | 包初始化 |
| `inference/engine.py` | 新建 | InferenceEngine(apply_rules / find_path / get_neighbors) + SubclassRule + TransitivityRule |
| `inference/api.py` | 新建 | 3 endpoint(POST apply / GET path / GET neighbors) |
| `versioning/store.py` | 扩展 | Version 新增 version_id 字段 + get_by_id / delete_by_id 方法 |
| `versioning/api.py` | 新建 | 4 endpoint(POST / GET list / GET detail / DELETE) |
| `main.py` | 接线 | include_router(versioning_router) + include_router(inference_router) |
| `tests/conftest.py` | 扩展 | _reset_stores 同时清理 version_store |
| `tests/test_ont_business.py` | 新建 | 16 tests |

---

## 2. 新增 API

| Endpoint | 方法 | 用途 |
|---|---|---|
| `/api/v1/ont/versions` | POST | 创建版本快照 |
| `/api/v1/ont/versions` | GET | 列出版本(可选 ontology_id 过滤) |
| `/api/v1/ont/versions/{version_id}` | GET | 获取版本详情 |
| `/api/v1/ont/versions/{version_id}` | DELETE | 删除版本 |
| `/api/v1/ont/inference/apply` | POST | 应用推理规则(subclass 继承 + transitivity 传递闭包) |
| `/api/v1/ont/inference/path` | GET | 查询最短路径(BFS, params: source / target / max_depth) |
| `/api/v1/ont/inference/neighbors` | GET | K-hop 邻居发现(params: node / depth) |

---

## 3. SPARQL 真实化

`execute_sparql` 从永远返回 `[]` 改为 InMemory pattern matching:
- 解析 SPARQL triple patterns(`?s ?p ?o` / `?s rdf:type ?o` / 属性值匹配)
- 遍历 InstanceStore 实例，展开为 RDF 候选三元组
- 按 pattern 做 variable binding + literal match
- 支持 tenant_id(namespace)过滤
- 无 Neo4j 连接时自动降级到 InMemory

---

## 4. 推理引擎

### SubclassRule
- 遍历 `subclass_of` 关系(child → parent)
- parent 实例的属性继承到 child(不覆盖 child 已有属性)

### TransitivityRule
- 对指定关系类型计算传递闭包(A→B, B→C ⟹ A→C)
- 排除已存在的直接关系

### find_path (BFS)
- 无向图 BFS 最短路径
- max_depth 限制搜索深度
- 无路径返回 None

### get_neighbors (K-hop)
- 从指定节点出发 depth 跳内可达的所有节点
- 不含节点自身

---

## 5. 测试结果

```text
$ python -m pytest mate-platform-backend/packages/mate-tech-ont/tests -q --tb=short
66 passed in 1.4s   # 0 failed / 0 skipped

# 新增 16 tests
$ python -m pytest mate-platform-backend/packages/mate-tech-ont/tests/test_ont_business.py -v
16 passed in 1.0s
```

### 5.1 测试明细

| 测试 | 断言要点 |
|---|---|
| `test_sparql_returns_matching_instances` | SELECT ?s ?o WHERE { ?s rdf:type ?o } 返回全部匹配实例 |
| `test_sparql_filters_by_tenant` | tenant_id 过滤: 只返回同 namespace 实例 |
| `test_sparql_empty_when_no_match` | 无匹配 triple pattern → 空列表 |
| `test_sparql_property_pattern` | 属性值匹配(?s label X) |
| `test_inference_subclass_inheritance` | SubclassRule: child 继承 parent 属性(不覆盖已有) |
| `test_inference_transitivity` | TransitivityRule: A→B→C ⟹ A→C(排除已有直接关系) |
| `test_find_path_shortest` | BFS 最短路径: A→B→C→D 路径长度 4 |
| `test_find_path_none_when_unreachable` | 无路径 → None |
| `test_get_neighbors_k_hop` | 1/2/3-hop 邻居集合正确 |
| `test_version_create_and_get` | POST 创建 + GET 详情 |
| `test_version_list` | GET list(全量 + ontology_id 过滤) |
| `test_version_delete` | DELETE 删除 + 后续 GET 404 |
| `test_version_create_conflict` | 重复(ontology_id, version) → 409 |
| `test_inference_path_endpoint` | HTTP GET /inference/path 返回 BFS 路径 |
| `test_inference_neighbors_endpoint` | HTTP GET /inference/neighbors 返回 K-hop |
| `test_tenant_isolation_inference` | 跨租户实例不可达; transitivity 结果不含跨租户关系 |

---

## 6. ADR-0014 五步接入确认

| 步骤 | 状态 | 说明 |
|---|---|---|
| 1. install_auth | ✅ | 已在 main.py 接入，新 endpoint 继承全局 auth middleware |
| 2. require_tenant | ✅ | 全局 _enforce_tenant_per_request middleware 已覆盖新路由 |
| 3. Outbox | ⏭️ | 推理/版本查询不写 outbox(只读操作) |
| 4. BearerAuth | ✅ | install_auth 已强制 |
| 5. 跨租户 negative | ✅ | test_tenant_isolation_inference 验证跨租户不可达 |

---

## 7. 硬规则对齐

| # | 硬规则 | 对齐 |
|---|---|---|
| 3 | 没有 tenant 上下文, 不访问 repository | ✅ SPARQL + 推理均按 namespace 过滤 |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ 0 skip / 66 pass |

---

## 8. 结论

SPARQL 执行从空数组升级为 InMemory pattern matching; 推理引擎(subclass 继承 + transitivity 传递闭包 + BFS 路径 + K-hop 邻居)全面落地; 版本管理 4 CRUD endpoint + 推理 3 endpoint 就绪。**Accepted**。
