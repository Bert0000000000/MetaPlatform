"""Required gates must fail on missing, skipped, or incomplete evidence."""

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "verify_ont_postgres.py"


def gate():
    assert SCRIPT.exists(), "Required PostgreSQL gate is missing"
    spec = importlib.util.spec_from_file_location("ont_pg_gate", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_missing_dsn_fails_instead_of_using_application_default():
    with pytest.raises(ValueError, match="VER_PG_DSN or PG_DSN"):
        gate().resolve_dsn({})


def test_generic_dsn_is_supported():
    assert gate().resolve_dsn({"PG_DSN": "explicit-target"}) == "explicit-target"


def test_conflicting_dsns_are_rejected():
    with pytest.raises(ValueError, match="same"):
        gate().resolve_dsn({"VER_PG_DSN": "one", "PG_DSN": "two"})


@pytest.mark.parametrize("superuser,bypass", [(True, False), (False, True)])
def test_privileged_business_role_is_rejected(superuser, bypass):
    with pytest.raises(ValueError, match="NOSUPERUSER NOBYPASSRLS"):
        gate().validate_identity("business", superuser, bypass)


def test_nonprivileged_business_role_is_accepted():
    gate().validate_identity("business", False, False)


@pytest.mark.parametrize("child", ["", "<skipped/>", "<failure/>", "<error/>"])
def test_empty_skipped_and_failed_junit_cannot_pass(tmp_path, child):
    report = tmp_path / "result.xml"
    case = (
        f'<testcase classname="test_ont_migration_plan" name="test_flow">{child}</testcase>'
        if child
        else ""
    )
    report.write_text(f"<testsuites><testsuite>{case}</testsuite></testsuites>")
    with pytest.raises(ValueError):
        gate().check_junit(report, {"test_ont_migration_plan"})


def test_missing_required_suite_is_rejected(tmp_path):
    report = tmp_path / "result.xml"
    report.write_text(
        '<testsuites><testsuite><testcase classname="test_other" name="test_ok"/></testsuite></testsuites>'
    )
    with pytest.raises(ValueError, match="not executed"):
        gate().check_junit(report, {"test_ont_migration_plan"})


def test_executed_successful_required_suite_is_accepted(tmp_path):
    report = tmp_path / "result.xml"
    report.write_text(
        '<testsuites><testsuite><testcase classname="packages.tests.test_ont_migration_plan.TestMigration" name="test_ok"/></testsuite></testsuites>'
    )
    assert gate().check_junit(report, {"test_ont_migration_plan"}) == 1


@pytest.mark.parametrize(
    "admin,test",
    [
        ("", ""),
        (
            "postgresql://admin@localhost/postgres",
            "postgresql://mate_ont_test@localhost/application",
        ),
        (
            "postgresql://admin@localhost/application",
            "postgresql://mate_ont_test@localhost/metaplatform_ont_test",
        ),
        (
            "postgresql://admin@localhost/postgres",
            "postgresql://meta@localhost/metaplatform_ont_test",
        ),
        (
            "postgresql://admin@localhost/postgres",
            "postgresql://mate_ont_test@elsewhere/metaplatform_ont_test",
        ),
    ],
)
def test_provisioner_rejects_unsafe_targets_before_mutation(admin, test):
    from scripts.ci.prepare_ont_rls_test_db import validate_test_target

    with pytest.raises(ValueError):
        validate_test_target(admin, test)
