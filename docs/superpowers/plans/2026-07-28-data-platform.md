# Mate Platform Data Platform Implementation Plan (D0�CD8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** �� v3.0 �����֮�ϣ�����������йܴ����� ETL + ���� + ������������������ Python `mate-tech-data`������ƽ���� Flink + Airflow + Paimon + Iceberg + Trino + StarRocks + ����ջ����Ʒ��ڲ������� `Ontology Studio / ��������`������������ APP��

**Architecture:** Python �����棨`mate-tech-data` ģ�黯���壩+ ����ƽ�棨Kubernetes �ϵ� Flink Application / Airflow / Trino / StarRocks / Paimon + Iceberg ���� / Gravitino + OpenMetadata + OpenLineage + Great Expectations + Ranger + OpenBao����������ֻ����״̬�붨�壬������״̬������ Flink / Kafka / �����С����� Pipeline �汾�����ɻع����������������ݲ�Ʒ�� Schema Contract / Quality / Security / Ownership / Approval �����Ž���

**Tech Stack:** Python 3.12��FastAPI��SQLModel��Pydantic v2��httpx��uvloop��granian��pyright strict��Pytest��Testcontainers��Kubernetes��Argo CD��Helm��Flink 1.19��Airflow 3.0��Apache Paimon 0.9��Apache Iceberg 1.5��Trino 455��StarRocks 3.3��Apache Gravitino 0.7��OpenMetadata 1.4��OpenLineage 0.50��Great Expectations 0.18��Apache Ranger 2.4��OpenBao 1.15��Apache Kafka 3.7��Apicurio 2.6��Keycloak 25��Flowable 8��

---

## File Structure

### �����棨`mate-tech-data`��

- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/` ��
- `mate_tech_data/connector/` �������� Connector SDK
- `mate_tech_data/pipeline/` Pipeline Spec �����
- `mate_tech_data/orchestration/` ����������
- `mate_tech_data/catalog/` �����ʲ�
- `mate_tech_data/governance/` ����
- `mate_tech_data/query/` ��ѯ�� Serving
- `mate_tech_data/operator/` Airflow Provider
- `mate_tech_data/acl/` ���� ACL Adapter
- `mate_tech_data/api/` ·�ɾۺ�
- `mate_tech_data/db/` PostgreSQL ģ����Ǩ��
- `mate_tech_data/outbox/` Outbox
- `mate_tech_data/auth/` ��Ȩ
- `mate_tech_data/common/` ����

### ��Լ������

- `docs/active/api/data/openapi.yaml` `mate-tech-data` ���� OpenAPI 3.1
- `docs/active/specs/2026-07-27-mate-platform-data-architecture.md` ���ϸ��
- `infra/data/k8s/` Helm values
- `infra/data/docker-compose.observability.yml` Compose profiles

### ǰ�ˣ�Ƕ������ Ontology Data Center��

- `metaplatform-frontend/apps/portal/src/pages/ontology/` ���� `OntologyDatacenterPage.tsx`��������ҳ·��
- `metaplatform-frontend/apps/portal/src/api/data.ts` API �ͻ���
- `metaplatform-frontend/packages/shared/src/components/` ���� SubTabs / PageHeader

### ����

- `mate-platform-backend/packages/mate-tech-data/tests/unit/`
- `mate-platform-backend/packages/mate-tech-data/tests/integration/`
- `mate-platform-backend/packages/mate-tech-data/tests/contract/`
- `tests/e2e/data/` Playwright
- `tests/perf/data/` ѹ�������

---

## ������������̱�

```mermaid
flowchart LR
  D0[D0 Spike] --> D1[K8s ����ƽ��] --> D2[mate-tech-data �Ǽ�] --> D3[CDC + Paimon]
  D3 --> D4[Pipeline + Airflow]
  D4 --> D5[Iceberg + Trino + StarRocks]
  D5 --> D6[���� + ��ȫ + ѪԵ]
  D6 --> D7[��������ԭλ��ǿ]
  D7 --> D8[ѹ�� �ֱ� GA]
```

---

## D0 Spike��2 �ܣ�

**Owner:** D0 owner �� **�ؼ�·�� ?**

### Task D0.1: �ؼ���· Spike

**Files:**

- Create: `infra/data/spike/cdc-paimon-trino/README.md`
- Create: `infra/data/spike/cdc-paimon-trino/docker-compose.yml`
- Create: `infra/data/spike/cdc-paimon-trino/flink-job.sql`
- Create: `infra/data/spike/cdc-paimon-trino/verify.sh`
- Create: `docs/superpowers/reports/2026-07-28-data-spike-d0.md`

- [ ] **Step 1: ��д docker-compose.yml**

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

- [ ] **Step 2: ��д Flink SQL**

���浽 `infra/data/spike/cdc-paimon-trino/flink-job.sql`��

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

- [ ] **Step 3: ��д verify.sh**

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

- [ ] **Step 4: ���в���¼���**

```bash
cd infra/data/spike/cdc-paimon-trino
./verify.sh 2>&1 | tee /tmp/spike.log
```

- [ ] **Step 5: ��д Spike ����**

���� `docs/superpowers/reports/2026-07-28-data-spike-d0.md`�����ٰ�����

- �˵��� CDC �� Paimon �� Trino ��֤ͨ�ݣ���ͼ + �����
- Flink Job ����ʱ�䡢Checkpoint �����Backpressure
- Paimon �ļ���С��Compaction ��Ϊ
- Trino ��ѯ P95
- ��֪���������壨�� Paimon/Iceberg ����ӳ�䡢Debezium slot ��Ϊ��

- [ ] **Step 6: �ύ**

```bash
git add infra/data/spike docs/superpowers/reports
git commit -m "feat(data): D0 spike cdc paimon trino"
```

**�Ž���** �˵�����·��ͨ��Spike ������ڡ�

---

## D1 Kubernetes ����ƽ�棨4 �ܣ�

**Owner:** D1 owner �� **�ؼ�·�� ?**

### Task D1.1: Helm Chart �Ǽ�

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

- [ ] **Step 2: values.yaml Ĭ��**

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

- [ ] **Step 3: Kafka StatefulSet ģ��**

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

- [ ] **Step 4: MinIO / Flink Operator / Airflow / Trino ģ��**

������ Helm ��׼�ṹ���룺Deployment��Service��ServiceAccount��ConfigMap��Secret ģ�塣

- [ ] **Step 5: ��֤��Ⱦ**

```bash
helm template mate-data-platform infra/data/k8s/charts/mate-data-platform > /tmp/rendered.yaml
kubectl --dry-run=client apply -f /tmp/rendered.yaml
```

- [ ] **Step 6: �ύ**

```bash
git add infra/data/k8s
git commit -m "feat(data): d1 k8s helm chart skeleton"
```

### Task D1.2: Argo CD Ӧ��

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
      name: "mate-data-platform-{{env}}"
    spec:
      project: mate
      source:
        repoURL: https://github.com/your-org/metaplatform
        path: infra/data/k8s/charts/mate-data-platform
        helm:
          valueFiles:
            - values-{{env}}.yaml
      destination:
        server: "{{cluster}}"
```

- [ ] **Step 2: �ύ**

```bash
git add infra/data/k8s/argocd
git commit -m "feat(data): d1 argocd applicationset"
```

### Task D1.3: ���ϻָ�����

**Files:**

- Create: `docs/superpowers/reports/2026-07-28-data-k8s-drill.md`

- [ ] **Step 1: ע�����**

- ɱ��һ�� Kafka broker
- ���� Flink TaskManager
- ɾ�� Paimon �ļ��ٻָ�

- [ ] **Step 2: ��֤�ָ�**

- �˵��� P95 ���ӻ����� 50%
- RPO/RTO ��ֵ��¼

- [ ] **Step 3: �ύ����**

```bash
git add docs/superpowers/reports
git commit -m "docs(data): d1 k8s failure recovery drill"
```

**�Ž���** �ؼ�����������ȫ�����������ϻָ�����������ɡ�

---

## D2 mate-tech-data �Ǽܣ�4 �ܣ�

**Owner:** D2 owner �� **�ؼ�·�� ?**

### Task D2.1: ���Ǽ��� pyproject

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

- [ ] **Step 6: �ܲ�**

```bash
uv sync
uv run pytest packages/mate-tech-data/tests/unit/test_settings.py -v
uv run pyright packages/mate-tech-data
```

- [ ] **Step 7: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d2 mate tech data skeleton"
```

### Task D2.2: ACL Adapter ע������

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

- [ ] **Step 4: �ܲⲢ�ύ**

```bash
uv run pytest packages/mate-tech-data/tests/unit/acl -v
git add packages/mate-tech-data
git commit -m "feat(data): d2 acl registry and kafka adapter"
```

### Task D2.3: ����ģ�� + ���ݿ�Ǩ��

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/db/models.py`
- Create: `mate-tech-data/src/mate_tech_data/db/migrations/env.py`
- Create: `mate-tech-data/src/mate_tech_data/db/migrations/versions/0001_init.py`
- Create: `mate-tech-data/tests/integration/db/test_migration.py`

- [ ] **Step 1: SQLModel ����**

```python
from datetime import datetime
from sqlmodel import SQLModel, Field
class BaseModel(SQLModel):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

- [ ] **Step 2: ��ʼ�� Alembic**

```bash
cd packages/mate-tech-data
alembic init -t async src/mate_tech_data/db/migrations
```

- [ ] **Step 3: ��д 0001_init.py**

���� `data_source`��`connector_definition`��`schema_snapshot`��`pipeline`��`pipeline_version`��`node`��`edge`��`deployment`��`artifact`��`schedule`��`run`��`backfill`��`checkpoint`��`savepoint`��`data_asset`��`dataset_version`��`data_product`��`contract`��`subscription`��`lineage_edge`��`quality_suite`��`quality_run`��`classification`��`policy_binding`��`sla`��`saved_query`��`metric` ����

- [ ] **Step 4: Testcontainers ���ɲ���**

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

- [ ] **Step 5: �ܲⲢ�ύ**

```bash
uv run pytest packages/mate-tech-data/tests/integration/db -v
git add packages/mate-tech-data
git commit -m "feat(data): d2 db schema init migration"
```

### Task D2.4: FastAPI ����

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

- [ ] **Step 3: ���ɲ���**

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

- [ ] **Step 4: �ܲⲢ�ύ**

```bash
uv run pytest packages/mate-tech-data/tests/integration/api -v
git add packages/mate-tech-data
git commit -m "feat(data): d2 fastapi app shell"
```

### Task D2.5: ��Լ OpenAPI ����

**Files:**

- Create: `docs/active/api/data/openapi.yaml`
- Create: `docs/superpowers/specs/2026-07-28-mate-tech-data-openapi.md`

- [ ] **Step 1: д OpenAPI 3.1 ����**

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

- [ ] **Step 3: �ύ**

```bash
git add docs/active/api/data
git commit -m "docs(data): d2 openapi contract"
```

**�Ž���** `mate-tech-data` �������������Ԫ/���ɲ���ͨ����OpenAPI ��Լͨ�� Redocly �� oasdiff CI��

---

## D3 CDC + Paimon ODS/DWD��5 �ܣ�

**Owner:** D3 owner �� **�ؼ�·�� ?**

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

ʹ�� Testcontainers ���� PostgreSQL��ִ�� `discover` �� `test_connection`��

- [ ] **Step 5: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d3 connector sdk with cdc and kafka"
```

### Task D3.2: Paimon ODS/DWD д��

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/pipeline/compiler.py`
- Create: `mate-tech-data/src/mate_tech_data/acl/paimon.py`
- Create: `mate-tech-data/tests/integration/pipeline/test_paimon_compile.py`

- [ ] **Step 1: paimon.py**

��װ `pypaimon` �ͻ��ˣ�֧�֣�

- `create_catalog(name, warehouse)`
- `create_table(catalog, db, table_name, schema)`
- `commit(catalog, db, table_name, records)`

- [ ] **Step 2: compiler.py ���� CDC��Paimon**

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

ʹ�� Testcontainers ���� Flink + MinIO + PostgreSQL���ύ������ﲢ��֤ Paimon �ļ����ɡ�

- [ ] **Step 4: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d3 paimon ods dwd compiler"
```

### Task D3.3: �ط������ע��

**Files:**

- Create: `mate-tech-data/tests/integration/pipeline/test_replay.py`
- Create: `docs/superpowers/reports/2026-07-28-data-replay-d3.md`

- [ ] **Step 1: Golden Dataset**

����� `tests/integration/data/orders.csv`��

```
id,amount,updated_at
1,9.99,2026-07-01T00:00:00Z
2,19.99,2026-07-01T00:00:01Z
```

- [ ] **Step 2: �طŲ���**

```python
async def test_replay_pipeline(engine):
    res = await engine.replay(pipeline_id="demo", dataset="tests/integration/data/orders.csv")
    rows = res["rows"]
    assert rows == 2
```

- [ ] **Step 3: ����ע��**

- ɱ�� TaskManager����֤ Savepoint ������
- ע�������¼�����֤ Paimon ��������
- ע�� Schema �������֤�ܾ������������

- [ ] **Step 4: �ύ**

```bash
git add packages/mate-tech-data docs/superpowers/reports
git commit -m "test(data): d3 replay and fault injection"
```

**�Ž���** CDC ��ͨ��Upsert/Delete ��ȷ��������طŶ����޲��죻����ע�� P50 �ָ� < 30s��

---

## D4 Pipeline Spec + Airflow��5 �ܣ�

**Owner:** D4 owner �� **�ؼ�·�� ?**

### Task D4.1: Canonical Spec �� JSON Schema

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/pipeline/canonical_spec.py`
- Create: `docs/active/specs/2026-07-28-mate-tech-data-pipeline-spec.json`
- Create: `mate-tech-data/tests/unit/pipeline/test_canonical_spec.py`

- [ ] **Step 1: д JSON Schema**

���ٰ��� `nodes`��type/source/transform/sink/quality/map����`edges`��`resources`��`parameters`��`contract`��`schedule`��`approval` �ֶΡ�

- [ ] **Step 2: Python У����**

```python
import jsonschema
from ..common.errors import PipelineError
def validate_spec(spec: dict) -> None:
    try:
        jsonschema.validate(spec, SCHEMA)
    except jsonschema.ValidationError as e:
        raise PipelineError(f"invalid pipeline spec: {e.message}") from e
```

- [ ] **Step 3: ��Ԫ����**

���ǣ��Ϸ� spec��ȱ�ֶΡ������͡�ѭ��������

- [ ] **Step 4: �ύ**

```bash
git add packages/mate-tech-data docs/active/specs
git commit -m "feat(data): d4 pipeline canonical spec"
```

### Task D4.2: Pipeline Compiler

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/pipeline/compiler.py`
- Create: `mate-tech-data/tests/unit/pipeline/test_compiler.py`

- [ ] **Step 1: ����ģʽ����**

- `compile_sql(spec)` ���� Flink SQL
- `compile_flink_job(spec)` ���� `FlinkDeployment` manifest
- `compile_airflow_dag(spec)` ���� DAG bundle dict

- [ ] **Step 2: governance manifest**

`compile_governance(spec)` ���� OpenLineage / Quality / Ranger intent��

- [ ] **Step 3: ��Ԫ����**

- ÿ��ģʽ���� 1 �����ղ���
- ͬһ spec �������ȶ�����ϣ�ȶ���

- [ ] **Step 4: �ύ**

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

���� Flink Kubernetes Operator REST���ύ `FlinkDeployment`���ȴ� `RUNNING`������ jobId��

- [ ] **Step 2: QualityGateOperator**

���� `mate-tech-data` �� `/quality/runs` �˵㣬����ȫ��ͨ����

- [ ] **Step 3: DataProductPublishOperator**

�� ADS ���İ汾д�� Catalog�������¼���

- [ ] **Step 4: ���ɲ���**

ʹ�� Testcontainers ���� Airflow + Flink Operator + mate-tech-data������һ�� DAG ���С�

- [ ] **Step 5: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4 airflow flink operators"
```

### Task D4.4: ����״̬��

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/pipeline/service.py`
- Create: `mate-tech-data/src/mate_tech_data/pipeline/api.py`
- Create: `mate-tech-data/tests/integration/pipeline/test_state_machine.py`

- [ ] **Step 1: ״̬��**

`DRAFT �� VALIDATED �� IN_REVIEW �� DEPLOYED �� RUNNING / PAUSED / FAILED �� RETIRED`

- [ ] **Step 2: API �˵�**

- `POST /api/v1/data/pipelines`
- `POST /api/v1/data/pipelines/{id}/validate`
- `POST /api/v1/data/pipelines/{id}/deploy`
- `POST /api/v1/data/pipelines/{id}/run`
- `POST /api/v1/data/pipelines/{id}/pause`
- `POST /api/v1/data/pipelines/{id}/retire`

- [ ] **Step 3: ���ɲ���**

������һ�� DRAFT �� RETIRED��

- [ ] **Step 4: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4 pipeline state machine api"
```

**�Ž���** ���� 1 �� Pipeline ͨ�� SQL + 1 ��ͨ�� Java Flink + 1 ��ͨ�� PyFlink���˵�����ͨ���ܻع���

---

## D5 Iceberg + Trino + StarRocks��4 �ܣ�

**Owner:** D5 owner �� **�ؼ�·�� ?**

### Task D5.1: Iceberg ���ݲ�Ʒ����

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/acl/iceberg.py`
- Create: `mate-tech-data/src/mate_tech_data/catalog/service.py`
- Create: `mate-tech-data/tests/integration/catalog/test_iceberg_publish.py`

- [ ] **Step 1: iceberg.py**

��װ PyIceberg REST catalog �ͻ��ˡ�

- [ ] **Step 2: ���� Pipeline**

`promote_to_iceberg(paimon_db, paimon_table, iceberg_db, iceberg_table)`��

- �� Paimon ���¿���
- �ﻯ�� Iceberg
- д�� OpenLineage `data.product.certified.v1`

- [ ] **Step 3: integration test**

ʹ�� Testcontainers ���� Iceberg REST + Trino����֤ Iceberg ���ɱ� Trino ��ѯ��

- [ ] **Step 4: �ύ**

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

֧�� Ranger ��Ȩע�롢��ʱ��Limit����ơ�

- [ ] **Step 2: API �˵�**

- `POST /api/v1/data/query`
- `GET /api/v1/data/query/{id}`

- [ ] **Step 3: integration test**

���� Trino + Iceberg + Ranger����֤��ѯͨ����Ȩ��������

- [ ] **Step 4: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5 trino query gateway"
```

### Task D5.3: StarRocks Serving

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/query/starrocks_gateway.py`
- Create: `mate-tech-data/tests/integration/query/test_starrocks.py`

- [ ] **Step 1: gateway**

- �����ⲿ��ָ�� Iceberg
- �ﻯ��ͼ
- �첽�ﻯ��ͬ��ˢ��

- [ ] **Step 2: ���ɲ���**

���� StarRocks + Iceberg����֤ ADS ��ѯ P95 1�C3s��

- [ ] **Step 3: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5 starrocks serving"
```

**�Ž���** ���� 3 ����֤���ݲ�Ʒ�ɱ� BI/RAG/Agent ���ģ�StarRocks P95 1�C3s��

---

## D6 �����밲ȫ��4 �ܣ�

**Owner:** D6 owner �� **�ؼ�·�� ?**

### Task D6.1: Gravitino ����

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/catalog/gravitino_adapter.py`
- Create: `mate-tech-data/tests/integration/catalog/test_gravitino.py`

- [ ] **Step 1: ���� Paimon + Iceberg + Kafka + S3**

- ���� Catalog
- �� Namespace
- ͬ�� OpenLineage д�� `data.schema.changed.v1`

- [ ] **Step 2: ���ɲ���**

- ��֤ 4 �� Catalog ���ϲ�ѯ
- ��֤ Schema ����¼��� OpenMetadata ����

- [ ] **Step 3: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 gravitino federation"
```

### Task D6.2: OpenMetadata ����

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/catalog/openmetadata_adapter.py`
- Create: `mate-tech-data/tests/integration/catalog/test_openmetadata.py`

- [ ] **Step 1: Adapter**

- ���� Dataset / Owner / Glossary / Tag
- �ϱ� Quality
- �ϱ� Lineage����� OpenLineage��

- [ ] **Step 2: ���ɲ���**

- ��֤ lineage ��Ⱦ
- ��֤ quality ����

- [ ] **Step 3: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 openmetadata governance"
```

### Task D6.3: ������ѪԵ

**Files:**

- Create: `mate-tech-data/src/mate_tech_data/governance/quality.py`
- Create: `mate-tech-data/src/mate_tech_data/governance/lineage.py`
- Create: `mate-tech-data/tests/integration/governance/test_quality.py`

- [ ] **Step 1: Quality**

��װ Great Expectations ���������У�

```python
class QualityService:
    async def run(self, suite: str, dataset: str) -> QualityRun: ...
```

- [ ] **Step 2: Lineage**

���� Airflow DAG run �����¼����ϱ� OpenLineage��

- [ ] **Step 3: ���ɲ���**

- ����һ��ʧ�ܵ��������У�������Ϸ���
- ��֤ OpenLineage �¼���·

- [ ] **Step 4: �ύ**

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

- [ ] **Step 1: Ranger �·�**

- �� Pydantic ģ������ Ranger Policy
- ����������ʹ�� Data Product ʱע�� policy ������

- [ ] **Step 2: OpenBao ��̬ƾ֤**

- ƾ֤���� Pipeline Spec
- ͨ�� OpenBao API ��ȡ���� token

- [ ] **Step 3: ���ɲ���**

- ��֤ԽȨ���ʱ� Ranger ���
- ��֤��Կ�ֻ�

- [ ] **Step 4: �ύ**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6 ranger and openbao"
```

**�Ž���** ԽȨ���� 100% ��ϣ���Կ 30 ���Զ��ֻ�������ʧ�� 100% ��Ϸ�����ѪԵ�����굽�ֶμ���

---

## D7 Ontology Studio ԭλ��ǿ��5 �ܣ�

**Owner:** D7 owner �� **�ؼ�·�� ?**

### Task D7.1: ǰ�� API �ͻ���

**Files:**

- Create: `metaplatform-frontend/apps/portal/src/api/data.ts`
- Create: `metaplatform-frontend/apps/portal/src/api/data.types.ts`

- [ ] **Step 1: TypeScript ����**

���� `DataSource`��`Pipeline`��`DataProduct` �Ƚӿڣ���Ӧ OpenAPI ��Լ��

- [ ] **Step 2: �ͻ��˷�װ**

```ts
export async function listPipelines(): Promise<Pipeline[]> {
  const r = await api.get("/v1/data/pipelines");
  return r.data.items;
}
```

- [ ] **Step 3: �ύ**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7 data api client"
```

### Task D7.2: ����������ҳ

**Files:**

- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/OverviewPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/SourcesPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/PipelinesPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/LakehousePage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/GovernancePage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/OperationsPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/App.tsx`��׷��·�ɣ�
- Create: `metaplatform-frontend/tests/e2e/data/datacenter.spec.ts`

- [ ] **Step 1: ����ҳ**

��Ƭ������Դ����Pipeline ���������ʲ������������֡����и澯��

- [ ] **Step 2: ����Դҳ**

����Դ�б� + ״̬��Schema Discovery����/�ֶ�ӳ��Ԥ����

- [ ] **Step 3: Pipeline ҳ**

������Visual Canvas��+ Flink SQL �༭�� + ����/����/������ڡ�

- [ ] **Step 4: ������ SQL**

���㣨Landing / ODS / DWD / DWS / ADS��չʾ��֧�� StarRocks / Trino ��ѯ��

- [ ] **Step 5: ����ҳ**

��������SLA��ѪԵ��Owner�������ǩ��

- [ ] **Step 6: ���м��**

����ʵ����Savepoint���������ع����澯��

- [ ] **Step 7: ·��**

```tsx
<Route path="ontology/datacenter" element={<OverviewPage />} />
<Route path="ontology/datacenter/sources" element={<SourcesPage />} />
<Route path="ontology/datacenter/pipelines" element={<PipelinesPage />} />
<Route path="ontology/datacenter/lakehouse" element={<LakehousePage />} />
<Route path="ontology/datacenter/governance" element={<GovernancePage />} />
<Route path="ontology/datacenter/operations" element={<OperationsPage />} />
```

- [ ] **Step 8: E2E ����**

```ts
test("data center overview renders", async ({ page }) => {
  await page.goto("/ontology/datacenter");
  await expect(page.getByText("����Դ����")).toBeVisible();
});
```

- [ ] **Step 9: �ύ**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7 ontology data center pages"
```

### Task D7.3: ����ӳ��ԭλ

**Files:**

- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/components/SemanticMapButton.tsx`
- Create: `metaplatform-frontend/tests/e2e/data/semantic-map.spec.ts`

- [ ] **Step 1: ��ť**

��ÿ�������ʲ���Ƭ�ϼӡ�ӳ�䵽���塱��ť������ `/v1/data/catalog/{id}/map` �˵㡣

- [ ] **Step 2: E2E**

������Դ�� Concept һ������ӳ�䡣

- [ ] **Step 3: �ύ**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7 semantic map button"
```

**�Ž���** ���� 4 ����������ҳǩ����ҳǩ���ع飻����ӳ��һ���ǳɡ�

---

## D8 ѹ�� �ֱ� GA��4 �ܣ�

**Owner:** D8 owner �� **�ؼ�·�� ?**

### Task D8.1: ������ѹ��

**Files:**

- Create: `tests/perf/data/scenarios/cdc_500_pipeline.py`
- Create: `tests/perf/data/scenarios/trino_p95.py`
- Create: `tests/perf/data/scenarios/starrocks_p95.py`
- Create: `docs/superpowers/reports/2026-07-28-data-perf-d8.md`

- [ ] **Step 1: 500 Pipeline ѹ��**

- ͬʱ�� 500 �� Pipeline
- ��֤������ P95 < 200ms
- ��֤����ƽ�� Kafka Lag < 60s

- [ ] **Step 2: ��ѯ P95**

- Trino ������ѯ P95 < 30s
- StarRocks P95 1�C3s
- ���ݲ�Ʒ��ѯ P95 < 5s

- [ ] **Step 3: ����**

```bash
git add tests/perf docs/superpowers/reports
git commit -m "test(data): d8 capacity and p95"
```

### Task D8.2: �������ֱ�

**Files:**

- Create: `tests/chaos/data/kafka_broker_outage.yaml`
- Create: `tests/chaos/data/flink_tm_kill.yaml`
- Create: `tests/chaos/data/postgres_primary_failover.yaml`
- Create: `docs/superpowers/reports/2026-07-28-data-chaos-d8.md`

- [ ] **Step 1: ע��**

- ɱ�� 1 �� Kafka broker
- ɱ�� Flink TaskManager
- Postgres Primary �����л�

- [ ] **Step 2: ��֤**

- ������ RPO �� 5 ����
- �ؼ��� RPO �� Checkpoint ����
- ������ RTO �� 30 ����
- �ؼ��� RTO �� 15 ����

- [ ] **Step 3: ����**

```bash
git add tests/chaos docs/superpowers/reports
git commit -m "test(data): d8 chaos and dr"
```

### Task D8.3: GA ����

**Files:**

- Create: `docs/superpowers/reports/2026-07-28-data-ga-d8.md`
- Create: `docs/superpowers/reports/2026-07-28-data-acceptance-checklist.md`

- [ ] **Step 1: �߲�ȫ�� GA �Ž�**

- �˵��� 3 �� Pipeline ��ͨ
- �޾�Ĭ����
- ���ݲ�Ʒ�ɱ� BI/RAG/Agent ����
- ���ܡ������ԡ�SLO���ֱ�ָ��ȫ�����
- �� Java `TECH-DATA` ���ֹ鵵

- [ ] **Step 2: ���� GA ����**

- ���������ܡ��ֱ�
- ��֪����������
- �����Ż�����

- [ ] **Step 3: �ύ**

```bash
git add docs/superpowers/reports
git commit -m "docs(data): d8 ga report"
```

**�Ž���** ���� v1.0 GA �����Ž�ȫ��ͨ����`/api/v1/data/*` ��Լ���ݾ�ʵ�֣��� P0/P1 ȱ��������

---

## ��׶�������Ϲ�

- **���ͼ��**��`uv run pyright packages/mate-tech-data` ȫ��
- **Lint**��`uv run ruff check packages/mate-tech-data` ȫ��
- **����**����Ԫ �� 80% ���ǡ����ɸ���ȫ�� Engine Adapter����Լ���Ը������� REST �˵�
- **CI**��`GitHub Actions` ���� `data-plane-ci`��lint + type + unit + contract + oasdiff
- **ǰ��**��`pnpm typecheck`��`pnpm lint`��`pnpm test:e2e` ȫ����
- **�ɹ۲�**��OTel SDK��Prometheus ָ�ꡢLoki ��־��Kafka Lag / Flink Checkpoint / Compaction / Trino Queue / StarRocks Load / Quality ʧ�� / SLA / �ɱ�ָ��
- **��ȫ**��Ranger ����Ȩ�ޡ�OpenBao ƾ֤������ǩ��������ֻ������ root
- **�ɻع�**��Pipeline Version ���ɱ䣻����ʧ���Զ��ع�����һ Savepoint��ADS ����ʧ�ܱ�����󽡿��汾
