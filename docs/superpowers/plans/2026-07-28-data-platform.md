# Mate Platform Data Platform Implementation Plan (D0–D8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 v3.0 主后端之上，落地完整自托管大数据 ETL + 湖仓 + 治理能力；控制面用 Python `mate-tech-data`，数据平面用 Flink + Airflow + Paimon + Iceberg + Trino + StarRocks + 治理栈；产品入口并入现有 `Ontology Studio / 数据中心`，不新增独立 APP。

**Architecture:** Python 控制面（`mate-tech-data` 模块化单体）+ 数据平面（Kubernetes 上的 Flink Application / Airflow / Trino / StarRocks / Paimon + Iceberg 湖表 / Gravitino + OpenMetadata + OpenLineage + Great Expectations + Ranger + OpenBao）。控制面只管理状态与定义，吞吐与状态保留在 Flink / Kafka / 湖仓中。所有 Pipeline 版本化、可回滚、补数；所有数据产品经 Schema Contract / Quality / Security / Ownership / Approval 五重门禁。

**Tech Stack:** Python 3.12、FastAPI、SQLModel、Pydantic v2、httpx、uvloop、granian、pyright strict、Pytest、Testcontainers、Kubernetes、Argo CD、Helm、Flink 1.19、Airflow 3.0、Apache Paimon 0.9、Apache Iceberg 1.5、Trino 455、StarRocks 3.3、Apache Gravitino 0.7、OpenMetadata 1.4、OpenLineage 0.50、Great Expectations 0.18、Apache Ranger 2.4、OpenBao 1.15、Apache Kafka 3.7、Apicurio 2.6、Keycloak 25、Flowable 8。

---

## File Structure

### 控制面（`mate-tech-data`）

- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/` 根
- `mate_tech_data/connector/` 连接器与 Connector SDK
- `mate_tech_data/pipeline/` Pipeline Spec 与编译
- `mate_tech_data/orchestration/` 调度与运行
- `mate_tech_data/catalog/` 数据资产
- `mate_tech_data/governance/` 治理
- `mate_tech_data/query/` 查询与 Serving
- `mate_tech_data/operator/` Airflow Provider
- `mate_tech_data/acl/` 引擎 ACL Adapter
- `mate_tech_data/api/` 路由聚合
- `mate_tech_data/db/` PostgreSQL 模型与迁移
- `mate_tech_data/outbox/` Outbox
- `mate_tech_data/auth/` 鉴权
- `mate_tech_data/common/` 公共

### 契约与配置

- `docs/active/api/data/openapi.yaml` `mate-tech-data` 完整 OpenAPI 3.1
- `docs/active/specs/2026-07-27-mate-platform-data-architecture.md` 组件细节
- `infra/data/k8s/` Helm values
- `infra/data/docker-compose.observability.yml` Compose profiles

### 前端（嵌入现有 Ontology Data Center）

- `metaplatform-frontend/apps/portal/src/pages/ontology/` 已有 `OntologyDatacenterPage.tsx`；新增子页路由
- `metaplatform-frontend/apps/portal/src/api/data.ts` API 客户端
- `metaplatform-frontend/packages/shared/src/components/` 复用 SubTabs / PageHeader

### 测试

- `mate-platform-backend/packages/mate-tech-data/tests/unit/`
- `mate-platform-backend/packages/mate-tech-data/tests/integration/`
- `mate-platform-backend/packages/mate-tech-data/tests/contract/`
- `tests/e2e/data/` Playwright
- `tests/perf/data/` 压测与混沌

---

## 任务依赖与里程碑

```mermaid
flowchart LR
  D0[D0 Spike] --> D1[K8s 数据平面] --> D2[mate-tech-data 骨架] --> D3[CDC + Paimon]
  D3 --> D4[Pipeline + Airflow]
  D4 --> D5[Iceberg + Trino + StarRocks]
  D5 --> D6[治理 + 安全 + 血缘]
  D6 --> D7[本体引擎原位增强]
  D7 --> D8[压测 灾备 GA]
```

---


## D0 Spike（2 周）

**Owner:** D0 owner · **关键路径 ?**

### Task D0.1: 关键链路 Spike

**Files:**
- Create: `infra/data/spike/cdc-paimon-trino/README.md`
- Create: `infra/data/spike/cdc-paimon-trino/docker-compose.yml`
- Create: `infra/data/spike/cdc-paimon-trino/flink-job.sql`
- Create: `infra/data/spike/cdc-paimon-trino/verify.sh`
- Create: `docs/superpowers/reports/2026-07-28-data-spike-d0.md`

- [ ] **Step 1: 编写 docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
  kafka:
    image: confluentinc/cp-kafka:7.8.0
    environment:
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_NODE_ID: 1
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
  paimon:
    image: apache/paimon:0.9
    command: standalone
    ports: ["8081:8081"]
  trino:
    image: trinodb/trino:455
    ports: ["8083:8080"]
    volumes:
      - ./trino-catalog:/etc/trino/catalog
  flink:
    image: flink:1.19
    command: jobmanager
    ports: ["8082:8081"]
    environment:
      FLINK_PROPERTIES: "execution.checkpointing.interval: 10s"
```

- [ ] **Step 2: 编写 Flink SQL**

保存到 `infra/data/spike/cdc-paimon-trino/flink-job.sql`：

```sql
CREATE TABLE source_orders (
  id BIGINT,
  amount DECIMAL(10,2),
  updated_at TIMESTAMP(3),
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'postgres-cdc',
  'hostname' = 'postgres',
  'port' = '5432',
  'username' = 'postgres',
  'password' = 'postgres',
  'database-name' = 'postgres',
  'schema-name' = 'public',
  'table-name' = 'orders',
  'debezium.slot.name' = 'spike_slot'
);

CREATE TABLE sink_orders_paimon (
  id BIGINT,
  amount DECIMAL(10,2),
  updated_at TIMESTAMP(3),
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'paimon',
  'path' = 'file:/tmp/paimon/default.db/orders',
  'sink.parallelism' = '1'
);

INSERT INTO sink_orders_paimon SELECT * FROM source_orders;
```

- [ ] **Step 3: 编写 verify.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
docker compose up -d
sleep 30
docker compose exec flink bash -c "flink run -d /opt/flink/usrlib/paimon-flink-1.19-0.9.0.jar -f /tmp/flink-job.sql"
sleep 60
docker compose exec postgres psql -U postgres -c "INSERT INTO orders VALUES (1, 9.99, now());"
sleep 30
trino --server trino:8080 --execute "SELECT count(*) FROM paimon.default.orders;"
```

- [ ] **Step 4: 运行并记录结果**

```bash
cd infra/data/spike/cdc-paimon-trino
./verify.sh 2>&1 | tee /tmp/spike.log
```

- [ ] **Step 5: 编写 Spike 报告**

报告 `docs/superpowers/reports/2026-07-28-data-spike-d0.md`，至少包含：

- 端到端 CDC → Paimon → Trino 跑通证据（截图 + 输出）
- Flink Job 启动时间、Checkpoint 间隔、Backpressure
- Paimon 文件大小、Compaction 行为
- Trino 查询 P95
- 已知兼容性陷阱（如 Paimon/Iceberg 类型映射、Debezium slot 行为）

- [ ] **Step 6: 提交**

```bash
git add infra/data/spike docs/superpowers/reports
git commit -m "feat(data): D0 spike cdc paimon trino"
```

**门禁：** 端到端链路跑通，Spike 报告存在。

---

## D1 Kubernetes 数据平面（4 周）

**Owner:** D1 owner · **关键路径 ?**

### Task D1.1: Helm Chart 骨架

**Files:**
- Create: `infra/data/k8s/charts/mate-data-platform/Chart.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/values.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/values-dev.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/kafka.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/minio.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/flink-operator.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/airflow.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/trino.yaml`

- [ ] **Step 1: Chart.yaml**

```yaml
apiVersion: v2
name: mate-data-platform
version: 0.1.0
appVersion: "0.1.0"
```

- [ ] **Step 2: values.yaml 默认**

```yaml
global:
  tenant: default
  storageClass: standard
kafka:
  replicas: 3
  storageSize: 100Gi
minio:
  storageSize: 200Gi
flink:
  jobmanager:
    replicas: 1
  taskmanager:
    replicas: 3
  resources:
    cpu: "2"
    memory: "4Gi"
airflow:
  executor: KubernetesExecutor
trino:
  workers: 3
```

- [ ] **Step 3: Kafka StatefulSet 模板**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
spec:
  replicas: 3
  serviceName: kafka
  selector:
    matchLabels:
      app: kafka
  template:
    metadata:
      labels:
        app: kafka
    spec:
      containers:
        - name: kafka
          image: confluentinc/cp-kafka:7.8.0
          env:
            - name: KAFKA_PROCESS_ROLES
              value: broker,controller
            - name: KAFKA_NODE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.labels["statefulset.kubernetes.io/pod-name"]
```

- [ ] **Step 4: MinIO / Flink Operator / Airflow / Trino 模板**

按各自 Helm 标准结构补齐：Deployment、Service、ServiceAccount、ConfigMap、Secret 模板。

- [ ] **Step 5: 验证渲染**

```bash
helm template mate-data-platform infra/data/k8s/charts/mate-data-platform > /tmp/rendered.yaml
kubectl --dry-run=client apply -f /tmp/rendered.yaml
```

- [ ] **Step 6: 提交**

```bash
git add infra/data/k8s
git commit -m "feat(data): d1 k8s helm chart skeleton"
```

### Task D1.2: Argo CD 应用

**Files:**
- Create: `infra/data/k8s/argocd/mate-data-platform.yaml`
- Create: `infra/data/k8s/argocd/appset.yaml`

- [ ] **Step 1: ApplicationSet**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: mate-data-platform
spec:
  generators:
    - list:
        elements:
          - env: dev
            cluster: dev
          - env: prod
            cluster: prod
  template:
    metadata:
      name: 'mate-data-platform-{{env}}'
    spec:
      project: mate
      source:
        repoURL: https://github.com/your-org/metaplatform
        path: infra/data/k8s/charts/mate-data-platform
        helm:
          valueFiles:
            - values-{{env}}.yaml
      destination:
        server: '{{cluster}}'
```

- [ ] **Step 2: 提交**

```bash
git add infra/data/k8s/argocd
git commit -m "feat(data): d1 argocd applicationset"
```

### Task D1.3: 故障恢复演练

**Files:**
- Create: `docs/superpowers/reports/2026-07-28-data-k8s-drill.md`

- [ ] **Step 1: 注入故障**

- 杀掉一个 Kafka broker
- 重启 Flink TaskManager
- 删除 Paimon 文件再恢复

- [ ] **Step 2: 验证恢复**

- 端到端 P95 不劣化超过 50%
- RPO/RTO 数值记录

- [ ] **Step 3: 提交报告**

```bash
git add docs/superpowers/reports
git commit -m "docs(data): d1 k8s failure recovery drill"
```

**门禁：** 关键组件健康检查全部就绪；故障恢复演练报告完成。

---


## D2 mate-tech-data 骨架（4 周）

**Owner:** D2 owner · **关键路径 ?**

### Task D2.1: 包骨架与 pyproject

**Files:**
- Create: `mate-platform-backend/packages/mate-tech-data/pyproject.toml`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/__init__.py`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/common/settings.py`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/common/logging.py`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/common/telemetry.py`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/common/errors.py`
- Create: `mate-platform-backend/packages/mate-tech-data/tests/__init__.py`
- Create: `mate-platform-backend/packages/mate-tech-data/tests/conftest.py`
- Create: `mate-platform-backend/packages/mate-tech-data/tests/unit/test_settings.py`

- [ ] **Step 1: pyproject.toml**

```toml
[project]
name = "mate-tech-data"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "pydantic>=2.0",
  "sqlmodel>=0.0.16",
  "httpx>=0.27",
  "aiokafka>=0.11",
  "structlog>=24.1",
  "opentelemetry-api>=1.27",
]
[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "pytest-asyncio>=0.23",
  "testcontainers>=4.7",
  "pyright>=1.1",
]
```

- [ ] **Step 2: settings.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    postgres_dsn: str = "postgresql+asyncpg://mate:mate@postgres:5432/mate_data"
    kafka_bootstrap: str = "kafka:9092"
    flink_rest: str = "http://flink-jobmanager:8081"
    airflow_rest: str = "http://airflow-webserver:8080"
    gravitino_rest: str = "http://gravitino:8090"
    openmetadata_rest: str = "http://openmetadata:8585"
    ranger_rest: str = "http://ranger:6080"
    openbao_addr: str = "http://openbao:8200"
    keycloak_issuer: str = "http://keycloak:8080/realms/mate"
    otlp_endpoint: str = "http://otel-collector:4317"

settings = Settings()
```

- [ ] **Step 3: logging.py / telemetry.py / errors.py**

```python
import structlog
log = structlog.get_logger("mate_tech_data")
```

```python
from opentelemetry import trace
tracer = trace.get_tracer("mate_tech_data")
```

```python
class MateDataError(Exception):
    pass
class ConnectorError(MateDataError): pass
class PipelineError(MateDataError): pass
class QualityGateError(MateDataError): pass
```

- [ ] **Step 4: conftest.py**

```python
import pytest
from mate_tech_data.common.settings import settings
@pytest.fixture(autouse=True)
def _settings(monkeypatch):
    monkeypatch.setattr(settings, "postgres_dsn", "postgresql+asyncpg://test:test@localhost:5432/test")
```

- [ ] **Step 5: test_settings.py**

```python
def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("MATE_DATA_POSTGRES_DSN", "postgresql+asyncpg://x/y/z")
    from mate_tech_data.common.settings import Settings
    s = Settings()
    assert "x/y/z" in s.postgres_dsn
```

- [ ] **Step 6: 跑测**

```bash
uv sync
uv run pytest packages/mate-tech-data/tests/unit/test_settings.py -v
uv run pyright packages/mate-tech-data
```

- [ ] **Step 7: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d2 mate tech data skeleton"
```

### Task D2.2: ACL Adapter 注册中心

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/acl/registry.py`
- Create: `mate-tech-data/src/mate_tech_data/acl/kafka.py`
- Create: `mate-tech-data/tests/unit/acl/test_registry.py`

- [ ] **Step 1: registry.py**

```python
from typing import Protocol, Any
class EngineAdapter(Protocol):
    name: str
    async def health(self) -> dict[str, Any]: ...
class EngineRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, EngineAdapter] = {}
    def register(self, a: EngineAdapter) -> None:
        self._adapters[a.name] = a
    def get(self, name: str) -> EngineAdapter:
        return self._adapters[name]
    def all(self) -> dict[str, EngineAdapter]:
        return dict(self._adapters)
registry = EngineRegistry()
```

- [ ] **Step 2: kafka.py**

```python
from aiokafka import AIOKafkaProducer
from .registry import EngineAdapter
class KafkaAdapter:
    name = "kafka"
    def __init__(self, bootstrap: str) -> None:
        self.bootstrap = bootstrap
        self.producer = AIOKafkaProducer(bootstrap_servers=bootstrap)
    async def health(self) -> dict[str, str]:
        return {"status": "ok", "bootstrap": self.bootstrap}
```

- [ ] **Step 3: test_registry.py**

```python
from mate_tech_data.acl.registry import EngineRegistry
from mate_tech_data.acl.kafka import KafkaAdapter
async def test_register_and_get():
    r = EngineRegistry()
    a = KafkaAdapter(bootstrap="localhost:9092")
    r.register(a)
    assert r.get("kafka") is a
```

- [ ] **Step 4: 跑测并提交**

```bash
uv run pytest packages/mate-tech-data/tests/unit/acl -v
git add packages/mate-tech-data
git commit -m "feat(data): d2 acl registry and kafka adapter"
```

### Task D2.3: 领域模型 + 数据库迁移

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/db/models.py`
- Create: `mate-tech-data/src/mate_tech_data/db/migrations/env.py`
- Create: `mate-tech-data/src/mate_tech_data/db/migrations/versions/0001_init.py`
- Create: `mate-tech-data/tests/integration/db/test_migration.py`

- [ ] **Step 1: SQLModel 基类**

```python
from datetime import datetime
from sqlmodel import SQLModel, Field
class BaseModel(SQLModel):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

- [ ] **Step 2: 初始化 Alembic**

```bash
cd packages/mate-tech-data
alembic init -t async src/mate_tech_data/db/migrations
```

- [ ] **Step 3: 编写 0001_init.py**

包含 `data_source`、`connector_definition`、`schema_snapshot`、`pipeline`、`pipeline_version`、`node`、`edge`、`deployment`、`artifact`、`schedule`、`run`、`backfill`、`checkpoint`、`savepoint`、`data_asset`、`dataset_version`、`data_product`、`contract`、`subscription`、`lineage_edge`、`quality_suite`、`quality_run`、`classification`、`policy_binding`、`sla`、`saved_query`、`metric` 表。

- [ ] **Step 4: Testcontainers 集成测试**

```python
import pytest
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

@pytest.fixture
async def engine():
    pg = PostgresContainer("postgres:16-alpine")
    pg.start()
    e = create_async_engine(pg.get_connection_url())
    async with e.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield e
    pg.stop()

async def test_init_migration(engine):
    async with engine.connect() as conn:
        rows = await conn.execute(text("SELECT tablename FROM pg_tables"))
        names = {r[0] for r in rows}
    assert "data_source" in names
    assert "pipeline" in names
```

- [ ] **Step 5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-data/tests/integration/db -v
git add packages/mate-tech-data
git commit -m "feat(data): d2 db schema init migration"
```

### Task D2.4: FastAPI 启动

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/main.py`
- Create: `mate-tech-data/src/mate_tech_data/api/deps.py`
- Create: `mate-tech-data/src/mate_tech_data/api/routes/health.py`
- Create: `mate-tech-data/tests/integration/api/test_health.py`

- [ ] **Step 1: main.py**

```python
from fastapi import FastAPI
from mate_tech_data.api.routes import health
app = FastAPI(title="mate-tech-data", version="0.1.0")
app.include_router(health.router, prefix="/api/v1/data")
```

- [ ] **Step 2: health.py**

```python
from fastapi import APIRouter
router = APIRouter()
@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 3: 集成测试**

```python
from httpx import AsyncClient, ASGITransport
from mate_tech_data.main import app
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.get("/api/v1/data/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 4: 跑测并提交**

```bash
uv run pytest packages/mate-tech-data/tests/integration/api -v
git add packages/mate-tech-data
git commit -m "feat(data): d2 fastapi app shell"
```

### Task D2.5: 契约 OpenAPI 初稿

**Files:**
- Create: `docs/active/api/data/openapi.yaml`
- Create: `docs/superpowers/specs/2026-07-28-mate-tech-data-openapi.md`

- [ ] **Step 1: 写 OpenAPI 3.1 包含**

- `/api/v1/data/datasources`
- `/api/v1/data/pipelines`
- `/api/v1/data/runs`
- `/api/v1/data/lakehouse`
- `/api/v1/data/catalog`
- `/api/v1/data/lineage`
- `/api/v1/data/quality`
- `/api/v1/data/query`
- `/api/v1/data/products`
- `/api/v1/data/health`

- [ ] **Step 2: Redocly lint**

```bash
npx @redocly/cli lint docs/active/api/data/openapi.yaml
npx oasdiff breaking docs/active/api/data/openapi.yaml 1.0.0 docs/active/api/data/openapi.yaml
```

- [ ] **Step 3: 提交**

```bash
git add docs/active/api/data
git commit -m "docs(data): d2 openapi contract"
```

**门禁：** `mate-tech-data` 服务可启动，单元/集成测试通过，OpenAPI 契约通过 Redocly 与 oasdiff CI。

---

## D3 CDC + Paimon ODS/DWD（5 周）

**Owner:** D3 owner · **关键路径 ?**

### Task D3.1: Connector SDK

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/connector/models.py`
- Create: `mate-tech-data/src/mate_tech_data/connector/engine_adapters/postgres_cdc.py`
- Create: `mate-tech-data/src/mate_tech_data/connector/engine_adapters/mysql_cdc.py`
- Create: `mate-tech-data/src/mate_tech_data/connector/engine_adapters/kafka_topic.py`
- Create: `mate-tech-data/src/mate_tech_data/connector/engine_adapters/s3_batch.py`
- Create: `mate-tech-data/src/mate_tech_data/connector/service.py`
- Create: `mate-tech-data/src/mate_tech_data/connector/api.py`
- Create: `mate-tech-data/tests/unit/connector/test_models.py`
- Create: `mate-tech-data/tests/integration/connector/test_postgres_cdc.py`

- [ ] **Step 1: models.py**

```python
from enum import Enum
from sqlmodel import Field
from typing import Any
from pydantic import AnyUrl
from ..db.models import BaseModel

class ConnectorType(str, Enum):
    POSTGRES_CDC = "postgres_cdc"
    MYSQL_CDC = "mysql_cdc"
    KAFKA_TOPIC = "kafka_topic"
    S3_BATCH = "s3_batch"

class DataSource(BaseModel, table=True):
    __tablename__ = "data_source"
    name: str
    type: ConnectorType
    config: dict[str, Any]
    credential_ref: str | None = None
    status: str = "active"

class SchemaSnapshot(BaseModel, table=True):
    __tablename__ = "schema_snapshot"
    data_source_id: int
    fields: list[dict[str, Any]]
```

- [ ] **Step 2: postgres_cdc.py**

```python
class PostgresCDCAdapter:
    name = "postgres_cdc"
    async def discover(self, conn: dict[str, Any]) -> list[dict[str, Any]]:
        ...
    async def test_connection(self, conn: dict[str, Any]) -> bool:
        ...
```

- [ ] **Step 3: unit test**

```python
from mate_tech_data.connector.models import DataSource, ConnectorType
def test_data_source_roundtrip():
    s = DataSource(name="erp", type=ConnectorType.POSTGRES_CDC, config={"host": "x"})
    assert s.type == ConnectorType.POSTGRES_CDC
```

- [ ] **Step 4: integration test**

使用 Testcontainers 启动 PostgreSQL，执行 `discover` 与 `test_connection`。

- [ ] **Step 5: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d3 connector sdk with cdc and kafka"
```

### Task D3.2: Paimon ODS/DWD 写入

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/compiler.py`
- Create: `mate-tech-data/src/mate_tech_data/acl/paimon.py`
- Create: `mate-tech-data/tests/integration/pipeline/test_paimon_compile.py`

- [ ] **Step 1: paimon.py**

封装 `pypaimon` 客户端，支持：

- `create_catalog(name, warehouse)` 
- `create_table(catalog, db, table_name, schema)`
- `commit(catalog, db, table_name, records)`

- [ ] **Step 2: compiler.py 编译 CDC→Paimon**

```python
def compile_cdc_to_paimon(source: DataSource, sink_db: str, sink_table: str) -> str:
    return f"""
CREATE TABLE source_{source.id} (...)
WITH ('connector' = 'postgres-cdc', ...);
CREATE TABLE sink_{sink_table} (...)
WITH ('connector' = 'paimon', 'path' = 's3://bucket/{sink_db}/{sink_table}', ...);
INSERT INTO sink_{sink_table} SELECT * FROM source_{source.id};
"""
```

- [ ] **Step 3: integration test**

使用 Testcontainers 启动 Flink + MinIO + PostgreSQL，提交编译产物并验证 Paimon 文件生成。

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d3 paimon ods dwd compiler"
```

### Task D3.3: 回放与故障注入

**Files:**
- Create: `mate-tech-data/tests/integration/pipeline/test_replay.py`
- Create: `docs/superpowers/reports/2026-07-28-data-replay-d3.md`

- [ ] **Step 1: Golden Dataset**

存放在 `tests/integration/data/orders.csv`：

```
id,amount,updated_at
1,9.99,2026-07-01T00:00:00Z
2,19.99,2026-07-01T00:00:01Z
```

- [ ] **Step 2: 回放测试**

```python
async def test_replay_pipeline(engine):
    res = await engine.replay(pipeline_id="demo", dataset="tests/integration/data/orders.csv")
    rows = res["rows"]
    assert rows == 2
```

- [ ] **Step 3: 故障注入**

- 杀掉 TaskManager，验证 Savepoint 与重启
- 注入乱序事件，验证 Paimon 主键更新
- 注入 Schema 变更，验证拒绝并进入隔离区

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data docs/superpowers/reports
git commit -m "test(data): d3 replay and fault injection"
```

**门禁：** CDC 跑通；Upsert/Delete 正确；乱序与回放对账无差异；故障注入 P50 恢复 < 30s。

---

## D4 Pipeline Spec + Airflow（5 周）

**Owner:** D4 owner · **关键路径 ?**

### Task D4.1: Canonical Spec 与 JSON Schema

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/canonical_spec.py`
- Create: `docs/active/specs/2026-07-28-mate-tech-data-pipeline-spec.json`
- Create: `mate-tech-data/tests/unit/pipeline/test_canonical_spec.py`

- [ ] **Step 1: 写 JSON Schema**

至少包含 `nodes`（type/source/transform/sink/quality/map）、`edges`、`resources`、`parameters`、`contract`、`schedule`、`approval` 字段。

- [ ] **Step 2: Python 校验器**

```python
import jsonschema
from ..common.errors import PipelineError
def validate_spec(spec: dict) -> None:
    try:
        jsonschema.validate(spec, SCHEMA)
    except jsonschema.ValidationError as e:
        raise PipelineError(f"invalid pipeline spec: {e.message}") from e
```

- [ ] **Step 3: 单元测试**

覆盖：合法 spec、缺字段、错类型、循环依赖。

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data docs/active/specs
git commit -m "feat(data): d4 pipeline canonical spec"
```

### Task D4.2: Pipeline Compiler

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/compiler.py`
- Create: `mate-tech-data/tests/unit/pipeline/test_compiler.py`

- [ ] **Step 1: 三种模式编译**

- `compile_sql(spec)` 返回 Flink SQL
- `compile_flink_job(spec)` 返回 `FlinkDeployment` manifest
- `compile_airflow_dag(spec)` 返回 DAG bundle dict

- [ ] **Step 2: governance manifest**

`compile_governance(spec)` 返回 OpenLineage / Quality / Ranger intent。

- [ ] **Step 3: 单元测试**

- 每个模式至少 1 个快照测试
- 同一 spec 编译结果稳定（哈希稳定）

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4 pipeline compiler flink sql airflow"
```

### Task D4.3: Airflow Provider

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/operator/flink_operator.py`
- Create: `mate-tech-data/src/mate_tech_data/operator/quality_gate_operator.py`
- Create: `mate-tech-data/src/mate_tech_data/operator/data_product_publish_operator.py`
- Create: `mate-tech-data/tests/integration/operator/test_airflow_provider.py`

- [ ] **Step 1: FlinkSubmitOperator**

调用 Flink Kubernetes Operator REST，提交 `FlinkDeployment`，等待 `RUNNING`，返回 jobId。

- [ ] **Step 2: QualityGateOperator**

调用 `mate-tech-data` 的 `/quality/runs` 端点，断言全部通过。

- [ ] **Step 3: DataProductPublishOperator**

将 ADS 表的版本写入 Catalog，发布事件。

- [ ] **Step 4: 集成测试**

使用 Testcontainers 启动 Airflow + Flink Operator + mate-tech-data，触发一次 DAG 运行。

- [ ] **Step 5: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4 airflow flink operators"
```

### Task D4.4: 发布状态机

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/service.py`
- Create: `mate-tech-data/src/mate_tech_data/pipeline/api.py`
- Create: `mate-tech-data/tests/integration/pipeline/test_state_machine.py`

- [ ] **Step 1: 状态机**

`DRAFT → VALIDATED → IN_REVIEW → DEPLOYED → RUNNING / PAUSED / FAILED → RETIRED`

- [ ] **Step 2: API 端点**

- `POST /api/v1/data/pipelines`
- `POST /api/v1/data/pipelines/{id}/validate`
- `POST /api/v1/data/pipelines/{id}/deploy`
- `POST /api/v1/data/pipelines/{id}/run`
- `POST /api/v1/data/pipelines/{id}/pause`
- `POST /api/v1/data/pipelines/{id}/retire`

- [ ] **Step 3: 集成测试**

完整跑一遍 DRAFT → RETIRED。

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4 pipeline state machine api"
```

**门禁：** 至少 1 条 Pipeline 通过 SQL + 1 条通过 Java Flink + 1 条通过 PyFlink，端到端跑通并能回滚。

---


## D5 Iceberg + Trino + StarRocks（4 周）

**Owner:** D5 owner · **关键路径 ?**

### Task D5.1: Iceberg 数据产品发布

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/acl/iceberg.py`
- Create: `mate-tech-data/src/mate_tech_data/catalog/service.py`
- Create: `mate-tech-data/tests/integration/catalog/test_iceberg_publish.py`

- [ ] **Step 1: iceberg.py**

封装 PyIceberg REST catalog 客户端。

- [ ] **Step 2: 提升 Pipeline**

`promote_to_iceberg(paimon_db, paimon_table, iceberg_db, iceberg_table)`：

- 读 Paimon 最新快照
- 物化到 Iceberg
- 写入 OpenLineage `data.product.certified.v1`

- [ ] **Step 3: integration test**

使用 Testcontainers 启动 Iceberg REST + Trino，验证 Iceberg 表可被 Trino 查询。

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5 iceberg promotion"
```

### Task D5.2: Trino Gateway

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/query/trino_gateway.py`
- Create: `mate-tech-data/src/mate_tech_data/query/api.py`
- Create: `mate-tech-data/tests/integration/query/test_trino.py`

- [ ] **Step 1: gateway**

```python
class TrinoGateway:
    async def execute(self, sql: str, principal: Principal) -> QueryResult:
        ...
```

支持 Ranger 鉴权注入、超时、Limit、审计。

- [ ] **Step 2: API 端点**

- `POST /api/v1/data/query`
- `GET /api/v1/data/query/{id}`

- [ ] **Step 3: integration test**

启动 Trino + Iceberg + Ranger，验证查询通过鉴权与限流。

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5 trino query gateway"
```

### Task D5.3: StarRocks Serving

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/query/starrocks_gateway.py`
- Create: `mate-tech-data/tests/integration/query/test_starrocks.py`

- [ ] **Step 1: gateway**

- 创建外部表指向 Iceberg
- 物化视图
- 异步物化与同步刷新

- [ ] **Step 2: 集成测试**

启动 StarRocks + Iceberg，验证 ADS 查询 P95 1–3s。

- [ ] **Step 3: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5 starrocks serving"
```

**门禁：** 至少 3 个认证数据产品可被 BI/RAG/Agent 订阅；StarRocks P95 1–3s。

---

## D6 治理与安全（4 周）

**Owner:** D6 owner · **关键路径 ?**

### Task D6.1: Gravitino 联邦

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/catalog/gravitino_adapter.py`
- Create: `mate-tech-data/tests/integration/catalog/test_gravitino.py`

- [ ] **Step 1: 联邦 Paimon + Iceberg + Kafka + S3**

- 创建 Catalog
- 绑定 Namespace
- 同步 OpenLineage 写入 `data.schema.changed.v1`

- [ ] **Step 2: 集成测试**

- 验证 4 类 Catalog 联合查询
- 验证 Schema 变更事件被 OpenMetadata 消费

- [ ] **Step 3: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 gravitino federation"
```

### Task D6.2: OpenMetadata 治理

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/catalog/openmetadata_adapter.py`
- Create: `mate-tech-data/tests/integration/catalog/test_openmetadata.py`

- [ ] **Step 1: Adapter**

- 创建 Dataset / Owner / Glossary / Tag
- 上报 Quality
- 上报 Lineage（结合 OpenLineage）

- [ ] **Step 2: 集成测试**

- 验证 lineage 渲染
- 验证 quality 报告

- [ ] **Step 3: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 openmetadata governance"
```

### Task D6.3: 质量与血缘

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/governance/quality.py`
- Create: `mate-tech-data/src/mate_tech_data/governance/lineage.py`
- Create: `mate-tech-data/tests/integration/governance/test_quality.py`

- [ ] **Step 1: Quality**

封装 Great Expectations 规则与运行：

```python
class QualityService:
    async def run(self, suite: str, dataset: str) -> QualityRun: ...
```

- [ ] **Step 2: Lineage**

监听 Airflow DAG run 结束事件，上报 OpenLineage。

- [ ] **Step 3: 集成测试**

- 触发一次失败的质量运行，断言阻断发布
- 验证 OpenLineage 事件链路

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 quality and lineage"
```

### Task D6.4: Ranger + OpenBao

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/governance/policy.py`
- Create: `mate-tech-data/src/mate_tech_data/governance/secrets.py`
- Create: `mate-tech-data/tests/integration/governance/test_ranger.py`
- Create: `mate-tech-data/tests/integration/governance/test_openbao.py`

- [ ] **Step 1: Ranger 下发**

- 从 Pydantic 模型生成 Ranger Policy
- 测试连接器使用 Data Product 时注入 policy 上下文

- [ ] **Step 2: OpenBao 动态凭证**

- 凭证不存 Pipeline Spec
- 通过 OpenBao API 拉取短期 token

- [ ] **Step 3: 集成测试**

- 验证越权访问被 Ranger 阻断
- 验证密钥轮换

- [ ] **Step 4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 ranger and openbao"
```

**门禁：** 越权测试 100% 阻断；密钥 30 天自动轮换；质量失败 100% 阻断发布；血缘可下钻到字段级。

---

## D7 Ontology Studio 原位增强（5 周）

**Owner:** D7 owner · **关键路径 ?**

### Task D7.1: 前端 API 客户端

**Files:**
- Create: `metaplatform-frontend/apps/portal/src/api/data.ts`
- Create: `metaplatform-frontend/apps/portal/src/api/data.types.ts`

- [ ] **Step 1: TypeScript 类型**

定义 `DataSource`、`Pipeline`、`DataProduct` 等接口，对应 OpenAPI 契约。

- [ ] **Step 2: 客户端封装**

```ts
export async function listPipelines(): Promise<Pipeline[]> {
  const r = await api.get('/v1/data/pipelines');
  return r.data.items;
}
```

- [ ] **Step 3: 提交**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7 data api client"
```

### Task D7.2: 数据中心子页

**Files:**
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/OverviewPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/SourcesPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/PipelinesPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/LakehousePage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/GovernancePage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/OperationsPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/App.tsx`（追加路由）
- Create: `metaplatform-frontend/tests/e2e/data/datacenter.spec.ts`

- [ ] **Step 1: 总览页**

卡片：数据源数、Pipeline 数、湖仓资产数、质量评分、运行告警。

- [ ] **Step 2: 数据源页**

数据源列表 + 状态、Schema Discovery、表/字段映射预览。

- [ ] **Step 3: Pipeline 页**

画布（Visual Canvas）+ Flink SQL 编辑器 + 编译/发布/运行入口。

- [ ] **Step 4: 湖仓与 SQL**

按层（Landing / ODS / DWD / DWS / ADS）展示，支持 StarRocks / Trino 查询。

- [ ] **Step 5: 治理页**

质量规则、SLA、血缘、Owner、术语、标签。

- [ ] **Step 6: 运行监控**

运行实例、Savepoint、补数、回滚、告警。

- [ ] **Step 7: 路由**

```tsx
<Route path="ontology/datacenter" element={<OverviewPage />} />
<Route path="ontology/datacenter/sources" element={<SourcesPage />} />
<Route path="ontology/datacenter/pipelines" element={<PipelinesPage />} />
<Route path="ontology/datacenter/lakehouse" element={<LakehousePage />} />
<Route path="ontology/datacenter/governance" element={<GovernancePage />} />
<Route path="ontology/datacenter/operations" element={<OperationsPage />} />
```

- [ ] **Step 8: E2E 测试**

```ts
test('data center overview renders', async ({ page }) => {
  await page.goto('/ontology/datacenter');
  await expect(page.getByText('数据源总数')).toBeVisible();
});
```

- [ ] **Step 9: 提交**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7 ontology data center pages"
```

### Task D7.3: 语义映射原位

**Files:**
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/components/SemanticMapButton.tsx`
- Create: `metaplatform-frontend/tests/e2e/data/semantic-map.spec.ts`

- [ ] **Step 1: 按钮**

在每个湖仓资产卡片上加“映射到本体”按钮，调用 `/v1/data/catalog/{id}/map` 端点。

- [ ] **Step 2: E2E**

从数据源到 Concept 一键创建映射。

- [ ] **Step 3: 提交**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7 semantic map button"
```

**门禁：** 现有 4 个本体引擎页签与子页签不回归；语义映射一气呵成。

---

## D8 压测 灾备 GA（4 周）

**Owner:** D8 owner · **关键路径 ?**

### Task D8.1: 容量与压测

**Files:**
- Create: `tests/perf/data/scenarios/cdc_500_pipeline.py`
- Create: `tests/perf/data/scenarios/trino_p95.py`
- Create: `tests/perf/data/scenarios/starrocks_p95.py`
- Create: `docs/superpowers/reports/2026-07-28-data-perf-d8.md`

- [ ] **Step 1: 500 Pipeline 压测**

- 同时跑 500 条 Pipeline
- 验证控制面 P95 < 200ms
- 验证数据平面 Kafka Lag < 60s

- [ ] **Step 2: 查询 P95**

- Trino 交互查询 P95 < 30s
- StarRocks P95 1–3s
- 数据产品查询 P95 < 5s

- [ ] **Step 3: 报告**

```bash
git add tests/perf docs/superpowers/reports
git commit -m "test(data): d8 capacity and p95"
```

### Task D8.2: 混沌与灾备

**Files:**
- Create: `tests/chaos/data/kafka_broker_outage.yaml`
- Create: `tests/chaos/data/flink_tm_kill.yaml`
- Create: `tests/chaos/data/postgres_primary_failover.yaml`
- Create: `docs/superpowers/reports/2026-07-28-data-chaos-d8.md`

- [ ] **Step 1: 注入**

- 杀掉 1 个 Kafka broker
- 杀掉 Flink TaskManager
- Postgres Primary 故障切换

- [ ] **Step 2: 验证**

- 控制面 RPO ≤ 5 分钟
- 关键流 RPO ≤ Checkpoint 周期
- 控制面 RTO ≤ 30 分钟
- 关键流 RTO ≤ 15 分钟

- [ ] **Step 3: 报告**

```bash
git add tests/chaos docs/superpowers/reports
git commit -m "test(data): d8 chaos and dr"
```

### Task D8.3: GA 验收

**Files:**
- Create: `docs/superpowers/reports/2026-07-28-data-ga-d8.md`
- Create: `docs/superpowers/reports/2026-07-28-data-acceptance-checklist.md`

- [ ] **Step 1: 走查全部 GA 门禁**

- 端到端 3 类 Pipeline 跑通
- 无静默丢数
- 数据产品可被 BI/RAG/Agent 订阅
- 性能、可用性、SLO、灾备指标全部达标
- 旧 Java `TECH-DATA` 保持归档

- [ ] **Step 2: 发布 GA 报告**

- 容量、性能、灾备
- 已知风险与限制
- 后续优化方向

- [ ] **Step 3: 提交**

```bash
git add docs/superpowers/reports
git commit -m "docs(data): d8 ga report"
```

**门禁：** 所有 v1.0 GA 验收门禁全部通过；`/api/v1/data/*` 契约兼容旧实现；无 P0/P1 缺陷遗留。

---

## 跨阶段质量与合规

- **类型检查**：`uv run pyright packages/mate-tech-data` 全绿
- **Lint**：`uv run ruff check packages/mate-tech-data` 全绿
- **测试**：单元 ≥ 80% 覆盖、集成覆盖全部 Engine Adapter、契约测试覆盖所有 REST 端点
- **CI**：`GitHub Actions` 增加 `data-plane-ci`：lint + type + unit + contract + oasdiff
- **前端**：`pnpm typecheck`、`pnpm lint`、`pnpm test:e2e` 全部绿
- **可观测**：OTel SDK、Prometheus 指标、Loki 日志、Kafka Lag / Flink Checkpoint / Compaction / Trino Queue / StarRocks Load / Quality 失败 / SLA / 成本指标
- **安全**：Ranger 行列权限、OpenBao 凭证、镜像签名、容器只读、非 root
- **可回滚**：Pipeline Version 不可变；部署失败自动回滚到上一 Savepoint；ADS 发布失败保留最后健康版本
