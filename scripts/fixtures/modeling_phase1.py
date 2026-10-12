"""Generate small, reproducible business workbooks for phase-one acceptance."""

import argparse
import json
from pathlib import Path

from openpyxl import Workbook

CASES = {
    "equipment": {
        "context": "设备分类业务口径：数控机床是一种机床，机床是一种设备，构成三层 is-a 继承。类型分类表给出业务确认的分类定义及父类别依据，它是模型证据，不是设备实例，禁止把分类行映射成业务对象。三层统一以设备编号为唯一业务身份，父共有属性标识及类型保持一致；设备有设备编号、设备名称、品牌，机床增加加工方式，数控机床增加控制系统、轴数。实际数据只有数控机床表两行，每行只映射到最具体的数控机床类；设备与机床作为概念父类不得重复生成同编号实例，父类查询通过子类闭包包含数控机床。这里没有维修记录，不能推断维修日期或可用性。",
        "sheets": {
            "类型分类": [
                ["类别编码", "类别名称", "父类别编码", "分类依据"],
                ["equipment", "设备", "", "可独立编号管理的生产设备"],
                ["machine_tool", "机床", "equipment", "机床是一种设备，继承统一设备编号"],
                [
                    "cnc_machine_tool",
                    "数控机床",
                    "machine_tool",
                    "数控机床是一种机床，以数控系统控制加工",
                ],
            ],
            "数控机床": [
                ["设备编号", "设备名称", "品牌", "加工方式", "控制系统", "轴数"],
                ["CNC01", "立式加工中心", "甲品牌", "铣削", "FANUC", 3],
                ["CNC02", "数控车床", "乙品牌", "车削", "SIEMENS", 2],
            ],
        },
        "questions": [
            (
                "数控机床、机床和设备是什么分类关系？",
                "数控机床 is-a 机床，机床 is-a 设备；三层继承而非 part-of",
            ),
            (
                "查询全部设备时是否包含两台数控机床？",
                "包含 CNC01、CNC02，通过子类闭包而非复制父类实例",
            ),
            ("三个层级如何识别同一台设备？", "统一设备编号，父共有属性保持相同标识和类型"),
            ("CNC01 使用什么控制系统、几根轴？", "FANUC，3轴；控制系统与轴数为数控机床专有属性"),
            ("CNC01 最近一次维修是什么时候？", "无法回答：没有维修记录，不得编造日期"),
        ],
        "expected": {
            "hierarchy": ["equipment", "machine_tool", "cnc_machine_tool"],
            "leaf_instances": 2,
            "ancestor_direct_instances": 0,
        },
    },
    "manufacturing": {
        "context": "制造齐套：物料主数据、分仓库存、BOM和工单。库存身份为物料编码+仓库，BOM身份为产品编码+物料编码；不同表中的同一物料应复用一个概念。库存行同时描述物料与库存。",
        "sheets": {
            "物料": [
                ["物料编码", "物料名称", "单位"],
                ["M01", "电机", "台"],
                ["M02", "螺栓", "个"],
            ],
            "库存": [
                ["物料编码", "物料名称", "仓库", "可用量"],
                ["M01", "电机", "A", 3],
                ["M01", "电机", "B", 2],
                ["M02", "螺栓", "A", 40],
            ],
            "BOM": [["产品编码", "物料编码", "单件用量"], ["P01", "M01", 1], ["P01", "M02", 4]],
            "工单": [["工单编号", "产品编码", "计划数量"], ["W01", "P01", 4], ["W02", "P01", 2]],
        },
        "questions": [
            ("某物料分布在哪些仓库？", "M01 在 A、B 仓；库存以物料+仓库区分"),
            ("P01 需要哪些物料？", "M01、M02；单位分别为台、个"),
            ("W01 的计划量是多少？", "4"),
            ("W01 需要多少螺栓？", "4×4=16；首期结构支持关联，自动计算留待派生指标"),
            ("供应商何时到货？", "无法回答：缺供应商和采购交期数据"),
        ],
        "expected": {"materials": 2, "inventory": 3, "bom_lines": 2, "work_orders": 2},
    },
    "sales": {
        "context": "客户订单：客户在主数据和订单表中重复出现；订单头与订单行粒度不同，订单行身份为订单号+行号。订单表同时描述客户与订单。不要把订单行误并成订单。",
        "sheets": {
            "客户": [
                ["客户号", "客户名称", "城市"],
                ["C01", "甲公司", "杭州"],
                ["C02", "乙公司", "上海"],
            ],
            "订单": [
                ["订单号", "客户号", "客户名称", "订单日期"],
                ["O01", "C01", "甲公司", "2026-10-01"],
                ["O02", "C01", "甲公司", "2026-10-02"],
                ["O03", "C02", "乙公司", "2026-10-03"],
            ],
            "订单行": [
                ["订单号", "行号", "商品号", "商品名称", "数量"],
                ["O01", 1, "S01", "键盘", 2],
                ["O01", 2, "S02", "鼠标", 3],
                ["O02", 1, "S01", "键盘", 1],
                ["O03", 1, "S02", "鼠标", 4],
            ],
        },
        "questions": [
            ("甲公司有哪些订单？", "O01、O02"),
            ("O01 包含哪些商品？", "S01 键盘、S02 鼠标"),
            ("O01 有多少订单行？", "2；不得按订单号合并订单行"),
            ("S01 出现在哪些订单？", "O01、O02"),
            ("O01 何时签收？", "无法回答：缺配送和签收信息"),
        ],
        "expected": {"customers": 2, "orders": 3, "order_lines": 4, "products": 2},
    },
}


def generate(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for name, case in CASES.items():
        book = Workbook()
        book.remove(book.active)
        for title, rows in case["sheets"].items():
            sheet = book.create_sheet(title)
            for row in rows:
                sheet.append(row)
        book.save(output / f"{name}.xlsx")
        spec = {k: v for k, v in case.items() if k != "sheets"}
        spec["questions"] = [
            {"id": f"q{i}", "question": q, "expected": answer}
            for i, (q, answer) in enumerate(case["questions"], 1)
        ]
        (output / f"{name}.json").write_text(
            json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(".cache/modeling-phase1/fixtures"))
    generate(parser.parse_args().output)
