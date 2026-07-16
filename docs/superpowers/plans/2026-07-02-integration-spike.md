# 集成 Spike 实施计划（团队 A + B 协作）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 验证本体引擎 v0.1 与数据栈 v0.1 能在 1 个月内端到端跑通 — 建实体类型 → 落图 → 落湖 → 用 SQL 查出来 — 作为进入 MVP 第 2 期的"实物证据"。

**Architecture:** 在团队 A（本体引擎）和团队 B（数据栈）并行交付的基础上，搭建一个 e2e 集成测试：本体引擎发 entity-instance 事件 → 数据栈 Kafka 消费者接收 → Doris 自动建表并写入 → 用户通过数据栈的查询 API 读出。

**Tech Stack:**
- 与本体引擎一致：Java 21 + Spring Boot 3 + Neo4j 5 + PostgreSQL 16 + Kafka
- 与数据栈一致：Go 1.22 + Gin + Doris 2.0 + ClickHouse 24 + MinIO + Hudi
- e2e 工具：Testcontainers（Java 端）+ docker-compose（编排）

**对应 spec：** §5.2.2 + §5.2.3 之间的 P3 数据流
**对应决策：** D12 双线并行、D14 第 1 期 Spike
**对应阶段：** 第 1 期 · Spike 末段（T-2 周 ~ T0）

---

## 文件结构

集成 Spike 不是一个新项目，而是在两个团队的项目之间架起测试桥。结构如下：

```
metaplatform-integration-spike/
├── docker-compose.yml                   # 一键起两套基础设施
├── README.md
├── scripts/
│   ├── start-everything.sh              # 启动本体引擎 + 数据栈
│   ├── stop-everything.sh
│   └── run-e2e.sh                       # 跑 e2e
├── e2e/
│   ├── customer-lifecycle.sh            # bash 脚本：完整 7 步 e2e
│   ├── fixtures/
│   │   └── customer-event.json          # 模拟事件 payload
│   └── verify/
│       ├── verify-neo4j.sh
│       ├── verify-doris.sh
│       └── verify-kafka.sh
└── docs/
    └── spike-acceptance.md
```

---

## Task 1: 编排基础设施（一键起两套）

**Files:**
- Create: `metaplatform-integration-spike/docker-compose.yml`
- Create: `metaplatform-integration-spike/README.md`

- [ ] **Step 1.1: 写 docker-compose**

```yaml
version: '3.8'

# 集成 Spike 编排：本体引擎 + 数据栈 + 共用基础设施
# 注意：本仓库不启动本体引擎/数据栈的 JAR/二进制，只启动基础设施
# 本体引擎和数据栈的二进制由各自的 docker-compose 启动

services:
  # === 本体引擎的基础设施 ===
  ontology-neo4j:
    image: neo4j:5.18-community
    container_name: spike-neo4j
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/metaplatform
    volumes:
      - neo4j-data:/data

  ontology-postgres:
    image: postgres:16
    container_name: spike-pg-ontology
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ontology_meta
      POSTGRES_USER: meta
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-ontology-data:/var/lib/postgresql/data

  # === 数据栈的基础设施 ===
  data-stack-doris-fe:
    image: apache/doris:2.0.2-fe
    container_name: spike-doris-fe
    ports:
      - "9030:9030"
      - "8030:8030"
    hostname: doris-fe

  data-stack-doris-be:
    image: apache/doris:2.0.2-be
    container_name: spike-doris-be
    ports:
      - "8040:8040"
    hostname: doris-be
    depends_on:
      - data-stack-doris-fe

  data-stack-clickhouse:
    image: clickhouse/clickhouse-server:24.3
    container_name: spike-clickhouse
    ports:
      - "8123:8123"
      - "9000:9000"
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: metaplatform
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1

  data-stack-minio:
    image: minio/minio:latest
    container_name: spike-minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: metaplatform
    command: server /data --console-address ":9001"

  data-stack-postgres:
    image: postgres:16
    container_name: spike-pg-datastack
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: data_stack_meta
      POSTGRES_USER: meta
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-datastack-data:/var/lib/postgresql/data

  # === 共用基础设施：单一 Kafka ===
  shared-kafka:
    image: apache/kafka:3.6.1
    container_name: spike-kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://shared-kafka:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'

volumes:
  neo4j-data:
  pg-ontology-data:
  pg-datastack-data:
```

- [ ] **Step 1.2: 写 README**

`README.md`：

```markdown
# MetaPlatform 集成 Spike

第 1 期 Spike 末段：验证本体引擎 v0.1 ↔ 数据栈 v0.1 端到端可跑通。

## 启动

```bash
docker-compose up -d
sleep 30

# 启动本体引擎（在另一个项目）
cd ../metaplatform-ontology-engine
./mvnw spring-boot:run &

# 启动数据栈（在另一个项目）
cd ../metaplatform-data-stack
go run cmd/server/main.go &

sleep 30
```

## 跑 e2e

```bash
./scripts/run-e2e.sh
```

## 端口

- 本体引擎 Neo4j: 7474 / 7687
- 本体引擎 PG: 5432
- 数据栈 Doris FE: 9030
- 数据栈 Doris BE: 8040
- 数据栈 ClickHouse: 8123 / 9000
- 数据栈 MinIO: 9000 / 9001
- 数据栈 PG: 5433
- 共用 Kafka: 9092
```

- [ ] **Step 1.3: 启动基础设施**

```bash
docker-compose up -d
sleep 30
docker ps
```

Expected: 8 个容器运行

- [ ] **Step 1.4: 验证 Kafka 通了**

```bash
docker exec -it spike-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

Expected: 空列表（还没创建 topic）

- [ ] **Step 1.5: 提交**

```bash
git init && git checkout -b main
git add .
git commit -m "chore: integration spike orchestration compose"
```

---

## Task 2: e2e 测试 fixture（事件 payload）

**Files:**
- Create: `e2e/fixtures/customer-event.json`

- [ ] **Step 2.1: 写 fixture**

`e2e/fixtures/customer-event.json`：

```json
{
  "eventId": "evt-001",
  "occurredAt": "2026-07-02T10:00:00Z",
  "tenantId": "default-tenant",
  "actorId": "alice",
  "entityTypeId": "REPLACE_WITH_ACTUAL_ENTITY_TYPE_ID",
  "instance": {
    "id": "customer-001",
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

- [ ] **Step 2.2: 提交**

```bash
git add .
git commit -m "test(e2e): add customer event fixture"
```

---

## Task 3: 完整 e2e 脚本（7 步）

**Files:**
- Create: `scripts/customer-lifecycle.sh`

> **设计目标**：单个 bash 脚本，模拟"业务人员用 MetaPlatform 创建一个客户"的全流程。7 步走完 = 集成 Spike 成功。

- [ ] **Step 3.1: 写 customer-lifecycle.sh**

```bash
#!/usr/bin/env bash
# customer-lifecycle.sh
# 集成 Spike 的端到端测试：建实体类型 → 落图 → 落湖 → 用 SQL 查出来
# 7 步走完 = 集成 Spike 成功

set -euo pipefail

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
ONTOLOGY_URL=${ONTOLOGY_URL:-http://localhost:8080}
DATASTACK_URL=${DATASTACK_URL:-http://localhost:8081}
ACTOR_ID=${ACTOR_ID:-alice}
TENANT_ID=${TENANT_ID:-default-tenant}
KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}
ENTITY_INSTANCE_TOPIC=metaplatform.ontology.entity-instance

# 输出 helper
step() { echo -e "${YELLOW}==> $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# === Step 1: 在本体引擎创建 Customer 实体类型 ===
step "Step 1/7: 创建 Customer 实体类型（本体引擎）"
RESPONSE=$(curl -s -X POST "$ONTOLOGY_URL/api/v1/entity-types" \
  -H "Content-Type: application/json" \
  -H "X-Actor-Id: $ACTOR_ID" \
  -d '{
    "name":"Customer",
    "properties":[
      {"name":"name","type":"STRING","required":true},
      {"name":"email","type":"STRING","required":false}
    ]
  }')
ENTITY_TYPE_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
[ -n "$ENTITY_TYPE_ID" ] || fail "创建 Customer 失败：$RESPONSE"
ok "Customer 创建成功，id=$ENTITY_TYPE_ID"

# === Step 2: 验证本体引擎写入了 Neo4j ===
step "Step 2/7: 验证本体引擎在 Neo4j 中持久化"
sleep 2
NEO4J_COUNT=$(docker exec spike-neo4j cypher-shell -u neo4j -p metaplatform \
  "MATCH (e:EntityType {id:'$ENTITY_TYPE_ID'}) RETURN count(e) AS c" 2>/dev/null | grep -oP '^\d+' | head -1)
[ "$NEO4J_COUNT" = "1" ] || fail "Neo4j 中没找到 Customer"
ok "Neo4j 中找到 Customer"

# === Step 3: 在本体引擎发 entity-instance 事件（模拟业务对象层） ===
step "Step 3/7: 发 entity-instance 事件到 Kafka"
EVENT_PAYLOAD=$(cat <<EOF
{
  "eventId": "evt-$(date +%s)",
  "occurredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tenantId": "$TENANT_ID",
  "actorId": "$ACTOR_ID",
  "entityTypeId": "$ENTITY_TYPE_ID",
  "instance": {
    "id": "customer-$(date +%s)",
    "name": "Alice",
    "email": "alice@example.com"
  }
}
EOF
)
echo "$EVENT_PAYLOAD" | docker exec -i spike-kafka /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server $KAFKA_BROKER \
  --topic $ENTITY_INSTANCE_TOPIC
ok "事件已发送到 Kafka"

# === Step 4: 等数据栈消费 ===
step "Step 4/7: 等数据栈消费（5s）"
sleep 5
ok "等待完成"

# === Step 5: 在 Doris 中验证表已建、数据已写 ===
step "Step 5/7: 验证 Doris 表和数据"
TABLE_PREFIX="instance_$(echo $ENTITY_TYPE_ID | cut -c1-8)"
TABLE_EXISTS=$(docker exec spike-doris-fe mysql -h127.0.0.1 -P9030 -uroot \
  -e "SHOW TABLES FROM default LIKE '${TABLE_PREFIX}%';" 2>/dev/null | tail -1)
[ -n "$TABLE_EXISTS" ] || fail "Doris 中没找到表 $TABLE_PREFIX"
ok "Doris 中找到表 $TABLE_EXISTS"

ROW_COUNT=$(docker exec spike-doris-fe mysql -h127.0.0.1 -P9030 -uroot \
  -e "SELECT COUNT(*) FROM default.${TABLE_EXISTS};" 2>/dev/null | tail -1)
[ "$ROW_COUNT" -ge "1" ] || fail "Doris 表里没数据：$ROW_COUNT"
ok "Doris 表里有 $ROW_COUNT 行"

# === Step 6: 通过数据栈的查询 API 读出来 ===
step "Step 6/7: 通过数据栈查询 API 读出"
QUERY_RESPONSE=$(curl -s -X POST "$DATASTACK_URL/api/v1/query" \
  -H "Content-Type: application/json" \
  -d "{\"sql\":\"SELECT * FROM ${TABLE_EXISTS}\"}")
ok "查询返回：$QUERY_RESPONSE"

# === Step 7: 在 Neo4j Browser 验证 ===
step "Step 7/7: 验证 Neo4j 中 Customer 类型已添加 property（如果业务对象层跑了）"
# 这步可选 — Spike 期业务对象层还没做，所以 Neo4j 中只有类型，没有实例
NEO4J_TYPE_PROPS=$(docker exec spike-neo4j cypher-shell -u neo4j -p metaplatform \
  "MATCH (e:EntityType {id:'$ENTITY_TYPE_ID'})-[r:HAS_PROPERTY]->(p:Property) RETURN count(p) AS c" 2>/dev/null | grep -oP '^\d+' | head -1)
ok "Customer 类型有 $NEO4J_TYPE_PROPS 个属性"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} 集成 Spike 成功！7 步全部通过${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "结论：本体引擎 v0.1 ↔ 数据栈 v0.1 端到端可跑通"
echo "下一步：进入第 2 期 MVP 阶段"
```

- [ ] **Step 3.2: 改权限并提交**

```bash
chmod +x scripts/customer-lifecycle.sh
git add .
git commit -m "test(e2e): add 7-step customer lifecycle script"
```

---

## Task 4: 跑完整 e2e

- [ ] **Step 4.1: 启动本体引擎**

```bash
cd ../metaplatform-ontology-engine
docker-compose up -d
./mvnw spring-boot:run > /tmp/ontology.log 2>&1 &
ONTOLOGY_PID=$!
echo "ontology pid: $ONTOLOGY_PID"
sleep 30
curl -s http://localhost:8080/actuator/health
```

Expected: `{"status":"UP"}`

- [ ] **Step 4.2: 启动数据栈**

```bash
cd ../metaplatform-data-stack
docker-compose up -d
go run cmd/server/main.go > /tmp/datastack.log 2>&1 &
DATASTACK_PID=$!
echo "datastack pid: $DATASTACK_PID"
sleep 30
curl -s http://localhost:8081/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4.3: 跑 e2e**

```bash
cd metaplatform-integration-spike
./scripts/customer-lifecycle.sh
```

Expected:
- 7 步全过
- 末尾打印"集成 Spike 成功！7 步全部通过"
- 实体类型 id 被打印
- Doris 表名被打印

- [ ] **Step 4.4: 如果失败，排查日志**

```bash
# 本体引擎日志
tail -100 /tmp/ontology.log

# 数据栈日志
tail -100 /tmp/datastack.log

# Kafka 消费 lag
docker exec spike-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group data-stack-ingest-group
```

- [ ] **Step 4.5: 提交日志（可选）**

```bash
git add logs/
git commit -m "test(e2e): record e2e run logs"
```

---

## Task 5: 验证 D13 双轨 OLAP

**Files:**
- Create: `scripts/verify-d13-dual-track.sh`

> **目标**：证明 Doris 是默认路径、ClickHouse 是 `ext_ck_` 前缀的副轨。

- [ ] **Step 5.1: 写验证脚本**

```bash
#!/usr/bin/env bash
# verify-d13-dual-track.sh
# 验证 D13 决策：Doris 主 + ClickHouse 适配器

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DATASTACK_URL=${DATASTACK_URL:-http://localhost:8081}

step() { echo -e "${YELLOW}==> $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# === Test 1: 默认表名走 Doris ===
step "Test 1/3: 默认表名 'customers' 应走 Doris"
RESPONSE=$(curl -s -X POST "$DATASTACK_URL/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM customers"}')
echo "$RESPONSE" | grep -q "ok" || fail "默认表查询失败：$RESPONSE"
ok "默认走 Doris 路由"

# === Test 2: ext_ck_ 前缀表走 ClickHouse ===
step "Test 2/3: 'ext_ck_logs' 前缀应走 ClickHouse 适配器"
RESPONSE=$(curl -s -X POST "$DATASTACK_URL/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM ext_ck_logs"}')
echo "$RESPONSE" | grep -q "ok" || fail "CK 前缀查询失败：$RESPONSE"
ok "CK 前缀走 ClickHouse 适配器"

# === Test 3: Go 单元测试（路由决策器）===
step "Test 3/3: Go 单元测试 — 路由决策器"
cd ../metaplatform-data-stack
go test ./internal/infrastructure/warehouse/... -v -run TestRouteDecider 2>&1 | tail -20
ok "路由决策器测试通过"

echo ""
echo -e "${GREEN}D13 双轨 OLAP 验证通过${NC}"
```

- [ ] **Step 5.2: 跑验证**

```bash
chmod +x scripts/verify-d13-dual-track.sh
./scripts/verify-d13-dual-track.sh
```

Expected: 3 个 Test 全过

- [ ] **Step 5.3: 提交**

```bash
git add .
git commit -m "test(e2e): add D13 dual-track OLAP verification"
```

---

## Task 6: 写 spike 验收文档

- [ ] **Step 6.1: 写 docs/spike-acceptance.md**

```markdown
# 集成 Spike 验收报告

日期：2026-07-XX
执行人：<name>
参与：团队 A（本体引擎）、团队 B（数据栈）

## 验收清单

- [ ] Task 4.3：7 步 e2e 全过
- [ ] Task 5：3 个 D13 验证全过

## 端到端流程

```
用户/建模者
    ↓ POST /api/v1/entity-types
本体引擎 (团队 A)
    ↓ 写入 Neo4j
    ↓ 发布 EntityTypeCreated 事件到 Kafka
    ↓ 用户/业务对象层发 EntityInstanceCreated 事件
数据栈 (团队 B)
    ↓ 消费 EntityInstanceCreated
    ↓ 自动在 Doris 建表
    ↓ 写入 Doris
    ↓ 写入 Hudi（v0.1 简化）
    ↓ 用户查 SELECT * FROM instance_xxx
Doris 返回结果
```

## 性能基线（v0.1）

| 指标 | 数值 | 备注 |
|---|---|---|
| 创建 EntityType 到 Neo4j 可见 | <2s | |
| EntityInstanceCreated 到 Doris 可查 | <5s | 含 Kafka 消费 |
| Doris 简单查询延迟 | <100ms | 1-10 行 |
| Doris 10 万行查询 | <2s | 未优化 |
| Hudi 写入（CLI 包装） | 1-3s/批 | 1000 行 |
| ClickHouse 路由决策 | <1ms | 仅决策 |

## 已知限制（v0.1 不做）

- ❌ ClickHouse 真实 query 路径（v0.2 落地）
- ❌ Hudi 完整 SDK 集成（v0.2 重写）
- ❌ 业务对象层（v0.2 起步）
- ❌ 多租户 / 鉴权 / 安全
- ❌ 性能调优

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Kafka 消费者可能丢消息 | ✅ v0.1 已加 Outbox 模式（本体引擎 Plan Task 5.1）+ DLQ 兜底（数据栈 Plan Task 8.7）|
| Hudi CLI 调用失败不阻断 | v0.2 改成 SDK 同步写 |
| Doris 单点（FE+BE 都是 1 个）| 商用前加副本 |
| traceId 不可追 | ✅ v0.1 已贯通（HTTP filter → outbox header → consumer ctx → Doris/Hudi 日志；本体 Plan Task 5.2 + 数据栈 Plan Task 8.8）|

## 结论

- [ ] ✅ 全部通过 → **进入第 2 期 MVP 阶段**（T0 ~ T+6m）
- [ ] ⚠️ 部分失败 → 修补后重新评审
- [ ] ❌ 大量失败 → 调整 v1.2 spec，重做决策

## 签字

- 团队 A 负责人：________  日期：____
- 团队 B 负责人：________  日期：____
- 平台架构师：________    日期：____
```

- [ ] **Step 6.2: 提交**

```bash
git add .
git commit -m "docs: add integration spike acceptance report"
```

---

## Task 7: 收尾

- [ ] **Step 7.1: 停止所有进程**

```bash
# 找进程
ps aux | grep -E "spring-boot|data-stack" | grep -v grep

# 优雅停止
kill <ONTOLOGY_PID> <DATASTACK_PID>

# 停 docker
cd metaplatform-integration-spike
docker-compose down
```

- [ ] **Step 7.2: 整体 commit + tag**

```bash
git add .
git commit --allow-empty -m "chore: integration spike phase complete"
git tag spike-v0.1-acceptance
git push origin spike-v0.1-acceptance
```

- [ ] **Step 7.3: 通知产品经理**

把 `docs/spike-acceptance.md` 发给产品经理，请求签字进入 MVP 第 2 期。

---

## 自检（v1.2 spec 覆盖核对）

| spec 章节 | 对应 Task |
|---|---|
| §5.2.2 + §5.2.3 之间的 P3 数据流 | Task 3 完整 7 步 |
| §6 D12 双线并行 | 整个集成 Spike 都在验证 D12 |
| §6 D13 Doris 主 + ClickHouse 适配器 | Task 5 |
| §13.3 第一个子项目（团队 A+B 协作）| 整个集成 Spike |
| §10.1 第 1 期 Spike 验收 | Task 6 验收报告 |

## 范围说明

**集成 Spike 只做 4 件事**：
1. 一键起两套基础设施（Task 1）
2. 7 步 e2e 跑通（Task 3/4）
3. D13 双轨 OLAP 验证（Task 5）
4. 验收报告（Task 6）

**集成 Spike 不做**：
- 业务对象层（子项目 2，MVP 期做）
- AI Substrate（子项目 3，MVP 期做）
- 任何新的功能开发

---

## 完成标准

集成 Spike 完成 = **Task 1-7 全部勾选 + docs/spike-acceptance.md 签字 + 团队 A/B 负责人签字 + 平台架构师签字**。

签字完成后进入第 2 期 MVP 阶段（业务对象层 v0.1 / AI Substrate v0.1 / ...）。

---

**生成时间**：2026-07-02 14:30
**对应 spec 版本**：v1.2
**对应决策**：D12（并行）/ D14（第 1 期 Spike 验收）
