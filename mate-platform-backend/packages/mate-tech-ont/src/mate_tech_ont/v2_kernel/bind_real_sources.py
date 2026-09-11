"""P1-4 收尾：真实业务源库全链路验证 —— mock 数据声明到本体对象的绑定。

角色：这是主会话（非 agent）负责的「真实源库接入」准备件——
当 mock/business_mock.sql 落地后，此模块把新增的源表（订单/发票/员工/工单）
声明到本体 ObjectType 并执行同步，形成多域数据流闭环。

v1 是**验证脚本**（可独立执行）；生产化后由 UI 数据中心面板替代手工声明。

用法（在 mate-tech-ont 容器内或本机带 PG 环境时）::

    python -m scripts.ont_bind_real_sources   # 或直接 python scripts/...
"""

from __future__ import annotations

import sys
from typing import Any

TENANT = "tenant-default"

# 源表 → ObjectType 声明（idempotent：upsert 语义）
BINDINGS: list[dict[str, Any]] = [
    {
        "class_rid": f"ont.{TENANT}.obj.crm.customer-master.v1",
        "name": "crm-source",
        "table": "src_crm_customers",
        "pk_column": "cid",
        "field_mapping": {
            f"ont.{TENANT}.prop.cust-id.v1": "cid",
            f"ont.{TENANT}.prop.cust-name.v1": "cname",
            f"ont.{TENANT}.prop.cust-tier.v1": "ctier",
            f"ont.{TENANT}.prop.cust-city.v1": "ccity",
        },
        "priority": 10,
        "ts_column": "updated_at",
    },
]

# 待 mock SQL 落地后启用的扩展声明（订单/发票/员工/工单）
EXTENDED_BINDINGS: list[dict[str, Any]] = [
    {
        "class_rid": f"ont.{TENANT}.obj.crm.sales-order.v1",
        "name": "orders-source",
        "table": "src_crm_orders",
        "pk_column": "oid",
        "field_mapping": {
            f"ont.{TENANT}.prop.order-oid.v1": "oid",
            f"ont.{TENANT}.prop.order-cid.v1": "cid",
            f"ont.{TENANT}.prop.order-amount.v1": "amount",
            f"ont.{TENANT}.prop.order-status.v1": "status",
        },
        "priority": 10,
        "ts_column": "order_date",
    },
]


def get_repo(dsn: str) -> Any:
    sys.path.insert(0, "packages/mate-kernel/src")
    sys.path.insert(0, "packages/mate-tech-ont/src")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    return PgOntologyRepository(dsn=dsn)


def bind_all(repo: Any, extended: bool = False) -> dict[str, Any]:
    """声明 + 同步全部绑定。返回 {class_rid: sync_stats|error}。"""
    bindings = BINDINGS + (EXTENDED_BINDINGS if extended else [])
    results: dict[str, Any] = {}
    for b in bindings:
        rid = b["class_rid"]
        try:
            repo.upsert_backing_datasource(
                {**b, "tenant_id": TENANT})
            stats = repo.sync_backing_datasources(rid, incremental=True)
            results[rid] = {"ok": True, "stats": stats}
        except Exception as e:  # 逐类型隔离——单类型失败不中断
            results[rid] = {"ok": False, "error": str(e)[:200]}
    return results


if __name__ == "__main__":
    import os

    dsn = os.environ.get(
        "PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont")
    repo = get_repo(dsn)
    extended = "--extended" in sys.argv
    out = bind_all(repo, extended=extended)
    for rid, r in out.items():
        status = "OK" if r.get("ok") else f"ERR: {r.get('error')}"
        print(f"{rid} -> {status} {r.get('stats', '')}")
