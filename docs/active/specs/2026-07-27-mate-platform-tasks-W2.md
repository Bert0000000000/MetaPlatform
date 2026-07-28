# W2 任务卡：基础设施 facade

> **源交付项**：[路线图 §4 W2](./2026-07-27-mate-platform-delivery-roadmap.md#w2---基础设施-facade)
> **总览**：[Task Breakdown](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S2（2026-08-03 ~ 2026-08-17）
> **里程碑**：M1 下半
> **任务卡总数**：24
> **依赖**：W1（monorepo + CI + Hello）

---

## 目录

- [W2-1 pg / neo4j / milvus / minio 接入](#w2-1-pg--neo4j--milvus--minio-接入)
- [W2-2 redis / kafka / nacos 接入](#w2-2-redis--kafka--nacos-接入)
- [W2-3 Repository Pattern 基类 + 实现](#w2-3-repository-pattern-基类--实现)
- [W2-4 基础设施测试基线](#w2-4-基础设施测试基线)

---

## W2-1 pg / neo4j / milvus / minio 接入

> **路线图工时**：5d | **拆出 TC 数**：7 | **关键路径**：是

### TC-2.1.1 psycopg 3 接入 + 连接池

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7（Hello app 跑通） |
| **可并行 TC** | TC-2.1.3、TC-2.1.4、TC-2.1.5 |
| **输出 PR** | `feat(infra): psycopg pool` |
| **关键路径** | 是 |

**目标**：在 `libs/infra-contracts/` 提供 `PgClient` 封装，封装 psycopg 3 的连接池、事务上下文。

**实现步骤**：
1. `libs/infra-contracts/pyproject.toml` 加 `psycopg[binary,pool]>=3.1`
2. `src/infra_contracts/pg.py`：实现 `PgClient`（`connect()`、`transaction()`、`fetch_one`/`fetch_all`/`execute`）
3. 默认连接串读 env：`PG_DSN=postgresql://mate:mate@localhost:5432/mate`
4. 连接池：`min_size=2、max_size=10、timeout=30`
5. 写 `tests/test_pg.py`：连接 + 简单 CRUD（用 hello 数据库）

**DoD 验证清单**：
- [ ] `uv run --package infra-contracts pytest tests/test_pg.py` 全绿
- [ ] 写一个 demo 跑通"创建表 → 插入 → 查询"完整流程
- [ ] type check 通过

---

### TC-2.1.2 异步 asyncpg 评估（如需）

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.1.1 |
| **可并行 TC** | — |
| **输出 PR** | `docs(infra): asyncpg eval` |

**目标**：评估是否需要在 v1 引入 asyncpg（FastAPI 异步端点专用）。

**实现步骤**：
1. 写 ADR-0005：v1 默认 psycopg（同步），仅在 FastAPI 端点显式需要时用 asyncpg
2. 写一个 spike 脚本 `scripts/eval-asyncpg.py`：用同一份 schema，分别跑 psycopg 和 asyncpg，对比 1000 次简单 select 的延迟

**DoD 验证清单**：
- [ ] ADR-0005 合并，结论明确
- [ ] 评估脚本输出可复现

---

### TC-2.1.3 neo4j-driver 接入

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.1.1 |
| **输出 PR** | `feat(infra): neo4j driver` |
| **关键路径** | 是 |

**目标**：在 `libs/infra-contracts/` 提供 `Neo4jClient`。

**实现步骤**：
1. 依赖 `neo4j>=5.20`
2. `src/infra_contracts/neo4j.py`：`Neo4jClient`（`driver()` 上下文、`execute_query`、`execute_write`）
3. 默认 `NEO4J_URI=bolt://localhost:7687`、`NEO4J_USER=neo4j`、`NEO4J_PASSWORD=mate-pass`
4. 写 `tests/test_neo4j.py`：建一个临时节点 + 查询 + 删

**DoD 验证清单**：
- [ ] 单测全绿
- [ ] type check 通过
- [ ] 错误连接串给出友好报错

---

### TC-2.1.4 pymilvus 接入

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.1.1、TC-2.1.3 |
| **输出 PR** | `feat(infra): pymilvus client` |

**目标**：在 `libs/infra-contracts/` 提供 `MilvusClient`。

**实现步骤**：
1. 依赖 `pymilvus>=2.4`
2. `src/infra_contracts/milvus.py`：`MilvusClient`（`connect()`、`create_collection`、`insert`、`search`、`drop`）
3. 默认 `MILVUS_HOST=localhost`、`MILVUS_PORT=19530`
4. 写 `tests/test_milvus.py`：建 collection → 插入 100 条 → 检索

**DoD 验证清单**：
- [ ] 单测全绿
- [ ] collection 名带 `test_` 前缀自动清理

---

### TC-2.1.5 minio-py 接入

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.1.1、TC-2.1.3、TC-2.1.4 |
| **输出 PR** | `feat(infra): minio client` |

**目标**：在 `libs/infra-contracts/` 提供 `MinioClient`。

**实现步骤**：
1. 依赖 `minio>=7.2`
2. `src/infra_contracts/minio.py`：`MinioClient`（`bucket_exists`、`make_bucket`、`put_object`、`get_object`、`presigned_get`）
3. 默认 `MINIO_ENDPOINT=localhost:9000`、`MINIO_ACCESS_KEY=mate`、`MINIO_SECRET_KEY=mate-pass`
4. 写 `tests/test_minio.py`：建 bucket → 上传 → 下载 → 删除

**DoD 验证清单**：
- [ ] 单测全绿
- [ ] presigned URL 1 小时内有效

---

### TC-2.1.6 docker-compose 加 4 个服务 + 健康检查

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.1.1 ~ TC-2.1.5 |
| **输出 PR** | `dev: add pg/neo4j/milvus/minio` |
| **关键路径** | 是 |

**目标**：`docker-compose.yml` 加 4 个基础设施服务，每个带健康检查。

**实现步骤**：
1. `postgres:16-alpine`（端口 5432，卷 `mate-pg-data`，healthcheck `pg_isready`）
2. `neo4j:5.20-community`（7474 + 7687，卷 `mate-neo4j-data`，`NEO4J_AUTH=neo4j/mate-pass`）
3. `milvusdb/milvus:v2.4-standalone`（19530 + 9091，依赖 etcd + minio 子服务）
4. `minio/minio:RELEASE.2024-09-13T20-26-02Z`（9000 + 9001，`MINIO_ROOT_USER=mate`）
5. 统一挂载 `./infra/init/`：放 init SQL / Cypher
6. 写 `infra/init/postgres/01-init.sql`：建 `mate` DB + `mate` 用户

**DoD 验证清单**：
- [ ] `docker compose up -d pg neo4j milvus minio` 全 healthy
- [ ] `docker compose ps` 显示 4 个 healthy
- [ ] 重启后数据保留（卷挂载正确）

---

### TC-2.1.7 各驱动单测汇总

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.1.1 ~ TC-2.1.5、TC-2.1.6 |
| **可并行 TC** | — |
| **输出 PR** | `test(infra): storage clients suite` |
| **关键路径** | 是 |

**目标**：把 4 个驱动的单测串成 `test_storage.py` 套件 + 共享 fixture。

**实现步骤**：
1. `tests/conftest.py`：定义 `pg_client`、`neo4j_client`、`milvus_client`、`minio_client` fixtures（session scope）
2. `tests/test_storage.py`：4 个 test class，每个 1 个 smoke test
3. CI 加 `infra-storage` job，依赖 `docker compose up -d`

**DoD 验证清单**：
- [ ] CI 中 `infra-storage` job 绿
- [ ] 4 个 fixture 可在外部测试复用

---

## W2-2 redis / kafka / nacos 接入

> **路线图工时**：3d | **拆出 TC 数**：5 | **关键路径**：否

### TC-2.2.1 redis-py 接入（同步 + 异步）

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.2.2、TC-2.2.3 |
| **输出 PR** | `feat(infra): redis client` |

**目标**：提供 `RedisClient`（同步）+ `AsyncRedisClient`。

**实现步骤**：
1. 依赖 `redis>=5.0`（含 asyncio）
2. `src/infra_contracts/redis_client.py`：两个 class
3. 默认 `REDIS_URL=redis://localhost:6379/0`
4. `tests/test_redis.py`：同步 set/get、异步 set/get、TTL

**DoD 验证清单**：
- [ ] 单测全绿（同步 + 异步各 ≥ 3 个）
- [ ] 错误 URL 报错友好

---

### TC-2.2.2 aiokafka 接入

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.2.1、TC-2.2.3 |
| **输出 PR** | `feat(infra): kafka producer/consumer` |

**目标**：提供 `KafkaProducer` + `KafkaConsumer` 薄封装。

**实现步骤**：
1. 依赖 `aiokafka>=0.11`、`kafka-python-ng>=2.2`（脚本用）
2. `src/infra_contracts/kafka.py`：`KafkaProducer.publish(topic, payload, key)`、`KafkaConsumer.subscribe(topics, group_id)`
3. payload 默认 JSON 序列化；key 默认 str
4. 默认 `KAFKA_BOOTSTRAP=localhost:9092`
5. `tests/test_kafka.py`：发 10 条 → 收 10 条，校验顺序与载荷

**DoD 验证清单**：
- [ ] 单测全绿
- [ ] 错误主题给出明确异常

---

### TC-2.2.3 nacos-sdk-python 接入

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.1.7 |
| **可并行 TC** | TC-2.2.1、TC-2.2.2 |
| **输出 PR** | `feat(infra): nacos config client` |

**目标**：提供 `NacosConfig` 封装，监听配置变更。

**实现步骤**：
1. 依赖 `nacos-sdk-python>=1.0`
2. `src/infra_contracts/nacos.py`：`NacosConfig.get(key)`、`NacosConfig.subscribe(key, callback)`
3. 默认 `NACOS_SERVER=localhost:8848`、`NACOS_NAMESPACE=mate`
4. 写 `tests/test_nacos.py`：mock 服务端推送一次 → 验证回调

**DoD 验证清单**：
- [ ] 单测全绿（mock 模式）
- [ ] 实际连接 nacos 容器后能读到配置

---

### TC-2.2.4 docker-compose 加 3 个服务

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-2.1.6 |
| **可并行 TC** | TC-2.2.5 |
| **输出 PR** | `dev: add redis/kafka/nacos` |

**目标**：`docker-compose.yml` 加 redis / kafka / nacos 服务。

**实现步骤**：
1. `redis:7-alpine`（端口 6379，卷 `mate-redis-data`，healthcheck `redis-cli ping`）
2. `bitnami/kafka:3.7`（端口 9092，env `KAFKA_CFG_NODE_ID=0`、`KAFKA_CFG_PROCESS_ROLES=controller,broker`，healthcheck `kafka-broker-api-versions.sh`）
3. `nacos/nacos-server:v2.4.3-slim`（端口 8848 + 9848，env `MODE=standalone`、`JVM_XMS=512m`）
4. 写 `infra/init/nacos/realm-import.json`：预置一个 `mate` namespace

**DoD 验证清单**：
- [ ] 3 服务全 healthy
- [ ] nacos 控制台 `http://localhost:8848/nacos` 可登录

---

### TC-2.2.5 各驱动单测汇总

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.2.1 ~ TC-2.2.3、TC-2.2.4 |
| **可并行 TC** | — |
| **输出 PR** | `test(infra): messaging clients suite` |

**目标**：串成 `test_messaging.py` 套件 + 共享 fixture。

**实现步骤**：
1. `tests/conftest.py` 加 `redis_client`、`kafka_producer`、`nacos_client` fixtures
2. `tests/test_messaging.py`：3 个 test class
3. CI 加 `infra-messaging` job

**DoD 验证清单**：
- [ ] CI 中 `infra-messaging` job 绿
- [ ] fixtures 复用方便

---

## W2-3 Repository Pattern 基类 + 实现

> **路线图工时**：5d | **拆出 TC 数**：7 | **关键路径**：是

### TC-2.3.1 Repository 协议/接口设计

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-1.7.4（共享 schema 落地） |
| **可并行 TC** | TC-2.3.2 |
| **输出 PR** | `feat(infra): repository protocol` |
| **关键路径** | 是 |

**目标**：用 `typing.Protocol` 定义通用 Repository 接口。

**实现步骤**：
1. `src/infra_contracts/repo.py`：
   ```python
   class Repository(Protocol[T, ID]):
       async def get(self, id: ID) -> T | None: ...
       async def list(self, *, limit: int = 50, offset: int = 0, **filters) -> list[T]: ...
       async def save(self, entity: T) -> T: ...
       async def delete(self, id: ID) -> bool: ...
   ```
2. 写 ADR-0006：为什么用 Protocol 而非 ABC（鸭子类型 + 静态检查）
3. 写 `tests/test_repo_protocol.py`：用 InMemory 实现跑通 mock 协议

**DoD 验证清单**：
- [ ] Protocol 在 pyright strict 下不报 warning
- [ ] ADR-0006 合并

---

### TC-2.3.2 通用 Repository 抽象基类

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.3.1 |
| **可并行 TC** | — |
| **输出 PR** | `feat(infra): abstract repository` |
| **关键路径** | 是 |

**目标**：在 Protocol 之上提供可选的抽象基类（带 ID 字段提取）。

**实现步骤**：
1. `src/infra_contracts/base_repo.py`：`class AbstractRepository(Generic[T, ID])`，要求子类实现 `_extract_id(entity)`
2. 提供 `get_or_raise(id)` 默认实现，缺失抛 `EntityNotFound`
3. 写 `tests/test_base_repo.py`：用 fake repo 验证默认实现

**DoD 验证清单**：
- [ ] pyright strict 通过
- [ ] `EntityNotFound` 异常在 `libs/common/exceptions.py` 统一定义

---

### TC-2.3.3 Document / Chunk PG 实现

| 字段 | 值 |
|---|---|
| **预估工时** | 6h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.1.1、TC-2.3.2 |
| **可并行 TC** | TC-2.3.4 |
| **输出 PR** | `feat(infra): pg document repo` |
| **关键路径** | 是 |

**目标**：用 `PgClient` 实现 `DocumentRepository` + `ChunkRepository`。

**实现步骤**：
1. `apps/tech-kb/src/tech_kb/repos/pg_document.py`：实现 `class PgDocumentRepository(AbstractRepository[Document, UUID])`
2. `apps/tech-kb/src/tech_kb/repos/pg_chunk.py`：同上
3. 表结构：`CREATE TABLE documents (id UUID PK, kb_id UUID, status TEXT, source_uri TEXT, metadata JSONB, created_at TIMESTAMPTZ)`；`chunks` 类似 + `tsvector` 列与 GIN 索引
4. 写迁移：`apps/tech-kb/migrations/001_init.sql`
5. `tests/test_pg_document_repo.py`：CRUD + 检索（用 tsvector）

**DoD 验证清单**：
- [ ] 迁移可重复执行（`IF NOT EXISTS`）
- [ ] 单测覆盖率 ≥ 80%
- [ ] list 支持 `kb_id` / `status` 过滤

---

### TC-2.3.4 Document / Chunk InMemory 实现（测试用）

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.3.1 |
| **可并行 TC** | TC-2.3.3 |
| **输出 PR** | `feat(infra): in-memory document repo` |

**目标**：纯内存版 Repository，供单元测试与本地调试用。

**实现步骤**：
1. `apps/tech-kb/src/tech_kb/repos/mem_document.py`：用 `dict[UUID, Document]`
2. `mem_chunk.py`：同上
3. 写 `tests/test_mem_document_repo.py`：与 PG 实现共享同一份 contract test
4. 写 `tests/contract/test_document_repo.py`：用 pytest.parametrize 让两实现跑同一组用例

**DoD 验证清单**：
- [ ] 同一 contract test 在 PG + InMemory 均绿
- [ ] InMemory 启动 < 10ms

---

### TC-2.3.5 Neo4j Repository 接口预留

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.3.1、TC-2.1.3 |
| **可并行 TC** | TC-2.3.6、TC-2.3.7 |
| **输出 PR** | `feat(infra): neo4j repo stub` |

**目标**：定义 `GraphRepository` Protocol（节点 / 边 CRUD），实现留到 W5。

**实现步骤**：
1. `apps/tech-ont/src/tech_ont/repos/neo4j_repo.py`：定义 `class Neo4jGraphRepository(Protocol)` + 抛出 `NotImplementedError`
2. ADR-0007：v1 Neo4j 仅做读模型，主写仍走 OpenAPI → tech-ont → Neo4j

**DoD 验证清单**：
- [ ] Protocol 可被 mock
- [ ] ADR-0007 合并

---

### TC-2.3.6 Milvus Repository 接口预留

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.3.1、TC-2.1.4 |
| **可并行 TC** | TC-2.3.5、TC-2.3.7 |
| **输出 PR** | `feat(infra): milvus repo stub` |

**目标**：定义 `VectorRepository` Protocol（insert / search / delete by ids）。

**实现步骤**：
1. `apps/tech-kb/src/tech_kb/repos/vector_repo.py`：`class VectorRepository(Protocol)` + 抛出 `NotImplementedError`
2. `tests/test_vector_repo_protocol.py`：契约示例

**DoD 验证清单**：
- [ ] Protocol 完整覆盖 4 个方法（insert / search / delete / drop_collection）

---

### TC-2.3.7 MinIO Repository 实现（chunk 二进制）

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.1.5 |
| **可并行 TC** | TC-2.3.5、TC-2.3.6 |
| **输出 PR** | `feat(infra): minio blob repo` |

**目标**：用 `MinioClient` 存放大文件（PDF 原文档、模型权重等）。

**实现步骤**：
1. `apps/tech-kb/src/tech_kb/repos/minio_blob.py`：`class MinioBlobRepository`（`put(key, bytesio, size, content_type)`、`get(key) -> bytes`、`presigned_get(key, ttl)`）
2. key 规则：`{tenant_id}/{kb_id}/{document_id}/{filename}`
3. `tests/test_minio_blob_repo.py`：上传 1MB → 下载 → 字节一致

**DoD 验证清单**：
- [ ] 100MB 上传 + 下载 < 5s（本地）
- [ ] presigned URL 在 ttl 过期后失效

---

## W2-4 基础设施测试基线（覆盖率 ≥ 80%）

> **路线图工时**：3d | **拆出 TC 数**：5 | **关键路径**：是

### TC-2.4.1 pytest fixtures 设计（testcontainers）

| 字段 | 值 |
|---|---|
| **预估工时** | 4h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.1.7、TC-2.2.5 |
| **可并行 TC** | TC-2.4.2 |
| **输出 PR** | `test(infra): testcontainers fixtures` |
| **关键路径** | 是 |

**目标**：用 testcontainers-python 在 CI 拉起一次性容器。

**实现步骤**：
1. 依赖 `testcontainers[postgres,neo4j,milvus,minio,redis,confluentkafka]>=4.7`
2. `tests/fixtures/containers.py`：每个容器一个 fixture，session scope
3. 端口随机化（避免 CI 并行冲突）
4. 提供 `infra_compose` fixture：可选用 docker-compose 或 testcontainers（CI 默认 testcontainers）

**DoD 验证清单**：
- [ ] CI 中 testcontainers 启动 < 60s
- [ ] session 结束自动清理

---

### TC-2.4.2 集成测试 base

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.4.1 |
| **可并行 TC** | — |
| **输出 PR** | `test(infra): integration base` |

**目标**：建立 `tests/integration/` 目录与统一 base。

**实现步骤**：
1. `tests/integration/conftest.py`：所有容器 fixture 引用、清理
2. `tests/integration/test_*.py`：至少 5 个 smoke test（pg/neo4j/milvus/minio/redis 各 1）
3. 写 `pytest -m "not integration"` 让默认 `pytest` 跳过

**DoD 验证清单**：
- [ ] `pytest -m integration` 全绿
- [ ] `pytest`（默认）全绿且 < 30s

---

### TC-2.4.3 覆盖率门槛 CI 接入

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | DevOps |
| **前置 TC** | TC-1.6.3、TC-2.4.2 |
| **可并行 TC** | TC-2.4.4 |
| **输出 PR** | `ci: cov gate 80%` |
| **关键路径** | 是 |

**目标**：CI 跑 `pytest --cov --cov-fail-under=80`，合并到 TC-1.6.3。

**实现步骤**：
1. `.github/workflows/python.yml` 加 `--cov-fail-under=80`
2. `pyproject.toml` 增 `[tool.coverage.run] omit = ["*/tests/*", "*/migrations/*"]`
3. 报告上传 codecov

**DoD 验证清单**：
- [ ] 故意删一个测试，CI 阻断
- [ ] codecov 报告可看

---

### TC-2.4.4 性能基准（连接池上限）

| 字段 | 值 |
|---|---|
| **预估工时** | 3h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.4.1 |
| **可并行 TC** | TC-2.4.3 |
| **输出 PR** | `test(infra): perf bench` |

**目标**：写一组 `pytest-benchmark`，固化连接池基线。

**实现步骤**：
1. 依赖 `pytest-benchmark>=4.0`
2. `tests/bench/test_pg_pool_bench.py`：100 并发 × 10 次简单 SELECT
3. `tests/bench/test_milvus_bench.py`：10k 向量 search p95 < 50ms
4. 写 ADR-0008：性能基线值（作为后续告警阈值）

**DoD 验证清单**：
- [ ] `pytest-benchmark` 输出存档
- [ ] ADR-0008 合并

---

### TC-2.4.5 mock vs real 切换开关

| 字段 | 值 |
|---|---|
| **预估工时** | 2h |
| **负责人角色** | Backend |
| **前置 TC** | TC-2.3.4、TC-2.4.1 |
| **可并行 TC** | — |
| **输出 PR** | `feat(infra): mock toggle` |

**目标**：通过环境变量 `INFRA_MODE=mock|real` 切换 InMemory / 真容器。

**实现步骤**：
1. `src/infra_contracts/factory.py`：`def get_document_repo() -> DocumentRepository`，根据 env 决定
2. `INFRA_MODE=mock` 默认本地 + CI 单元测试；`=real` 用于集成测试
3. 写 `tests/test_factory.py`：两种模式返回正确实现

**DoD 验证清单**：
- [ ] 切换后 `apps/tech-kb` 接口行为一致
- [ ] README 写明 `INFRA_MODE` 用法

---

## W2 完成度检查表

| W2-n | 路线图 ID | 关键路径 | 路线图工时 | TC 数 | 状态 |
|---|---|---|---|---|---|
| W2-1 | §4 W2-1 | 是 | 5d | 7 | 未启动 |
| W2-2 | §4 W2-2 | 否 | 3d | 5 | 未启动 |
| W2-3 | §4 W2-3 | 是 | 5d | 7 | 未启动 |
| W2-4 | §4 W2-4 | 是 | 3d | 5 | 未启动 |
| **合计** | — | — | **16d** | **24** | **未启动** |

---

## Sprint S2 建议排程

| 周 | 重点 TC | 备注 |
|---|---|---|
| W2 D1-D2 | TC-2.1.1 ~ TC-2.1.5 | 5 个驱动接入并行 |
| W2 D2 | TC-2.1.6 | docker-compose 完整化 |
| W2 D3 | TC-2.1.7、TC-2.2.1 ~ TC-2.2.3 | 集成测试 + 3 个 messaging 驱动 |
| W2 D4 | TC-2.2.4、TC-2.2.5 | messaging 服务 + 测试汇总 |
| W2 D4-D5 | TC-2.3.1、TC-2.3.2 | Repository 协议 + 基类 |
| W2 D5-D7 | TC-2.3.3 ~ TC-2.3.7 | 5 个具体 Repository 实现 |
| W2 D8-D9 | TC-2.4.1 ~ TC-2.4.5 | 测试基线（testcontainers + 性能 + mock 开关） |

> 关键路径：W2-1（5d）→ W2-3（5d）→ W2-4（3d）。W2-2 可全并行。

---

## 依赖关系图

```mermaid
flowchart LR
    A[TC-2.1.1 psycopg] --> D[TC-2.3.3 PG repo]
    B[TC-2.1.3 neo4j] --> E[TC-2.3.5 Neo4j stub]
    C[TC-2.1.4 milvus] --> F[TC-2.3.6 Milvus stub]
    G[TC-2.1.5 minio] --> H[TC-2.3.7 MinIO repo]
    A --> I[TC-2.4.1 testcontainers]
    J[TC-2.3.1 Protocol] --> K[TC-2.3.2 基类]
    K --> D
    K --> L[TC-2.3.4 InMemory]
    D --> M[TC-2.4.3 覆盖率门槛]
    I --> M
```

---

## 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-07-27 | v1.0 初稿 | 配合 Task Breakdown 总览建立 W2 任务卡 |
