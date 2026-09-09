"""ontology-sdk 单测：typed client 的路径/头/错误/幂等语义（MockTransport）。"""
from __future__ import annotations

import json

import httpx
import pytest

from mate_clients.ontology_sdk import OntologySDK, OntologySDKError

TENANT = "tenant-default"
TOKEN = "tok-123"


def _sdk(handler) -> OntologySDK:
    transport = httpx.MockTransport(handler)
    sdk = OntologySDK(base_url="http://gw.test", token=TOKEN, tenant_id=TENANT)
    sdk._client = httpx.Client(transport=transport,
                               headers={"X-Tenant-Id": TENANT})
    return sdk


def test_headers_injected():
    seen = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen["auth"] = req.headers.get("Authorization")
        seen["tenant"] = req.headers.get("X-Tenant-Id")
        return httpx.Response(200, json={})

    _sdk(h).get_object_type("ont.t.obj.a.v1")
    assert seen["auth"] == f"Bearer {TOKEN}"
    assert seen["tenant"] == TENANT


def test_get_object_type_path():
    seen = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen["path"] = req.url.path
        return httpx.Response(200, json={"rid": "x"})

    _sdk(h).get_object_type("ont.t.obj.a.v1")
    assert seen["path"] == "/api/v1/ont/v2/object-types/ont.t.obj.a.v1"


def test_create_object_type_posts_dto():
    seen = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen["path"] = req.url.path
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"rid": "x"})

    dto = {"rid": "ont.t.obj.a.v1", "primary_key": ["p"], "properties": []}
    _sdk(h).create_object_type(dto)
    assert seen["path"] == "/api/v1/ont/v2/object-types"
    assert seen["body"] == dto


def test_proposal_flow_paths_and_idempotency():
    seen: dict[str, str] = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen[f"{req.method} {req.url.path}"] = req.headers.get("Idempotency-Key", "")
        return httpx.Response(200, json={"ok": True})

    sdk = _sdk(h)
    sdk.confirm_proposal("p1")
    sdk.execute_proposal("p1")
    sdk.revert_proposal("p1")
    assert seen["POST /api/v1/ont/v2/proposals/p1/confirm"]
    assert seen["POST /api/v1/ont/v2/proposals/p1/execute"]
    assert seen["POST /api/v1/ont/v2/proposals/p1/revert"]


def test_error_mapped_to_sdk_error():
    def h(req: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "conflict"})

    with pytest.raises(OntologySDKError) as ei:
        _sdk(h).create_object_type({})
    assert ei.value.status == 409
    assert ei.value.body == {"detail": "conflict"}


def test_validate_shacl_passes_axioms():
    seen = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"conforms": True})

    sdk = _sdk(h)
    sdk.validate_shacl("ont.t.obj.a.v1",
                       property_shapes=[{"path": "p", "min_count": 1}],
                       subclass_axioms=[("ont.t.obj.b.v1", "ont.t.obj.a.v1")])
    assert seen["body"]["subclass_axioms"] == [["ont.t.obj.b.v1", "ont.t.obj.a.v1"]]
    assert seen["body"]["property_shapes"] == [{"path": "p", "min_count": 1}]


def test_reasoning_run_defaults():
    seen = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={})

    _sdk(h).reasoning_run(individuals={"i1": ["a"]})
    assert seen["body"] == {"subclass_axioms": [], "individuals": {"i1": ["a"]},
                            "same_as_pairs": [], "transitive_axioms": [],
                            "property_edges": []}


def test_align_individuals_shape():
    seen = {}

    def h(req: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"clusters": {}})

    _sdk(h).align_individuals([{"rid": "a"}], [{"rid": "b"}],
                              explicit_pairs=[("a", "b")])
    assert seen["body"] == {"left": [{"rid": "a"}], "right": [{"rid": "b"}],
                            "explicit_pairs": [["a", "b"]]}
