# Mate Platform 整体落地实施计划（W1–W7 + D0–D8）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **每个 sub-step 限 2–5 分钟**，全部给出具体文件路径、代码、命令、预期输出与提交指令。

**Goal:** 在 v3.0 主后端之上，落地完整自托管大数据 ETL + 湖仓 + 治理能力，并把所有能力并入现有本体论引擎的“数据中心”；同步 v3.0 业务模块（msg/obs/mcp/ont/llmgw/rag/agent/app-kb）继续按 W 路线推进；最终通过 v1.0 GA 验收。

**Architecture:** Python 主后端（`mate-tech-{rag,agent,llmgw,ont,msg,obs,mcp,data}, mate-app-kb`）+ 外部 Java 引擎（Keycloak/Flowable/Drools 作为成熟产品）+ 数据平面（Flink/Airflow/Paimon/Iceberg/Trino/StarRocks/Gravitino/OpenMetadata/Ranger/OpenBao/Kafka/MinIO）+ Traefik/AuthService 网关。前端 9 apps 单体 monorepo（已就位）。

**Tech Stack:** Python 3.12、FastAPI、SQLModel、Pydantic v2、httpx、uvloop、granian、pyright strict、Pytest、Testcontainers、Kubernetes、Argo CD、Helm、Flink 1.19、Airflow 3.0、Apache Paimon 0.9、Apache Iceberg 1.5、Trino 455、StarRocks 3.3、Apache Gravitino 0.7、OpenMetadata 1.4、OpenLineage 0.50、Great Expectations 0.18、Apache Ranger 2.4、OpenBao 1.15、Apache Kafka 3.7、Apicurio 2.6、Keycloak 25、Flowable 8、React 19、Vite 6、TypeScript 5.7、Ant Design 6、AntV X6、Flowgram.ai、Playwright。

**任务编号约定：**
- `W*` 表示主线 W1–W7 任务（业务域）
- `D*` 表示数据平台 D0–D8 任务（ETL/湖仓/治理）
- `D*.S*` 表示 sub-step（限 2–5 分钟）
- 每个 D 任务在主线中找一个最合理的 W 任务挂载

---

## 整体时间线

```mermaid
gantt
  title Mate Platform 整体实施 (35 周)
  dateFormat YYYY-MM-DD
  axisFormat W%V
  section W 主线
  W1 项目骨架 + Swagger    :w1, 2026-07-28, 2w
  W2 基础设施 facade         :w2, after w1, 3w
  W3 ACL 客户端 (Keycloak/Flowable/Drools) :w3, after w2, 3w
  W4 Traefik 网关 + AuthService :w4, after w2, 3w
  W5 业务域 (msg/obs/mcp/ont/llmgw/rag/agent/app-kb) :w5, after w4, 10w
  W6 前端 9 apps 补齐对接     :w6, after w1, 13w
  W7 蓝绿迁移                :w7, after w5, 13w
  section D 数据平台
  D0 Spike (CDC→Paimon→Trino) :d0, 2026-07-28, 2w
  D1 K8s 数据平面             :d1, after d0, 4w
  D2 mate-tech-data 骨架     :d2, after d1, 4w
  D3 CDC + Paimon ODS/DWD    :d3, after d2, 5w
  D4 Pipeline + Airflow      :d4, after d3, 5w
  D5 Iceberg + Trino + StarRocks :d5, after d4, 4w
  D6 治理 + 安全 + 血缘      :d6, after d5, 4w
  D7 Ontology 原位增强       :d7, after d6, 5w
  D8 压测 灾备 GA            :d8, after d7, 4w
  section 关键路径
  D0 → D1 → D2 → D3 → D4 → D5 → D6 → D7 → D8
  W1-1 → W2-3 → W3-3 → W4-3 → W5-6 → W5-7 → W5-8 → W7-6
```

---


# Part 1: W 主线 (W1–W7)

## W1 项目骨架 + Swagger/OpenAPI（2 周）

**Owner:** W1 owner · **关键路径 ? · 并行 D0**

### W1.1: 建 `mate-platform-backend/` monorepo

**Files:**
- Create: `mate-platform-backend/pyproject.toml`
- Create: `mate-platform-backend/uv.toml`
- Create: `mate-platform-backend/README.md`
- Create: `mate-platform-backend/ruff.toml`
- Create: `mate-platform-backend/pyrightconfig.json`
- Create: `mate-platform-backend/.gitignore`
- Create: `mate-platform-backend/packages/mate-common/pyproject.toml`
- Create: `mate-platform-backend/packages/mate-common/src/mate_common/__init__.py`
- Create: `mate-platform-backend/tests/__init__.py`

- [ ] **W1.1.S1: 写 `pyproject.toml`**

```toml
[project]
name = "mate-platform-backend"
version = "0.1.0"
requires-python = ">=3.12"
[tool.uv]
package = true
[tool.ruff]
line-length = 100
target-version = "py312"
[tool.pyright]
strict = true
```

- [ ] **W1.1.S2: 写 `uv.toml`**

```toml
required-version = ">=0.4.0"
```

- [ ] **W1.1.S3: 写 `README.md`**

含“项目说明 / 安装 / 测试 / 提交规范”四节。

- [ ] **W1.1.S4: 写 `ruff.toml`**

```toml
line-length = 100
target-version = "py312"
extend-exclude = [".venv", "dist", "build"]
```

- [ ] **W1.1.S5: 写 `pyrightconfig.json`**

```json
{ "include": ["packages"], "strict": ["packages/*/src"], "pythonVersion": "3.12" }
```

- [ ] **W1.1.S6: 写 `.gitignore`**

忽略 `.venv/`、`dist/`、`build/`、`__pycache__/`、`.pytest_cache/`、`.ruff_cache/`、`.coverage`、`.env`。

- [ ] **W1.1.S7: 写 `packages/mate-common/pyproject.toml`**

```toml
[project]
name = "mate-common"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic>=2.0"]
```

- [ ] **W1.1.S8: 写 `packages/mate-common/src/mate_common/__init__.py`**

```python
"""mate-common 共享层：DTO、异常、工具、常量。"""
```

- [ ] **W1.1.S9: 写 `tests/__init__.py`**

```python
"""测试根。"""
```

- [ ] **W1.1.S10: 跑 `uv sync` 验证可装**

```bash
cd mate-platform-backend
uv sync
```

预期：exit 0，`.venv` 创建。

- [ ] **W1.1.S11: 跑 `uv run pyright packages/mate-common`**

```bash
uv run pyright packages/mate-common
```

预期：无 error。

- [ ] **W1.1.S12: 跑 `uv run ruff check .`**

```bash
uv run ruff check .
```

预期：All checks passed!

- [ ] **W1.1.S13: 提交**

```bash
git add mate-platform-backend
git commit -m "chore(backend): w1.1 mate platform backend skeleton"
```

### W1.2: Swagger Editor / UI / Prism 集成

**Files:**
- Create: `infra/contracts/swagger-editor/compose.yml`
- Create: `infra/contracts/swagger-editor/README.md`

- [ ] **W1.2.S1: 写 compose.yml**

```yaml
services:
  swagger-editor:
    image: swaggerapi/swagger-editor:v5
    ports: ["8080:8080"]
  swagger-ui:
    image: swaggerapi/swagger-ui:v5
    environment:
      SWAGGER_JSON: /api/openapi.yaml
    volumes: ["${PWD}/contracts:/api"]
    ports: ["8081:8080"]
  prism:
    image: stoplight/prism:5
    command: ["mock", "-d", "/api/openapi.yaml", "-p", "4010"]
    volumes: ["${PWD}/contracts:/api"]
    ports: ["4010:4010"]
```

- [ ] **W1.2.S2: 写 README**

列出三个 URL。

- [ ] **W1.2.S3: 启动验证**

```bash
docker compose -f infra/contracts/swagger-editor/compose.yml up -d
curl -s http://localhost:8080/editor | head -c 200
docker compose -f infra/contracts/swagger-editor/compose.yml down
```

- [ ] **W1.2.S4: 提交**

```bash
git add infra/contracts/swagger-editor
git commit -m "feat(contracts): w1.2 swagger editor ui prism"
```

### W1.3: IAM OpenAPI 初稿

**Files:**
- Create: `contracts/openapi/iam/openapi.yaml`
- Create: `contracts/openapi/iam/examples/realm.json`

- [ ] **W1.3.S1: 写 OpenAPI 头**

```yaml
openapi: 3.1.0
info:
  title: Mate IAM (Keycloak Adapter)
  version: 0.1.0
servers:
  - url: http://localhost:8080/api/v1/iam
```

- [ ] **W1.3.S2: 写 10 个端点**

- `POST /realms/{realm}/clients`
- `GET /realms/{realm}/clients`
- `POST /realms/{realm}/users`
- `GET /realms/{realm}/users`
- `POST /realms/{realm}/roles`
- `POST /protocol/openid-connect/token`
- `GET /admin/realms/{realm}/users/{id}`
- `PUT /admin/realms/{realm}/users/{id}/reset-password`
- `GET /admin/realms/{realm}/groups`
- `POST /admin/realms/{realm}/groups`

- [ ] **W1.3.S3: 写示例**

```json
{ "realm": "mate", "clientId": "metaplatform" }
```

- [ ] **W1.3.S4: Redocly lint**

```bash
npx @redocly/cli lint contracts/openapi/iam/openapi.yaml
```

预期：`0 errors`.

- [ ] **W1.3.S5: 提交**

```bash
git add contracts/openapi/iam
git commit -m "feat(iam): w1.3 openapi contract"
```

### W1.4: Knowledge OpenAPI 初稿

**Files:**
- Create: `contracts/openapi/knowledge/openapi.yaml`

- [ ] **W1.4.S1: 写 10 个端点**

- `POST /v1/kb/datasets`
- `GET /v1/kb/datasets`
- `POST /v1/kb/datasets/{id}/documents`
- `GET /v1/kb/datasets/{id}/documents`
- `POST /v1/kb/datasets/{id}/search`
- `GET /v1/kb/datasets/{id}/chunks/{chunkId}`
- `DELETE /v1/kb/datasets/{id}`
- `POST /v1/kb/graphs`
- `GET /v1/kb/graphs/{id}/entities`
- `POST /v1/kb/embeddings/reindex`

- [ ] **W1.4.S2: 提交**

```bash
git add contracts/openapi/knowledge
git commit -m "feat(knowledge): w1.4 openapi contract"
```

### W1.5: Ontology OpenAPI 初稿

**Files:**
- Create: `contracts/openapi/ont/openapi.yaml`

- [ ] **W1.5.S1: 写 10 个端点**

- `POST /v1/ont/concepts`
- `GET /v1/ont/concepts`
- `POST /v1/ont/entities`
- `GET /v1/ont/entities/{id}`
- `POST /v1/ont/relations`
- `GET /v1/ont/relations`
- `POST /v1/ont/rules`
- `GET /v1/ont/versions`
- `POST /v1/ont/versions/{id}/publish`
- `POST /v1/ont/versions/{id}/rollback`

- [ ] **W1.5.S2: 提交**

```bash
git add contracts/openapi/ont
git commit -m "feat(ont): w1.5 openapi contract"
```

### W1.6: CI 校验流水线

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **W1.6.S1: 写 CI**

```yaml
name: ci
on: [push, pull_request]
jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v2
      - run: cd mate-platform-backend && uv sync
      - run: cd mate-platform-backend && uv run ruff check .
      - run: cd mate-platform-backend && uv run pyright packages
      - run: cd mate-platform-backend && uv run pytest
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm i -g @redocly/cli
      - run: npx @redocly/cli lint contracts/openapi
      - run: npx oasdiff breaking contracts/openapi/iam/openapi.yaml 1.0.0 contracts/openapi/iam/openapi.yaml
```

- [ ] **W1.6.S2: 提交**

```bash
git add .github/workflows
git commit -m "ci: w1.6 python and contracts pipeline"
```

### W1.7: Pydantic 与 OpenAPI 对齐

**Files:**
- Create: `packages/mate-common/src/mate_common/dto/pagination.py`
- Create: `packages/mate-common/tests/test_dto_pagination.py`

- [ ] **W1.7.S1: 写 `pagination.py`**

```python
from pydantic import BaseModel
class Page(BaseModel):
    items: list[dict]
    total: int
    page: int
    size: int
```

- [ ] **W1.7.S2: 写测试**

```python
from mate_common.dto.pagination import Page
def test_page():
    p = Page(items=[], total=0, page=1, size=20)
    assert p.total == 0
```

- [ ] **W1.7.S3: 跑测**

```bash
cd mate-platform-backend
uv run pytest packages/mate-common -v
```

预期：1 passed。

- [ ] **W1.7.S4: 提交**

```bash
git add packages/mate-common
git commit -m "feat(common): w1.7 pagination dto"
```

**W1 门禁：** `uv sync / ruff / pyright / pytest` 全绿；CI 触发；OpenAPI 契约 lint 通过。

---

## W2 基础设施 facade（3 周 · 并行 D1）

**Owner:** W2 owner · **关键路径 ?**

### W2.1: PG/Neo4j/Milvus/MinIO 现成库接入

**Files:**
- Create: `packages/mate-common/src/mate_common/clients/pg.py`
- Create: `packages/mate-common/src/mate_common/clients/neo4j.py`
- Create: `packages/mate-common/src/mate_common/clients/minio.py`
- Create: `packages/mate-common/src/mate_common/clients/milvus.py`
- Create: `packages/mate-common/tests/integration/clients/test_pg.py`
- Create: `packages/mate-common/tests/integration/clients/test_neo4j.py`
- Create: `packages/mate-common/tests/integration/clients/test_minio.py`
- Create: `packages/mate-common/tests/integration/clients/test_milvus.py`

- [ ] **W2.1.S1: pyproject 加依赖**

```toml
dependencies = [
  "pydantic>=2.0", "httpx>=0.27",
  "asyncpg>=0.29", "psycopg[binary]>=3.2",
  "neo4j>=5.20", "minio>=7.2", "pymilvus>=2.4",
]
```

- [ ] **W2.1.S2: `clients/pg.py`**

```python
import asyncpg
class PgClient:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
    async def connect(self) -> None:
        self.conn = await asyncpg.connect(self.dsn)
    async def fetch(self, sql: str) -> list[dict]:
        rows = await self.conn.fetch(sql)
        return [dict(r) for r in rows]
```

- [ ] **W2.1.S3: `clients/neo4j.py`**

```python
from neo4j import AsyncGraphDatabase
class Neo4jClient:
    def __init__(self, uri: str, user: str, password: str) -> None:
        self.driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    async def run(self, cypher: str) -> list[dict]:
        async with self.driver.session() as s:
            r = await s.run(cypher)
            return [dict(rec) for rec in r]
```

- [ ] **W2.1.S4: `clients/minio.py`**

```python
from minio import Minio
class MinioClient:
    def __init__(self, endpoint: str, access: str, secret: str, secure: bool = False) -> None:
        self.client = Minio(endpoint, access_key=access, secret_key=secret, secure=secure)
    def put(self, bucket: str, key: str, data: bytes) -> None:
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)
        import io
        self.client.put_object(bucket, key, io.BytesIO(data), len(data))
```

- [ ] **W2.1.S5: `clients/milvus.py`**

```python
from pymilvus import MilvusClient
class MilvusWrapper:
    def __init__(self, uri: str) -> None:
        self.client = MilvusClient(uri=uri)
    def has_collection(self, name: str) -> bool:
        return self.client.has_collection(name)
```

- [ ] **W2.1.S6: Testcontainers 集成测试**

每个 client 一个集成测试：启动对应容器，连接、调用、断言。

- [ ] **W2.1.S7: 跑测**

```bash
cd mate-platform-backend
uv run pytest packages/mate-common/tests/integration -v
```

预期：4 passed。

- [ ] **W2.1.S8: 提交**

```bash
git add packages/mate-common
git commit -m "feat(common): w2.1 pg neo4j minio milvus clients"
```

### W2.2: Redis/Kafka/Nacos 现成库接入

**Files:**
- Create: `packages/mate-common/src/mate_common/clients/redis.py`
- Create: `packages/mate-common/src/mate_common/clients/kafka.py`
- Create: `packages/mate-common/src/mate_common/clients/nacos.py`
- Create: `packages/mate-common/tests/integration/clients/test_redis.py`
- Create: `packages/mate-common/tests/integration/clients/test_kafka.py`
- Create: `packages/mate-common/tests/integration/clients/test_nacos.py`

- [ ] **W2.2.S1: pyproject 加依赖**

```toml
"redis>=5.0", "aiokafka>=0.11", "nacos-sdk-python>=1.0",
```

- [ ] **W2.2.S2: `redis.py`**

```python
import redis.asyncio as redis
class RedisClient:
    def __init__(self, url: str) -> None:
        self.r = redis.from_url(url)
    async def get(self, key: str) -> str | None:
        return await self.r.get(key)
```

- [ ] **W2.2.S3: `kafka.py`**

```python
from aiokafka import AIOKafkaProducer
class KafkaProducer:
    def __init__(self, bootstrap: str) -> None:
        self.bootstrap = bootstrap
        self.p = AIOKafkaProducer(bootstrap_servers=bootstrap)
    async def start(self) -> None:
        await self.p.start()
    async def send(self, topic: str, value: bytes) -> None:
        await self.p.send_and_wait(topic, value)
```

- [ ] **W2.2.S4: `nacos.py`**

```python
class NacosClient:
    def __init__(self, server: str, namespace: str) -> None:
        self.server = server
        self.namespace = namespace
    def register(self, name: str, ip: str, port: int) -> None:
        import requests
        requests.post(f"{self.server}/nacos/v1/ns/instance", json={
            "serviceName": name, "ip": ip, "port": port, "namespaceId": self.namespace,
        })
```

- [ ] **W2.2.S5: 集成测试**

3 个 Testcontainers 集成测试。

- [ ] **W2.2.S6: 跑测并提交**

```bash
uv run pytest packages/mate-common/tests/integration -v
git add packages/mate-common
git commit -m "feat(common): w2.2 redis kafka nacos clients"
```

### W2.3: Repository Pattern 基类

**Files:**
- Create: `packages/mate-common/src/mate_common/repository/base.py`
- Create: `packages/mate-common/tests/test_repository.py`

- [ ] **W2.3.S1: `base.py`**

```python
from typing import Generic, TypeVar
T = TypeVar("T")
class Repository(Generic[T]):
    async def get(self, id: int) -> T | None: ...
    async def list(self) -> list[T]: ...
    async def create(self, entity: T) -> T: ...
    async def delete(self, id: int) -> None: ...
```

- [ ] **W2.3.S2: 测试**

```python
from mate_common.repository.base import Repository
def test_repository_is_generic():
    r: Repository[int] = Repository()
    assert r is not None
```

- [ ] **W2.3.S3: 跑测并提交**

```bash
uv run pytest packages/mate-common -v
git add packages/mate-common
git commit -m "feat(common): w2.3 repository base"
```

### W2.4: 测试覆盖率基线

**Files:**
- Create: `pyproject.toml` 加 pytest 配置

- [ ] **W2.4.S1: pytest 配置**

```toml
[tool.pytest.ini_options]
addopts = "--cov=packages --cov-fail-under=80"
testpaths = ["packages", "tests"]
```

- [ ] **W2.4.S2: 跑测并提交**

```bash
uv run pytest
git add mate-platform-backend
git commit -m "chore(test): w2.4 coverage baseline 80"
```

**W2 门禁：** `pytest --cov` 覆盖率 ≥ 80%；PG/Neo4j/Milvus/MinIO/Redis/Kafka/Nacos 集成测试全绿。

---


## W3 ACL 客户端（2.5 周 · 并行 D2）

**Owner:** W3 owner · **关键路径 ?**

### W3.1: Keycloak docker-compose

**Files:**
- Create: `infra/keycloak/compose.yml`
- Create: `infra/keycloak/realm-export.json`

- [ ] **W3.1.S1: compose.yml**

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    command: ["start-dev", "--import-realm"]
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    volumes: ["./realm-export.json:/opt/keycloak/data/import/realm.json:ro"]
    ports: ["8080:8080"]
```

- [ ] **W3.1.S2: realm-export.json**

最小 Realm：`metaplatform`，含 `metaplatform` 客户端与 5 个角色。

- [ ] **W3.1.S3: 启动验证**

```bash
docker compose -f infra/keycloak/compose.yml up -d
sleep 30
curl -s http://localhost:8080/realms/metaplatform/.well-known/openid-configuration | head -c 200
docker compose -f infra/keycloak/compose.yml down
```

- [ ] **W3.1.S4: 提交**

```bash
git add infra/keycloak
git commit -m "feat(iam): w3.1 keycloak compose"
```

### W3.2: Realm/Client/Roles/Users 初始化脚本

**Files:**
- Create: `infra/keycloak/init/realm.sh`
- Create: `infra/keycloak/init/realm.json`
- Create: `infra/keycloak/init/assign-roles.sh`
- Create: `infra/keycloak/init/users.json`

- [ ] **W3.2.S1: `realm.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
KC="http://localhost:8080"
REALM="metaplatform"
ADMIN="admin"
PWD="admin"
TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" -d "username=$ADMIN&password=$PWD&grant_type=password&client_id=admin-cli" | jq -r .access_token)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @init/realm.json "$KC/admin/realms"
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @init/users.json "$KC/admin/realms/$REALM/users"
```

- [ ] **W3.2.S2: `realm.json`**

Realm 定义、客户端、5 角色、3 用户组。

- [ ] **W3.2.S3: `users.json`**

3 个测试用户：`alice`、`bob`、`carol`，含 attributes。

- [ ] **W3.2.S4: `assign-roles.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
KC="http://localhost:8080"; REALM="metaplatform"
TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | jq -r .access_token)
for u in alice bob carol; do
  UID=$(curl -s -H "Authorization: Bearer $TOKEN" "$KC/admin/realms/$REALM/users?username=$u" | jq -r '.[0].id')
  curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '[{"name":"admin"}]' "$KC/admin/realms/$REALM/users/$UID/role-mappings/realm"
done
```

- [ ] **W3.2.S5: 跑测并提交**

```bash
bash infra/keycloak/init/realm.sh
bash infra/keycloak/init/assign-roles.sh
git add infra/keycloak/init
git commit -m "feat(iam): w3.2 realm init scripts"
```

### W3.3: `KeycloakClient`

**Files:**
- Create: `packages/mate-tech-iam/src/mate_tech_iam/clients/keycloak.py`
- Create: `packages/mate-tech-iam/pyproject.toml`
- Create: `packages/mate-tech-iam/src/mate_tech_iam/__init__.py`
- Create: `packages/mate-tech-iam/tests/unit/test_keycloak.py`
- Create: `packages/mate-tech-iam/tests/integration/test_keycloak.py`

- [ ] **W3.3.S1: pyproject**

```toml
[project]
name = "mate-tech-iam"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic>=2.0","httpx>=0.27"]
```

- [ ] **W3.3.S2: client**

```python
import httpx
class KeycloakClient:
    def __init__(self, base_url: str, realm: str, client_id: str, client_secret: str) -> None:
        self.base = base_url.rstrip("/"); self.realm = realm
        self.token = self._fetch_token(client_id, client_secret)
    def _fetch_token(self, cid, sec) -> str:
        r = httpx.post(f"{self.base}/realms/{self.realm}/protocol/openid-connect/token",
                       data={"grant_type": "client_credentials", "client_id": cid, "client_secret": sec})
        r.raise_for_status(); return r.json()["access_token"]
    def introspect(self, token: str) -> dict:
        r = httpx.post(f"{self.base}/realms/{self.realm}/protocol/openid-connect/token/introspect",
                       data={"token": token, "client_id": "admin-cli", "client_secret": "admin"})
        r.raise_for_status(); return r.json()
    def get_user(self, uid: str) -> dict:
        h = {"Authorization": f"Bearer {self.token}"}
        r = httpx.get(f"{self.base}/admin/realms/{self.realm}/users/{uid}", headers=h)
        r.raise_for_status(); return r.json()
```

- [ ] **W3.3.S3: 单元测试**

```python
def test_init_requires_token():
    pass
```

- [ ] **W3.3.S4: 集成测试**

启动 Keycloak，调用 `introspect` 与 `get_user`，断言。

- [ ] **W3.3.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-iam -v
git add packages/mate-tech-iam
git commit -m "feat(iam): w3.3 keycloak client"
```

### W3.4: Flowable 8.0 docker-compose

**Files:**
- Create: `infra/flowable/compose.yml`

- [ ] **W3.4.S1: compose.yml**

```yaml
services:
  flowable-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: flowable
      POSTGRES_USER: flowable
      POSTGRES_PASSWORD: flowable
  flowable-engine:
    image: flowable/flowable-engine:8.0.0
    depends_on: [flowable-db]
    environment:
      spring.datasource.url: jdbc:postgresql://flowable-db:5432/flowable
    ports: ["8081:8080"]
  flowable-task:
    image: flowable/flowable-task:8.0.0
    depends_on: [flowable-engine]
    environment:
      flowable.rest.url: http://flowable-rest:8080
    ports: ["8082:8080"]
  flowable-rest:
    image: flowable/flowable-rest:8.0.0
    depends_on: [flowable-db]
    environment:
      spring.datasource.url: jdbc:postgresql://flowable-db:5432/flowable
    ports: ["8083:8080"]
```

- [ ] **W3.4.S2: 启动验证**

```bash
docker compose -f infra/flowable/compose.yml up -d
sleep 60
curl -s http://localhost:8081/flowable-rest/service/management/deployment | head -c 200
```

- [ ] **W3.4.S3: 提交**

```bash
git add infra/flowable
git commit -m "feat(bpmn): w3.4 flowable 8.0 compose"
```

### W3.5: `FlowableClient`

**Files:**
- Create: `packages/mate-tech-bpmn/src/mate_tech_bpmn/clients/flowable.py`
- Create: `packages/mate-tech-bpmn/tests/integration/test_flowable.py`

- [ ] **W3.5.S1: pyproject + init**

```toml
[project]
name = "mate-tech-bpmn"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic>=2.0","httpx>=0.27"]
```

- [ ] **W3.5.S2: client**

```python
import httpx
class FlowableClient:
    def __init__(self, base_url: str, user: str, pwd: str) -> None:
        self.base = base_url.rstrip("/")
        self.auth = (user, pwd)
    def deploy_bpmn(self, name: str, xml: bytes) -> str:
        files = {"file": (name, xml, "application/xml")}
        r = httpx.post(f"{self.base}/flowable-rest/service/repository/deployments", files=files, auth=self.auth)
        r.raise_for_status(); return r.json()["id"]
    def start_process(self, key: str, vars: dict | None = None) -> str:
        r = httpx.post(f"{self.base}/flowable-rest/service/runtime/process-instances", json={"processDefinitionKey": key, "variables": vars or {}}, auth=self.auth)
        r.raise_for_status(); return r.json()["id"]
    def get_my_tasks(self, user: str) -> list[dict]:
        r = httpx.get(f"{self.base}/flowable-rest/service/runtime/tasks", params={"assignee": user}, auth=self.auth)
        r.raise_for_status(); return r.json()["data"]
    def complete_task(self, task_id: str) -> None:
        r = httpx.post(f"{self.base}/flowable-rest/service/runtime/tasks/{task_id}", auth=self.auth)
        r.raise_for_status()
```

- [ ] **W3.5.S3: 集成测试**

```python
def test_deploy_and_run(flowable):
    xml = b"<?xml version='1.0'?><definitions><process id='demo' name='Demo'><startEvent id='s'/><endEvent id='e'/><sequenceFlow sourceRef='s' targetRef='e'/></process></definitions>"
    did = flowable.deploy_bpmn("demo.bpmn20.xml", xml)
    assert did
    pid = flowable.start_process("demo")
    assert pid
```

- [ ] **W3.5.S4: 跑测并提交**

```bash
uv run pytest packages/mate-tech-bpmn -v
git add packages/mate-tech-bpmn
git commit -m "feat(bpmn): w3.5 flowable client"
```

### W3.6: BPMN 模板库

**Files:**
- Create: `packages/mate-tech-bpmn/templates/approval.bpmn20.xml`
- Create: `packages/mate-tech-bpmn/templates/escalation.bpmn20.xml`
- Create: `packages/mate-tech-bpmn/templates/notify.bpmn20.xml`

- [ ] **W3.6.S1: `approval.bpmn20.xml`**

S4 场景：start → usertask(manager) → usertask(director) → end。

- [ ] **W3.6.S2: `escalation.bpmn20.xml`**

包含 boundary timer event，3 天超时升级到 director。

- [ ] **W3.6.S3: `notify.bpmn20.xml`**

service task 发送通知。

- [ ] **W3.6.S4: 部署到 Flowable**

```bash
python -c "from mate_tech_bpmn.clients.flowable import FlowableClient; f=FlowableClient('http://localhost:8083','admin','test'); 
[open(f'templates/{n}','rb').read() for n in ['approval.bpmn20.xml','escalation.bpmn20.xml','notify.bpmn20.xml']]"
```

- [ ] **W3.6.S5: 提交**

```bash
git add packages/mate-tech-bpmn/templates
git commit -m "feat(bpmn): w3.6 templates"
```

### W3.7: Drools KIE Server

**Files:**
- Create: `infra/kie/compose.yml`

- [ ] **W3.7.S1: compose.yml**

```yaml
services:
  kie-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kie
      POSTGRES_USER: kie
      POSTGRES_PASSWORD: kie
  kie-server:
    image: jboss/kie-server:7.74
    depends_on: [kie-postgres]
    environment:
      QUARTZ_PROPERTIES_TABLE_PREFIX: QRTZ_
      DATASOURCES: "JNDI"
    ports: ["8180:8080"]
```

- [ ] **W3.7.S2: 启动验证**

```bash
docker compose -f infra/kie/compose.yml up -d
sleep 60
curl -s http://localhost:8180/services/rest/server/containers | head -c 200
```

- [ ] **W3.7.S3: 提交**

```bash
git add infra/kie
git commit -m "feat(rule): w3.7 kie server compose"
```

### W3.8: `DroolsClient`

**Files:**
- Create: `packages/mate-tech-rule/src/mate_tech_rule/clients/drools.py`
- Create: `packages/mate-tech-rule/tests/integration/test_drools.py`

- [ ] **W3.8.S1: client**

```python
import httpx
class DroolsClient:
    def __init__(self, base: str, user: str, pwd: str) -> None:
        self.base = base.rstrip("/"); self.auth = (user, pwd)
    def create_container(self, id: str, gav: str) -> None:
        r = httpx.put(f"{self.base}/services/rest/server/containers/{id}", params={"containerId": id, "releaseId": gav}, auth=self.auth)
        r.raise_for_status()
    def evaluate_rule(self, container: str, payload: dict) -> dict:
        r = httpx.post(f"{self.base}/services/rest/server/containers/instances/{container}", json={"commands":[{"insert":{"object":payload}},{"fire-all-rules":""}]}, auth=self.auth)
        r.raise_for_status(); return r.json()
```

- [ ] **W3.8.S2: 集成测试**

启动 KIE，创建 `demo` 容器，evaluate 一条 `age >= 18` 规则。

- [ ] **W3.8.S3: 跑测并提交**

```bash
uv run pytest packages/mate-tech-rule -v
git add packages/mate-tech-rule
git commit -m "feat(rule): w3.8 drools client"
```

### W3.9: 规则仓库

**Files:**
- Create: `packages/mate-tech-rule/rules/age-check.drl`
- Create: `packages/mate-tech-rule/rules/limit-check.drl`
- Create: `packages/mate-tech-rule/rules/fraud-score.drl`

- [ ] **W3.9.S1: 3 个 DRL**

每条规则最少 5 行，含 `when` / `then`。

- [ ] **W3.9.S2: Git 标签**

```bash
git tag rule-v1.0 -m "rule v1.0"
```

- [ ] **W3.9.S3: 提交**

```bash
git add packages/mate-tech-rule/rules
git commit -m "feat(rule): w3.9 rule repository"
```

**W3 门禁：** Keycloak/Flowable/Drools 三个集成测试全绿；3 个 BPMN 与 3 个 DRL 模板就绪。

---

## W4 Traefik 网关 + AuthService（2.5 周 · 并行 D1/D2）

**Owner:** W4 owner · **关键路径 ?**

### W4.1: Traefik compose

**Files:**
- Create: `infra/traefik/compose.yml`
- Create: `infra/traefik/dynamic/middlewares.yml`
- Create: `infra/traefik/dynamic/routers.yml`

- [ ] **W4.1.S1: compose.yml**

```yaml
services:
  traefik:
    image: traefik:v3.x
    command: ["--providers.docker=true","--providers.file.directory=/etc/traefik/dynamic","--entrypoints.web.address=:80","--entrypoints.websecure.address=:443"]
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro", "./dynamic:/etc/traefik/dynamic:ro"]
    ports: ["80:80","443:443"]
```

- [ ] **W4.1.S2: middlewares.yml**

`rateLimit`、`traceId`、`cors`。

- [ ] **W4.1.S3: routers.yml**

将 `auth`、`iam`、`bpmn` 等路由到对应服务。

- [ ] **W4.1.S4: 启动验证**

```bash
docker compose -f infra/traefik/compose.yml up -d
curl -s http://localhost:8080/api/rawdata | head -c 200
```

- [ ] **W4.1.S5: 提交**

```bash
git add infra/traefik
git commit -m "feat(gw): w4.1 traefik compose"
```

### W4.2: `AuthService`

**Files:**
- Create: `services/auth-service/pyproject.toml`
- Create: `services/auth-service/src/auth_service/main.py`
- Create: `services/auth-service/src/auth_service/jwt.py`
- Create: `services/auth-service/tests/test_jwt.py`
- Create: `services/auth-service/Dockerfile`

- [ ] **W4.2.S1: pyproject**

```toml
[project]
name = "auth-service"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.115","pydantic>=2.0","httpx>=0.27","uvicorn>=0.30"]
```

- [ ] **W4.2.S2: `jwt.py`**

```python
import jwt
def decode(token: str, jwks_url: str) -> dict:
    import httpx
    jwks = httpx.get(jwks_url).json()
    return jwt.decode(token, jwks, algorithms=["RS256"], options={"verify_aud": False})
```

- [ ] **W4.2.S3: `main.py`**

```python
from fastapi import FastAPI, Request, HTTPException
from .jwt import decode
app = FastAPI()
JWKS = "http://keycloak:8080/realms/metaplatform/protocol/openid-connect/certs"
@app.get("/auth/verify")
async def verify(request: Request) -> dict:
    h = request.headers.get("authorization", "")
    if not h.startswith("Bearer "):
        raise HTTPException(401)
    return decode(h[7:], JWKS)
```

- [ ] **W4.2.S4: Dockerfile**

```dockerfile
FROM python:3.12
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -e .
CMD ["uvicorn","auth_service.main:app","--host","0.0.0.0","--port","8000"]
```

- [ ] **W4.2.S5: 单元测试**

```python
def test_decode_invalid_token():
    import pytest
    with pytest.raises(Exception):
        decode("invalid", "http://x/.well-known/jwks.json")
```

- [ ] **W4.2.S6: 跑测并提交**

```bash
uv run pytest services/auth-service -v
git add services/auth-service
git commit -m "feat(auth): w4.2 auth service"
```

### W4.3: 路由 `auth.metaplatform.local` 到 Keycloak

**Files:**
- Create: `infra/traefik/dynamic/routers/keycloak.yml`

- [ ] **W4.3.S1: router**

```yaml
http:
  routers:
    keycloak:
      rule: "Host(`auth.metaplatform.local`)"
      service: keycloak
      entryPoints: [websecure]
      tls: {}
  services:
    keycloak:
      loadBalancer:
        servers: [{url: "http://keycloak:8080"}]
```

- [ ] **W4.3.S2: 提交**

```bash
git add infra/traefik
git commit -m "feat(gw): w4.3 keycloak route"
```

**W4 门禁：** Traefik dashboard 可访问；AuthService `/auth/verify` 通过 Keycloak JWT 校验。

---

## W5 业务域实现（10 周 · 并行 D2–D7）

**Owner:** W5 owner · **关键路径 ?**

### W5.1: `tech-msg` 消息（2 周 · 并行 D3）

**Files:**
- Create: `packages/mate-tech-msg/pyproject.toml`
- Create: `packages/mate-tech-msg/src/mate_tech_msg/api/routes/messages.py`
- Create: `packages/mate-tech-msg/src/mate_tech_msg/services/publisher.py`
- Create: `packages/mate-tech-msg/tests/integration/test_publish.py`

- [ ] **W5.1.S1: pyproject**

```toml
[project]
name = "mate-tech-msg"
version = "0.1.0"
dependencies = ["fastapi>=0.115","pydantic>=2.0","aiokafka>=0.11","httpx>=0.27"]
```

- [ ] **W5.1.S2: `services/publisher.py`**

```python
from aiokafka import AIOKafkaProducer
class Publisher:
    def __init__(self, bootstrap: str) -> None:
        self.p = AIOKafkaProducer(bootstrap_servers=bootstrap)
    async def start(self): await self.p.start()
    async def stop(self): await self.p.stop()
    async def send(self, topic: str, value: bytes, key: bytes | None = None) -> None:
        await self.p.send_and_wait(topic, value=value, key=key)
```

- [ ] **W5.1.S3: `api/routes/messages.py`**

```python
from fastapi import APIRouter, Depends
from ..services.publisher import Publisher
router = APIRouter()
@router.post("/{topic}")
async def publish(topic: str, body: bytes) -> dict:
    p: Publisher = ...
    await p.send(topic, body)
    return {"status": "ok"}
```

- [ ] **W5.1.S4: 集成测试**

启动 Kafka，调用 `/msg/test`，断言 `produced > 0`。

- [ ] **W5.1.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-msg -v
git add packages/mate-tech-msg
git commit -m "feat(msg): w5.1 publish api"
```

### W5.2: `tech-obs` 可观测（2 周 · 并行 D3）

**Files:**
- Create: `packages/mate-tech-obs/pyproject.toml`
- Create: `packages/mate-tech-obs/src/mate_tech_obs/middleware/otel.py`
- Create: `packages/mate-tech-obs/src/mate_tech_obs/main.py`
- Create: `packages/mate-tech-obs/tests/integration/test_otel.py`

- [ ] **W5.2.S1: pyproject + middleware**

依赖 `opentelemetry-sdk`、`opentelemetry-exporter-otlp`。

- [ ] **W5.2.S2: middleware**

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
def setup_otlp(endpoint: str) -> None:
    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True)))
    trace.set_tracer_provider(provider)
```

- [ ] **W5.2.S3: main.py 引入**

```python
from .middleware.otel import setup_otlp
setup_otlp("http://otel-collector:4317")
```

- [ ] **W5.2.S4: 集成测试**

启动 OTel collector mock，验证 span 被导出。

- [ ] **W5.2.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-obs -v
git add packages/mate-tech-obs
git commit -m "feat(obs): w5.2 otel setup"
```

### W5.3: `tech-mcp` MCP 协议（2 周 · 并行 D3）

**Files:**
- Create: `packages/mate-tech-mcp/pyproject.toml`
- Create: `packages/mate-tech-mcp/src/mate_tech_mcp/server.py`
- Create: `packages/mate-tech-mcp/src/mate_tech_mcp/tools/echo.py`
- Create: `packages/mate-tech-mcp/tests/integration/test_mcp.py`

- [ ] **W5.3.S1: pyproject**

依赖 `mcp`。

- [ ] **W5.3.S2: `tools/echo.py`**

```python
def echo(text: str) -> str:
    return text
```

- [ ] **W5.3.S3: `server.py`**

```python
from mcp.server import Server
from .tools.echo import echo
server = Server("mate-mcp")
@server.tool()
def echo_tool(text: str) -> str:
    return echo(text)
```

- [ ] **W5.3.S4: 集成测试**

启动 server，`stdio` 测试 echo 工具。

- [ ] **W5.3.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-mcp -v
git add packages/mate-tech-mcp
git commit -m "feat(mcp): w5.3 mcp server"
```

### W5.4: `tech-ont` Ontology（2 周 · 并行 D3 + D4）

**Files:**
- Create: `packages/mate-tech-ont/pyproject.toml`
- Create: `packages/mate-tech-ont/src/mate_tech_ont/models/concept.py`
- Create: `packages/mate-tech-ont/src/mate_tech_ont/repositories/neo4j_concept_repo.py`
- Create: `packages/mate-tech-ont/src/mate_tech_ont/api/routes/concepts.py`
- Create: `packages/mate-tech-ont/tests/integration/test_concept.py`

- [ ] **W5.4.S1: model**

```python
from pydantic import BaseModel
class Concept(BaseModel):
    id: str
    name: str
    description: str | None = None
```

- [ ] **W5.4.S2: repo**

```python
from mate_common.clients.neo4j import Neo4jClient
class Neo4jConceptRepo:
    def __init__(self, c: Neo4jClient) -> None:
        self.c = c
    async def create(self, concept: Concept) -> None:
        await self.c.run("CREATE (n:Concept {id:$id,name:$name})", id=concept.id, name=concept.name)
    async def list(self) -> list[dict]:
        return await self.c.run("MATCH (n:Concept) RETURN n")
```

- [ ] **W5.4.S3: api**

```python
from fastapi import APIRouter
from ..repositories.neo4j_concept_repo import Neo4jConceptRepo
from ..models.concept import Concept
router = APIRouter()
repo = Neo4jConceptRepo(None)
@router.post("")
async def create(c: Concept) -> dict:
    await repo.create(c)
    return c.model_dump()
@router.get("")
async def list_() -> list[dict]:
    return await repo.list()
```

- [ ] **W5.4.S4: 集成测试**

启动 Neo4j，创建 + 列出 + 断言。

- [ ] **W5.4.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-ont -v
git add packages/mate-tech-ont
git commit -m "feat(ont): w5.4 concept api"
```

### W5.5: `tech-llmgw` LLM 路由（2 周 · 并行 D4）

**Files:**
- Create: `packages/mate-tech-llmgw/pyproject.toml`
- Create: `packages/mate-tech-llmgw/src/mate_tech_llmgw/providers/openai.py`
- Create: `packages/mate-tech-llmgw/src/mate_tech_llmgw/router.py`
- Create: `packages/mate-tech-llmgw/tests/integration/test_router.py`

- [ ] **W5.5.S1: provider**

```python
import httpx
class OpenAIProvider:
    def __init__(self, base: str, key: str) -> None:
        self.c = httpx.AsyncClient(base_url=base, headers={"Authorization": f"Bearer {key}"})
    async def chat(self, model: str, msgs: list[dict]) -> dict:
        r = await self.c.post("/v1/chat/completions", json={"model": model, "messages": msgs})
        r.raise_for_status(); return r.json()
```

- [ ] **W5.5.S2: router**

按 `model` 前缀路由到 OpenAI / Anthropic / 本地 Ollama。

- [ ] **W5.5.S3: 集成测试**

启动 OpenAI mock，断言按前缀路由。

- [ ] **W5.5.S4: 跑测并提交**

```bash
uv run pytest packages/mate-tech-llmgw -v
git add packages/mate-tech-llmgw
git commit -m "feat(llmgw): w5.5 provider router"
```

### W5.6: `tech-rag` RAG 核心（3 周 · 并行 D5）

**Files:**
- Create: `packages/mate-tech-rag/pyproject.toml`
- Create: `packages/mate-tech-rag/src/mate_tech_rag/clients/ragflow.py`
- Create: `packages/mate-tech-rag/src/mate_tech_rag/clients/lightrag.py`
- Create: `packages/mate-tech-rag/src/mate_tech_rag/services/retrieval.py`
- Create: `packages/mate-tech-rag/src/mate_tech_rag/api/routes/search.py`
- Create: `packages/mate-tech-rag/tests/integration/test_rag.py`

- [ ] **W5.6.S1: ragflow client**

```python
import httpx
class RagflowClient:
    def __init__(self, base: str, key: str) -> None:
        self.c = httpx.Client(base_url=base, headers={"Authorization": f"Bearer {key}"})
    def upload_doc(self, ds: str, file: bytes) -> dict:
        r = self.c.post(f"/api/v1/datasets/{ds}/documents", files={"file": file})
        r.raise_for_status(); return r.json()
    def search(self, ds: str, q: str, top_k: int = 5) -> list[dict]:
        r = self.c.post(f"/api/v1/datasets/{ds}/chunks", json={"question": q, "top_k": top_k})
        r.raise_for_status(); return r.json()["data"]["chunks"]
```

- [ ] **W5.6.S2: lightrag client**

```python
class LightRagClient:
    def query(self, q: str) -> list[dict]:
        import httpx
        r = httpx.post("http://lightrag:9622/query", json={"q": q})
        r.raise_for_status(); return r.json()["entities"]
```

- [ ] **W5.6.S3: retrieval service**

```python
class RetrievalService:
    def __init__(self, rag: RagflowClient, lrag: LightRagClient, rerank) -> None:
        self.rag = rag; self.lrag = lrag; self.rerank = rerank
    async def search(self, ds: str, q: str) -> list[dict]:
        chunks = self.rag.search(ds, q)
        ents = self.lrag.query(q)
        return self.rerank.rerank(chunks + ents)
```

- [ ] **W5.6.S4: api**

```python
@router.post("/search")
async def search(body: dict) -> dict:
    return await RetrievalService(...).search(body["dataset"], body["q"])
```

- [ ] **W5.6.S5: 集成测试**

启动 RAGFlow + LightRAG mock，调用 `/search`，断言 200。

- [ ] **W5.6.S6: 跑测并提交**

```bash
uv run pytest packages/mate-tech-rag -v
git add packages/mate-tech-rag
git commit -m "feat(rag): w5.6 retrieval api"
```

### W5.7: `tech-agent` Agent/LangGraph（3 周 · 并行 D5）

**Files:**
- Create: `packages/mate-tech-agent/pyproject.toml`
- Create: `packages/mate-tech-agent/src/mate_tech_agent/graph/builder.py`
- Create: `packages/mate-tech-agent/src/mate_tech_agent/api/routes/agents.py`
- Create: `packages/mate-tech-agent/tests/integration/test_agent.py`

- [ ] **W5.7.S1: pyproject**

依赖 `langgraph`、`langchain`、`langchain-openai`。

- [ ] **W5.7.S2: graph builder**

```python
from langgraph.graph import StateGraph, START, END
def build_demo() -> StateGraph:
    g = StateGraph(dict)
    g.add_node("a", lambda s: {**s, "x": 1})
    g.add_edge(START, "a")
    g.add_edge("a", END)
    return g
```

- [ ] **W5.7.S3: api**

```python
@router.post("/run")
async def run(body: dict) -> dict:
    g = build_demo()
    return g.compile().invoke(body)
```

- [ ] **W5.7.S4: 集成测试**

调用 `/run`，断言返回 `x: 1`。

- [ ] **W5.7.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-agent -v
git add packages/mate-tech-agent
git commit -m "feat(agent): w5.7 langgraph"
```

### W5.8: `app-kb` 业务聚合（3 周 · 并行 D5）

**Files:**
- Create: `packages/mate-app-kb/pyproject.toml`
- Create: `packages/mate-app-kb/src/mate_app_kb/api/routes/kbs.py`
- Create: `packages/mate-app-kb/src/mate_app_kb/api/routes/search.py`
- Create: `packages/mate-app-kb/src/mate_app_kb/api/routes/chat.py`
- Create: `packages/mate-app-kb/src/mate_app_kb/api/routes/workflows.py`
- Create: `packages/mate-app-kb/src/mate_app_kb/api/routes/events.py`
- Create: `packages/mate-app-kb/src/mate_app_kb/api/routes/stats.py`
- Create: `packages/mate-app-kb/tests/integration/test_app_kb.py`

- [ ] **W5.8.S1: pyproject**

```toml
[project]
name = "mate-app-kb"
version = "0.1.0"
dependencies = ["fastapi>=0.115","pydantic>=2.0","httpx>=0.27","mate-tech-rag","mate-tech-agent"]
```

- [ ] **W5.8.S2: 7 个路由**

每条路由 2–4 行，端点 + 透传到对应服务。

- [ ] **W5.8.S3: 集成测试**

启动 mock 服务，端到端跑 `kb → rag → chat` 链路。

- [ ] **W5.8.S4: 跑测并提交**

```bash
uv run pytest packages/mate-app-kb -v
git add packages/mate-app-kb
git commit -m "feat(app-kb): w5.8 business aggregation"
```

**W5 门禁：** 8 个业务域单元 + 集成测试全绿；`mate-app-kb` 端到端 6 条主链路通过。

---

## W6 前端 9 apps 补齐对接（13 周 · 并行 D7）

**Owner:** W6 owner · **配合**

### W6.1: BFF `API_MODE=mock|live|hybrid`

**Files:**
- Create: `metaplatform-frontend/bff/src/mode.ts`
- Create: `metaplatform-frontend/bff/src/index.ts`

- [ ] **W6.1.S1: `mode.ts`**

```ts
export type ApiMode = "mock" | "live" | "hybrid";
export const API_MODE: ApiMode = (process.env.API_MODE as ApiMode) || "mock";
```

- [ ] **W6.1.S2: `index.ts`**

根据 `API_MODE` 决定 mock / proxy。

- [ ] **W6.1.S3: 提交**

```bash
git add metaplatform-frontend/bff
git commit -m "feat(frontend): w6.1 bff api mode"
```

### W6.2: portal + dashboard 主入口 + 仪表盘（4 周 · 并行 D7）

- [ ] **W6.2.S1: portal e2e**

```ts
test('portal renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Mate Platform')).toBeVisible();
});
```

- [ ] **W6.2.S2: 提交**

```bash
git add metaplatform-frontend
git commit -m "test(frontend): w6.2 portal e2e"
```

### W6.3: ontstudio + kb + mcphub（4 周 · 并行 D7）

- [ ] **W6.3.S1: ontstudio e2e**

```ts
test('ontstudio opens', async ({ page }) => {
  await page.goto('/ontology');
  await expect(page.getByText('本体论管理')).toBeVisible();
});
```

- [ ] **W6.3.S2: kb e2e**

```ts
test('kb search', async ({ page }) => {
  await page.goto('/knowledge/docs');
  await page.getByPlaceholder('搜索').fill('mate');
});
```

- [ ] **W6.3.S3: 提交**

```bash
git add metaplatform-frontend
git commit -m "test(frontend): w6.3 ontstudio kb mcphub e2e"
```

### W6.4: apphub + arch + dw + superai（3 周 · 并行 D7）

- [ ] **W6.4.S1–S4: 4 个 e2e**
- [ ] **W6.4.S5: 提交**

```bash
git add metaplatform-frontend
git commit -m "test(frontend): w6.4 apphub arch dw superai e2e"
```

### W6.5: MSW 浏览器层 Mock

- [ ] **W6.5.S1: MSW 启动**

```ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
export const worker = setupWorker(...handlers);
```

- [ ] **W6.5.S2: 提交**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): w6.5 msw mock"
```

### W6.6: Playwright E2E 回归

- [ ] **W6.6.S1: 每个 app ≥ 5 个关键 E2E**
- [ ] **W6.6.S2: 提交**

```bash
git add metaplatform-frontend/tests
git commit -m "test(frontend): w6.6 e2e regression"
```

**W6 门禁：** 9 个 app 关键路径 E2E 全绿；BFF mock/live 切换正常。

---

## W7 蓝绿迁移（13 周 · 并行 D8）

**Owner:** W7 owner · **关键路径 ?**

### W7.1: 预发布环境

- [ ] **W7.1.S1: K8s namespace `mate-staging` 创建**
- [ ] **W7.1.S2: Argo CD App of Apps**
- [ ] **W7.1.S3: 提交**

```bash
git add infra/data/k8s/argocd
git commit -m "feat(gw): w7.1 staging namespace"
```

### W7.2: 蓝绿部署脚本

- [ ] **W7.2.S1: scripts/bluegreen/deploy.sh**
- [ ] **W7.2.S2: scripts/bluegreen/rollback.sh**
- [ ] **W7.2.S3: 提交**

```bash
git add scripts/bluegreen
git commit -m "feat(release): w7.2 bluegreen scripts"
```

### W7.3–W7.6: 模块迁移

- **W7.3** `tech-msg` → `tech-obs` → `tech-mcp`
- **W7.4** `tech-ont` + `tech-llmgw`
- **W7.5** `tech-rag`
- **W7.6** `tech-agent` + `app-kb`（含 W7.D5 数据平台 D 域引用）

每条用同一脚本：

```bash
bash scripts/bluegreen/deploy.sh $MODULE
sleep 7d
bash scripts/bluegreen/rollback.sh $MODULE  # if needed
```

- [ ] **W7.3–W7.6: 4 次迁移执行与 4 次提交**

```bash
git tag w7.3-msg-obs-mcp
git tag w7.4-ont-llmgw
git tag w7.5-rag
git tag w7.6-agent-app-kb
```

### W7.7: v_{n-1} 保留 7 天

- [ ] **W7.7.S1: Cron 清理脚本**
- [ ] **W7.7.S2: 提交**

```bash
git add scripts/bluegreen/cron
git commit -m "feat(release): w7.7 v_{n-1} cleanup"
```

**W7 门禁：** 所有模块蓝绿迁移通过 7 天观察期；自动清理脚本就绪。

---


# Part 2: D 数据平台 (D0–D8)

> 数据平台是 v1.0 GA 硬前置。每个 D 任务都拆到 2–5 分钟的 sub-step，与 W 主线并发进行。

---

## D0 Spike（2 周 · 并行 W1）

**Owner:** D0 owner · **关键路径 ?**

### D0.1: 关键链路 Spike (CDC→Paimon→Trino)

**Files:**
- Create: `infra/data/spike/cdc-paimon-trino/docker-compose.yml`
- Create: `infra/data/spike/cdc-paimon-trino/flink-job.sql`
- Create: `infra/data/spike/cdc-paimon-trino/verify.sh`
- Create: `infra/data/spike/cdc-paimon-trino/README.md`
- Create: `docs/superpowers/reports/2026-07-28-data-spike-d0.md`

- [ ] **D0.1.S1: 写 `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: {POSTGRES_PASSWORD: postgres}
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
    volumes: ["./trino-catalog:/etc/trino/catalog"]
  flink:
    image: flink:1.19
    command: jobmanager
    ports: ["8082:8081"]
    environment: {FLINK_PROPERTIES: "execution.checkpointing.interval: 10s"}
```

- [ ] **D0.1.S2: 写 `flink-job.sql`**

```sql
CREATE TABLE source_orders (
  id BIGINT, amount DECIMAL(10,2), updated_at TIMESTAMP(3),
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'postgres-cdc',
  'hostname' = 'postgres','port' = '5432',
  'username' = 'postgres','password' = 'postgres',
  'database-name' = 'postgres','schema-name' = 'public',
  'table-name' = 'orders','debezium.slot.name' = 'spike_slot'
);
CREATE TABLE sink_orders_paimon (
  id BIGINT, amount DECIMAL(10,2), updated_at TIMESTAMP(3),
  PRIMARY KEY (id) NOT ENFORCED
) WITH ('connector' = 'paimon','path' = 'file:/tmp/paimon/default.db/orders','sink.parallelism' = '1');
INSERT INTO sink_orders_paimon SELECT * FROM source_orders;
```

- [ ] **D0.1.S3: 写 `verify.sh`**

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

- [ ] **D0.1.S4: 启动 spike**

```bash
cd infra/data/spike/cdc-paimon-trino
chmod +x verify.sh
./verify.sh 2>&1 | tee /tmp/spike.log
```

- [ ] **D0.1.S5: 写 README**

包含：组件版本、启动顺序、预期输出。

- [ ] **D0.1.S6: 写 spike 报告**

报告包含：CDC 端到端 P95、Paimon 文件大小、Trino 查询 P95、已知陷阱。

- [ ] **D0.1.S7: 提交**

```bash
git add infra/data/spike docs/superpowers/reports
git commit -m "feat(data): d0.1 cdc paimon trino spike"
```

**D0 门禁：** 端到端 CDC→Paimon→Trino 跑通，spike 报告存在。

---

## D1 K8s 数据平面（4 周 · 并行 W2/W4）

**Owner:** D1 owner · **关键路径 ?**

### D1.1: Helm Chart 骨架

**Files:**
- Create: `infra/data/k8s/charts/mate-data-platform/Chart.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/values.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/values-dev.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/kafka.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/minio.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/flink-operator.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/airflow.yaml`
- Create: `infra/data/k8s/charts/mate-data-platform/templates/trino.yaml`

- [ ] **D1.1.S1: Chart.yaml**

```yaml
apiVersion: v2
name: mate-data-platform
version: 0.1.0
appVersion: "0.1.0"
```

- [ ] **D1.1.S2: values.yaml**

```yaml
global: {tenant: default, storageClass: standard}
kafka: {replicas: 3, storageSize: 100Gi}
minio: {storageSize: 200Gi}
flink: {jobmanager: {replicas: 1}, taskmanager: {replicas: 3}, resources: {cpu: "2", memory: "4Gi"}}
airflow: {executor: KubernetesExecutor}
trino: {workers: 3}
```

- [ ] **D1.1.S3: Kafka StatefulSet**

3 副本、KRaft、SS。

- [ ] **D1.1.S4: MinIO template**

StatefulSet + Service + PVC。

- [ ] **D1.1.S5: Flink Operator**

Helm release `flink-kubernetes-operator`。

- [ ] **D1.1.S6: Airflow template**

Helm release `airflow`。

- [ ] **D1.1.S7: Trino template**

Deployment + Service + ConfigMap。

- [ ] **D1.1.S8: 验证渲染**

```bash
helm template mate-data-platform infra/data/k8s/charts/mate-data-platform > /tmp/rendered.yaml
kubectl --dry-run=client apply -f /tmp/rendered.yaml
```

- [ ] **D1.1.S9: 提交**

```bash
git add infra/data/k8s
git commit -m "feat(data): d1.1 helm chart skeleton"
```

### D1.2: Argo CD 应用

**Files:**
- Create: `infra/data/k8s/argocd/appset.yaml`

- [ ] **D1.2.S1: ApplicationSet**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: {name: mate-data-platform}
spec:
  generators:
    - list:
        elements:
          - {env: dev, cluster: dev}
          - {env: prod, cluster: prod}
  template:
    metadata: {name: 'mate-data-platform-{{env}}'}
    spec:
      project: mate
      source:
        repoURL: https://github.com/your-org/metaplatform
        path: infra/data/k8s/charts/mate-data-platform
        helm: {valueFiles: ['values-{{env}}.yaml']}
      destination: {server: '{{cluster}}'}
```

- [ ] **D1.2.S2: 提交**

```bash
git add infra/data/k8s/argocd
git commit -m "feat(data): d1.2 argocd applicationset"
```

### D1.3: 故障恢复演练

- [ ] **D1.3.S1: 注入故障脚本**

```bash
kubectl delete pod kafka-0
kubectl delete pod flink-taskmanager-0
rm -rf /tmp/paimon/default.db/orders
```

- [ ] **D1.3.S2: 验证恢复**

观察 P95 不劣化 > 50%，记录 RPO/RTO。

- [ ] **D1.3.S3: 写报告**

`docs/superpowers/reports/2026-07-28-data-k8s-drill.md`。

- [ ] **D1.3.S4: 提交**

```bash
git add docs/superpowers/reports
git commit -m "docs(data): d1.3 k8s dr drill"
```

**D1 门禁：** 关键组件健康检查全部就绪；故障恢复演练报告完成。

---


## D2 mate-tech-data 骨架（4 周 · 并行 W3/W5）

**Owner:** D2 owner · **关键路径 ?**

### D2.1: 包骨架与 pyproject

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

- [ ] **D2.1.S1: pyproject.toml**

```toml
[project]
name = "mate-tech-data"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.115","pydantic>=2.0","sqlmodel>=0.0.16","httpx>=0.27","aiokafka>=0.11","structlog>=24.1","opentelemetry-api>=1.27"]
[project.optional-dependencies]
dev = ["pytest>=8.0","pytest-asyncio>=0.23","testcontainers>=4.7","pyright>=1.1"]
```

- [ ] **D2.1.S2: settings.py**

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

- [ ] **D2.1.S3: logging.py**

```python
import structlog
log = structlog.get_logger("mate_tech_data")
```

- [ ] **D2.1.S4: telemetry.py**

```python
from opentelemetry import trace
tracer = trace.get_tracer("mate_tech_data")
```

- [ ] **D2.1.S5: errors.py**

```python
class MateDataError(Exception): pass
class ConnectorError(MateDataError): pass
class PipelineError(MateDataError): pass
class QualityGateError(MateDataError): pass
```

- [ ] **D2.1.S6: conftest.py**

```python
import pytest
from mate_tech_data.common.settings import settings
@pytest.fixture(autouse=True)
def _settings(monkeypatch):
    monkeypatch.setattr(settings, "postgres_dsn", "postgresql+asyncpg://test:test@localhost:5432/test")
```

- [ ] **D2.1.S7: test_settings.py**

```python
def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("MATE_DATA_POSTGRES_DSN", "postgresql+asyncpg://x/y/z")
    from mate_tech_data.common.settings import Settings
    s = Settings()
    assert "x/y/z" in s.postgres_dsn
```

- [ ] **D2.1.S8: 跑测**

```bash
uv sync
uv run pytest packages/mate-tech-data/tests/unit/test_settings.py -v
uv run pyright packages/mate-tech-data
```

预期：1 passed；pyright 无 error。

- [ ] **D2.1.S9: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d2.1 mate tech data skeleton"
```

### D2.2: ACL Adapter 注册中心

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/acl/registry.py`
- Create: `mate-tech-data/src/mate_tech_data/acl/kafka.py`
- Create: `mate-tech-data/tests/unit/acl/test_registry.py`

- [ ] **D2.2.S1: `registry.py`**

```python
from typing import Protocol, Any
class EngineAdapter(Protocol):
    name: str
    async def health(self) -> dict[str, Any]: ...
class EngineRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, EngineAdapter] = {}
    def register(self, a: EngineAdapter) -> None: self._adapters[a.name] = a
    def get(self, name: str) -> EngineAdapter: return self._adapters[name]
    def all(self) -> dict[str, EngineAdapter]: return dict(self._adapters)
registry = EngineRegistry()
```

- [ ] **D2.2.S2: `kafka.py`**

```python
from aiokafka import AIOKafkaProducer
class KafkaAdapter:
    name = "kafka"
    def __init__(self, bootstrap: str) -> None:
        self.bootstrap = bootstrap
        self.producer = AIOKafkaProducer(bootstrap_servers=bootstrap)
    async def health(self) -> dict[str, str]:
        return {"status": "ok", "bootstrap": self.bootstrap}
```

- [ ] **D2.2.S3: `test_registry.py`**

```python
from mate_tech_data.acl.registry import EngineRegistry
from mate_tech_data.acl.kafka import KafkaAdapter
async def test_register_and_get():
    r = EngineRegistry()
    a = KafkaAdapter(bootstrap="localhost:9092")
    r.register(a)
    assert r.get("kafka") is a
```

- [ ] **D2.2.S4: 跑测并提交**

```bash
uv run pytest packages/mate-tech-data/tests/unit/acl -v
git add packages/mate-tech-data
git commit -m "feat(data): d2.2 acl registry kafka"
```

### D2.3: 领域模型 + 数据库迁移

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/db/models.py`
- Create: `mate-tech-data/src/mate_tech_data/db/migrations/env.py`
- Create: `mate-tech-data/src/mate_tech_data/db/migrations/versions/0001_init.py`
- Create: `mate-tech-data/tests/integration/db/test_migration.py`

- [ ] **D2.3.S1: `db/models.py`**

```python
from datetime import datetime
from sqlmodel import SQLModel, Field
class BaseModel(SQLModel):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

- [ ] **D2.3.S2: 初始化 Alembic**

```bash
cd packages/mate-tech-data
alembic init -t async src/mate_tech_data/db/migrations
```

- [ ] **D2.3.S3: `0001_init.py`**

27 张表（见设计规格 §7.1）。

- [ ] **D2.3.S4: `test_migration.py`**

```python
import pytest
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlalchemy import text

@pytest.fixture
async def engine():
    pg = PostgresContainer("postgres:16-alpine"); pg.start()
    e = create_async_engine(pg.get_connection_url())
    async with e.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield e
    pg.stop()

async def test_init_migration(engine):
    async with engine.connect() as conn:
        rows = await conn.execute(text("SELECT tablename FROM pg_tables"))
        names = {r[0] for r in rows}
    assert "data_source" in names and "pipeline" in names
```

- [ ] **D2.3.S5: 跑测并提交**

```bash
uv run pytest packages/mate-tech-data/tests/integration/db -v
git add packages/mate-tech-data
git commit -m "feat(data): d2.3 db schema init"
```

### D2.4: FastAPI 启动

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/main.py`
- Create: `mate-tech-data/src/mate_tech_data/api/deps.py`
- Create: `mate-tech-data/src/mate_tech_data/api/routes/health.py`
- Create: `mate-tech-data/tests/integration/api/test_health.py`

- [ ] **D2.4.S1: `main.py`**

```python
from fastapi import FastAPI
from mate_tech_data.api.routes import health
app = FastAPI(title="mate-tech-data", version="0.1.0")
app.include_router(health.router, prefix="/api/v1/data")
```

- [ ] **D2.4.S2: `health.py`**

```python
from fastapi import APIRouter
router = APIRouter()
@router.get("/health")
async def health() -> dict[str, str]: return {"status": "ok"}
```

- [ ] **D2.4.S3: `test_health.py`**

```python
from httpx import AsyncClient, ASGITransport
from mate_tech_data.main import app
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.get("/api/v1/data/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
```

- [ ] **D2.4.S4: 跑测并提交**

```bash
uv run pytest packages/mate-tech-data/tests/integration/api -v
git add packages/mate-tech-data
git commit -m "feat(data): d2.4 fastapi app"
```

### D2.5: 契约 OpenAPI 初稿

**Files:**
- Create: `docs/active/api/data/openapi.yaml`

- [ ] **D2.5.S1: OpenAPI 头**

```yaml
openapi: 3.1.0
info:
  title: Mate Data Platform
  version: 0.1.0
servers:
  - url: http://localhost:8080/api/v1/data
```

- [ ] **D2.5.S2: 10 个端点**

`/datasources`、`/pipelines`、`/runs`、`/lakehouse`、`/catalog`、`/lineage`、`/quality`、`/query`、`/products`、`/health`。

- [ ] **D2.5.S3: Redocly lint**

```bash
npx @redocly/cli lint docs/active/api/data/openapi.yaml
npx oasdiff breaking docs/active/api/data/openapi.yaml 1.0.0 docs/active/api/data/openapi.yaml
```

- [ ] **D2.5.S4: 提交**

```bash
git add docs/active/api/data
git commit -m "docs(data): d2.5 openapi"
```

**D2 门禁：** `mate-tech-data` 可启动；单元/集成测试通过；OpenAPI 通过 Redocly。

---

## D3 CDC + Paimon ODS/DWD（5 周 · 并行 W5）

**Owner:** D3 owner · **关键路径 ?**

### D3.1: Connector SDK

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

- [ ] **D3.1.S1: `models.py`**

```python
from enum import Enum
from sqlmodel import Field
from typing import Any
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

- [ ] **D3.1.S2: `postgres_cdc.py`**

```python
class PostgresCDCAdapter:
    name = "postgres_cdc"
    async def discover(self, conn: dict[str, Any]) -> list[dict[str, Any]]: ...
    async def test_connection(self, conn: dict[str, Any]) -> bool: ...
```

- [ ] **D3.1.S3: `test_models.py`**

```python
from mate_tech_data.connector.models import DataSource, ConnectorType
def test_data_source_roundtrip():
    s = DataSource(name="erp", type=ConnectorType.POSTGRES_CDC, config={"host": "x"})
    assert s.type == ConnectorType.POSTGRES_CDC
```

- [ ] **D3.1.S4: 集成测试**

Testcontainers 启动 PostgreSQL，调用 `discover`。

- [ ] **D3.1.S5: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d3.1 connector sdk"
```

### D3.2: Paimon ODS/DWD 写入

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/compiler.py`
- Create: `mate-tech-data/src/mate_tech_data/acl/paimon.py`
- Create: `mate-tech-data/tests/integration/pipeline/test_paimon_compile.py`

- [ ] **D3.2.S1: `acl/paimon.py`**

```python
class PaimonAdapter:
    name = "paimon"
    def __init__(self, warehouse: str) -> None: self.warehouse = warehouse
    def catalog(self, name: str): ...
    def create_table(self, catalog, db, table, schema): ...
    def commit(self, catalog, db, table, records): ...
```

- [ ] **D3.2.S2: `compiler.py`**

```python
def compile_cdc_to_paimon(source, sink_db, sink_table) -> str:
    return f"CREATE TABLE source_{source.id} (...) WITH ('connector' = 'postgres-cdc', ...); CREATE TABLE sink_{sink_table} (...) WITH ('connector' = 'paimon', 'path' = 's3://bucket/{sink_db}/{sink_table}', ...); INSERT INTO sink_{sink_table} SELECT * FROM source_{source.id};"
```

- [ ] **D3.2.S3: 集成测试**

Testcontainers 启动 Flink + MinIO + PostgreSQL，编译并执行。

- [ ] **D3.2.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d3.2 paimon ods dwd"
```

### D3.3: 回放与故障注入

**Files:**
- Create: `mate-tech-data/tests/integration/pipeline/test_replay.py`
- Create: `docs/superpowers/reports/2026-07-28-data-replay-d3.md`

- [ ] **D3.3.S1: Golden Dataset**

`tests/integration/data/orders.csv`：

```
id,amount,updated_at
1,9.99,2026-07-01T00:00:00Z
2,19.99,2026-07-01T00:00:01Z
```

- [ ] **D3.3.S2: `test_replay.py`**

```python
async def test_replay_pipeline(engine):
    res = await engine.replay(pipeline_id="demo", dataset="tests/integration/data/orders.csv")
    assert res["rows"] == 2
```

- [ ] **D3.3.S3: 故障注入**

- 杀 TaskManager → 验证 Savepoint 重启
- 注入乱序事件 → 验证 Paimon 主键更新
- 注入 Schema 变更 → 验证拒绝并隔离

- [ ] **D3.3.S4: 报告**

记录 P50 恢复时间、Upsert 正确性、乱序一致性。

- [ ] **D3.3.S5: 提交**

```bash
git add packages/mate-tech-data docs/superpowers/reports
git commit -m "test(data): d3.3 replay and fault"
```

**D3 门禁：** CDC 跑通；Upsert/Delete 正确；乱序与回放对账无差异；故障注入 P50 恢复 < 30s。

---


## D4 Pipeline Spec + Airflow（5 周 · 并行 W5）

**Owner:** D4 owner · **关键路径 ?**

### D4.1: Canonical Spec 与 JSON Schema

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/canonical_spec.py`
- Create: `docs/active/specs/2026-07-28-mate-tech-data-pipeline-spec.json`
- Create: `mate-tech-data/tests/unit/pipeline/test_canonical_spec.py`

- [ ] **D4.1.S1: 写 JSON Schema**

`nodes` (type/source/transform/sink/quality/map)、`edges`、`resources`、`parameters`、`contract`、`schedule`、`approval`。

- [ ] **D4.1.S2: 校验器**

```python
import jsonschema
from ..common.errors import PipelineError
def validate_spec(spec: dict) -> None:
    try: jsonschema.validate(spec, SCHEMA)
    except jsonschema.ValidationError as e: raise PipelineError(f"invalid: {e.message}") from e
```

- [ ] **D4.1.S3: 单元测试**

合法 spec、缺字段、错类型、循环依赖。

- [ ] **D4.1.S4: 提交**

```bash
git add packages/mate-tech-data docs/active/specs
git commit -m "feat(data): d4.1 canonical spec"
```

### D4.2: Pipeline Compiler

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/compiler.py`
- Create: `mate-tech-data/tests/unit/pipeline/test_compiler.py`

- [ ] **D4.2.S1: `compile_sql(spec)` 返回 Flink SQL**
- [ ] **D4.2.S2: `compile_flink_job(spec)` 返回 `FlinkDeployment` manifest**
- [ ] **D4.2.S3: `compile_airflow_dag(spec)` 返回 DAG bundle dict**
- [ ] **D4.2.S4: `compile_governance(spec)` 返回 OpenLineage / Quality / Ranger intent**
- [ ] **D4.2.S5: 单元测试**

每种模式 1 个快照测试；同一 spec 编译哈希稳定。

- [ ] **D4.2.S6: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4.2 compiler"
```

### D4.3: Airflow Provider

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/operator/flink_operator.py`
- Create: `mate-tech-data/src/mate_tech_data/operator/quality_gate_operator.py`
- Create: `mate-tech-data/src/mate_tech_data/operator/data_product_publish_operator.py`
- Create: `mate-tech-data/tests/integration/operator/test_airflow_provider.py`

- [ ] **D4.3.S1: `FlinkSubmitOperator`**

调用 Flink Operator REST，提交 `FlinkDeployment`，等待 `RUNNING`，返回 jobId。

- [ ] **D4.3.S2: `QualityGateOperator`**

调用 `mate-tech-data` 的 `/quality/runs`，断言全过。

- [ ] **D4.3.S3: `DataProductPublishOperator`**

将 ADS 表版本写入 Catalog，发事件。

- [ ] **D4.3.S4: 集成测试**

Testcontainers 启动 Airflow + Flink Operator + mate-tech-data，触发 DAG 运行。

- [ ] **D4.3.S5: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4.3 airflow providers"
```

### D4.4: 发布状态机

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/pipeline/service.py`
- Create: `mate-tech-data/src/mate_tech_data/pipeline/api.py`
- Create: `mate-tech-data/tests/integration/pipeline/test_state_machine.py`

- [ ] **D4.4.S1: 状态机**

`DRAFT → VALIDATED → IN_REVIEW → DEPLOYED → RUNNING / PAUSED / FAILED → RETIRED`

- [ ] **D4.4.S2: API 端点**

```python
@router.post(""); async def create(p: Pipeline): ...
@router.post("/{id}/validate"); async def validate(id: int): ...
@router.post("/{id}/deploy"); async def deploy(id: int): ...
@router.post("/{id}/run"); async def run(id: int): ...
@router.post("/{id}/pause"); async def pause(id: int): ...
@router.post("/{id}/retire"); async def retire(id: int): ...
```

- [ ] **D4.4.S3: 集成测试**

完整跑 DRAFT → RETIRED。

- [ ] **D4.4.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d4.4 state machine"
```

**D4 门禁：** 至少 1 条 SQL + 1 条 Java Flink + 1 条 PyFlink Pipeline 端到端跑通并能回滚。

---

## D5 Iceberg + Trino + StarRocks（4 周 · 并行 W5）

**Owner:** D5 owner · **关键路径 ?**

### D5.1: Iceberg 数据产品发布

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/acl/iceberg.py`
- Create: `mate-tech-data/src/mate_tech_data/catalog/service.py`
- Create: `mate-tech-data/tests/integration/catalog/test_iceberg_publish.py`

- [ ] **D5.1.S1: `iceberg.py`**

封装 PyIceberg REST catalog。

- [ ] **D5.1.S2: `promote_to_iceberg`**

读 Paimon 快照 → 物化 Iceberg → 发 `data.product.certified.v1`。

- [ ] **D5.1.S3: 集成测试**

Testcontainers 启动 Iceberg REST + Trino，断言表可查。

- [ ] **D5.1.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5.1 iceberg promotion"
```

### D5.2: Trino Gateway

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/query/trino_gateway.py`
- Create: `mate-tech-data/src/mate_tech_data/query/api.py`
- Create: `mate-tech-data/tests/integration/query/test_trino.py`

- [ ] **D5.2.S1: `TrinoGateway.execute`**

支持 Ranger 鉴权注入、超时、Limit、审计。

- [ ] **D5.2.S2: API**

`POST /query` / `GET /query/{id}`。

- [ ] **D5.2.S3: 集成测试**

启动 Trino + Iceberg + Ranger。

- [ ] **D5.2.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5.2 trino gateway"
```

### D5.3: StarRocks Serving

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/query/starrocks_gateway.py`
- Create: `mate-tech-data/tests/integration/query/test_starrocks.py`

- [ ] **D5.3.S1: `StarRocksGateway`**

创建外部表、物化视图、异步刷新。

- [ ] **D5.3.S3: 集成测试**

启动 StarRocks + Iceberg，断言 ADS 查询 P95 1–3s。

- [ ] **D5.3.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d5.3 starrocks"
```

**D5 门禁：** 至少 3 个认证数据产品可被订阅；StarRocks P95 1–3s。

---

## D6 治理与安全（4 周 · 并行 W5）

**Owner:** D6 owner · **关键路径 ?**

### D6.1: Gravitino 联邦

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/catalog/gravitino_adapter.py`
- Create: `mate-tech-data/tests/integration/catalog/test_gravitino.py`

- [ ] **D6.1.S1: 联邦 Paimon + Iceberg + Kafka + S3**

```python
def register_catalog(name: str, type: str, uri: str): ...
def bind_namespace(catalog, ns, props): ...
def emit_schema_event(catalog, ns, table): ...
```

- [ ] **D6.1.S2: 集成测试**

4 类 Catalog 联合查询 + Schema 变更事件被 OpenMetadata 消费。

- [ ] **D6.1.S3: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6.1 gravitino"
```

### D6.2: OpenMetadata 治理

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/catalog/openmetadata_adapter.py`
- Create: `mate-tech-data/tests/integration/catalog/test_openmetadata.py`

- [ ] **D6.2.S1: Adapter**

创建 Dataset / Owner / Glossary / Tag；上报 Quality；上报 Lineage。

- [ ] **D6.2.S2: 集成测试**

验证 lineage 渲染 + quality 报告。

- [ ] **D6.2.S3: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6.2 openmetadata"
```

### D6.3: 质量与血缘

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/governance/quality.py`
- Create: `mate-tech-data/src/mate_tech_data/governance/lineage.py`
- Create: `mate-tech-data/tests/integration/governance/test_quality.py`

- [ ] **D6.3.S1: `QualityService.run`**

封装 Great Expectations。

- [ ] **D6.3.S2: `LineagePublisher`**

监听 Airflow DAG run 结束事件 → 上报 OpenLineage。

- [ ] **D6.3.S3: 集成测试**

失败质量运行阻断发布。

- [ ] **D6.3.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6.3 quality lineage"
```

### D6.4: Ranger + OpenBao

**Files:**
- Create: `mate-tech-data/src/mate_tech_data/governance/policy.py`
- Create: `mate-tech-data/src/mate_tech_data/governance/secrets.py`
- Create: `mate-tech-data/tests/integration/governance/test_ranger.py`
- Create: `mate-tech-data/tests/integration/governance/test_openbao.py`

- [ ] **D6.4.S1: Ranger 下发**

Pydantic 模型 → Ranger Policy。

- [ ] **D6.4.S2: OpenBao 动态凭证**

短期 token。

- [ ] **D6.4.S3: 集成测试**

越权 100% 阻断 + 密钥 30 天轮换。

- [ ] **D6.4.S4: 提交**

```bash
git add packages/mate-tech-data
git commit -m "feat(data): d6.4 ranger openbao"
```

**D6 门禁：** 越权 100% 阻断；密钥轮换；质量失败 100% 阻断；血缘字段级。

---

## D7 Ontology 原位增强（5 周 · 并行 W6）

**Owner:** D7 owner · **关键路径 ?**

### D7.1: 前端 API 客户端

**Files:**
- Create: `metaplatform-frontend/apps/portal/src/api/data.ts`
- Create: `metaplatform-frontend/apps/portal/src/api/data.types.ts`

- [ ] **D7.1.S1: `data.types.ts`**

```ts
export interface DataSource { id: number; name: string; type: string; status: string; }
export interface Pipeline { id: number; name: string; version: number; status: string; }
export interface DataProduct { id: string; name: string; certified: boolean; }
```

- [ ] **D7.1.S2: `data.ts`**

```ts
import { api } from "@mate/shared";
export async function listPipelines(): Promise<Pipeline[]> {
  const r = await api.get("/v1/data/pipelines");
  return r.data.items;
}
```

- [ ] **D7.1.S3: 提交**

```bash
git add metaplatform-frontend/apps/portal/src/api
git commit -m "feat(frontend): d7.1 data api"
```

### D7.2: 数据中心子页

**Files:**
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/OverviewPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/SourcesPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/PipelinesPage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/LakehousePage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/GovernancePage.tsx`
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/OperationsPage.tsx`
- Modify: `metaplatform-frontend/apps/portal/src/App.tsx`
- Create: `metaplatform-frontend/tests/e2e/data/datacenter.spec.ts`

- [ ] **D7.2.S1: 总览页**

卡片：数据源数、Pipeline 数、湖仓资产、质量评分、告警。

- [ ] **D7.2.S2: 数据源页**

数据源列表 + 状态、Schema Discovery、字段映射。

- [ ] **D7.2.S3: Pipeline 页**

Canvas + Flink SQL 编辑器 + 编译/发布/运行入口。

- [ ] **D7.2.S4: 湖仓与 SQL**

按层展示 + StarRocks/Trino 查询。

- [ ] **D7.2.S5: 治理页**

质量、SLA、血缘、Owner、术语、标签。

- [ ] **D7.2.S6: 运行监控**

运行实例、Savepoint、补数、回滚、告警。

- [ ] **D7.2.S7: 路由**

```tsx
<Route path="ontology/datacenter" element={<OverviewPage />} />
<Route path="ontology/datacenter/sources" element={<SourcesPage />} />
<Route path="ontology/datacenter/pipelines" element={<PipelinesPage />} />
<Route path="ontology/datacenter/lakehouse" element={<LakehousePage />} />
<Route path="ontology/datacenter/governance" element={<GovernancePage />} />
<Route path="ontology/datacenter/operations" element={<OperationsPage />} />
```

- [ ] **D7.2.S8: E2E 测试**

```ts
test('data center overview renders', async ({ page }) => {
  await page.goto('/ontology/datacenter');
  await expect(page.getByText('数据源总数')).toBeVisible();
});
```

- [ ] **D7.2.S9: 提交**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7.2 data center pages"
```

### D7.3: 语义映射原位

**Files:**
- Create: `metaplatform-frontend/apps/portal/src/pages/ontology/datacenter/components/SemanticMapButton.tsx`
- Create: `metaplatform-frontend/tests/e2e/data/semantic-map.spec.ts`

- [ ] **D7.3.S1: 按钮组件**

```tsx
export function SemanticMapButton({ assetId }: { assetId: number }) {
  return <Button onClick={() => api.post(`/v1/data/catalog/${assetId}/map`)}>映射到本体</Button>;
}
```

- [ ] **D7.3.S2: E2E**

```ts
test('semantic map', async ({ page }) => {
  await page.goto('/ontology/datacenter/lakehouse');
  await page.getByText('映射到本体').first().click();
  await expect(page.getByText('已映射')).toBeVisible();
});
```

- [ ] **D7.3.S3: 提交**

```bash
git add metaplatform-frontend
git commit -m "feat(frontend): d7.3 semantic map"
```

**D7 门禁：** 4 个本体引擎页签与子页签不回归；语义映射一气呵成。

---

## D8 压测 灾备 GA（4 周 · 并行 W7）

**Owner:** D8 owner · **关键路径 ?**

### D8.1: 容量与压测

**Files:**
- Create: `tests/perf/data/scenarios/cdc_500_pipeline.py`
- Create: `tests/perf/data/scenarios/trino_p95.py`
- Create: `tests/perf/data/scenarios/starrocks_p95.py`
- Create: `docs/superpowers/reports/2026-07-28-data-perf-d8.md`

- [ ] **D8.1.S1: 500 Pipeline 压测**

Locust 场景：同时跑 500 条 Pipeline。

- [ ] **D8.1.S2: 查询 P95**

Trino < 30s / StarRocks 1–3s / Data Product < 5s。

- [ ] **D8.1.S3: 报告**

- [ ] **D8.1.S4: 提交**

```bash
git add tests/perf docs/superpowers/reports
git commit -m "test(data): d8.1 perf"
```

### D8.2: 混沌与灾备

**Files:**
- Create: `tests/chaos/data/kafka_broker_outage.yaml`
- Create: `tests/chaos/data/flink_tm_kill.yaml`
- Create: `tests/chaos/data/postgres_primary_failover.yaml`
- Create: `docs/superpowers/reports/2026-07-28-data-chaos-d8.md`

- [ ] **D8.2.S1: 故障注入**

- 杀 Kafka broker / Flink TM / Postgres Primary

- [ ] **D8.2.S2: 验证 RPO/RTO**

控制面 RPO ≤ 5m / 关键流 ≤ Checkpoint / 控制面 RTO ≤ 30m / 关键流 ≤ 15m。

- [ ] **D8.2.S3: 报告**

- [ ] **D8.2.S4: 提交**

```bash
git add tests/chaos docs/superpowers/reports
git commit -m "test(data): d8.2 chaos"
```

### D8.3: GA 验收

**Files:**
- Create: `docs/superpowers/reports/2026-07-28-data-ga-d8.md`
- Create: `docs/superpowers/reports/2026-07-28-data-acceptance-checklist.md`

- [ ] **D8.3.S1: 走查全部 GA 门禁**
- [ ] **D8.3.S2: GA 报告**
- [ ] **D8.3.S3: 提交**

```bash
git add docs/superpowers/reports
git commit -m "docs(data): d8.3 ga"
```

**D8 门禁：** 所有 v1.0 GA 验收门禁通过；`/api/v1/data/*` 契约兼容；无 P0/P1 缺陷。

---

# Part 3: 跨阶段质量与合规

- **类型检查**：`uv run pyright packages` 全绿
- **Lint**：`uv run ruff check .` 全绿
- **测试**：单元 ≥ 80% 覆盖、集成覆盖全部 Engine Adapter、契约测试覆盖所有 REST 端点
- **CI**：`GitHub Actions` 增加 `data-plane-ci`：lint + type + unit + contract + oasdiff
- **前端**：`pnpm typecheck`、`pnpm lint`、`pnpm test:e2e` 全部绿
- **可观测**：OTel SDK、Prometheus 指标、Loki 日志、Kafka Lag / Flink Checkpoint / Compaction / Trino Queue / StarRocks Load / Quality 失败 / SLA / 成本指标
- **安全**：Ranger 行列权限、OpenBao 凭证、镜像签名、容器只读、非 root
- **可回滚**：Pipeline Version 不可变；部署失败自动回滚到上一 Savepoint；ADS 发布失败保留最后健康版本

# Part 4: 关键路径与里程碑

## 关键路径

```
W1-1 → W2-3 → W3-3 → W4-3 → W5-6 → W5-7 → W5-8 → W7-6
∥
D0 → D1 → D2 → D3 → D4 → D5 → D6 → D7 → D8
```

## 里程碑

| 里程碑 | 包含 | 目标日期 | 状态 |
|---|---|---|---|
| M1+ | D0–D1 + W1–W2 | 2026-09-15 | 未启动 |
| M2+ | D2–D3 + W3–W4 | 2026-10-15 | 未启动 |
| M3+ | D4–D5 + W5 | 2026-12-15 | 未启动 |
| M4+ | D6 + W6 | 2027-01-31 | 未启动 |
| M5+ | D7–D8 + W7（GA 共同门槛） | 2027-03-15 | 未启动 |

## 每周同步

每周一上午按 `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` §8 模板更新进度。
