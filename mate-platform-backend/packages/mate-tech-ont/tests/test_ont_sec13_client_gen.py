"""SEC-13 —— OSDK-lite 客户端生成器测试 + 生成 CLI 脚本冒烟。

覆盖：
1. 生成源码可编译（compile）且包含 dataclass / 字段类型 / 元数据注释；
2. slug → 类名 / 字段名转换（kebab → Pascal / snake）；
3. ActionType rid 常量表；
4. 生成代码实例化 OntologyClient（不发请求 —— 只验证结构完整）。
"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.tooling.client_gen import generate_client_source

T = "sec13"
OBJ = f"ont.{T}.obj.crm.vip-customer.v1"
P_ID = f"ont.{T}.prop.cid.v1"
P_NAME = f"ont.{T}.prop.cname.v1"
P_TIER = f"ont.{T}.prop.ctier.v1"
ACT = f"ont.{T}.act.crm.upgrade-tier.v1"


def _ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef(OBJ),
        primary_key=(ClassRef(P_ID),),
        properties=(
            Property(
                rid=ClassRef(P_ID),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef(P_NAME),
                type_id="string",
                nullable=True,
                primary_key=False,
                title="name",
                format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef(P_TIER),
                type_id="integer",
                nullable=True,
                primary_key=False,
                title="tier",
                format=PropertyFormat.INTEGER,
            ),
        ),
        display_name="VIP 客户",
        description="高价值客户档案",
        status="active",
    )


def _at() -> ActionType:
    return ActionType(
        rid=ClassRef(ACT),
        parameters=(),
        submission_criteria=(),
        side_effects=(),
        function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
        on=(ClassRef(OBJ),),
        title="Upgrade Tier",
    )


class TestClientGen:
    def test_generates_compilable_source(self) -> None:
        src = generate_client_source([_ot()], [_at()], tenant=T)
        # 可编译
        code = compile(src, "<generated>", "exec")
        assert code is not None
        # dataclass + 字段类型 + 元数据
        assert "class VipCustomer" in src
        assert "cname: str = None" in src
        assert "ctier: int = None" in src
        assert "高价值客户档案" in src
        assert "UPGRADE_TIER RID" not in src  # 常量名是 UPGRADE_TIER_RID
        assert "UPGRADE_TIER_RID" in src

    def test_generated_module_instantiable(self) -> None:
        src = generate_client_source([_ot()], [], tenant=T)
        ns: dict[str, object] = {}
        exec(compile(src, "<generated>", "exec"), ns)
        client_cls = ns["OntologyClient"]
        client = client_cls(base_url="http://localhost:8100/api/v1/ont/v2", token="t")
        assert client.base_url.endswith("/ont/v2")
        vip = ns["VipCustomer"](
            rid="ont.x.ind.vip-customer.1", primary_key="1", cname="acme", ctier=3
        )
        assert vip.ctier == 3

    def test_no_duplicate_class_names(self) -> None:
        ot1 = _ot()
        # 同 slug 不同 domain —— 生成器应跳过重名（保守）
        from dataclasses import replace

        ot2 = replace(ot1, rid=ClassRef(f"ont.{T}.obj.sales.vip-customer.v1"))
        src = generate_client_source([ot1, ot2])
        assert src.count("class VipCustomer") == 1
