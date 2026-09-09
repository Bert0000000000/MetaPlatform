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

---

# 第三批（Sprint 5 残余收口 · 2026-09-08）

## 10. Trino 激活 [!→x]（根因翻案：配置而非资源）

- **根因更正**：前两批判为「VM 资源挤占」，本批腾挪窗口（停 kind 四节点）
  后复现重启循环并抓到真凶——`iceberg.catalog.type=file_system` 是 **Trino
  483 不存在的 CatalogType**（从插件 jar `io/trino/plugin/iceberg/CatalogType.class`
  挖出合法值：glue/hive_metastore/jdbc/nessie/rest/snowflake/
  testing_file_metastore）。Iceberg catalog 加载失败会 abort 整个 JVM
  （Executors.executeUntilFailure），造成「启动期自退出」假象。
- **修复**：`iceberg.catalog.type=jdbc`（JDBC metastore，免独立 catalog 服务）：
  - 元数据：mate-postgres 专用库 `iceberg_catalog` 的 `iceberg_tables` /
    `iceberg_namespace_properties`（V1 DDL）
  - 数据：native S3（`fs.native-s3.enabled` + `s3.path-style-access`）直存
    MinIO `mate-warehouse`
  - compose 增 named volume `trino-data:/data`（消除 Windows bind mount
    初始化毛刺期的 launcher pid 崩溃循环）
- **取证 ①（联邦查询）**：`SHOW CATALOGS` → iceberg/postgresql/system；
  `SELECT count(*) FROM postgresql.public.ont_object_type` = **30**（rid 如
  `ont.tenant-default.obj.crm.contract.v1`）；`ont_individual` = 16。
- **取证 ②（Iceberg Roundtrip）**：CREATE SCHEMA `sprint5_evidence` →
  CREATE TABLE `roundtrip` → INSERT 3 → SELECT 3 → DELETE 1 → SELECT 剩 2；
  MinIO 侧 parquet 数据文件 + 3 份 metadata.json 快照、PG 侧
  `iceberg_tables.metadata_location = s3://mate-warehouse/...metadata.json`。
- `/v1/info`：`{"state":"ACTIVE","starting":false}`，容器 healthy。
- 取证后 kind 四节点恢复运行。收尾态：mate-trino 回到 stopped（与本批开始
  时一致）——同时常驻 Trino + milvus + kind 四节点超出本宿主 VM 内存预算
  （实测触发全局内存抖动：daemon healthcheck exec 超时、gateway 瞬时 000），
  证据已收口，需要时单启 `docker start mate-trino`（配置修复后 ~1 分钟即
  healthy）。

## 11. 多模态数据产品（Iceberg ADS）[x]

- `scripts/smoke_sprint5_multimodal_ads.py`（网关全链无 mock）：
  ① 网关登录 JWT；② 3 张真实 PNG（`_png` 生成器）经 MinIO SDK 上传
  `mate-warehouse/multimodal/ads/*.png`（stat 回读 size）；③ iceberg catalog
  建 `iceberg.multimodal.ads_image_catalog`（image_key/title/width/height/
  size_bytes）+ 3 行写入并回查；④ `POST /api/v1/data/products`
  （modality=mixed, target_iceberg_table=…）→ `dp-a34ba0d4`；
  ⑤ `POST /products/{id}/publish` → **status=published, version=2**。
- **顺带修复**：`mate-tech-data` SQL store `set_data_product_status` 缺
  `bump_version`/`require_owner` 参数（第二批 SQL 化时与 API 契约脱节，
  publish 500）——已对齐 in_memory 语义并热修烧死镜像。

## 12. ONT-G14 SHACL W3C 全集增量 [~→x]

- kernel `shacl.py` 增量：
  - **severity 分级**：Violation/Warning/Info（W3C 语义：仅 Violation 使
    conforms=false）；报告新增 `severity_counts`
  - **sh:not**：内嵌 PropertyShape 节点级取反（datatype/pattern/class/
    languageIn 作用于值节点）
  - **sh:languageIn**：`"@lang"` 后缀与 `{"@value","@language"}` 双载体，
    无语言标签 = 违例（W3C：literal 须带标签）
  - **sh:qualifiedValueShape**：qualifiedMinCount/qualifiedMaxCount
- 单测：`test_ont_g14_shacl.py` **30 passed**（16 既有 + 14 增量，每约束
  正反例）；REST live 4 项经网关（severity Warning 不破 conforms / not 违例
  / languageIn 违例 / qualifiedMinCount 违例），契约 ontValidateV2Shacl
  schema 同步（severity enum + severity_counts + 新约束字段）。
- PRD-23 → [x]，覆盖/未覆盖清单见 PRD（未覆盖：sh:node 递归、path 表达式、
  组件族 in/minLength 等、target 三变体、Test Suite conformance、RDF graph
  报告格式——均已如实列明）。

## 13. ONT-G33 对齐与合并最小闭环 [→~]

- kernel `alignment.py`：
  - **align_individuals**：explicit_pairs（vocabulary same_as）+ 词汇证据
    （label 规范化相等）+ 结构证据（属性 slug + 值签名 Jaccard ≥0.5，跨本体
    可比）；匹配对带 evidence/score；聚类复用 reasoning R2 并查集传递闭包
  - **merge_object_types**：字段并集（Property rid）+ 同 rid 字段级冲突标记
    （left/right/resolved）+ keep_left/keep_right 策略 + 合并审计
    （merged_from/into/strategy/added/conflicts/计数）；PK 并集守
    ObjectType 不变量
- REST（契约先行，ont.yaml 新增 2 路径 + operationId）：
  `ontAlignV2Individuals`（POST /v2/alignment/run）、
  `ontPreviewV2ObjectTypeMerge`（POST /v2/object-types/merge-preview，
  stateless；实例重映射仍走既有 ontMergeV2ObjectTypes，互补）。
- 单测：`test_ont_g33_alignment.py` **9 passed**（显式聚类/词汇/结构/负例/
  传递闭包/并集/冲突 keep_left/keep_right/审计+PK 并集）；live 2 项经网关
  （alignment 三证据单簇 / merge-preview 并集+冲突+审计）。
- 残余（如实）：modularization（FR-ALIGN-003）留增量 → PRD-33 [~]。

## 14. 测试汇总（第三批）

- 新增：SHACL 14 + G33 9 = **23 passed**（合计 kernel 三批 39：SHACL 30 +
  G33 9）；kernel 全套件 611 passed 无回归。
- ont 套件 228 passed；`test_tenant_isolation_hard` 8 errors 经 stash 验证
  **HEAD 上同样失败**（PG 表属主环境问题，非本批引入）；objectset PG 1 例
  偶发环境抖动，复跑即绿。

## 15. 残余与边界（第三批后）

| 项 | 状态 | 说明 |
|---|---|---|
| Trino 联邦 + Iceberg Roundtrip | [x] | §10 |
| 多模态 Iceberg ADS | [x] | §11（dp-a34ba0d4 published v2）|
| SHACL PRD-23 | [x] | §12（未覆盖清单如实）|
| G33 对齐/合并 | [~] | §13（modularization 留增量）|
| Paimon 运行面 | [x] | §16（Flink 1.20 + Paimon 1.1.1 on MinIO）|
| staging 演练 | [ ] 让位边界如实 | 见 §17（helm 渲染 101 manifests ✓ + kind 四节点 Ready ✓；install 窗口与 Trino/Paimon 激活挤占，apiserver TLS 超时让位）|
| BI 集成（StarRocks） | [ ] | 后续批次（镜像/资源窗口同上）|

## 17. staging 演练尝试与让位边界（如实）

- helm 渲染（静态）：`helm template mate-staging infra/helm -f values-staging.yaml`
  → **101 manifests**（9 Deployment + 20 Service + ServiceAccount/ServiceMonitor
  等），零渲染错误。
- kind 集群：四个节点（control-plane + 3 worker）恢复后 `kubectl get nodes` 全
  **Ready**（v1.36.1）；cluster 当前无业务 namespace（干净基线）。
- install 尝试两轮均因 apiserver `TLS handshake timeout`/EOF 失败——本批窗口
  被 Trino 激活 + Flink/Paimon 验证 + 四节点启动连续挤占 Docker VM（同期
  daemon healthcheck exec 也超时、mate-postgres 被迫崩溃恢复一轮后自愈、
  mate-milvus 退出一次已拉起）。按 goal 条款 staging 让位，解锁条件 = 独立
  低负载窗口重跑 `helm install`（建议先 `--set datahub.enabled=false` 并补装
  datahub CRD 或临时关闭依赖 CRD 的组件）。

## 16. Paimon 运行面 [x]

- **交付**：`docker-compose.paimon.yml`（Flink 1.20 standalone：JM 640m + TM
  1024m/2 slot，同 metaplatform 网络）+ `.tmp-paimon/` 运行件：
  `paimon-flink-1.20-1.1.1.jar` + **`paimon-s3-1.1.1.jar`**（官方 S3 filesystem
  bundle，SDK v2，原生吃 catalog `'s3.*'` options）+ `flink-s3-fs-hadoop` +
  `hadoop-hdfs-client`（兜底 hadoop Configuration/HdfsConfiguration 类路径）
  + `core-site.xml`（fs.s3a.* 兜底）。
- **调试链（如实）**：① s3 插件只挂 plugins/ → paimon 不可见 hadoop 类
  （移 lib 解决）；② 缺 hadoop-hdfs-client（补 jar）；③ catalog `'s3.*'`
  options 走 s3a 签名 403（换 paimon-s3 bundle 解决——s3a 路径对 MinIO 的
  凭据/签名链路不稳，官方 bundle 为正解）。
- **SQL 取证**（`sql-client.sh -f`，batch 模式）：CREATE CATALOG paimon
  （warehouse=s3://mate-warehouse/paimon + s3.endpoint=mate-minio:9000 +
  path-style）→ CREATE TABLE `sprint5_paimon_rt`(id,name,amount,parquet) →
  INSERT 3 行（Job `c4519597ad8a0d650e79c66b9e8f47dc`，state=**FINISHED**）→
  SELECT 返回 **3 rows**（1/alpha/10.5、2/beta/20.5、3/gamma/30.5）。
- **落位验证**：MinIO `mate-warehouse/paimon/default.db/sprint5_paimon_rt/`
  完整 lake 布局（bucket-0 parquet 数据文件 + manifest + schema + snapshot）。
- 与 Trino 激活互斥窗口执行（Flink 验证后 down，Trino 重建，kind 四节点恢复）。
