import json
import httpx
import pytest
from fastapi import HTTPException

from mate_app_copilot import modeling_proposal as proposal


@pytest.mark.asyncio
async def test_external_provider_stream_preserves_vendor_auth_and_closes_on_error(monkeypatch):
    from mate_app_copilot.llm.openai_provider import OpenAIProvider

    clients = []
    original = httpx.AsyncClient

    def handle(request):
        assert str(request.url) == "https://provider.example/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer vendor-credential"
        assert "X-Tenant-Id" not in request.headers
        return httpx.Response(200, json={"choices": []})

    def client(**kwargs):
        value = original(transport=httpx.MockTransport(handle), **kwargs)
        clients.append(value)
        return value

    monkeypatch.setattr(httpx, "AsyncClient", client)
    with pytest.raises(RuntimeError, match="consumer stopped"):
        async with OpenAIProvider(
            api_key="vendor-credential", base_url="https://provider.example/v1"
        ) as provider:
            async with provider.chat_completion_stream({"stream": True}) as response:
                assert response.status_code == 200
                raise RuntimeError("consumer stopped")
    assert clients[0].is_closed


@pytest.mark.asyncio
async def test_data_repair_uses_authenticated_bounded_route_and_observed_value_contract(
    monkeypatch,
):
    from fastapi import FastAPI
    from mate_app_copilot import modeling_router

    app = FastAPI()
    app.include_router(modeling_router.router)
    monkeypatch.setattr(modeling_router, "identity", lambda request: ("tenant", "token"))
    monkeypatch.setattr(modeling_router, "_get_client", lambda request: None)

    async def config(*args):
        return {}

    captured = []

    async def complete(cfg, system, payload):
        captured.append((system, payload))
        return {"repairs": []}

    monkeypatch.setattr(proposal, "provider_config", config)
    monkeypatch.setattr(proposal, "complete", complete)
    body = {
        "profile": {"sheets": []},
        "context": "费用按单据明细定位",
        "validation": {"candidates": []},
        "outputSchema": {"type": "object"},
    }
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        result = await client.post("/api/v1/copilot/modeling/data-repair", json=body)
        assert result.status_code == 200 and result.json() == {"repairs": []}
        assert (
            await client.post(
                "/api/v1/copilot/modeling/data-repair", json={"profile": {"sheets": []}}
            )
        ).status_code == 422
    assert captured[0][1]["businessContext"] == body["context"]
    assert "never invent" in captured[0][0] and "Human confirmation" in captured[0][0]


@pytest.mark.asyncio
async def test_refinement_is_authenticated_bounded_and_receives_platform_and_full_data_evidence(
    monkeypatch,
):
    from fastapi import FastAPI
    from mate_app_copilot import modeling_router

    app = FastAPI()
    app.include_router(modeling_router.router)
    monkeypatch.setattr(modeling_router, "identity", lambda request: ("tenant", "token"))
    monkeypatch.setattr(modeling_router, "_get_client", lambda request: None)

    async def config(*args):
        return {}

    captured = []

    async def complete(cfg, system, payload):
        captured.append((system, payload))
        return {"repairs": []}

    monkeypatch.setattr(proposal, "provider_config", config)
    monkeypatch.setattr(proposal, "complete", complete)
    payload = {
        "profile": {
            "sheets": [],
            "platformCapabilities": {"propertyTypes": ["text", "number", "date"]},
        },
        "draft": {"classes": []},
        "validation": {"identities": []},
        "outputSchema": {"type": "object"},
    }
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/copilot/modeling/refine", json=payload)
        assert response.status_code == 200 and response.json() == {"repairs": []}
        assert (
            await client.post("/api/v1/copilot/modeling/refine", json={"profile": {"sheets": []}})
        ).status_code == 422
    assert captured[0][1]["diagnostics"] == {"identities": []}
    assert "Never rename" in captured[0][0] and "statistically unique" in captured[0][0]


@pytest.mark.asyncio
async def test_generation_progress_stream_has_real_stages_and_terminal_result(monkeypatch):
    from fastapi import FastAPI
    from mate_app_copilot import modeling_router

    app = FastAPI()
    app.include_router(modeling_router.router)
    monkeypatch.setattr(modeling_router, "identity", lambda request: ("tenant", "token"))
    monkeypatch.setattr(modeling_router, "_get_client", lambda request: None)

    async def generate(*args, on_progress=None):
        on_progress({"stage": "concepts"})
        on_progress({"stage": "mapping", "batch": 2, "totalBatches": 3})
        return {"draft": {"classes": []}}

    monkeypatch.setattr(modeling_router, "generate", generate)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/v1/copilot/modeling/generate",
            headers={"Accept": "text/event-stream"},
            json={"profile": {"sheets": []}},
        )
    assert response.status_code == 200
    events = [
        json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")
    ]
    assert [event["type"] for event in events] == ["progress", "progress", "result"]
    assert events[1]["progress"] == {"stage": "mapping", "batch": 2, "totalBatches": 3}
    assert events[-1]["result"] == {"draft": {"classes": []}}


@pytest.mark.asyncio
@pytest.mark.parametrize("finish", ["stop", "length", None])
async def test_stream_requires_complete_valid_output(monkeypatch, finish):
    original = httpx.AsyncClient

    def handler(request):
        assert json.loads(request.content)["stream"] is True
        chunks = [
            {"choices": [{"delta": {"content": '{"ok":'}, "finish_reason": None}]},
            {"choices": [{"delta": {"content": "true}"}, "finish_reason": finish}]},
        ]
        body = (
            "".join("data: " + json.dumps(chunk) + "\n\n" for chunk in chunks) + "data: [DONE]\n\n"
        )
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    monkeypatch.setattr(
        proposal.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    cfg = {"base_url": "https://model.example/v1", "api_key": "key", "default_model": "model"}
    if finish == "stop":
        assert await proposal.complete(cfg, "system", {}) == {"ok": True}
    else:
        with pytest.raises(HTTPException) as caught:
            await proposal.complete(cfg, "system", {})
        assert "草稿未修改" in caught.value.detail


@pytest.mark.asyncio
async def test_provider_gateway_timeout_has_specific_message(monkeypatch):
    original = httpx.AsyncClient
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(504, text="private-upstream-body")

    monkeypatch.setattr(
        proposal.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    with pytest.raises(HTTPException) as caught:
        await proposal.complete(
            {"base_url": "https://model.example/v1", "api_key": "key", "default_model": "model"},
            "system",
            {},
        )
    assert "网关超时" in caught.value.detail
    assert "private" not in caught.value.detail
    assert len(calls) == 3


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["connect", "timeout", "unauthorized", "rate_limit"])
async def test_transport_errors_are_not_reported_as_invalid_json(monkeypatch, failure):
    original = httpx.AsyncClient
    calls = []

    def handler(request):
        calls.append(request)
        if failure == "connect":
            raise httpx.ConnectError("sensitive-host-secret", request=request)
        if failure == "timeout":
            raise httpx.ReadTimeout("sensitive-host-secret", request=request)
        return httpx.Response(
            401 if failure == "unauthorized" else 429, text="secret-provider-body"
        )

    monkeypatch.setattr(
        proposal.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    with pytest.raises(HTTPException) as caught:
        await proposal.complete(
            {"base_url": "https://model.example/v1", "api_key": "key", "default_model": "model"},
            "system",
            {},
        )
    assert "JSON" not in caught.value.detail
    assert "secret" not in caught.value.detail
    assert len(calls) == (3 if failure in {"connect", "rate_limit"} else 1)


@pytest.mark.asyncio
async def test_transient_connection_failure_retries_and_preserves_request(monkeypatch):
    original = httpx.AsyncClient
    bodies = []

    def handler(request):
        bodies.append(request.content)
        if len(bodies) < 3:
            raise httpx.ConnectError("temporary", request=request)
        return httpx.Response(
            200,
            json={
                "choices": [{"finish_reason": "stop", "message": {"content": '{"mappings": []}'}}]
            },
        )

    monkeypatch.setattr(
        proposal.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = await proposal.complete(
        {"base_url": "https://model.example/v1", "api_key": "key", "default_model": "model"},
        "system",
        {"batchIndex": 2},
    )
    assert result == {"mappings": []}
    assert len(bodies) == 3 and len(set(bodies)) == 1


@pytest.mark.asyncio
async def test_mapping_schema_and_evidence_do_not_mix_source_batches(monkeypatch):
    async def config(*args):
        return {}

    calls = []

    async def complete(cfg, system, payload):
        if "classes" not in payload:
            return {
                "name": "业务",
                "classes": [
                    {
                        "id": "product",
                        "evidence": [
                            {
                                "kind": "source",
                                "sheet": "Other",
                                "columns": ["Code"],
                                "detail": "证据",
                            }
                        ],
                    }
                ],
            }
        calls.append(payload)
        return {"mappings": []}

    monkeypatch.setattr(proposal, "provider_config", config)
    monkeypatch.setattr(proposal, "complete", complete)
    schema = {
        "properties": {"mappings": {"type": "array", "items": {"$ref": "#/$defs/Mapping"}}},
        "$defs": {
            "Mapping": {"properties": {"sheet": {"type": "string"}, "classId": {"type": "string"}}}
        },
    }
    result = await proposal.generate(
        None,
        "tenant",
        "token",
        {"sheets": [{"name": name} for name in ["Rows", "Rows2", "Rows3", "Other"]]},
        "",
        [],
        [],
        schema,
    )
    assert calls[0]["outputSchema"]["$defs"]["Mapping"]["properties"]["sheet"]["enum"] == [
        "Rows",
        "Rows2",
        "Rows3",
    ]
    assert calls[1]["outputSchema"]["$defs"]["Mapping"]["properties"]["sheet"]["enum"] == ["Other"]
    assert calls[0]["classes"][0]["evidence"] == []
    assert result["draft"]["classes"][0]["evidence"][0]["sheet"] == "Other"
    assert "enum" not in schema["$defs"]["Mapping"]["properties"]["sheet"]


@pytest.mark.asyncio
async def test_mapping_batch_ids_are_namespaced_without_changing_business_references(monkeypatch):
    async def config(*args):
        return {}

    async def complete(cfg, system, payload):
        if "classes" not in payload:
            return {"name": "业务", "classes": [{"id": "product"}]}
        return {
            "mappings": [
                {
                    "id": "product_map",
                    "classId": "product",
                    "sheet": payload["profile"]["sheets"][0]["name"],
                    "bindings": {"code": "编码"},
                }
            ]
        }

    monkeypatch.setattr(proposal, "provider_config", config)
    monkeypatch.setattr(proposal, "complete", complete)
    result = (
        await proposal.generate(
            None, "tenant", "token", {"sheets": [{"name": str(i)} for i in range(7)]}, "", [], []
        )
    )["draft"]
    assert len({m["id"] for m in result["mappings"]}) == 3
    assert all(
        m["classId"] == "product" and m["bindings"] == {"code": "编码"} for m in result["mappings"]
    )


@pytest.mark.asyncio
async def test_out_of_scope_mapping_gets_one_bounded_repair_then_fails_closed(monkeypatch):
    calls = []

    async def config(*args):
        return {}

    async def complete(cfg, system, payload):
        calls.append(payload)
        if "classes" not in payload:
            return {"name": "业务", "classes": [{"id": "product"}]}
        return {"mappings": [{"id": "map", "classId": "invented", "sheet": "Rows", "bindings": {}}]}

    monkeypatch.setattr(proposal, "provider_config", config)
    monkeypatch.setattr(proposal, "complete", complete)
    with pytest.raises(HTTPException) as caught:
        await proposal.generate(None, "tenant", "token", {"sheets": [{"name": "Rows"}]}, "", [], [])
    assert len(calls) == 3
    assert calls[-1]["repair"]["code"] == "mapping_unknown_class"
    assert "mapping_unknown_class" in caught.value.detail
    assert "invented" not in caught.value.detail


@pytest.mark.asyncio
async def test_mapping_repair_corrects_reference_without_repeating_global_concepts(monkeypatch):
    calls = []

    async def config(*args):
        return {}

    async def complete(cfg, system, payload):
        calls.append(payload)
        if "classes" not in payload:
            return {"name": "业务", "classes": [{"id": "product", "properties": [{"id": "code"}]}]}
        return {
            "mappings": [
                {
                    "id": "map",
                    "classId": "product",
                    "sheet": "Rows" if "repair" in payload else "Other",
                    "bindings": {"code": "编码"},
                }
            ]
        }

    monkeypatch.setattr(proposal, "provider_config", config)
    monkeypatch.setattr(proposal, "complete", complete)
    result = await proposal.generate(
        None,
        "tenant",
        "token",
        {"sheets": [{"name": "Rows", "columns": [{"name": "编码"}]}]},
        "",
        [],
        [],
    )
    assert len(calls) == 3
    assert calls[-1]["repair"]["code"] == "mapping_outside_group"
    assert result["draft"]["mappings"][0]["sheet"] == "Rows"
    assert not result["draft"]["mappings"][0]["accepted"]


@pytest.mark.parametrize(
    "bindings,code",
    [
        ({"unknown": "编码"}, "mapping_unknown_property"),
        ({"code": "猜测字段"}, "mapping_unknown_column"),
    ],
)
def test_mapping_fields_must_be_exact_source_and_class_references(bindings, code):
    with pytest.raises(proposal.MappingShapeError) as caught:
        proposal.check_mapping_batch(
            {
                "mappings": [
                    {"id": "map", "classId": "product", "sheet": "Rows", "bindings": bindings}
                ]
            },
            [{"id": "product", "properties": [{"id": "code"}]}],
            [{"name": "Rows", "columns": [{"name": "编码"}]}],
        )
    assert caught.value.code == code


@pytest.mark.asyncio
async def test_generation_resets_provider_confirmation_claims(monkeypatch):
    async def complete(*args):
        return {
            "name": "业务",
            "classes": [
                {
                    "id": "product",
                    "identity": ["code"],
                    "identityStatus": "confirmed",
                    "uniqueKeys": [{"properties": ["code"], "confirmed": True}],
                }
            ],
            "relationships": [
                {"id": "rel", "cardinality": "N:1", "cardinalityStatus": "confirmed"}
            ],
        }

    async def config(*args):
        return {}

    monkeypatch.setattr(proposal, "complete", complete)
    monkeypatch.setattr(proposal, "provider_config", config)
    result = (await proposal.generate(None, "tenant", "user", {}, "", [], []))["draft"]
    assert result["classes"][0]["identityStatus"] == "proposed"
    assert not result["classes"][0]["uniqueKeys"][0]["confirmed"]
    assert result["relationships"][0]["cardinalityStatus"] == "proposed"
    assert result["relationships"][0]["targetSelection"] == "entity"


@pytest.mark.asyncio
async def test_global_concepts_are_reused_for_all_mapping_groups(monkeypatch):
    calls = []

    async def complete(cfg, system, payload):
        calls.append(payload)
        if len(calls) == 1:
            return {
                "schemaVersion": 2,
                "name": "业务",
                "classes": [{"id": "product"}],
                "relationships": [],
                "mappings": [],
                "notes": [],
            }
        return {
            "mappings": [
                {
                    "id": "m" + str(len(calls)),
                    "classId": "product",
                    "sheet": payload["profile"]["sheets"][0]["name"],
                    "bindings": {"code": "编码"},
                }
            ]
        }

    class Client:
        async def get_provider_config(self, tenant, provider, token):
            assert (tenant, token) == ("tenant", "user-token")
            return {
                "base_url": "https://model.example/v1",
                "default_model": "model",
                "api_key": "key",
            }

    monkeypatch.setattr(proposal, "complete", complete)
    profile = {"sheets": [{"name": "表" + str(i), "columns": [{"name": "编码"}]} for i in range(9)]}
    result = await proposal.generate(
        Client(), "tenant", "user-token", profile, "业务", [], [{"rid": "native"}]
    )
    assert len(calls) == 4
    assert all(
        call["classes"] == [{"id": "product", "accepted": False, "identityStatus": "unresolved"}]
        for call in calls[1:]
    )
    assert calls[0]["existingTypes"] == [{"rid": "native"}]
    assert all(m["classId"] == "product" and not m["accepted"] for m in result["draft"]["mappings"])
    assert result["draft"]["instances"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "choice",
    [
        {"finish_reason": "length", "message": {"content": "{}"}},
        {"message": {"refusal": "refused", "content": None}},
        {"message": {"content": "not json"}},
        {"message": {"content": "[]"}},
    ],
)
async def test_provider_failure_never_becomes_successful_draft(monkeypatch, choice):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [choice]}))
    monkeypatch.setattr(
        proposal.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs)
    )
    with pytest.raises(HTTPException) as caught:
        await proposal.complete(
            {"base_url": "https://model.example/v1", "api_key": "key", "default_model": "model"},
            "system",
            {},
        )
    assert caught.value.status_code == 502
    if choice.get("finish_reason") == "length":
        assert "截断" in caught.value.detail


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "provider_id,model", [("deepseek", "deepseek-chat"), ("custom", "deepseek-flash")]
)
async def test_deepseek_json_mode_accepts_markdown_wrapped_object(monkeypatch, provider_id, model):
    original = httpx.AsyncClient

    def handler(request):
        body = json.loads(request.content)
        assert body["response_format"] == {"type": "json_object"}
        if model == "deepseek-flash":
            assert body["thinking"] == {"type": "disabled"}
            assert body["max_tokens"] == 32768
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": '说明如下：\n```json\n{"classes": []}\n```'},
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        proposal.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs)
    )
    result = await proposal.complete(
        {
            "base_url": "https://model.example/v1",
            "api_key": "key",
            "default_model": model,
            "provider_id": provider_id,
        },
        "system",
        {},
    )
    assert result == {"classes": []}


@pytest.mark.asyncio
async def test_generation_carries_exact_authoritative_draft_schema(monkeypatch):
    seen = []

    async def complete(cfg, system, payload):
        seen.append((system, payload))
        return {
            "schemaVersion": 2,
            "name": "Business",
            "classes": [{"id": "product"}],
            "relationships": [],
            "mappings": [],
            "notes": [],
        }

    class Client:
        async def get_provider_config(self, *args):
            return {
                "base_url": "https://model.example/v1",
                "default_model": "model",
                "api_key": "key",
            }

    monkeypatch.setattr(proposal, "complete", complete)
    schema = {
        "title": "Draft",
        "additionalProperties": False,
        "properties": {"schemaVersion": {"const": 2}},
    }
    await proposal.generate(Client(), "tenant", "user", {"sheets": []}, "Business", [], [], schema)
    assert seen[0][1]["outputSchema"] == schema
    assert "supplied JSON Schema" in seen[0][0]


@pytest.mark.asyncio
async def test_mapping_schema_does_not_require_regenerating_global_classes(monkeypatch):
    calls = []

    async def complete(cfg, system, payload):
        calls.append(payload)
        if len(calls) == 1:
            return {"name": "业务", "classes": [{"id": "product"}], "relationships": []}
        return {"mappings": [], "notes": []}

    async def config(*args):
        return {}

    monkeypatch.setattr(proposal, "complete", complete)
    monkeypatch.setattr(proposal, "provider_config", config)
    schema = {
        "type": "object",
        "required": ["name", "classes", "mappings"],
        "properties": {
            "name": {},
            "classes": {},
            "mappings": {"type": "array"},
            "notes": {"type": "array"},
        },
    }
    await proposal.generate(
        None, "tenant", "user", {"sheets": [{"name": "sheet"}]}, "", [], [], schema
    )
    assert calls[1]["outputSchema"]["required"] == ["mappings"]
    assert set(calls[1]["outputSchema"]["properties"]) == {"mappings", "notes"}


@pytest.mark.asyncio
async def test_global_multilevel_parent_references_survive_mapping_batches(monkeypatch):
    parents = [
        {"id": "equipment", "parentClassId": None},
        {
            "id": "machine_tool",
            "parentClassId": "equipment",
            "inheritanceReason": "Machine tools are equipment",
        },
        {
            "id": "cnc_machine_tool",
            "parentClassId": "machine_tool",
            "inheritanceReason": "CNC machine tools are machine tools",
        },
    ]
    calls = []

    async def complete(cfg, system, payload):
        calls.append(payload)
        if len(calls) == 1:
            return {
                "schemaVersion": 2,
                "name": "Equipment",
                "classes": parents,
                "relationships": [],
                "mappings": [],
                "notes": [],
            }
        assert payload["classes"][2]["parentClassId"] == "machine_tool"
        assert payload["classes"][1]["parentClassId"] == "equipment"
        return {
            "mappings": [
                {
                    "id": "mapping" + str(len(calls)),
                    "classId": "cnc_machine_tool",
                    "sheet": payload["profile"]["sheets"][0]["name"],
                    "bindings": {"code": "编码"},
                }
            ]
        }

    class Client:
        async def get_provider_config(self, *args):
            return {
                "base_url": "https://model.example/v1",
                "default_model": "model",
                "api_key": "key",
            }

    monkeypatch.setattr(proposal, "complete", complete)
    result = await proposal.generate(
        Client(),
        "tenant",
        "user",
        {"sheets": [{"name": "sheet" + str(i)} for i in range(9)]},
        "",
        [],
        [],
    )
    assert result["draft"]["classes"][2]["parentClassId"] == "machine_tool"
    assert len(result["draft"]["mappings"]) == 3
