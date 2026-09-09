"""SAL §5 Scenario 写回一致性校验单测。"""
from __future__ import annotations

from mate_kernel.ontology.writeback import validate_write_back

CLS = "ont.t1.obj.batch1.customer.v1"
PK = ("ont.t1.prop.batch1-customer-id.v1",)
KNOWN = {CLS: PK}
ENTRY = {
    "individual_rid": "ont.t1.ind.batch1.customer.c-1",
    "class_rid": CLS,
    "props": {"batch1-customer-id": "c-1", "name": "alice"},
}


def test_valid_batch_returns_no_issues():
    assert validate_write_back([ENTRY], known_classes=KNOWN,
                               tenant_id="t1") == []


def test_unknown_class_flagged():
    bad = dict(ENTRY, class_rid="ont.t1.obj.batch1.ghost.v1")
    issues = validate_write_back([bad], known_classes=KNOWN, tenant_id="t1")
    assert [i.code for i in issues] == ["unknown_class"]


def test_tenant_mismatch_flagged():
    bad = dict(ENTRY, individual_rid="ont.t2.ind.batch1.customer.c-9")
    issues = validate_write_back([bad], known_classes=KNOWN, tenant_id="t1")
    assert any(i.code == "tenant_mismatch" for i in issues)


def test_duplicate_target_flagged():
    issues = validate_write_back([ENTRY, dict(ENTRY)], known_classes=KNOWN,
                                 tenant_id="t1")
    dup = [i for i in issues if i.code == "duplicate_target"]
    assert len(dup) == 1 and dup[0].index == 1


def test_missing_pk_flagged():
    bad = {k: v for k, v in ENTRY.items()}
    bad["props"] = {"name": "no-pk"}
    issues = validate_write_back([bad], known_classes=KNOWN, tenant_id="t1")
    assert [i.code for i in issues] == ["missing_pk"]


def test_pk_by_full_rid_also_accepted():
    ok = dict(ENTRY, props={PK[0]: "c-2"})
    assert validate_write_back([ok], known_classes=KNOWN, tenant_id="t1") == []
