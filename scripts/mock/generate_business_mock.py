#!/usr/bin/env python
"""生成多域业务源库 mock 数据集 SQL（纯 stdlib，供本体引擎数据绑定验证）。

用法（repo root）::

    cd mate-platform-backend && .venv/Scripts/python.exe scripts/mock/generate_business_mock.py

产出 ``scripts/mock/business_mock.sql``（PostgreSQL 方言），执行方式::

    docker exec -i mate-postgres psql -U meta -d metaplatform_ont < scripts/mock/business_mock.sql

设计要点
--------
- 纯 stdlib（random/datetime/argparse），不直连数据库——任何人可 ``psql -f`` 重放。
- 固定随机种子（--seed 42）+ 可指定锚点日期（--anchor，默认今天）=> 同参数字节级可重现。
- 上游先建、下游采样 FK：customers -> orders -> invoices、employees -> tickets；
  生成后内置一致性自检（oid∈orders 等三个 FK 子集校验 + SQL 括号/引号/分号配对粗校验）。
- 表结构与 ``mate_tech_ont/v2_kernel/bind_real_sources.py`` 的绑定契约对齐
  （src_crm_customers: cid/cname/ctier/ccity/updated_at；src_crm_orders: oid/cid/amount/status/order_date）。
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import random
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 词表
# ---------------------------------------------------------------------------

REGIONS = ["华东", "华南", "华北", "西南", "东北", "中部"]
INDUSTRIES = [
    "重工", "轻工", "能源", "物流", "智造",
    "生物", "化工", "电子", "食品", "纺织",
]
SUFFIXES = ["集团", "股份", "有限公司", "科技"]
BRANDS = [
    "华宇", "恒达", "鑫泰", "宏远", "瑞丰", "天成", "联创", "恒信",
    "中科", "广汇", "利丰", "永昌", "安捷", "凯盛", "正大", "博远",
]

CITIES = [
    "北京", "上海", "广州", "深圳", "成都", "杭州", "武汉", "西安", "重庆", "南京",
    "天津", "苏州", "郑州", "长沙", "沈阳", "青岛", "大连", "宁波", "无锡", "佛山",
    "东莞", "昆明", "合肥", "福州", "厦门", "济南", "长春", "哈尔滨", "贵阳", "石家庄",
]

SURNAMES = [
    "王", "李", "张", "刘", "陈", "杨", "黄", "赵", "吴", "周",
    "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗",
    "郑", "梁", "谢", "宋", "唐", "许", "韩", "冯", "邓", "曹",
    "彭", "肖", "田", "董", "袁", "蔡", "余", "杜", "叶", "程",
    "苏", "魏", "吕", "丁", "任", "沈", "姚", "卢",
]
GIVEN_CHARS = [
    "伟", "强", "磊", "涛", "斌", "杰", "锋", "鹏", "华", "明",
    "志", "远", "毅", "辉", "宇", "浩", "然", "婷", "雪", "梅",
    "琳", "静", "敏", "佳", "怡", "欣", "悦", "娜", "丽", "娟",
    "芳", "燕", "萍", "红", "玉", "秀", "英", "晨", "阳", "曦",
]

# 加权分布（权重按任务规格；未给定的用合理业务分布）
TIER_WEIGHTS = [("vip", 10), ("standard", 60), ("trial", 30)]
ORDER_STATUS_WEIGHTS = [
    ("confirmed", 15), ("processing", 20), ("shipped", 20),
    ("delivered", 35), ("cancelled", 10),
]
AMOUNT_BANDS = [  # (下限, 上限, 权重) —— 1000..500000 加权分布
    (1_000.0, 50_000.0, 65),
    (50_000.0, 200_000.0, 25),
    (200_000.0, 500_000.0, 10),
]
DEPT_WEIGHTS = [("hr", 10), ("it", 30), ("finance", 15), ("sales", 25), ("ops", 20)]
LEVEL_WEIGHTS = [
    ("junior", 35), ("mid", 30), ("senior", 20), ("lead", 10), ("principal", 5),
]
TICKET_CATEGORY_WEIGHTS = [
    ("hardware", 30), ("network", 25), ("software", 30), ("access", 15),
]
PRIORITY_WEIGHTS = [("p0", 5), ("p1", 15), ("p2", 50), ("p3", 30)]
TICKET_STATUS_WEIGHTS = [("open", 25), ("in_progress", 30), ("resolved", 45)]
INVOICE_STATUS_WEIGHTS = [("pending", 20), ("paid", 60), ("overdue", 20)]

BATCH_SIZE = 500
REPO_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_OUTPUT = os.path.join(REPO_ROOT, "scripts", "mock", "business_mock.sql")


def weighted(rng: random.Random, table: Sequence[tuple[str, int]]) -> str:
    """按累计权重抽样（只用 rng.random()，跨版本确定性好于 random.choices）。"""
    total = sum(w for _, w in table)
    r = rng.random() * total
    acc = 0.0
    for value, w in table:
        acc += w
        if r <= acc:
            return value
    return table[-1][0]


def weighted_band(rng: random.Random, bands: Sequence[tuple[float, float, int]]
                  ) -> tuple[float, float]:
    """金额区间加权抽样，返回 (lo, hi)。"""
    total = sum(b[2] for b in bands)
    r = rng.random() * total
    acc = 0.0
    for lo, hi, w in bands:
        acc += w
        if r <= acc:
            return lo, hi
    return bands[-1][0], bands[-1][1]


def ts_fmt(d: dt.datetime) -> str:
    return d.strftime("%Y-%m-%d %H:%M:%S")


def sq(value: Any) -> str:
    """SQL 单引号字面量（值内无引号，防御性转义照做）。"""
    return "'" + str(value).replace("'", "''") + "'"


# ---------------------------------------------------------------------------
# 行生成（上游先建，下游采样 FK）
# ---------------------------------------------------------------------------

def gen_customers(rng: random.Random, n: int, anchor: dt.datetime) -> list[tuple]:
    combos = [r + b + i + s for r in REGIONS for b in BRANDS
              for i in INDUSTRIES for s in SUFFIXES]
    if n > len(combos):  # 防御：需求超过词表组合时补序号分公司
        combos += [f"{c}第{k}分公司" for k in range(1, n - len(combos) + 1)
                   for c in combos[: (n - len(combos) + 1)]]
    rng.shuffle(combos)
    rows = []
    for idx in range(n):
        cid = f"CUST-{idx + 1:06d}"
        cname = combos[idx]
        ctier = weighted(rng, TIER_WEIGHTS)
        ccity = CITIES[rng.randrange(len(CITIES))]
        updated = anchor - dt.timedelta(days=rng.uniform(0, 90))
        rows.append((cid, cname, ctier, ccity, ts_fmt(updated)))
    return rows


def gen_orders(
    rng: random.Random, n: int, customer_ids: list[str], anchor: dt.datetime
) -> list[tuple]:
    rows = []
    for idx in range(n):
        oid = f"ORD-{idx + 1:06d}"
        cid = customer_ids[rng.randrange(len(customer_ids))]
        lo, hi = weighted_band(rng, AMOUNT_BANDS)
        amount = round(rng.uniform(lo, hi), 2)
        status = weighted(rng, ORDER_STATUS_WEIGHTS)
        order_date = anchor - dt.timedelta(days=rng.uniform(0, 180))
        rows.append((oid, cid, f"{amount:.2f}", status, ts_fmt(order_date)))
    return rows


def gen_employees(rng: random.Random, n: int, anchor: dt.date) -> list[tuple]:
    rows = []
    for idx in range(n):
        eid = f"EMP-{idx + 1:04d}"
        surname = SURNAMES[rng.randrange(len(SURNAMES))]
        given = "".join(
            GIVEN_CHARS[rng.randrange(len(GIVEN_CHARS))]
            for _ in range(1 if rng.random() < 0.30 else 2)
        )
        ename = surname + given
        department = weighted(rng, DEPT_WEIGHTS)
        level = weighted(rng, LEVEL_WEIGHTS)
        hire_date = (anchor - dt.timedelta(days=rng.randint(0, 1826))).isoformat()
        rows.append((eid, ename, department, level, hire_date))
    return rows


def gen_tickets(
    rng: random.Random, n: int, employee_ids: list[str], anchor: dt.datetime
) -> list[tuple]:
    rows = []
    for idx in range(n):
        tid = f"TKT-{idx + 1:06d}"
        eid = employee_ids[rng.randrange(len(employee_ids))]
        category = weighted(rng, TICKET_CATEGORY_WEIGHTS)
        priority = weighted(rng, PRIORITY_WEIGHTS)
        status = weighted(rng, TICKET_STATUS_WEIGHTS)
        created = anchor - dt.timedelta(days=rng.uniform(0, 90))
        rows.append((tid, eid, category, priority, status, ts_fmt(created)))
    return rows


def gen_invoices(
    rng: random.Random, n: int, orders: list[tuple], anchor: dt.datetime
) -> list[tuple]:
    """发票挂订单：amount ≈ 关联订单金额 ±10%；overdue 的 issue_date 必须 >90 天前。"""
    anchor_date = anchor.date()
    overdue_cap = anchor_date - dt.timedelta(days=91)   # overdue 上界（>90 天前）
    overdue_floor = anchor_date - dt.timedelta(days=180)
    order_meta = [
        (o[0], dt.datetime.strptime(o[4], "%Y-%m-%d %H:%M:%S").date(), float(o[2]))
        for o in orders
    ]
    # 可开逾期票的订单：下单时间须早于 overdue 上界（留 4 天裕量）
    overdue_eligible = [
        m for m in order_meta
        if m[1] <= overdue_cap - dt.timedelta(days=4)
    ] or [(o[0], overdue_floor, float(o[2])) for o in order_meta]

    rows = []
    for idx in range(n):
        iid = f"INV-{idx + 1:06d}"
        status = weighted(rng, INVOICE_STATUS_WEIGHTS)
        if status == "overdue":
            oid, pick_date, base_amount = overdue_eligible[
                rng.randrange(len(overdue_eligible))]
            lo = max(pick_date, overdue_floor)
            issue = lo + dt.timedelta(
                days=rng.randint(0, max((overdue_cap - lo).days, 0)))
        else:
            oid, order_date, base_amount = order_meta[
                rng.randrange(len(order_meta))]
            lo = max(order_date, anchor_date - dt.timedelta(days=179))
            issue = lo + dt.timedelta(
                days=rng.randint(0, max((anchor_date - lo).days, 0)))
        amount = round(base_amount * rng.uniform(0.90, 1.10), 2)
        rows.append((iid, oid, f"{amount:.2f}", status, issue.isoformat()))
    return rows


# ---------------------------------------------------------------------------
# SQL 组装
# ---------------------------------------------------------------------------

TABLE_DDL: list[tuple[str, str, list[str]]] = [
    (
        "src_crm_customers",
        """CREATE TABLE IF NOT EXISTS src_crm_customers (
    cid        TEXT PRIMARY KEY,
    cname      TEXT NOT NULL,
    ctier      TEXT NOT NULL,
    ccity      TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL
)""",
        ["cid", "cname", "ctier", "ccity", "updated_at"],
    ),
    (
        "src_crm_orders",
        """CREATE TABLE IF NOT EXISTS src_crm_orders (
    oid        TEXT PRIMARY KEY,
    cid        TEXT NOT NULL,
    amount     DOUBLE PRECISION NOT NULL,
    status     TEXT NOT NULL,
    order_date TIMESTAMP NOT NULL
)""",
        ["oid", "cid", "amount", "status", "order_date"],
    ),
    (
        "src_hr_employees",
        """CREATE TABLE IF NOT EXISTS src_hr_employees (
    eid        TEXT PRIMARY KEY,
    ename      TEXT NOT NULL,
    department TEXT NOT NULL,
    level      TEXT NOT NULL,
    hire_date  DATE NOT NULL
)""",
        ["eid", "ename", "department", "level", "hire_date"],
    ),
    (
        "src_it_tickets",
        """CREATE TABLE IF NOT EXISTS src_it_tickets (
    tid      TEXT PRIMARY KEY,
    eid      TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    status   TEXT NOT NULL,
    created  TIMESTAMP NOT NULL
)""",
        ["tid", "eid", "category", "priority", "status", "created"],
    ),
    (
        "src_finance_invoices",
        """CREATE TABLE IF NOT EXISTS src_finance_invoices (
    iid        TEXT PRIMARY KEY,
    oid        TEXT NOT NULL,
    amount     DOUBLE PRECISION NOT NULL,
    status     TEXT NOT NULL,
    issue_date DATE NOT NULL
)""",
        ["iid", "oid", "amount", "status", "issue_date"],
    ),
]


def render_insert(table: str, columns: list[str], rows: list[tuple]) -> list[str]:
    """每 500 行一个批量 INSERT 语句。"""
    stmts = []
    header = f"INSERT INTO {table} ({', '.join(columns)}) VALUES"
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start:start + BATCH_SIZE]
        lines = [header]
        for j, row in enumerate(chunk):
            values = ", ".join(
                v if (c in ("amount",)) else sq(v)
                for c, v in zip(columns, row, strict=True)
            )
            tail = ";" if j == len(chunk) - 1 else ","
            lines.append(f"({values}){tail}")
        stmts.append("\n".join(lines))
    return stmts


def build_sql(anchor: dt.datetime, counts: dict[str, int], sections: dict[str, list[str]]) -> str:
    header = f"""-- =========================================================================
-- Mate Platform 本体引擎数据绑定验证 —— 多域业务源库 Mock 数据集（PostgreSQL）
--
-- 生成器 : scripts/mock/generate_business_mock.py（纯 stdlib，--seed 可重现）
-- 锚点日期 : {anchor.date().isoformat()}（--anchor 可指定；同 seed + 同 anchor => 字节级一致）
-- 行数 : src_crm_customers={counts['src_crm_customers']}, src_crm_orders={counts['src_crm_orders']},
--        src_hr_employees={counts['src_hr_employees']}, src_it_tickets={counts['src_it_tickets']},
--        src_finance_invoices={counts['src_finance_invoices']}
--
-- 用途 : 为 dev PG（metaplatform_ont）灌入大规模真实感业务源表，供 Ontology
--        ObjectType / backing datasource 绑定（bind_real_sources.py）端到端验证。
-- 执行 : docker exec -i mate-postgres psql -U meta -d metaplatform_ont < scripts/mock/business_mock.sql
--
-- 注意 :
--   * TRUNCATE 会清空同名源表后重灌（单事务 BEGIN/COMMIT，失败自动回滚）。
--   * 表结构对齐 bind_real_sources.py 绑定契约；已存在的表不会被 CREATE 覆盖。
--   * 逻辑 FK 一致性已由生成器保证：orders.cid∈customers、invoices.oid∈orders、
--     tickets.eid∈employees（不声明物理 FK，模拟真实异构业务源库）。
-- =========================================================================

BEGIN;
"""
    parts = [header]
    for table, ddl, _columns in TABLE_DDL:
        parts.append(f"-- ---- {table} ({counts[table]} rows) " + "-" * 40 + "\n")
        parts.append(ddl + ";\n\n")
        parts.append(f"TRUNCATE TABLE {table};\n\n")
        parts.extend(stmt + "\n\n" for stmt in sections[table])
    parts.append("COMMIT;\n")
    return "".join(parts)


# ---------------------------------------------------------------------------
# 自检（无 PG 直连：引号感知的语句切分 + 括号配对 + 行数核对）
# ---------------------------------------------------------------------------

def split_statements(sql: str) -> list[str]:
    stmts: list[str] = []
    buf: list[str] = []
    depth = 0
    in_q = False
    i, n = 0, len(sql)
    while i < n:
        c = sql[i]
        if in_q:
            if c == "'":
                if i + 1 < n and sql[i + 1] == "'":
                    buf.append("''")
                    i += 2
                    continue
                in_q = False
            buf.append(c)
            i += 1
            continue
        if c == "'":
            in_q = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth < 0:
                raise ValueError("多余的右括号 ')'")
        elif c == ";" and depth == 0:
            s = "".join(buf).strip()
            if s:
                stmts.append(s)
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    if in_q:
        raise ValueError("存在未闭合的单引号")
    if depth != 0:
        raise ValueError(f"括号不配对：还差 {depth} 个 ')'")
    tail = "".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts


def verify_sql(sql: str, counts: dict[str, int]) -> dict[str, int]:
    """粗校验：括号/引号/分号配对 + 每表 INSERT 元组数 == 预期行数。返回实际行数。"""
    actual: dict[str, int] = dict.fromkeys(counts, 0)
    insert_stmts = 0
    for stmt in split_statements(sql):
        head = stmt.split(None, 3)
        if head[0].upper() != "INSERT":
            continue
        insert_stmts += 1
        table = head[2]
        if table not in actual:
            raise ValueError(f"INSERT 指向未知表: {table}")
        tuples = sum(1 for line in stmt.splitlines() if line.startswith("("))
        actual[table] += tuples
    for table, expected in counts.items():
        if actual[table] != expected:
            raise ValueError(
                f"{table}: INSERT 元组数 {actual[table]} != 预期 {expected}")
    if insert_stmts == 0:
        raise ValueError("未发现任何 INSERT 语句")
    return actual


def verify_fk(
    customers: list[tuple], orders: list[tuple],
    employees: list[tuple], tickets: list[tuple], invoices: list[tuple],
) -> None:
    cids = {r[0] for r in customers}
    eids = {r[0] for r in employees}
    oids = {r[0] for r in orders}
    bad_cid = {r[1] for r in orders} - cids
    bad_eid = {r[1] for r in tickets} - eids
    bad_oid = {r[1] for r in invoices} - oids
    if bad_cid or bad_eid or bad_oid:
        raise ValueError(
            f"FK 一致性失败: orders.cid 悬空 {len(bad_cid)}, "
            f"tickets.eid 悬空 {len(bad_eid)}, invoices.oid 悬空 {len(bad_oid)}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main(argv: Sequence[str] | None = None) -> int:
    # Windows 控制台（GBK 代码页）下避免中文报告乱码
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:  # 显示辅助，失败不阻断
                pass
    parser = argparse.ArgumentParser(
        description="生成本体引擎数据绑定验证用多域业务 mock 数据 SQL（纯 stdlib）")
    parser.add_argument("--customers", type=int, default=2000, help="客户行数（默认 2000）")
    parser.add_argument("--orders", type=int, default=5000, help="订单行数（默认 5000）")
    parser.add_argument("--employees", type=int, default=500, help="员工行数（默认 500）")
    parser.add_argument("--tickets", type=int, default=3000, help="工单行数（默认 3000）")
    parser.add_argument("--invoices", type=int, default=4000, help="发票行数（默认 4000）")
    parser.add_argument("--seed", type=int, default=42, help="随机种子（默认 42，保证可重现）")
    parser.add_argument(
        "--anchor", type=str, default=None,
        help="锚点日期 YYYY-MM-DD（默认今天；同 seed+anchor 字节级可重现）")
    parser.add_argument("--output", type=str, default=DEFAULT_OUTPUT, help="输出 SQL 路径")
    args = parser.parse_args(argv)

    anchor_date = (
        dt.date.fromisoformat(args.anchor) if args.anchor else dt.date.today())
    anchor = dt.datetime.combine(anchor_date, dt.time.min)
    rng = random.Random(args.seed)

    # 1) 上游先建
    customers = gen_customers(rng, args.customers, anchor)
    customer_ids = [r[0] for r in customers]
    orders = gen_orders(rng, args.orders, customer_ids, anchor)
    employees = gen_employees(rng, args.employees, anchor_date)
    employee_ids = [r[0] for r in employees]
    tickets = gen_tickets(rng, args.tickets, employee_ids, anchor)
    invoices = gen_invoices(rng, args.invoices, orders, anchor)

    # 2) 逻辑 FK 一致性自检
    verify_fk(customers, orders, employees, tickets, invoices)

    # 3) 组装 SQL（顺序：customers -> orders -> employees -> tickets -> invoices）
    data = {
        "src_crm_customers": customers,
        "src_crm_orders": orders,
        "src_hr_employees": employees,
        "src_it_tickets": tickets,
        "src_finance_invoices": invoices,
    }
    counts = {t: len(rows) for t, rows in data.items()}
    sections = {
        ddl[0]: render_insert(ddl[0], ddl[2], data[ddl[0]]) for ddl in TABLE_DDL
    }
    sql = build_sql(anchor, counts, sections)

    # 4) SQL 粗校验（括号/引号/分号配对 + 行数核对）
    actual = verify_sql(sql, counts)

    out_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(sql)
    size = Path(out_path).stat().st_size

    print("business_mock 生成完成")
    print(f"  输出文件 : {out_path}")
    print(f"  文件大小 : {size:,} bytes ({size / 1024 / 1024:.2f} MB)")
    print(f"  随机种子 : seed={args.seed}, anchor={anchor_date.isoformat()}")
    print(f"  INSERT 语句数 : {sum(len(v) for v in sections.values())}（每批 {BATCH_SIZE} 行）")
    for table in data:
        print(f"  {table:<24} {actual[table]:>6} rows")
    print("  自检 : 语句括号/引号配对 OK；三组 FK（orders.cid / invoices.oid / tickets.eid）子集校验 OK")
    print(f"  执行 : docker exec -i mate-postgres psql -U meta -d metaplatform_ont < {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
