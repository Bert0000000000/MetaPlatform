"""SAL-06 — Markings 联动：工具可见性(schema_gen) × agent 访问强制(security)。"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.tooling.schema_gen import visible_object_types


def _ot(rid, marking):
    from mate_kernel.ontology.identity.class_ref import ClassRef
    from mate_kernel.ontology.types.object_type import ObjectType
    from mate_kernel.ontology.types.property_ import Property, PropertyFormat

    pk = ClassRef(f"ont.t-sal06.prop.{rid}-id.v1")
    return ObjectType(
        rid=ClassRef(f"ont.t-sal06.obj.{rid}.v1"),
        display_name=rid,
        primary_key=(pk,),
        properties=(
            Property(
                rid=pk,
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
        ),
        marking=tuple(marking),
    )


class TestToolVisibility:
    def test_unmarked_always_visible(self):
        vis = visible_object_types([_ot("o1", [])], ["m1"])
        assert [t.display_name for t in vis] == ["o1"]

    def test_subset_visible_superset_hidden(self):
        ts = [_ot("pub", []), _ot("fin", ["finance"]), _ot("finhr", ["finance", "hr"])]
        vis = visible_object_types(ts, ["finance"])
        assert [t.display_name for t in vis] == ["pub", "fin"]

    def test_no_markings_holds_nothing_marked(self):
        assert visible_object_types([_ot("sec", ["s"])], []) == ()


class TestAgentEnforcement:
    def _mk(self, req_markings, held):
        from mate_kernel.agent.security import SecurityAgent, SecurityRequest

        requester = type("P", (), {"markings": tuple(held), "user_id": "u", "tenant_id": "t"})()
        required = type("R", (), {"required_markings": tuple(req_markings)})()
        req = SecurityRequest(
            requester=requester, required=required, target_tenant="t", resource_rid="r"
        )
        return SecurityAgent().decide(req)

    def test_missing_marking_denied(self):
        d = self._mk(("s",), ())
        assert d.decision.value == "deny" and d.rule_id == "R-MARK-001"

    def test_held_marking_allowed(self):
        d = self._mk(("s",), ("s",))
        assert d.decision.value == "allow"
