# SPRINT-5 ACCEPTANCE — 数据产品真实化（第一批 + 第二批）

> **日期**: 2026-09-08 · **范围**: goal「推进 Sprint 5」+ goal「Sprint 5 残余收口（第二批）」· **部署**: docker 全栈 + mate-trino（单节点）+ MinIO S3

## 1. ONT-G21 推理端到端 [x]

**代码**（sprint 分支 worktree `prd-05-08-sprint-0`，与 G16/G13/G18 axiom registry 同分支交付）：

- kernel `reasoning/engine.descendant_closure`：类 → 全部传递后代类（多父并集、环保护、自环伪影剔除）。
- `pg_repo.evaluate_object_set` 闭包扩展：按本租户 enabled subclass 公理把「查询类」展开为「类 + 后代类」；slug 操作数先解析为本租户已注册类型完整 rid（跨写法传递链连通），再求闭包；全部参数化。无公理时行为与旧版完全一致。

**单测 26 passed**：

| 套件 | 数 | 覆盖 |
|---|---|---|
| kernel `test_ont_g21_descendant_closure.py` | 6 | 直接/传递/多父/环/空/叶子 |
| ont `test_ont_g21_closure_objectset.py`（真实 PG metaplatform_ont） | 4 | 祖先查询命中全部后代 / 中间层 / 叶子精确 / 禁用公理回退精确 |
| 既有 `test_objectset_parity.py` + `integration/test_v2_kernel_pg_objectset.py` | 16 | 无回归 |

**Live 15/15 PASS**（`scripts/smoke_ont_g21_reasoning_e2e.py`，网关全链无 mock）：

- 类型层（三类共用 name 属性 = 属性继承语义）→ 实例 alice(person)/bob(employee)/carol(manager)
- 公理注册两种写法：employee⊑person 用完整 rid、g21-manager⊑g21-employee 用 slug
- `POST /reasoning/run`：employee → inferred [agent, person]（R1 传递闭包）
- **`POST /object-sets/query` 闭包可见**：查 person → alice+bob+carol（3/3 后代命中）；查 employee → bob+carol；查 manager → carol
- Function 注册面：`POST/GET /functions` 注册 g21-classify 回读一致
- ACL 负例：跨租户 axiom rid → 422；跨租户 class rid 查询 → 403

## 2. Trino + Iceberg 部署 [~]

- Trino 单节点容器 `mate-trino`（`docker-compose.trino.yml` + `infra/trino/etc/`，main tree trunk 交付）；catalog 两枚：
  - `postgresql.properties` → mate-postgres/metaplatform（联邦查询平台真实数据）
  - `iceberg.properties` → iceberg connector + **file-system catalog** + native S3 直存 MinIO `mate-warehouse` bucket（bucket 已建）
- `apache/iceberg-rest` 镜像 daocloud/1ms/rat.dev 均 denied → 采用 file-system catalog 方案（真实 Iceberg 表格式，免独立 catalog 服务）
- **边界（如实）**：Trino 冷启动（插件全量加载）在当前 Windows docker VM 上 >10 分钟且启动期挤占宿主资源——31 容器全栈出现网关瞬时 000/502（限堆 768M 后仍挤占）。两轮启动尝试（1536M/768M）均在插件加载期主动停止让位，环境即刻恢复（31 容器 0 unhealthy、fe9200=200、login=200）。容器保留 stopped 状态。
- **解锁动作**：全栈低峰期单独启动（`docker start mate-trino`，等待 SERVER STARTED 后跑两条 catalog 查询取证）；或 VM 扩容后常驻。§2 交付物就绪，取证只差服务激活。

## 3. PRD 起稿（7 份，状态如实）

PRD-12（数据栈部署 [~]）/ PRD-16（本体迁移 [x]）/ PRD-17（ObjectSet PG [x]）/ PRD-18（12 基元 [x]）/ PRD-23（SHACL 完整 [ ]）/ PRD-30（推理 e2e [~]）/ PRD-33（对齐合并 [ ]）—— 落 `docs/active/prd/APP-DW|APP-ONTSTUDIO/`。

## 4. 测试

本批新增 kernel 6 + ont PG 4 = 10 全绿；既有 parity 6 + pg_objectset 16 无回归（合计 26 passed 同轮验证）。

## 5. 边界汇总

| 项 | 状态 | 解锁动作 |
|---|---|---|
| Trino 服务激活 | [~] 容器/配置/镜像就绪；启动期资源挤占需单独窗口 | VM 扩容或全栈低峰期启动；启动后跑 §2 两条 catalog 查询取证 |
| Paimon 运行面 | [ ] | Flink 生态部署（重） |
| StarRocks BI / staging 大规模演练 / SHACL 完整 / G33 对齐 | [ ] | 后续批次 |
| Function 执行语义 | 注册面已通，执行引擎留增量 | PRD-30 FR-RSN-004 |

---

# 第二批（Sprint 5 残余收口）

## 6. ONT-G14 SHACL Core 关键约束 [~→关键面已收口]

- kernel `mate_kernel/ontology/shacl.py`：NodeShape/PropertyShape + 结构化验证报告
  （W3C 结构子集：conforms / violations[{focus_node, path, constraint, message}] / stats）。
- 约束集：**minCount / maxCount / datatype / pattern / class（值节点类校验）/ closed**
  ；W3C 语义要点：pattern 仅作用于字符串值；closed 拒绝未声明属性。
- 集成：ObjectType → NodeShape 合成（pk/非空 → minCount 1，type_id → datatype），
  与 ontValidateV2* 类型语义对齐；REST `POST /api/v1/ont/v2/shacl/validate`
  （operationId ontValidateV2Shacl，契约先行，stateless 与 repo 实例双路径）。
- 单测：kernel `test_ont_g14_shacl.py` **16 passed**（每约束正反例 + 报告聚合 + 环保护语义）。
- Live（网关）：① 集成路径——g21-employee 类型合成 shape + repo 实例 → conforms=true；
  ② stateless 负例——pattern 不匹配 + closed 多余属性 → conforms=false，
  violations 含 pattern+closed。
- **残余（如实）**：severity 分级 / sh:not / sh:languageIn / sh:qualifiedValueShape 等
  W3C 全集（PRD-23 FR-SHACL-005）。

## 7. DATA-D6/D7 lineage / quality / catalog [x]

- mate-tech-data 新增治理面（双模式：in-memory + SQL 持久化，契约先行 6 路径）：
  - **lineage**：POST /lineage/edges 登记 + GET /lineage/graph（entity 子图）→
    `data_lineage_edges` 表
  - **quality**：POST/GET /quality/rules（required=列存在 / type=类型匹配，对 source
    schema 执行）+ POST /quality/run（enabled 规则全量执行）+ GET /quality/results →
    `data_quality_rules` / `data_quality_results` 表
  - **catalog**：GET /catalog/search?q= 跨 sources + data products 检索
- 单测：`test_data_governance.py` **8 passed**（边+子图、租户隔离、required 正例、
  type 反例、缺列、多轮持久化、双命中、无命中）。
- Live 5/5（`scripts/smoke_sprint5_governance_e2e.py`，网关）：
  - SHACL 集成 conforms=true ✓；stateless 负例 pattern+closed ✓
  - lineage：登记边 + entity 子图节点精确 ✓
  - quality：2 规则执行（required passed=t / type passed=f 落 PG `data_quality_results`）✓
  - catalog：q=orders 双命中（source + product）✓

## 8. Trino 激活尝试与边界（最终）

- 第二轮激活（768M 堆）：节点状态到达 **ACTIVE**（uptime 16.5m）但查询仍返回
  "server is still initializing"，随后 JVM 干净退出（ExitCode=0，非 OOM），
  `restart: unless-stopped` 进入重启循环（Restarts=2）。
- 启动/加载期对宿主 VM 的挤占使 31 容器全栈网关出现瞬时 000/502；两轮窗口内
  主动停止让位后环境立即恢复。
- **结论**：Trino/Iceberg 交付物（镜像/配置/compose/bucket）全部就绪，
  激活标 **[!]**——前置 = 独立 VM/低负载宿主（Trino 独占 ≥2GB + 空闲 CPU），
  或全栈停机窗口内单独激活后跑两条 catalog 查询取证。

## 9. 测试汇总（第二批）

新增：SHACL 16 + 治理 8 = **24 passed**；G21/parity/objectset 既有套件无回归；
合并后 main 关键套件 51 passed（第一批收口轮）。
