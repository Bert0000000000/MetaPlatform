# AI 助手启动 Prompt 模板（K3-1 子批次 · SQL 持久化）

> 版本：v1.0 · 2026-08-02
> 用途：K3 接力 → 拆分 K3 为 4 个独立子 prompt 的第 1 份 — **K3-1 SQL 持久化**
> 前置：K1 4 + K2 5 + 8e69f1eb + K2.1 3 已合并（13 commit）
> 接力父：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`（566 行 K3 大剧本）

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 后端工程师，正在执行 K3 子批次 **K3-1 SQL 持久化**。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
接力父：批次 K3 大剧本（566 行），本子批次仅覆盖 K3-1 这一件（5 项 SQL 持久化）
目标：让短链生产可持久化 + 满足 §13 硬规则 3

## 必读文档

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md
   — K3 大剧本（仅看 K3-1 阶段，约 100 行）
2. mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_models.py
   — 当前 5 ORM 模板（apps/groups/modules/pages/templates）
3. mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/shortlink/repository.py
   — 当前 InMemoryShortlinkStore 模板（同接口）
4. mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/shortlink/service.py
   — create_shortlink 签名当前无 expires_at
5. mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py
   — POST /shortlinks 端点（约 L589）

## 你的任务（5 项）

### 1. ApphubShortlinkORM SQL 模型

在 `repositories/sql_models.py` 新增：

```python
from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

class ApphubShortlinkORM(Base):
    __tablename__ = "apphub_shortlinks"

    id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(String(64), nullable=False)
    app_id = Column(String(128), nullable=False)
    code = Column(String(16), nullable=False)
    role = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_apphub_shortlinks_tenant_code", "tenant_id", "code", unique=True),
        Index("ix_apphub_shortlinks_tenant_app", "tenant_id", "app_id"),
    )
```

提示：仓内其他 ORM 用什么 Base？看 sql_models.py 顶部 import。

### 2. Alembic migration 0014

```bash
mkdir -p packages/mate-app-hub/migrations/versions
```

新增 `migrations/versions/0014_apphub_shortlinks.py`（up + down）：

```python
"""add apphub_shortlinks table

Revision ID: 0014_apphub_shortlinks
Revises: 0013_apphub_apps_columns
Create Date: 2026-08-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0014_apphub_shortlinks"
down_revision = "0013_apphub_apps_columns"

def upgrade():
    op.create_table(
        "apphub_shortlinks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", String(64), nullable=False),
        sa.Column("app_id", String(128), nullable=False),
        sa.Column("code", String(16), nullable=False),
        sa.Column("role", String(64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_apphub_shortlinks_tenant_code", "apphub_shortlinks", ["tenant_id", "code"], unique=True)
    op.create_index("ix_apphub_shortlinks_tenant_app", "apphub_shortlinks", ["tenant_id", "app_id"])

def downgrade():
    op.drop_index("ix_apphub_shortlinks_tenant_app", "apphub_shortlinks")
    op.drop_index("ix_apphub_shortlinks_tenant_code", "apphub_shortlinks")
    op.drop_table("apphub_shortlinks")
```

若 alembic env.py 还没在 mate-app-hub 包内初始化，先：
```bash
mkdir -p packages/mate-app-hub/migrations
# 从 mate-platform-backend/alembic 复制 env.py + script.py.mako 模板
cp ../../alembic/env.py packages/mate-app-hub/migrations/
cp ../../alembic/script.py.mako packages/mate-app-hub/migrations/
```

### 3. ShortlinkStoreSQL 实现

在 `shortlink/repository.py` 新增 ShortlinkStoreSQL（与 InMemoryShortlinkStore 同接口）：

```python
class ShortlinkStoreSQL:
    def __init__(self, session: Session):
        self._session = session

    def put(self, entry: ShortlinkEntry) -> None: ...
    def get_by_code(self, tenant_id: str, code: str) -> ShortlinkEntry | None: ...
    def list(self, tenant_id: str) -> list[ShortlinkEntry]: ...
    def delete(self, tenant_id: str, code: str) -> None: ...
    def exists(self, tenant_id: str, code: str) -> bool: ...
    def reset(self) -> None: ...

    @staticmethod
    def _to_entry(orm: ApphubShortlinkORM) -> ShortlinkEntry: ...
```

参考 K3 大剧本的伪代码补全实现。

### 4. sql_store.py factory + service.py expires_at 透传

在 `repositories/sql_store.py` 新增：
```python
def get_sql_shortlink_store() -> ShortlinkStoreSQL:
    from sqlalchemy.orm import Session
    engine = get_engine()
    return ShortlinkStoreSQL(Session(bind=engine))
```

修改 `shortlink/service.py::create_shortlink` 签名：
```python
def create_shortlink(
    store,
    tenant_id: str,
    app_id: str,
    role: str | None = None,
    expires_at: datetime | None = None,  # 新增
) -> ShortlinkEntry:
```

修改 `api/app.py` POST /shortlinks requestBody：
```python
class CreateShortlinkRequest(BaseModel):
    app_id: str
    role: str | None = None
    expires_at: datetime | None = None  # 新增
```

并把 `expires_at=request.expires_at` 传到 `create_shortlink(...)` 调用。

### 5. SQL 集成测试

新增 `tests/test_apphub_shortlink_sql_01.py`，用 SQLite `:memory:` 避免依赖真实 PG：

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from mate_app_hub.repositories.sql_models import Base, ApphubShortlinkORM
from mate_app_hub.shortlink.repository import ShortlinkStoreSQL
from mate_app_hub.shortlink.service import create_shortlink, resolve_shortlink
from mate_app_hub.shortlink.generator import generate_code

@pytest.fixture
def sql_store():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return ShortlinkStoreSQL(sessionmaker(bind=engine)())

def test_create_and_resolve(sql_store):
    entry = create_shortlink(sql_store, "tenant-a", "app-1", role="editor")
    found = sql_store.get_by_code("tenant-a", entry.code)
    assert found is not None and found.app_id == "app-1"

def test_tenant_isolation(sql_store):
    e1 = create_shortlink(sql_store, "tenant-a", "app-1")
    assert sql_store.get_by_code("tenant-b", e1.code) is None

def test_expires_at_filter(sql_store):
    past = datetime.now() - timedelta(hours=1)
    e = create_shortlink(sql_store, "tenant-a", "app-1", expires_at=past)
    with pytest.raises(ValueError, match="expired"):
        resolve_shortlink(sql_store, "tenant-a", e.code)

# 至少 9 个用例补全：test_delete / test_list / test_unique / test_role / test_reset / ...
```

要求 ≥ 12 个测试用例，0 skip。

## 13 条硬规则（本子批次触发的）

- **§13 第 3 条**：tenant_id 复合索引 + 跨租户 negative 测试

## 启动方式

1. 切到 K3 接力 worktree：
   `git worktree add .worktrees/apphub-runtime-04a -b codex/apphub-runtime-04a main`
2. 跑基线：`cd mate-platform-backend/packages/mate-app-hub && pytest -q -m "not integration"`
3. 按 5 项顺序推进
4. 全部完成 commit 一次：`feat(apphub): K3-1 SQL 持久化 ApphubShortlinkORM + alembic 0014 + ShortlinkStoreSQL + 12 tests`
5. commit 前必跑：
   - `pytest -q` 0 failed
   - `ruff check packages/mate-app-hub/`
   - `python scripts/ci/forbid_skip_tests.py packages/mate-app-hub/`
   - `python scripts/ci/forbid_bare_httpx.py packages/mate-app-hub/`

## 已知陷阱

1. **alembic env.py 不在 mate-app-hub 包内**——从 `mate-platform-backend/alembic/` 复制或新建
2. **SQLite 与 PostgreSQL UUID 兼容性**——若用 SQLite，`UUID(as_uuid=True)` 在 SQLite 下是 VARCHAR
   测试应用 sqlalchemy.types.String(36) 替代，或用 `String(36)` + Python uuid 库
3. **`Session.commit()` 频率**——每个 put/delete 单独 commit（避免长 transaction）
4. **expires_at 时区**——必须 `timezone=True` 否则跨时区比较失败

## 验收清单

提交前必产出：

- [ ] ApphubShortlinkORM 注册到 sql_models.py
- [ ] migrations/versions/0014_apphub_shortlinks.py（up + down）
- [ ] alembic env.py + script.py.mako 已 copy 进 packages/mate-app-hub/migrations/
- [ ] ShortlinkStoreSQL 6 个方法与 InMemoryShortlinkStore 对齐
- [ ] sql_store.py get_sql_shortlink_store factory
- [ ] create_shortlink 签名含 expires_at
- [ ] POST /shortlinks requestBody 含 expires_at
- [ ] tests/test_apphub_shortlink_sql_01.py ≥ 12 tests pass
- [ ] 1 个 Conventional Commit
```

## 关联文档

- K3 大剧本：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`
- 待续：K3-2 OTel / K3-3 租户 / K3-4 executor 真实化（3 个独立子 prompt）

## 元说明

- **本子批次解决**：K3-1 SQL 持久化（5 项）
- **本子批次不解决**：OTel / 租户双轨 / executor