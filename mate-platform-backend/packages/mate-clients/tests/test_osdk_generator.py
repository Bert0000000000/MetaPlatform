"""G6 OSDK 生成器单测：契约 → 确定性 typed client。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from generate_typed_client import generate

CONTRACT = {
    "paths": {
        "/api/v1/ont/v2/object-types/{rid}": {
            "get": {"operationId": "ontGetV2ObjectType",
                    "summary": "Get an object type",
                    "parameters": [{"name": "rid", "in": "path", "required": True,
                                    "schema": {"type": "string"}}]},
        },
        "/api/v1/ont/v2/shacl/validate": {
            "post": {"operationId": "ontValidateV2Shacl",
                     "summary": "SHACL validate"},
        },
    }
}


@pytest.fixture()
def generated(tmp_path, monkeypatch):
    src = tmp_path / "c.yaml"
    open(src, "w", encoding="utf-8").write(yaml.safe_dump(CONTRACT))
    code = generate(str(src))
    mod: dict = {}
    exec(compile(code, "osdk_generated.py", "exec"), mod)
    return code, mod


def test_generates_operation_methods(generated):
    code, mod = generated
    cls = mod["GeneratedClient"]
    assert hasattr(cls, "ontgetv2objecttype")
    assert hasattr(cls, "ontvalidatev2shacl")


def test_deterministic_output(generated):
    code, _ = generated
    assert "AUTO-GENERATED" in code
    assert code.index("ontgetv2objecttype") < code.index("ontvalidatev2shacl")


def test_path_param_and_headers(generated):
    _, mod = generated
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["path"] = req.url.path
        seen["auth"] = req.headers.get("Authorization")
        return httpx.Response(200, json={"rid": "r1"})

    cls = mod["GeneratedClient"]
    client = cls(base_url="http://gw.test", token="tk", tenant_id="t1")
    client._client = httpx.Client(transport=httpx.MockTransport(handler),
                                  headers={"X-Tenant-Id": "t1",
                                           "Authorization": "Bearer tk"})
    out = client.ontgetv2objecttype("ont.t.obj.a.v1")
    assert seen["path"] == "/api/v1/ont/v2/object-types/ont.t.obj.a.v1"
    assert seen["auth"] == "Bearer tk"
    assert out == {"rid": "r1"}


def test_post_body_passthrough(generated):
    _, mod = generated
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"conforms": True})

    cls = mod["GeneratedClient"]
    client = cls(base_url="http://gw.test", token="tk", tenant_id="t1")
    client._client = httpx.Client(transport=httpx.MockTransport(handler),
                                  headers={"X-Tenant-Id": "t1"})
    client.ontvalidatev2shacl(target_class="ont.t.obj.a.v1")
    assert seen["body"] == {"target_class": "ont.t.obj.a.v1"}
