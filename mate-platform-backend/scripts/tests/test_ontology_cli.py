"""Unit tests for scripts/ontology_cli.py (ONT-G11).

All network interaction is faked by monkeypatching ``_request`` /
``login`` — no gateway is contacted.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import ontology_cli as cli


def test_build_query_body_defaults_and_extra_override() -> None:
    body = cli.build_query_body("ont.t.ac.v1", 10)
    assert body == {"source": "ont.t.ac.v1", "paging_limit": 10}
    extra = {"source": "ont.t.ac.v1", "filters": [{"op": "eq"}]}
    assert cli.build_query_body("ont.t.ac.v1", 10, extra) is extra


def test_list_classes_prints_rows_and_total(
    monkeypatch,
    capsys,
) -> None:
    captured: dict = {}

    def fake_request(method, gateway, path, *, token, tenant, payload=None, timeout=30.0):
        captured.update(method=method, path=path, token=token, tenant=tenant)
        return 200, {
            "items": [
                {"rid": "ont.t.employee.v1", "display_name": "Employee"},
                {"rid": "ont.t.order.v2", "display_name": "Order"},
            ],
            "total": 2,
        }

    monkeypatch.setattr(cli, "_request", fake_request)
    rc = cli.main(["--tenant", "tenant-acme", "list-classes", "--limit", "5"])

    out = capsys.readouterr().out
    assert rc == 0
    assert captured["method"] == "GET"
    assert "/api/v1/ont/v2/object-types" in captured["path"]
    assert captured["tenant"] == "tenant-acme"
    assert "total: 2" in out
    assert "ont.t.employee.v1" in out


def test_list_classes_accepts_bare_array_envelope(
    monkeypatch,
    capsys,
) -> None:
    """网关 v2 object-types 实测返回裸数组；CLI 两种包络都要支持。"""
    monkeypatch.setattr(
        cli,
        "_request",
        lambda *a, **k: (
            200,
            [{"rid": "ont.tenant-default.obj.ac.v1", "display_name": "AC"}],
        ),
    )
    rc = cli.main(["list-classes"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "total: 1" in out
    assert "ont.tenant-default.obj.ac.v1" in out


def test_query_posts_object_query_with_auth_headers(
    monkeypatch,
    capsys,
) -> None:
    captured: dict = {}

    def fake_request(method, gateway, path, *, token, tenant, payload=None, timeout=30.0):
        captured.update(method=method, path=path, token=token, tenant=tenant, payload=payload)
        return 200, {"kind": "objects", "rows": [{"rid": "ont.i.x.v1"}]}

    monkeypatch.setattr(cli, "_request", fake_request)
    monkeypatch.setattr(cli, "login", lambda *a, **k: "tok-123")
    rc = cli.main(["query", "--source", "ont.t.ac.v3", "--limit", "7"])

    out = capsys.readouterr().out
    assert rc == 0
    assert captured["method"] == "POST"
    assert captured["path"] == "/api/v1/ont/v2/object-query"
    assert captured["token"] == "tok-123"
    assert captured["payload"] == {"source": "ont.t.ac.v3", "paging_limit": 7}
    assert json.loads(out)["kind"] == "objects"


def test_get_type_404_exits_nonzero(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        cli,
        "_request",
        lambda *a, **k: (404, b'{"detail":"not found"}'),
    )
    rc = cli.main(["get-type", "ont.t.missing.v1"])
    err = capsys.readouterr().err
    assert rc == 1
    assert "HTTP 404" in err


def test_export_writes_bundle_file(monkeypatch, tmp_path) -> None:
    bundle = {"rid": "ont.t.ac.v1", "properties": [{"name": "status"}]}

    def fake_request(method, gateway, path, *, token, tenant, payload=None, timeout=30.0):
        assert method == "GET"
        assert path == "/api/v1/ont/v2/object-types/ont.t.ac.v1/export"
        return 200, bundle

    monkeypatch.setattr(cli, "_request", fake_request)
    out_path = tmp_path / "bundle.json"
    rc = cli.main(["export", "ont.t.ac.v1", "--out", str(out_path)])

    assert rc == 0
    assert json.loads(out_path.read_text(encoding="utf-8")) == bundle


def test_login_failure_returns_nonzero(monkeypatch) -> None:
    def boom(*a, **k):
        raise cli.OntCliError("login failed: unreachable")

    monkeypatch.setattr(cli, "login", boom)
    assert cli.main(["list-classes"]) == 1
