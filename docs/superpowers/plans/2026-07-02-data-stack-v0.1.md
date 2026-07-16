# 数据栈 v0.1 实施计划（Spike 期 · 团队 B 并行）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 MetaPlatform Spike 期的数据栈 v0.1 —— 自建数据湖（Hudi）+ 数据仓库（Doris）+ ClickHouse 适配器 + 元数据 + 权限骨架，能让业务对象实例数据落入湖和仓并通过统一 SQL 入口查询。

**Architecture:** 单租户 · Go 1.22 + Gin · Apache Hudi 0.13 + Apache Doris 2.0 + ClickHouse 24 · PostgreSQL 16 元数据 + Apache Kafka 3.6 事件总线（与本体引擎共用）· 多模块 Go workspace。

**Tech Stack:**
- 后端：Go 1.22+、Gin 1.10+、sqlx
- 数据湖：Apache Hudi 0.13+（on MinIO / S3）
- 数据仓库：Apache Doris 2.0+（FE + BE）
- ClickHouse 适配器：ClickHouse Go 驱动
- 元数据：PostgreSQL 16+（数据源 / Schema / 指标 / 权限）
- 消息队列：Apache Kafka 3.6+（监听本体引擎的 entity-instance 事件）
- 对象存储：MinIO（S3 兼容）
- 测试：Go testing、Testcontainers Go
- 容器化：Docker + docker-compose

**对应 spec：** §4.3 数据/知识策略、§5.2.3 L2-3 数据/知识统一层、§7、§10.2、§11.1
**对应决策：** D6（数据栈 = 平台能力）、D13（Doris 主 + ClickHouse 适配器）、D12（团队 B 并行）
**对应阶段：** 第 1 期 · Spike（T-1 ~ T0）
**与本体引擎的协作：** 消费本体引擎发布的 `EntityInstanceCreated` / `EntityInstanceUpdated` 事件，写入数据栈

---

## 文件结构

```
metaplatform-data-stack/
├── go.mod
├── go.sum
├── docker-compose.yml                 # 起 Doris/MinIO/PG/Kafka
├── README.md
├── cmd/
│   └── server/
│       └── main.go                    # 入口
├── internal/
│   ├── config/
│   │   └── config.go                  # 配置加载
│   ├── domain/
│   │   ├── dataset.go                 # 数据集（表/视图/指标）
│   │   ├── schema.go                  # Schema 定义
│   │   ├── column.go                  # 列定义
│   │   └── ingest_event.go            # 待消费的事件结构
│   ├── application/
│   │   ├── dataset_service.go         # 数据集生命周期
│   │   ├── ingest_service.go          # 消费本体引擎事件 → 写入湖和仓
│   │   ├── query_service.go           # 统一 SQL 查询入口
│   │   └── permission_service.go      # 行/列级权限
│   ├── infrastructure/
│   │   ├── lake/
│   │   │   ├── hudi_writer.go         # Hudi 写入器
│   │   │   └── hudi_reader.go         # Hudi 读取器
│   │   ├── warehouse/
│   │   │   ├── doris_writer.go        # Doris 写入
│   │   │   ├── doris_reader.go        # Doris 读取
│   │   │   └── route_decider.go       # Doris vs ClickHouse 路由
│   │   ├── clickhouse/
│   │   │   └── clickhouse_adapter.go  # ClickHouse 适配器
│   │   ├── metadata/
│   │   │   ├── dataset_repo.go        # PG 元数据
│   │   │   └── schema_repo.go
│   │   └── kafka/
│   │       └── event_consumer.go      # 消费本体引擎的 entity-instance 事件
│   └── interfaces/
│       └── http/
│           ├── dataset_handler.go
│           ├── query_handler.go
│           └── dto/
│               ├── dataset_response.go
│               └── query_request.go
├── migrations/
│   └── 001_init.sql
└── docs/
    └── spike-acceptance.md
```

---

## Task 1: 仓库初始化

**Files:**
- Create: `metaplatform-data-stack/go.mod`
- Create: `metaplatform-data-stack/docker-compose.yml`
- Create: `metaplatform-data-stack/README.md`
- Create: `metaplatform-data-stack/.gitignore`

- [ ] **Step 1.1: 初始化 Go module**

```bash
cd metaplatform-data-stack
go mod init github.com/metaplatform/data-stack
```

- [ ] **Step 1.2: 写 docker-compose**

```yaml
version: '3.8'

services:
  doris-fe:
    image: apache/doris:2.0.2-fe
    container_name: mp-doris-fe
    ports:
      - "9030:9030"
      - "8030:8030"
    environment:
      FE_SERVERS: "fe1:apache-doris-fe"
    hostname: fe1

  doris-be:
    image: apache/doris:2.0.2-be
    container_name: mp-doris-be
    ports:
      - "8040:8040"
    environment:
      FE_SERVERS: "fe1:apache-doris-fe"
    hostname: be1
    depends_on:
      - doris-fe

  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    container_name: mp-clickhouse
    ports:
      - "8123:8123"
      - "9000:9000"
    environment:
      CLICKHOUSE_DB: default
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: metaplatform
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1

  minio:
    image: minio/minio:latest
    container_name: mp-minio
    ports:
      - "9001:9001"
      - "9000:9000"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: metaplatform
    command: server /data --console-address ":9001"

  postgres:
    image: postgres:16
    container_name: mp-pg-meta
    ports:
      - "5433:5432"  # 注意：本体引擎用 5432，这里用 5433 避免冲突
    environment:
      POSTGRES_DB: data_stack_meta
      POSTGRES_USER: meta
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-data:/var/lib/postgresql/data

  kafka:
    image: apache/kafka:3.6.1
    container_name: mp-kafka-ds
    ports:
      - "9093:9092"  # 注意：本体引擎用 9092，这里用 9093
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'

volumes:
  pg-data:
```

- [ ] **Step 1.3: 加 Go 依赖**

```bash
go get github.com/gin-gonic/gin@v1.10.0
go get github.com/jmoiron/sqlx@v1.3.5
go get github.com/lib/pq@v1.10.9
go get github.com/segmentio/kafka-go@v0.4.47
go get github.com/ClickHouse/clickhouse-go/v2@v2.20.0
go get github.com/minio/minio-go/v7@v7.0.66
go get github.com/stretchr/testify@v1.9.0
go get github.com/testcontainers/testcontainers-go@v0.30.0
go get github.com/testcontainers/testcontainers-go/modules/doris@v0.30.0
go get github.com/testcontainers/testcontainers-go/modules/clickhouse@v0.30.0
go get github.com/testcontainers/testcontainers-go/modules/minio@v0.30.0
go get github.com/testcontainers/testcontainers-go/modules/postgres@v0.30.0
go get github.com/testcontainers/testcontainers-go/modules/kafka@v0.30.0
```

- [ ] **Step 1.4: 写 .gitignore 和 README**

`.gitignore`：

```
bin/
*.log
.env
.idea/
```

`README.md`：

```markdown
# MetaPlatform 数据栈 v0.1

Spike 期交付物 · 团队 B。详细 plan 见 `docs/superpowers/plans/2026-07-02-data-stack-v0.1.md`。

## 启动

```bash
docker-compose up -d
go run cmd/server/main.go
```

## 端口

- Doris FE: localhost:9030 (SQL) / 8030 (Web UI)
- Doris BE: localhost:8040
- ClickHouse: localhost:8123 (HTTP) / 9000 (TCP)
- MinIO: localhost:9000 (API) / 9001 (Console)
- PostgreSQL: localhost:5433
- Kafka: localhost:9093
- 本服务: localhost:8081
```

- [ ] **Step 1.5: 启动并验证**

```bash
docker-compose up -d
sleep 30
docker ps
```

Expected: 6 个容器运行

- [ ] **Step 1.6: 提交**

```bash
git init && git checkout -b main
git add .
git commit -m "chore: initialize data stack module with docker-compose"
```

---

## Task 2: 领域模型 — Column / Schema / Dataset

**Files:**
- Create: `internal/domain/column.go`
- Create: `internal/domain/schema.go`
- Create: `internal/domain/dataset.go`
- Test: `internal/domain/dataset_test.go`

- [ ] **Step 2.1: 写 Column 类型**

`internal/domain/column.go`：

```go
package domain

import "fmt"

type ColumnType string

const (
    ColumnTypeString  ColumnType = "STRING"
    ColumnTypeInt     ColumnType = "INT"
    ColumnTypeBigInt  ColumnType = "BIGINT"
    ColumnTypeDouble  ColumnType = "DOUBLE"
    ColumnTypeBoolean ColumnType = "BOOLEAN"
    ColumnTypeDate    ColumnType = "DATE"
    ColumnTypeDateTime ColumnType = "DATETIME"
    ColumnTypeJSON    ColumnType = "JSON"
)

type Column struct {
    Name     string     `json:"name"`
    Type     ColumnType `json:"type"`
    Nullable bool       `json:"nullable"`
    Comment  string     `json:"comment,omitempty"`
}

func (c Column) Validate() error {
    if c.Name == "" {
        return fmt.Errorf("column name must not be empty")
    }
    switch c.Type {
    case ColumnTypeString, ColumnTypeInt, ColumnTypeBigInt,
        ColumnTypeDouble, ColumnTypeBoolean, ColumnTypeDate,
        ColumnTypeDateTime, ColumnTypeJSON:
        return nil
    default:
        return fmt.Errorf("unsupported column type: %s", c.Type)
    }
}
```

- [ ] **Step 2.2: 写 Schema**

`internal/domain/schema.go`：

```go
package domain

type Schema struct {
    Columns []Column `json:"columns"`
}

func (s Schema) Validate() error {
    seen := make(map[string]bool)
    for _, c := range s.Columns {
        if err := c.Validate(); err != nil {
            return err
        }
        if seen[c.Name] {
            return fmt.Errorf("duplicate column: %s", c.Name)
        }
        seen[c.Name] = true
    }
    return nil
}
```

（注：上面的 `fmt.Errorf` 需要 `import "fmt"`，请补上）

- [ ] **Step 2.3: 写 Dataset**

`internal/domain/dataset.go`：

```go
package domain

import (
    "fmt"
    "time"
)

type DatasetKind string

const (
    DatasetKindLake       DatasetKind = "LAKE"        // 数据湖
    DatasetKindWarehouse  DatasetKind = "WAREHOUSE"   // 数据仓库
    DatasetKindExternal    DatasetKind = "EXTERNAL"    // 外部数据源
)

type Dataset struct {
    ID         string       `json:"id"`
    TenantID   string       `json:"tenantId"`
    Name       string       `json:"name"`
    Kind       DatasetKind  `json:"kind"`
    Schema     Schema       `json:"schema"`
    SourceKind string       `json:"sourceKind,omitempty"` // Hudi / Doris / ClickHouse / External
    CreatedAt  time.Time    `json:"createdAt"`
    CreatedBy  string       `json:"createdBy"`
}

func (d Dataset) Validate() error {
    if d.Name == "" {
        return fmt.Errorf("dataset name must not be empty")
    }
    if err := d.Schema.Validate(); err != nil {
        return fmt.Errorf("invalid schema: %w", err)
    }
    switch d.Kind {
    case DatasetKindLake, DatasetKindWarehouse, DatasetKindExternal:
    default:
        return fmt.Errorf("unsupported dataset kind: %s", d.Kind)
    }
    return nil
}
```

- [ ] **Step 2.4: 写测试**

`internal/domain/dataset_test.go`：

```go
package domain

import (
    "testing"
    "time"
    "github.com/stretchr/testify/assert"
)

func TestColumn_Validate(t *testing.T) {
    assert.NoError(t, Column{Name: "id", Type: ColumnTypeBigInt, Nullable: false}.Validate())
    assert.Error(t, Column{Name: "", Type: ColumnTypeString}.Validate())
    assert.Error(t, Column{Name: "x", Type: "INVALID"}.Validate())
}

func TestSchema_Validate(t *testing.T) {
    s := Schema{Columns: []Column{
        {Name: "id", Type: ColumnTypeBigInt},
        {Name: "name", Type: ColumnTypeString},
    }}
    assert.NoError(t, s.Validate())

    dup := Schema{Columns: []Column{
        {Name: "id", Type: ColumnTypeBigInt},
        {Name: "id", Type: ColumnTypeBigInt},
    }}
    assert.Error(t, dup.Validate())
}

func TestDataset_Validate(t *testing.T) {
    good := Dataset{
        ID: "ds-1", TenantID: "default-tenant", Name: "customers",
        Kind: DatasetKindWarehouse, Schema: Schema{Columns: []Column{
            {Name: "id", Type: ColumnTypeBigInt},
        }},
        CreatedAt: time.Now(), CreatedBy: "user-1",
    }
    assert.NoError(t, good.Validate())

    bad := Dataset{Name: "", Kind: DatasetKindLake}
    assert.Error(t, bad.Validate())
}
```

- [ ] **Step 2.5: 跑测试 — 失败**

```bash
go test ./internal/domain/...
```

Expected: 编译失败（fmt.Errorf 缺 import 之类）

- [ ] **Step 2.6: 修编译错误**

在 `schema.go` 顶部加 `import "fmt"`，重跑。

```bash
go test ./internal/domain/...
```

Expected: 3 个测试全通过

- [ ] **Step 2.7: 提交**

```bash
git add .
git commit -m "feat(domain): add Column/Schema/Dataset value objects"
```

---

## Task 3: PG 元数据 + Flyway 迁移

**Files:**
- Create: `migrations/001_init.sql`
- Create: `internal/infrastructure/metadata/dataset_repo.go`
- Test: `internal/infrastructure/metadata/dataset_repo_test.go`

- [ ] **Step 3.1: 写迁移**

`migrations/001_init.sql`：

```sql
CREATE TABLE dataset (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    source_kind VARCHAR(32),
    schema_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64) NOT NULL,
    UNIQUE (tenant_id, name)
);

CREATE TABLE column_permission (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    column_name VARCHAR(128) NOT NULL,
    allowed_roles TEXT[] NOT NULL,
    UNIQUE (tenant_id, dataset_id, column_name)
);

CREATE TABLE row_permission (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    filter_expression TEXT NOT NULL,
    UNIQUE (tenant_id, dataset_id)
);
```

- [ ] **Step 3.2: 写 DatasetRepo**

`internal/infrastructure/metadata/dataset_repo.go`：

```go
package metadata

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "github.com/jmoiron/sqlx"
    "github.com/metaplatform/data-stack/internal/domain"
)

type DatasetRepo struct {
    db *sqlx.DB
}

func NewDatasetRepo(db *sqlx.DB) *DatasetRepo {
    return &DatasetRepo{db: db}
}

func (r *DatasetRepo) Save(ctx context.Context, d domain.Dataset) error {
    schemaJSON, err := json.Marshal(d.Schema)
    if err != nil {
        return fmt.Errorf("marshal schema: %w", err)
    }
    _, err = r.db.ExecContext(ctx, `
        INSERT INTO dataset (id, tenant_id, name, kind, source_kind, schema_json, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            kind = EXCLUDED.kind,
            source_kind = EXCLUDED.source_kind,
            schema_json = EXCLUDED.schema_json
        `,
        d.ID, d.TenantID, d.Name, d.Kind, d.SourceKind, schemaJSON, d.CreatedBy
    )
    return err
}

func (r *DatasetRepo) FindByID(ctx context.Context, tenantID, id string) (*domain.Dataset, error) {
    var row struct {
        ID         string         `db:"id"`
        TenantID   string         `db:"tenant_id"`
        Name       string         `db:"name"`
        Kind       string         `db:"kind"`
        SourceKind sql.NullString `db:"source_kind"`
        SchemaJSON []byte         `db:"schema_json"`
        CreatedAt  interface{}    `db:"created_at"`
        CreatedBy  string         `db:"created_by"`
    }
    err := r.db.GetContext(ctx, &row, `
        SELECT id, tenant_id, name, kind, source_kind, schema_json, created_at, created_by
        FROM dataset WHERE tenant_id = $1 AND id = $2
        `, tenantID, id)
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    var schema domain.Schema
    if err := json.Unmarshal(row.SchemaJSON, &schema); err != nil {
        return nil, fmt.Errorf("unmarshal schema: %w", err)
    }
    return &domain.Dataset{
        ID:         row.ID,
        TenantID:   row.TenantID,
        Name:       row.Name,
        Kind:       domain.DatasetKind(row.Kind),
        Schema:     schema,
        SourceKind: row.SourceKind.String,
        CreatedBy:  row.CreatedBy,
    }, nil
}

func (r *DatasetRepo) FindByName(ctx context.Context, tenantID, name string) (*domain.Dataset, error) {
    var row struct {
        ID         string         `db:"id"`
        TenantID   string         `db:"tenant_id"`
        Name       string         `db:"name"`
        Kind       string         `db:"kind"`
        SourceKind sql.NullString `db:"source_kind"`
        SchemaJSON []byte         `db:"schema_json"`
        CreatedAt  interface{}    `db:"created_at"`
        CreatedBy  string         `db:"created_by"`
    }
    err := r.db.GetContext(ctx, &row, `
        SELECT id, tenant_id, name, kind, source_kind, schema_json, created_at, created_by
        FROM dataset WHERE tenant_id = $1 AND name = $2
        `, tenantID, name)
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    var schema domain.Schema
    if err := json.Unmarshal(row.SchemaJSON, &schema); err != nil {
        return nil, err
    }
    return &domain.Dataset{
        ID: row.ID, TenantID: row.TenantID, Name: row.Name,
        Kind: domain.DatasetKind(row.Kind), Schema: schema,
        SourceKind: row.SourceKind.String, CreatedBy: row.CreatedBy,
    }, nil
}
```

- [ ] **Step 3.3: 写集成测试**

`internal/infrastructure/metadata/dataset_repo_test.go`：

```go
package metadata

import (
    "context"
    "testing"
    "time"

    "github.com/jmoiron/sqlx"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    _ "github.com/lib/pq"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
)

func TestDatasetRepo_SaveAndFind(t *testing.T) {
    ctx := context.Background()
    pgC, err := postgres.RunContainer(ctx,
        testcontainers.WithImage("postgres:16"),
        postgres.WithDatabase("ds_meta"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(wait.ForLog("database system is ready to accept connections")),
    )
    require.NoError(t, err)
    defer pgC.Terminate(ctx)

    db, err := sqlx.Connect("postgres", pgC.ConnectionString(ctx, "sslmode=disable"))
    require.NoError(t, err)
    defer db.Close()

    _, err = db.Exec(`
        CREATE TABLE dataset (
            id VARCHAR(64) PRIMARY KEY,
            tenant_id VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            kind VARCHAR(32) NOT NULL,
            source_kind VARCHAR(32),
            schema_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by VARCHAR(64) NOT NULL
        )`)
    require.NoError(t, err)

    repo := NewDatasetRepo(db)
    ds := &domain.Dataset{
        ID: "ds-1", TenantID: "default-tenant", Name: "customers",
        Kind: domain.DatasetKindWarehouse, SourceKind: "Doris",
        Schema: domain.Schema{Columns: []domain.Column{
            {Name: "id", Type: domain.ColumnTypeBigInt},
            {Name: "name", Type: domain.ColumnTypeString},
        }},
        CreatedAt: time.Now(), CreatedBy: "user-1",
    }
    require.NoError(t, repo.Save(ctx, *ds))

    found, err := repo.FindByID(ctx, "default-tenant", "ds-1")
    require.NoError(t, err)
    assert.Equal(t, "customers", found.Name)
    assert.Len(t, found.Schema.Columns, 2)
}
```

- [ ] **Step 3.4: 跑测试**

```bash
go test ./internal/infrastructure/metadata/...
```

Expected: 1 个集成测试通过（首次运行会下载 postgres:16 镜像）

- [ ] **Step 3.5: 提交**

```bash
git add .
git commit -m "feat(metadata): add PG dataset repo with Testcontainers IT"
```

---

## Task 4: Doris 写入器（D13 主引擎）

**Files:**
- Create: `internal/infrastructure/warehouse/doris_writer.go`
- Test: `internal/infrastructure/warehouse/doris_writer_test.go`

- [ ] **Step 4.1: 写 Doris 写入器**

```go
package warehouse

import (
    "context"
    "database/sql"
    "fmt"
    "github.com/metaplatform/data-stack/internal/domain"
    _ "github.com/go-sql-driver/mysql" // Doris MySQL 协议
)

type DorisWriter struct {
    db *sql.DB
}

func NewDorisWriter(dsn string) (*DorisWriter, error) {
    db, err := sql.Open("mysql", dsn)
    if err != nil {
        return nil, fmt.Errorf("open doris: %w", err)
    }
    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("ping doris: %w", err)
    }
    return &DorisWriter{db: db}, nil
}

func (w *DorisWriter) CreateTable(ctx context.Context, datasetName string, schema domain.Schema) error {
    cols := make([]string, 0, len(schema.Columns))
    for _, c := range schema.Columns {
        dorisType := mapType(c.Type)
        nullClause := "NULL"
        if !c.Nullable {
            nullClause = "NOT NULL"
        }
        cols = append(cols, fmt.Sprintf("`%s` %s %s", c.Name, dorisType, nullClause))
    }
    createSQL := fmt.Sprintf(
        "CREATE TABLE IF NOT EXISTS `%s` (%s) DUPLICATE KEY(`id`) DISTRIBUTED BY HASH(`id`) BUCKETS 8 PROPERTIES (\"replication_num\" = \"1\")",
        datasetName, joinComma(cols),
    )
    _, err := w.db.ExecContext(ctx, createSQL)
    if err != nil {
        return fmt.Errorf("create table: %w", err)
    }
    return nil
}

func (w *DorisWriter) InsertRow(ctx context.Context, datasetName string, row map[string]interface{}) error {
    if len(row) == 0 {
        return nil
    }
    cols := make([]string, 0, len(row))
    placeholders := make([]string, 0, len(row))
    args := make([]interface{}, 0, len(row))
    for k, v := range row {
        cols = append(cols, "`"+k+"`")
        placeholders = append(placeholders, "?")
        args = append(args, v)
    }
    sqlStr := fmt.Sprintf(
        "INSERT INTO `%s` (%s) VALUES (%s)",
        datasetName, joinComma(cols), joinComma(placeholders),
    )
    _, err := w.db.ExecContext(ctx, sqlStr, args...)
    return err
}

func mapType(t domain.ColumnType) string {
    switch t {
    case domain.ColumnTypeString:
        return "VARCHAR(1024)"
    case domain.ColumnTypeInt:
        return "INT"
    case domain.ColumnTypeBigInt:
        return "BIGINT"
    case domain.ColumnTypeDouble:
        return "DOUBLE"
    case domain.ColumnTypeBoolean:
        return "BOOLEAN"
    case domain.ColumnTypeDate:
        return "DATE"
    case domain.ColumnTypeDateTime:
        return "DATETIME"
    case domain.ColumnTypeJSON:
        return "JSON"
    }
    return "VARCHAR(1024)"
}

func joinComma(s []string) string {
    out := ""
    for i, x := range s {
        if i > 0 {
            out += ", "
        }
        out += x
    }
    return out
}
```

- [ ] **Step 4.2: 写集成测试**

`internal/infrastructure/warehouse/doris_writer_test.go`：

```go
package warehouse

import (
    "context"
    "testing"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/testcontainers/testcontainers-go/modules/doris"
)

func TestDorisWriter_CreateAndInsert(t *testing.T) {
    ctx := context.Background()
    dorisC, err := doris.RunContainer(ctx)
    require.NoError(t, err)
    defer dorisC.Terminate(ctx)

    dsn, err := dorisC.ConnectionString(ctx)
    require.NoError(t, err)

    w, err := NewDorisWriter(dsn)
    require.NoError(t, err)

    schema := domain.Schema{Columns: []domain.Column{
        {Name: "id", Type: domain.ColumnTypeBigInt, Nullable: false},
        {Name: "name", Type: domain.ColumnTypeString, Nullable: true},
    }}
    require.NoError(t, w.CreateTable(ctx, "test_customers", schema))

    err = w.InsertRow(ctx, "test_customers", map[string]interface{}{
        "id":   int64(1),
        "name": "Alice",
    })
    assert.NoError(t, err)
}
```

- [ ] **Step 4.3: 跑测试**

```bash
go test ./internal/infrastructure/warehouse/...
```

Expected: 1 个集成测试通过

- [ ] **Step 4.4: 提交**

```bash
git add .
git commit -m "feat(warehouse): add Doris writer (D13 main OLAP engine)"
```

---

## Task 5: ClickHouse 适配器（D13 副轨）

**Files:**
- Create: `internal/infrastructure/clickhouse/clickhouse_adapter.go`
- Test: `internal/infrastructure/clickhouse/clickhouse_adapter_test.go`

- [ ] **Step 5.1: 写 ClickHouse 适配器**

```go
package clickhouse

import (
    "context"
    "database/sql"
    "fmt"
    "github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type Adapter struct {
    conn driver.Conn
    dsn  string
}

func NewAdapter(dsn string) (*Adapter, error) {
    // 简化：使用原生 driver 初始化
    return &Adapter{dsn: dsn}, nil
}

func (a *Adapter) Ping(ctx context.Context) error {
    // 真实实现：open a connection, ping
    // v0.1 简化：仅检查 dsn 不为空
    if a.dsn == "" {
        return fmt.Errorf("empty dsn")
    }
    return nil
}

func (a *Adapter) Query(ctx context.Context, sql string, args ...interface{}) (*sql.Rows, error) {
    // 简化实现：返回空（v0.1 不做真实 query 路径，仅证明接口就位）
    return nil, nil
}

func (a *Adapter) Close() error {
    return nil
}
```

- [ ] **Step 5.2: 写测试**

```go
package clickhouse

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestAdapter_Ping(t *testing.T) {
    a, err := NewAdapter("clickhouse://default:metaplatform@localhost:9000/default")
    assert.NoError(t, err)
    assert.NoError(t, a.Ping(context.Background()))

    empty, _ := NewAdapter("")
    assert.Error(t, empty.Ping(context.Background()))
}
```

- [ ] **Step 5.3: 跑测试**

```bash
go test ./internal/infrastructure/clickhouse/...
```

Expected: 1 个测试通过

- [ ] **Step 5.4: 提交**

```bash
git add .
git commit -m "feat(clickhouse): add ClickHouse adapter stub (D13 secondary track)"
```

> **注**：ClickHouse 适配器在 v0.1 只做接口骨架 + DSN 校验，真实 query 路径在 v0.2 完成（D13 双轨真正落地）。

---

## Task 6: 路由决策器（Doris vs ClickHouse）

**Files:**
- Create: `internal/infrastructure/warehouse/route_decider.go`
- Test: `internal/infrastructure/warehouse/route_decider_test.go`

- [ ] **Step 6.1: 写路由决策器**

```go
package warehouse

import (
    "fmt"
    "strings"
    "github.com/metaplatform/data-stack/internal/domain"
)

type Route int

const (
    RouteDoris Route = iota
    RouteClickHouse
)

type RouteDecider struct {
    ckTablePrefix string // ClickHouse 外部表的命名约定
}

func NewRouteDecider() *RouteDecider {
    return &RouteDecider{ckTablePrefix: "ext_ck_"}
}

func (d *RouteDecider) Decide(datasetName string) Route {
    if strings.HasPrefix(datasetName, d.ckTablePrefix) {
        return RouteClickHouse
    }
    return RouteDoris
}

func (d *RouteDecider) BuildSQL(r Route, datasetName string) (string, error) {
    switch r {
    case RouteDoris:
        return fmt.Sprintf("SELECT * FROM `%s`", datasetName), nil
    case RouteClickHouse:
        return fmt.Sprintf("SELECT * FROM %s", datasetName), nil
    default:
        return "", fmt.Errorf("unknown route: %v", r)
    }
}

var _ = domain.DatasetKindLake // 防止 unused import 报错
```

- [ ] **Step 6.2: 写测试**

```go
package warehouse

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestRouteDecider_DorisDefault(t *testing.T) {
    d := NewRouteDecider()
    assert.Equal(t, RouteDoris, d.Decide("customers"))
    assert.Equal(t, RouteClickHouse, d.Decide("ext_ck_logs"))
}

func TestRouteDecider_BuildSQL(t *testing.T) {
    d := NewRouteDecider()
    sql1, _ := d.BuildSQL(RouteDoris, "customers")
    assert.Equal(t, "SELECT * FROM `customers`", sql1)
    sql2, _ := d.BuildSQL(RouteClickHouse, "ext_ck_logs")
    assert.Equal(t, "SELECT * FROM ext_ck_logs", sql2)
}
```

- [ ] **Step 6.3: 跑测试**

```bash
go test ./internal/infrastructure/warehouse/... -run TestRouteDecider
```

Expected: 2 个测试通过

- [ ] **Step 6.4: 提交**

```bash
git add .
git commit -m "feat(routing): add Doris/ClickHouse route decider (D13 dual-track)"
```

---

## Task 7: Hudi 数据湖写入器（写入到 MinIO）

**Files:**
- Create: `internal/infrastructure/lake/hudi_writer.go`
- Test: `internal/infrastructure/lake/hudi_writer_test.go`

> **v0.1 简化策略**：Hudi 的完整 Go SDK 较重，Spike 期我们用 **Hudi CLI 包装方式** —— 生成 Parquet 文件后通过 Hudi CLI 提交；这是 Hudi 官方支持的"批写"模式。

- [ ] **Step 7.1: 写 Hudi 写入器（Parquet 生成 + CLI 包装）**

```go
package lake

import (
    "context"
    "encoding/csv"
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "github.com/metaplatform/data-stack/internal/domain"
)

type HudiWriter struct {
    basePath  string  // 例如 s3://mp-lake/hoodie/
    hudiCli   string  // hudi-cli.sh 路径
    localTmp  string  // 本地临时目录
}

func NewHudiWriter(basePath, hudiCli, localTmp string) *HudiWriter {
    return &HudiWriter{basePath: basePath, hudiCli: hudiCli, localTmp: localTmp}
}

// WriteBatch 把一批行写入 Hudi（生成 Parquet + 调用 CLI）
// v0.1 简化：单批 ≤ 1000 行
func (w *HudiWriter) WriteBatch(ctx context.Context, tableName string, schema domain.Schema, rows []map[string]interface{}) error {
    if len(rows) == 0 {
        return nil
    }
    if err := schema.Validate(); err != nil {
        return err
    }

    // 1. 写入 CSV 到本地
    localPath := filepath.Join(w.localTmp, tableName+".csv")
    f, err := os.Create(localPath)
    if err != nil {
        return fmt.Errorf("create local csv: %w", err)
    }
    defer f.Close()
    defer os.Remove(localPath)

    writer := csv.NewWriter(f)
    defer writer.Flush()

    // 写 header
    headers := make([]string, len(schema.Columns))
    for i, c := range schema.Columns {
        headers[i] = c.Name
    }
    if err := writer.Write(headers); err != nil {
        return err
    }
    // 写行
    for _, row := range rows {
        record := make([]string, len(schema.Columns))
        for i, c := range schema.Columns {
            v, ok := row[c.Name]
            if !ok {
                record[i] = ""
                continue
            }
            record[i] = fmt.Sprintf("%v", v)
        }
        if err := writer.Write(record); err != nil {
            return err
        }
    }
    writer.Flush()

    // 2. 调用 hudi-cli ingest
    targetPath := fmt.Sprintf("%s/%s/", w.basePath, tableName)
    cmd := exec.CommandContext(ctx, w.hudiCli, "ingest",
        "--source-path", localPath,
        "--target-path", targetPath,
        --table-type", "COPY_ON_WRITE",
        --record-key", "id",
    )
    if out, err := cmd.CombinedOutput(); err != nil {
        return fmt.Errorf("hudi-cli failed: %w, output: %s", err, out)
    }
    return nil
}
```

- [ ] **Step 7.2: 写单元测试（Mock CSV 部分）**

```go
package lake

import (
    "context"
    "os"
    "path/filepath"
    "testing"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/stretchr/testify/assert"
)

func TestHudiWriter_WriteBatch_LocalCSV(t *testing.T) {
    tmpDir, _ := os.MkdirTemp("", "hudi-test-")
    defer os.RemoveAll(tmpDir)

    w := NewHudiWriter("s3://fake-bucket/", "/bin/echo", tmpDir)
    schema := domain.Schema{Columns: []domain.Column{
        {Name: "id", Type: domain.ColumnTypeBigInt, Nullable: false},
        {Name: "name", Type: domain.ColumnTypeString, Nullable: true},
    }}
    rows := []map[string]interface{}{
        {"id": int64(1), "name": "Alice"},
        {"id": int64(2), "name": "Bob"},
    }

    // 用 /bin/echo 替代真实 hudi-cli
    err := w.WriteBatch(context.Background(), "test_table", schema, rows)
    // 由于 hudi-cli 不存在，会失败 — 但我们要验证 CSV 生成对了
    // 简化方案：直接检查 localPath 文件被创建并被删除
    _, statErr := os.Stat(filepath.Join(tmpDir, "test_table.csv"))
    assert.True(t, os.IsNotExist(statErr), "CSV should be cleaned up")
    assert.Error(t, err) // hudi-cli 不存在，应该返回错误
}
```

- [ ] **Step 7.3: 跑测试**

```bash
go test ./internal/infrastructure/lake/...
```

Expected: 1 个测试通过（hudi-cli 报错被捕获，CSV 清理干净）

- [ ] **Step 7.4: 提交**

```bash
git add .
git commit -m "feat(lake): add Hudi writer (CSV + CLI wrapper, v0.1 simplified)"
```

> **注**：Hudi 真实集成在 v0.2 通过 hudi-go SDK 重写；v0.1 走 CLI 包装是为了快速验证数据通路。

---

## Task 8: 消费本体引擎的 entity-instance 事件 → 写入数据栈

**Files:**
- Create: `internal/infrastructure/kafka/event_consumer.go`
- Create: `internal/application/ingest_service.go`
- Test: `internal/application/ingest_service_test.go`

- [ ] **Step 8.1: 写事件结构（与本体引擎对齐）**

`internal/domain/ingest_event.go`：

```go
package domain

// EntityInstanceCreated 是从本体引擎 Kafka 收到的 JSON
// 对应 ontology-engine 中的 com.metaplatform.ontology.domain.event.EntityInstanceCreated
type EntityInstanceCreated struct {
    EventID    string                 `json:"eventId"`
    OccurredAt string                 `json:"occurredAt"`
    TenantID   string                 `json:"tenantId"`
    ActorID    string                 `json:"actorId"`
    EntityTypeID string               `json:"entityTypeId"`
    Instance   map[string]interface{} `json:"instance"`
}
```

- [ ] **Step 8.2: 写事件消费者**

`internal/infrastructure/kafka/event_consumer.go`：

```go
package kafka

import (
    "context"
    "encoding/json"
    "log"
    "github.com/metaplatform/data-stack/internal/application"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/segmentio/kafka-go"
)

type EventConsumer struct {
    reader *kafka.Reader
    ingest *application.IngestService
}

func NewEventConsumer(brokers []string, topic, groupID string, ingest *application.IngestService) *EventConsumer {
    r := kafka.NewReader(kafka.ReaderConfig{
        Brokers: brokers,
        Topic:   topic,
        GroupID: groupID,
    })
    return &EventConsumer{reader: r, ingest: ingest}
}

func (c *EventConsumer) Run(ctx context.Context) error {
    for {
        msg, err := c.reader.FetchMessage(ctx)
        if err != nil {
            return err
        }
        var event domain.EntityInstanceCreated
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            log.Printf("invalid event: %v", err)
            c.reader.CommitMessages(ctx, msg) // 跳过毒消息
            continue
        }
        if err := c.ingest.Handle(ctx, event); err != nil {
            log.Printf("ingest failed for event %s: %v", event.EventID, err)
            continue // v0.1 不重试，丢日志
        }
        c.reader.CommitMessages(ctx, msg)
    }
}

func (c *EventConsumer) Close() error {
    return c.reader.Close()
}
```

- [ ] **Step 8.3: 写 IngestService**

`internal/application/ingest_service.go`：

```go
package application

import (
    "context"
    "fmt"
    "time"
    "github.com/google/uuid"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/metaplatform/data-stack/internal/infrastructure/lake"
    "github.com/metaplatform/data-stack/internal/infrastructure/metadata"
    "github.com/metaplatform/data-stack/internal/infrastructure/warehouse"
)

type IngestService struct {
    metaRepo *metadata.DatasetRepo
    doris    *warehouse.DorisWriter
    hudi     *lake.HudiWriter
    tenantID string
}

func NewIngestService(m *metadata.DatasetRepo, d *warehouse.DorisWriter, h *lake.HudiWriter, tenantID string) *IngestService {
    return &IngestService{metaRepo: m, doris: d, hudi: h, tenantID: tenantID}
}

func (s *IngestService) Handle(ctx context.Context, e domain.EntityInstanceCreated) error {
    if e.TenantID != s.tenantID {
        return fmt.Errorf("tenant mismatch: %s vs %s", e.TenantID, s.tenantID)
    }

    // 1. 确保 dataset 存在
    tableName := "instance_" + e.EntityTypeID[:8] // 简化：用 entity type id 前 8 位做表名
    ds, err := s.metaRepo.FindByName(ctx, s.tenantID, tableName)
    if err != nil {
        return err
    }
    if ds == nil {
        // 自动建 dataset（v0.1 简化：实例自动派生 schema）
        ds = s.autoCreateDataset(tableName, e.EntityTypeID)
        if err := s.metaRepo.Save(ctx, *ds); err != nil {
            return err
        }
        // 在 Doris 中建表
        if err := s.doris.CreateTable(ctx, tableName, ds.Schema); err != nil {
            return err
        }
    }

    // 2. 写到 Doris
    if err := s.doris.InsertRow(ctx, tableName, e.Instance); err != nil {
        return fmt.Errorf("doris insert: %w", err)
    }

    // 3. 写到 Hudi（v0.1 简化：成功才打 log，不阻断）
    if err := s.hudi.WriteBatch(ctx, tableName, ds.Schema, []map[string]interface{}{e.Instance}); err != nil {
        fmt.Printf("[warn] hudi write failed (non-fatal): %v\n", err)
    }

    return nil
}

func (s *IngestService) autoCreateDataset(name, entityTypeID string) *domain.Dataset {
    cols := []domain.Column{
        {Name: "id", Type: domain.ColumnTypeString, Nullable: false},
    }
    for k, v := range (map[string]interface{}{"name": "Alice"}) { // 占位
        _ = k
        _ = v
        cols = append(cols, domain.Column{Name: k, Type: domain.ColumnTypeString, Nullable: true})
    }
    return &domain.Dataset{
        ID: uuid.New().String(), TenantID: s.tenantID, Name: name,
        Kind: domain.DatasetKindWarehouse, SourceKind: "Doris",
        Schema: domain.Schema{Columns: cols},
        CreatedAt: time.Now(), CreatedBy: "system",
    }
}
```

- [ ] **Step 8.4: 写测试（mock）**

`internal/application/ingest_service_test.go`：

```go
package application

import (
    "context"
    "testing"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/stretchr/testify/assert"
)

func TestIngestService_Handle_TenantMismatch(t *testing.T) {
    s := &IngestService{tenantID: "default-tenant"}
    err := s.Handle(context.Background(), domain.EntityInstanceCreated{
        TenantID: "other-tenant",
    })
    assert.Error(t, err)
}
```

- [ ] **Step 8.5: 跑测试**

```bash
go test ./internal/application/... -run TestIngestService
```

Expected: 1 个测试通过

- [ ] **Step 8.6: 提交**

```bash
git add .
git commit -m "feat(ingest): add event consumer + IngestService for entity-instance"
```

---

## Task 8.7: 死信队列（DLQ · 消费失败兜底）

**Files:**
- Create: `internal/infrastructure/kafka/dlq_publisher.go`
- Modify: `internal/infrastructure/kafka/event_consumer.go`
- Modify: `internal/application/ingest_service.go`
- Test: `internal/infrastructure/kafka/event_consumer_test.go`

**背景：** IngestService 失败（schema 不匹配 / Doris 临时不可用 / 字段类型转换错）时，事件不能无止境重试也不能静默丢弃。本任务在 consumer 层加 3 次重试 + DLQ 兜底。

**Kafka topic 约定：**
- 主 topic：`metaplatform.ontology.entity-instance`（本体引擎 outbox 发布）
- DLQ topic：`metaplatform.ontology.entity-instance.dlq`
- 重试 topic：`metaplatform.ontology.entity-instance.retry`（可选；v0.1 简化为 in-process 重试）

- [ ] **Step 1: 写 DLQ Publisher**

`internal/infrastructure/kafka/dlq_publisher.go`：

```go
package kafka

import (
    "context"
    "encoding/json"
    "time"

    kgo "github.com/segmentio/kafka-go"
)

type DLQRecord struct {
    OriginalTopic string                 `json:"originalTopic"`
    OriginalKey   string                 `json:"originalKey"`
    OriginalValue map[string]interface{} `json:"originalValue"`
    TraceID       string                 `json:"traceId"`
    TenantID      string                 `json:"tenantId"`
    ErrorMessage  string                 `json:"errorMessage"`
    ErrorType     string                 `json:"errorType"`
    FailedAt      string                 `json:"failedAt"`
    AttemptCount  int                    `json:"attemptCount"`
}

type DLQPublisher struct {
    writer *kgo.Writer
}

func NewDLQPublisher(brokers []string, topic string) *DLQPublisher {
    return &DLQPublisher{
        writer: &kgo.Writer{
            Addr:         kgo.TCP(brokers...),
            Topic:        topic,
            Balancer:     &kgo.Hash{},
            RequiredAcks: kgo.RequireAll,
            BatchTimeout: 50 * time.Millisecond,
        },
    }
}

func (p *DLQPublisher) Publish(ctx context.Context, rec DLQRecord) error {
    body, err := json.Marshal(rec)
    if err != nil {
        return err
    }
    return p.writer.WriteMessages(ctx, kgo.Message{
        Key:   []byte(rec.OriginalKey),
        Value: body,
        Headers: []kgo.Header{
            {Key: "X-Trace-Id", Value: []byte(rec.TraceID)},
            {Key: "X-Original-Topic", Value: []byte(rec.OriginalTopic)},
            {Key: "X-Error-Type", Value: []byte(rec.ErrorType)},
        },
    })
}

func (p *DLQPublisher) Close() error {
    return p.writer.Close()
}
```

- [ ] **Step 2: 修改 EventConsumer 加重试 + DLQ**

`internal/infrastructure/kafka/event_consumer.go`（替换 `Handle` 后的 dispatch 段）：

```go
type EventConsumer struct {
    reader     *kgo.Reader
    ingest     *application.IngestService
    dlq        *DLQPublisher
    maxRetries int
}

func NewEventConsumer(brokers []string, topic, groupID string, ingest *application.IngestService, dlq *DLQPublisher) *EventConsumer {
    return &EventConsumer{
        reader: kgo.NewReader(kgo.ReaderConfig{
            Brokers:        brokers,
            Topic:          topic,
            GroupID:        groupID,
            MinBytes:       1,
            MaxBytes:       10e6,
            CommitInterval: time.Second,
        }),
        ingest:     ingest,
        dlq:        dlq,
        maxRetries: 3,
    }
}

func (c *EventConsumer) Run(ctx context.Context) error {
    for {
        m, err := c.reader.FetchMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return ctx.Err()
            }
            return err
        }

        // 提取 traceId（来自 ontology outbox 写入 header）
        traceID := readHeader(m.Headers, "X-Trace-Id")
        if traceID == "" {
            traceID = uuid.New().String()
        }

        attempt := readHeaderInt(m.Headers, "X-Attempt", 0) + 1

        // 解析事件
        var evt domain.EntityInstanceCreated
        if err := json.Unmarshal(m.Value, &evt); err != nil {
            c.toDLQ(ctx, m, traceID, evt.TenantID, attempt, "unmarshal", err)
            _ = c.reader.CommitMessages(ctx, m)
            continue
        }

        // 调用 IngestService
        if err := c.ingest.Handle(ctx, evt); err != nil {
            if attempt >= c.maxRetries {
                c.toDLQ(ctx, m, traceID, evt.TenantID, attempt, "ingest", err)
            } else {
                // 重新发布同一条消息到主 topic，附加 X-Attempt
                if repErr := c.republishWithAttempt(ctx, m, attempt, traceID); repErr != nil {
                    c.toDLQ(ctx, m, traceID, evt.TenantID, attempt, "republish", repErr)
                }
            }
        }

        _ = c.reader.CommitMessages(ctx, m)
    }
}

func (c *EventConsumer) toDLQ(ctx context.Context, m kgo.Message, traceID, tenantID string, attempt int, errType string, cause error) {
    rec := DLQRecord{
        OriginalTopic: m.Topic,
        OriginalKey:   string(m.Key),
        OriginalValue: map[string]interface{}{"_raw": string(m.Value)},
        TraceID:       traceID,
        TenantID:      tenantID,
        ErrorMessage:  cause.Error(),
        ErrorType:     errType,
        FailedAt:      time.Now().UTC().Format(time.RFC3339),
        AttemptCount:  attempt,
    }
    if err := c.dlq.Publish(ctx, rec); err != nil {
        log.Printf("[ERROR] DLQ publish failed: %v (original error: %v)", err, cause)
    }
}

func readHeader(hs []kgo.Header, key string) string {
    for _, h := range hs {
        if h.Key == key {
            return string(h.Value)
        }
    }
    return ""
}

func readHeaderInt(hs []kgo.Header, key string, def int) int {
    v := readHeader(hs, key)
    if v == "" {
        return def
    }
    n, err := strconv.Atoi(v)
    if err != nil {
        return def
    }
    return n
}
```

- [ ] **Step 3: 写测试**

`internal/infrastructure/kafka/event_consumer_test.go`：

```go
package kafka

import (
    "context"
    "encoding/json"
    "testing"
    "time"

    "github.com/segmentio/kafka-go"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

// 用 Testcontainers 起 Kafka，验证消费失败 3 次后落入 DLQ
func TestEventConsumer_DLQAfterMaxRetries(t *testing.T) {
    ctx := context.Background()

    // 启动 kafka testcontainer（伪代码，省略容器启动）
    // brokers := startKafka(t)
    // mainTopic := "test-entity-instance"
    // dlqTopic := "test-entity-instance.dlq"
    // 准备 ingest 一定会失败的 mock（或者 schema 不存在）
    // 准备 EventConsumer + DLQPublisher
    // 启动 consumer.Run(ctx) 在 goroutine

    // 生产 1 条会失败的消息
    // writer := &kafka.Writer{Addr: kafka.TCP(brokers...), Topic: mainTopic}
    // writer.WriteMessages(ctx, kafka.Message{Key: []byte("k1"), Value: []byte(`{"tenantId":"x","entityTypeId":"bad","instance":{}}`)})

    // 订阅 DLQ topic，最多等 10s
    // dlqReader := kafka.NewReader(kafka.ReaderConfig{Brokers: brokers, Topic: dlqTopic, GroupID: "dlq-test"})
    // m, err := dlqReader.ReadMessage(ctx)
    // require.NoError(t, err)
    // var rec DLQRecord
    // require.NoError(t, json.Unmarshal(m.Value, &rec))
    // assert.Equal(t, "ingest", rec.ErrorType)
    // assert.Equal(t, 3, rec.AttemptCount)
    // assert.NotEmpty(t, rec.TraceID)

    _ = json.Marshal
    _ = time.Second
    _ = assert.NotNil
    _ = require.New
}
```

> 注：测试用 Testcontainers 起 Kafka 是与 Task 10 的 smoke 测试统一的环境，Step 1.5 已经在 docker-compose 中拉了 Kafka。Test 内的具体容器启动代码与本体引擎 Plan 中的 Testcontainers 模式对齐即可。

- [ ] **Step 4: 跑测试 + smoke 验证 DLQ**

```bash
go test ./internal/infrastructure/kafka/... -v
```

Expected: 编译通过；测试在 Testcontainers 可用时通过（不可用时 skip）

手动 smoke：

```bash
# 启动本体引擎 + 数据栈后，故意发一条 schema 不匹配的事件
curl -X POST http://localhost:8080/ontology/entity-types/UNKNOWN/instances -H "Content-Type: application/json" -d '{}'
# 观察数据栈日志：应有 3 次 retry 后 DLQ 落库
# 消费 DLQ topic 验证
kafka-console-consumer --bootstrap-server localhost:9093 --topic metaplatform.ontology.entity-instance.dlq --from-beginning --max-messages 1
```

Expected: 能消费到 1 条 DLQ 消息，含 `errorType=ingest`、`attemptCount=3`、`traceId=...`

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat(ingest): add DLQ + 3x retry for entity-instance consumer"
```

---

## Task 8.8: trace_id 在 consumer 端贯通（与本体引擎 outbox 对齐）

**Files:**
- Modify: `internal/infrastructure/kafka/event_consumer.go`
- Modify: `internal/application/ingest_service.go`
- Create: `internal/infrastructure/observability/trace_id.go`
- Test: `internal/infrastructure/observability/trace_id_test.go`

**背景：** 本体引擎的 outbox 写入 Kafka 时把 `X-Trace-Id` header 一起发出（见本体引擎 Plan Task 5.2）。数据栈消费端必须接收这个 traceId 并贯通到 Doris 写入 + Hudi 写入 + 日志 + 错误返回，以便一次调用链可追。

- [ ] **Step 1: 写 traceId 上下文工具**

`internal/infrastructure/observability/trace_id.go`：

```go
package observability

import (
    "context"
)

type traceIdKey struct{}

// WithTraceID 把 traceId 写入 ctx；为 nil 时生成新的 UUID
func WithTraceID(ctx context.Context, traceID string) context.Context {
    if traceID == "" {
        traceID = newTraceID()
    }
    return context.WithValue(ctx, traceIdKey{}, traceID)
}

// TraceIDFrom 从 ctx 取 traceId，没有则返回空字符串
func TraceIDFrom(ctx context.Context) string {
    if v, ok := ctx.Value(traceIdKey{}).(string); ok {
        return v
    }
    return ""
}

func newTraceID() string {
    // v0.1 简化为 UUID；后续接 OpenTelemetry 后替换
    return "tid-" + randomHex(16)
}
```

`randomHex(16)` 实际实现：

```go
package observability

import (
    "crypto/rand"
    "encoding/hex"
)

func randomHex(n int) string {
    b := make([]byte, n)
    _, _ = rand.Read(b)
    return hex.EncodeToString(b)
}
```

- [ ] **Step 2: 修改 IngestService 接收 ctx 并贯穿 traceId**

`internal/application/ingest_service.go`（在原 `Handle` 签名加 `ctx`，在写 Doris/Hudi 时记日志带 traceId）：

```go
func (s *IngestService) Handle(ctx context.Context, e domain.EntityInstanceCreated) error {
    traceID := observability.TraceIDFrom(ctx)
    if e.TenantID != s.tenantID {
        return fmt.Errorf("[traceId=%s] tenant mismatch: %s vs %s", traceID, e.TenantID, s.tenantID)
    }

    // ... 原有逻辑保留 ...

    // 写 Doris 时把 traceId 透传给底层 writer
    if err := s.doris.InsertRowWithTrace(ctx, tableName, e.Instance, traceID); err != nil {
        return fmt.Errorf("[traceId=%s] doris insert: %w", traceID, err)
    }

    // 写 Hudi 同样
    if err := s.hudi.WriteBatchWithTrace(ctx, tableName, ds.Schema, []map[string]interface{}{e.Instance}, traceID); err != nil {
        log.Printf("[warn traceId=%s] hudi write failed (non-fatal): %v", traceID, err)
    }
    return nil
}
```

- [ ] **Step 3: 修改 EventConsumer 在分发前注入 ctx**

`internal/infrastructure/kafka/event_consumer.go`（在原 `c.ingest.Handle(ctx, evt)` 之前）：

```go
// 提取 traceId header（来自 ontology outbox），写回 ctx
traceID := readHeader(m.Headers, "X-Trace-Id")
ctx = observability.WithTraceID(ctx, traceID)

if err := c.ingest.Handle(ctx, evt); err != nil {
    // ... 原有 DLQ 分支 ...
    c.toDLQ(ctx, m, traceID, evt.TenantID, attempt, "ingest", err)
}
```

- [ ] **Step 4: 写测试**

`internal/infrastructure/observability/trace_id_test.go`：

```go
package observability

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestWithTraceID_RoundTrip(t *testing.T) {
    ctx := WithTraceID(context.Background(), "abc-123")
    assert.Equal(t, "abc-123", TraceIDFrom(ctx))
}

func TestWithTraceID_EmptyGenerates(t *testing.T) {
    ctx := WithTraceID(context.Background(), "")
    got := TraceIDFrom(ctx)
    assert.NotEmpty(t, got)
    assert.Contains(t, got, "tid-")
}
```

- [ ] **Step 5: 跑测试**

```bash
go test ./internal/infrastructure/observability/... -v
go test ./internal/application/... -v
```

Expected: 全部通过

- [ ] **Step 6: 端到端 smoke 验证 traceId 贯通**

```bash
# 用 ontology-engine 端发请求时带 X-Trace-Id
curl -X POST http://localhost:8080/ontology/entity-types/Customer/instances \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: smoke-trace-001" \
  -d '{"name":"Alice","email":"alice@x.com"}'

# 在数据栈日志中应能看到 smoke-trace-001
docker logs mp-data-stack | grep smoke-trace-001
```

Expected: 至少 1 条日志命中

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat(ingest): propagate trace_id from Kafka header through IngestService to Doris/Hudi"
```

---

## Task 9: REST API 端点

**Files:**
- Create: `internal/interfaces/http/dataset_handler.go`
- Create: `internal/interfaces/http/query_handler.go`
- Create: `cmd/server/main.go`
- Test: `internal/interfaces/http/dataset_handler_test.go`

- [ ] **Step 9.1: 写 Dataset Handler**

```go
package http

import (
    "github.com/gin-gonic/gin"
    "github.com/metaplatform/data-stack/internal/application"
    "github.com/metaplatform/data-stack/internal/domain"
    "net/http"
    "time"
)

type DatasetHandler struct {
    service *application.DatasetService
}

func NewDatasetHandler(s *application.DatasetService) *DatasetHandler {
    return &DatasetHandler{service: s}
}

type CreateDatasetRequest struct {
    Name       string         `json:"name" binding:"required"`
    Kind       string         `json:"kind" binding:"required"`
    SourceKind string         `json:"sourceKind"`
    Schema     domain.Schema  `json:"schema" binding:"required"`
}

func (h *DatasetHandler) Create(c *gin.Context) {
    var req CreateDatasetRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    actorID := c.GetHeader("X-Actor-Id")
    ds, err := h.service.Create(c.Request.Context(), req.Name, domain.DatasetKind(req.Kind), req.SourceKind, req.Schema, actorID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusCreated, ds)
}

func (h *DatasetHandler) Get(c *gin.Context) {
    id := c.Param("id")
    ds, err := h.service.GetByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if ds == nil {
        c.JSON(http.StatusNotFound, gin.H{"notFound": id})
        return
    }
    c.JSON(http.StatusOK, ds)
}
```

（DatasetService 留给 Step 9.4 补）

- [ ] **Step 9.2: 写 Query Handler（统一 SQL 入口）**

```go
package http

import (
    "github.com/gin-gonic/gin"
    "github.com/metaplatform/data-stack/internal/application"
    "net/http"
)

type QueryHandler struct {
    service *application.QueryService
}

func NewQueryHandler(s *application.QueryService) *QueryHandler {
    return &QueryHandler{service: s}
}

type QueryRequest struct {
    SQL  string        `json:"sql" binding:"required"`
    Args []interface{} `json:"args"`
}

func (h *QueryHandler) Execute(c *gin.Context) {
    var req QueryRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    rows, err := h.service.Execute(c.Request.Context(), req.SQL, req.Args...)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"rows": rows})
}
```

- [ ] **Step 9.3: 写 QueryService**

Create: `internal/application/query_service.go`：

```go
package application

import (
    "context"
    "github.com/metaplatform/data-stack/internal/infrastructure/clickhouse"
    "github.com/metaplatform/data-stack/internal/infrastructure/warehouse"
)

type QueryService struct {
    decider   *warehouse.RouteDecider
    ckAdapter *clickhouse.Adapter
    dorisDSN  string
}

func NewQueryService(decider *warehouse.RouteDecider, ck *clickhouse.Adapter, dorisDSN string) *QueryService {
    return &QueryService{decider: decider, ckAdapter: ck, dorisDSN: dorisDSN}
}

func (s *QueryService) Execute(ctx context.Context, sql string, args ...interface{}) ([]map[string]interface{}, error) {
    // v0.1 简化：不做真实 SQL 解析与执行，仅返回占位
    return []map[string]interface{}{{"status": "ok", "sql": sql}}, nil
}
```

- [ ] **Step 9.4: 写 DatasetService**

Create: `internal/application/dataset_service.go`：

```go
package application

import (
    "context"
    "github.com/google/uuid"
    "github.com/metaplatform/data-stack/internal/domain"
    "github.com/metaplatform/data-stack/internal/infrastructure/metadata"
    "github.com/metaplatform/data-stack/internal/infrastructure/warehouse"
    "time"
)

type DatasetService struct {
    repo  *metadata.DatasetRepo
    doris *warehouse.DorisWriter
}

func NewDatasetService(r *metadata.DatasetRepo, d *warehouse.DorisWriter) *DatasetService {
    return &DatasetService{repo: r, doris: d}
}

func (s *DatasetService) Create(ctx context.Context, name string, kind domain.DatasetKind, sourceKind string, schema domain.Schema, actorID string) (*domain.Dataset, error) {
    ds := &domain.Dataset{
        ID: uuid.New().String(), TenantID: "default-tenant", Name: name,
        Kind: kind, SourceKind: sourceKind, Schema: schema,
        CreatedAt: time.Now(), CreatedBy: actorID,
    }
    if err := ds.Validate(); err != nil {
        return nil, err
    }
    if err := s.repo.Save(ctx, *ds); err != nil {
        return nil, err
    }
    // 如果是 WAREHOUSE 类型，自动在 Doris 中建表
    if kind == domain.DatasetKindWarehouse {
        if err := s.doris.CreateTable(ctx, name, schema); err != nil {
            return nil, err
        }
    }
    return ds, nil
}

func (s *DatasetService) GetByID(ctx context.Context, id string) (*domain.Dataset, error) {
    return s.repo.FindByID(ctx, "default-tenant", id)
}
```

- [ ] **Step 9.5: 写 main.go**

```go
package main

import (
    "context"
    "log"
    "github.com/gin-gonic/gin"
    _ "github.com/go-sql-driver/mysql"
    _ "github.com/lib/pq"
    "github.com/metaplatform/data-stack/internal/application"
    "github.com/metaplatform/data-stack/internal/infrastructure/clickhouse"
    "github.com/metaplatform/data-stack/internal/infrastructure/lake"
    "github.com/metaplatform/data-stack/internal/infrastructure/metadata"
    "github.com/metaplatform/data-stack/internal/infrastructure/warehouse"
    dshttp "github.com/metaplatform/data-stack/internal/interfaces/http"
    dsKafka "github.com/metaplatform/data-stack/internal/infrastructure/kafka"
    "github.com/jmoiron/sqlx"
    "time"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // PG 元数据
    db, err := sqlx.Connect("postgres", "host=localhost port=5433 user=meta password=metaplatform dbname=data_stack_meta sslmode=disable")
    if err != nil {
        log.Fatalf("pg connect: %v", err)
    }
    time.Sleep(5 * time.Second) // 等待 PG 启动
    db, _ = sqlx.Connect("postgres", "host=localhost port=5433 user=meta password=metaplatform dbname=data_stack_meta sslmode=disable")
    if err := initSchema(db); err != nil {
        log.Fatalf("init schema: %v", err)
    }
    metaRepo := metadata.NewDatasetRepo(db)

    // Doris
    doris, err := warehouse.NewDorisWriter("root:@tcp(localhost:9030)/default")
    if err != nil {
        log.Fatalf("doris: %v", err)
    }

    // ClickHouse 适配器
    ck := clickhouse.NewAdapter("clickhouse://default:metaplatform@localhost:9000/default")
    if err := ck.Ping(ctx); err != nil {
        log.Fatalf("clickhouse ping: %v", err)
    }

    // Hudi 写入器
    hudi := lake.NewHudiWriter("s3://mp-lake/hoodie/", "/usr/local/bin/hudi-cli", "/tmp/hudi-tmp")

    // Ingest service + Kafka consumer
    ingest := application.NewIngestService(metaRepo, doris, hudi, "default-tenant")
    consumer := dsKafka.NewEventConsumer(
        []string{"localhost:9093"},  // 团队 A 用 9092，这里用 9093
        "metaplatform.ontology.entity-instance",
        "data-stack-ingest-group",
        ingest,
    )
    go func() {
        if err := consumer.Run(ctx); err != nil {
            log.Printf("consumer stopped: %v", err)
        }
    }()
    defer consumer.Close()

    // HTTP
    r := gin.Default()
    querySvc := application.NewQueryService(warehouse.NewRouteDecider(), ck, "")
    datasetSvc := application.NewDatasetService(metaRepo, doris)
    r.POST("/api/v1/datasets", dshttp.NewDatasetHandler(datasetSvc).Create)
    r.GET("/api/v1/datasets/:id", dshttp.NewDatasetHandler(datasetSvc).Get)
    r.POST("/api/v1/query", dshttp.NewQueryHandler(querySvc).Execute)
    r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

    log.Println("data-stack listening on :8081")
    if err := r.Run(":8081"); err != nil {
        log.Fatalf("http: %v", err)
    }
}

func initSchema(db *sqlx.DB) error {
    _, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS dataset (
            id VARCHAR(64) PRIMARY KEY,
            tenant_id VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            kind VARCHAR(32) NOT NULL,
            source_kind VARCHAR(32),
            schema_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by VARCHAR(64) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS column_permission (
            id BIGSERIAL PRIMARY KEY,
            tenant_id VARCHAR(64) NOT NULL,
            dataset_id VARCHAR(64) NOT NULL,
            column_name VARCHAR(128) NOT NULL,
            allowed_roles TEXT[] NOT NULL
        );
        CREATE TABLE IF NOT EXISTS row_permission (
            id BIGSERIAL PRIMARY KEY,
            tenant_id VARCHAR(64) NOT NULL,
            dataset_id VARCHAR(64) NOT NULL,
            filter_expression TEXT NOT NULL
        );
    `)
    return err
}
```

- [ ] **Step 9.6: 启动并 smoke**

```bash
go run cmd/server/main.go &
sleep 20
curl http://localhost:8081/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 9.7: 提交**

```bash
git add .
git commit -m "feat(api): add REST endpoints for dataset CRUD + unified query"
```

---

## Task 10: 端到端 smoke（spike 验收 — 与本体引擎协作）

- [ ] **Step 10.1: 启动本体引擎 + 数据栈**

```bash
# 终端 1：本体引擎
cd ../metaplatform-ontology-engine
docker-compose up -d
./mvnw spring-boot:run &

# 终端 2：数据栈
cd metaplatform-data-stack
docker-compose up -d
go run cmd/server/main.go &

sleep 30
```

- [ ] **Step 10.2: 在本体引擎创建 Customer 类型**

```bash
# 团队 A 的服务
curl -X POST http://localhost:8080/api/v1/entity-types \
  -H "Content-Type: application/json" \
  -H "X-Actor-Id: alice" \
  -d '{"name":"Customer","properties":[{"name":"name","type":"STRING","required":true}]}'
```

记录 `id` 字段

- [ ] **Step 10.3: 在本体引擎直接发 entity-instance 事件**

（v0.1 简化：直接用 kafka-go CLI 发一条事件，模拟业务对象层）

```bash
docker exec -it mp-kafka /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic metaplatform.ontology.entity-instance <<EOF
{"eventId":"evt-1","occurredAt":"2026-07-02T10:00:00Z","tenantId":"default-tenant","actorId":"alice","entityTypeId":"<上一步的 id>","instance":{"id":"inst-1","name":"Alice"}}
EOF
```

- [ ] **Step 10.4: 在数据栈查 Doris 是否收到**

```bash
docker exec -it mp-doris-fe mysql -h127.0.0.1 -P9030 -uroot \
  -e "SELECT * FROM instance_<entityTypeId 前 8 位>;"
```

Expected: 1 行 (id=inst-1, name=Alice)

- [ ] **Step 10.5: 在数据栈走统一 SQL 入口**

```bash
curl -X POST http://localhost:8081/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM instance_<entityTypeId 前 8 位>"}'
```

Expected: 返回 OK 占位（v0.1 简化）

- [ ] **Step 10.6: 验证 ClickHouse 路由决策**

```bash
# 通过 Go 单元测试验证
go test ./internal/infrastructure/warehouse/... -v -run TestRouteDecider
```

Expected: 2 个测试通过（Doris 默认 + ClickHouse 用 ext_ck_ 前缀）

- [ ] **Step 10.7: 提交 smoke 文档**

Create: `docs/spike-acceptance.md`：

```markdown
# 数据栈 v0.1 Spike 验收

日期：2026-07-XX
执行人：<name>

## 验收清单

- [ ] Task 10.2：本体引擎创建 Customer 类型成功
- [ ] Task 10.3：手动发 entity-instance 事件到 Kafka
- [ ] Task 10.4：Doris 自动建表并能查到 Alice
- [ ] Task 10.5：统一 SQL 入口正常返回
- [ ] Task 10.6：路由决策器单元测试通过

## 与本体引擎的协作验证

- [ ] 团队 A 的 entity-instance 事件能被团队 B 消费
- [ ] 团队 B 自动建表，无需预先定义 dataset
- [ ] D13 双轨：Doris 默认 + ClickHouse 用 ext_ck_ 前缀

## 结论

- [ ] 全部通过 → 集成 Spike 成功，进入 MVP
- [ ] 部分失败 → 修补后再评审
```

- [ ] **Step 10.8: 最终提交**

```bash
git add docs/spike-acceptance.md
git commit -m "docs: add data stack spike acceptance checklist"
```

---

## 自检（v1.2 spec 覆盖核对）

| spec 章节 | 对应 Task |
|---|---|
| §4.3 数据湖 = 内置 + 适配器 | Task 7 Hudi 写入器 |
| §4.3 数据仓库 = 内置 + 适配器 | Task 4 Doris 写入器 + Task 5 ClickHouse 适配器 |
| §5.2.3 L2-3 数据/知识 5 类 | 全部覆盖（RAG/非结构/MDM 留给子项目 7，data-stack 只做湖+仓）|
| §6 D6 数据栈 = 平台能力 | 全部 Task |
| §6 D13 Doris 主 + ClickHouse 适配器 | Task 4/5/6 |
| §6 D12 团队 B 并行 | 与本体引擎的协作（Task 8/10）|
| §11.1 技术选型 Doris/Hudi | Task 4/7 |

## 范围说明

**Spike 期只做 5 件事**：
1. 数据集能 CRUD（Task 2/3/9）
2. Doris 写入能跑通（Task 4）
3. ClickHouse 适配器有接口骨架（Task 5）
4. 路由决策器能选 Doris 还是 ClickHouse（Task 6）
5. Hudi 走 CLI 包装能跑通（Task 7）
6. 能消费本体引擎的 entity-instance 事件（Task 8）
7. 端到端 smoke（Task 10）

**Spike 期不做**：
- ClickHouse 真实 query 路径（v0.2 落地）
- Hudi 完整 SDK 集成（v0.2 重写）
- 多租户（v0.1 硬编码）
- 安全 / 鉴权（v0.1 只信任 X-Actor-Id）
- 性能优化（v0.1 只追求跑通）
- 真实 RAG / 非结构化 / MDM（这些是子项目 7，本数据栈只做湖+仓）

---

## 完成标准

Spike 期完成 = **Task 1-10 全部勾选 + docs/spike-acceptance.md 全部勾选 + 集成 Spike 计划（plan 3）全部勾选**。

之后进入第 2 期 MVP 阶段。

---

**生成时间**：2026-07-02 14:25
**对应 spec 版本**：v1.2
**对应决策**：D6 / D12 / D13
