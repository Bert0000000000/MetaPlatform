import pytest
from fastapi import HTTPException

from mate_tech_ont.modeling import assistant_client

from .test_modeling_core import draft


@pytest.mark.asyncio
@pytest.mark.parametrize('terminal', ['result', 'missing', 'error'])
async def test_generation_stream_forwards_progress_and_requires_terminal_result(monkeypatch, terminal):
    import httpx
    import json
    original = httpx.AsyncClient
    events = [{'type':'progress','progress':{'stage':'mapping','batch':1,'totalBatches':2}}]
    if terminal == 'result':
        events.append({'type':'result','result':{'draft':{}}})
    elif terminal == 'error':
        events.append({'type':'error','status':502,'detail':'unexpected-secret-provider-response'})

    def handler(request):
        assert request.headers['Accept'] == 'text/event-stream'
        return httpx.Response(200, headers={'content-type':'text/event-stream'}, text=''.join('data: ' + json.dumps(event) + '\n\n' for event in events))

    monkeypatch.setattr(assistant_client.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    seen = []
    async def progress(value):
        seen.append(value)
    token = assistant_client.generation_progress.set(progress)
    try:
        if terminal == 'result':
            assert await assistant_client._post('generate', {}, 'Bearer user', 'tenant') == {'draft':{}}
        else:
            with pytest.raises(HTTPException) as caught:
                await assistant_client._post('generate', {}, 'Bearer user', 'tenant')
            assert '草稿未修改' in caught.value.detail
            assert 'secret' not in caught.value.detail
        assert seen == [events[0]['progress']]
    finally:
        assistant_client.generation_progress.reset(token)


@pytest.mark.asyncio
@pytest.mark.parametrize('operation,sheets,expected', [('generate', 1, 600), ('generate', 25, 2040), ('review', 25, 600)])
async def test_multi_batch_generation_gets_a_bounded_read_budget(monkeypatch, operation, sheets, expected):
    import httpx
    original = httpx.AsyncClient
    observed = []

    def client(**kwargs):
        observed.append(kwargs['timeout'])
        return original(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={})), **kwargs)

    monkeypatch.setattr(assistant_client.httpx, 'AsyncClient', client)
    await assistant_client._post(operation, {'profile':{'sheets':[{}] * sheets}}, 'Bearer user', 'tenant')
    assert observed[0].read == expected
    assert observed[0].connect == 15


@pytest.mark.asyncio
@pytest.mark.parametrize('failure,expected', [('timeout', '等待超时'), ('connect', '无法连接'), ('invalid', '无效响应')])
async def test_service_transport_failures_have_distinct_safe_messages(monkeypatch, failure, expected, caplog):
    import httpx
    original = httpx.AsyncClient

    def handler(request):
        if failure == 'timeout':
            raise httpx.ReadTimeout('secret-url', request=request)
        if failure == 'connect':
            raise httpx.ConnectError('secret-url', request=request)
        return httpx.Response(200, text='secret-body')

    monkeypatch.setattr(assistant_client.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    with pytest.raises(HTTPException) as caught:
        await assistant_client._post('generate', {}, 'Bearer user', 'tenant')
    assert expected in caught.value.detail
    assert '草稿未修改' in caught.value.detail
    assert 'secret' not in caught.value.detail + caplog.text


@pytest.mark.asyncio
async def test_provider_review_claims_are_only_candidates(monkeypatch):
    value = draft()
    value["classes"][0].update(
        identityStatus="confirmed",
        uniqueKeys=[{"properties": ["name"], "confirmed": True}],
    )
    value["classes"][1]["identityStatus"] = "source-record"
    value["relationships"][0].update(cardinality="N:1", cardinalityStatus="confirmed")

    async def post(*args):
        return {"draft": value}

    monkeypatch.setattr(assistant_client, "_post", post)
    result = await assistant_client.generate({}, "", [], [], "user", "tenant")
    assert result["classes"][0]["identityStatus"] == "proposed"
    assert result["classes"][1]["identityStatus"] == "unresolved"
    assert not result["classes"][0]["uniqueKeys"][0]["confirmed"]
    assert result["relationships"][0]["cardinalityStatus"] == "proposed"
    assert result["relationships"][0]["targetSelection"] == "entity"


@pytest.mark.asyncio
async def test_old_provider_shape_is_new_unreviewed_generation(monkeypatch):
    async def post(*args):
        return {"draft": draft()}

    monkeypatch.setattr(assistant_client, "_post", post)
    result = await assistant_client.generate({}, "", [], [], "user", "tenant")
    assert [c["identityStatus"] for c in result["classes"]] == ["proposed", "unresolved"]
    assert result["relationships"][0]["cardinalityStatus"] == "unresolved"


@pytest.mark.asyncio
async def test_candidate_cannot_auto_approve_or_insert_manual_facts(monkeypatch):
    value = draft()
    value["classes"][0]["included"] = False
    value["relationships"][0]["included"] = False

    async def post(*args):
        return {"draft": value}

    monkeypatch.setattr(assistant_client, "_post", post)
    result = await assistant_client.generate({}, "", [], [], "Bearer user", "tenant")
    assert result["classes"][0]["included"] is True
    assert result["relationships"][0]["included"] is True
    assert all(
        not item["accepted"]
        for family in ("classes", "mappings", "relationships")
        for item in result[family]
    )
    value["instances"] = [{"id": "manual", "classId": "product", "values": {"code": "invented"}}]
    with pytest.raises(HTTPException) as caught:
        await assistant_client.generate({}, "", [], [], "Bearer user", "tenant")
    assert caught.value.status_code == 502


@pytest.mark.asyncio
async def test_service_forwards_only_current_caller_headers(monkeypatch):
    import httpx

    original = httpx.AsyncClient
    captured = []

    def respond(request):
        captured.append(request)
        return httpx.Response(200, json={"draft": draft()})

    monkeypatch.setenv("MODELING_COPILOT_URL", "http://127.0.0.1:9861")
    monkeypatch.setattr(
        assistant_client.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    await assistant_client.generate({}, "", [], [], "Bearer user", "tenant")
    assert str(captured[0].url) == "http://127.0.0.1:9861/api/v1/copilot/modeling/generate"
    assert captured[0].headers["authorization"] == "Bearer user"
    assert captured[0].headers["x-tenant-id"] == "tenant"
    assert "Bearer user" not in captured[0].content.decode()


@pytest.mark.asyncio
async def test_review_rejects_invented_model_target(monkeypatch):
    async def post(*args):
        return {
            "review": {
                "summary": "review",
                "issues": [
                    {
                        "id": "i1",
                        "severity": "warning",
                        "target": "class:invented",
                        "category": "identity",
                        "message": "uncertain",
                    }
                ],
                "coverage": [],
            }
        }

    monkeypatch.setattr(assistant_client, "_post", post)
    with pytest.raises(HTTPException) as caught:
        await assistant_client.review({"sheets": []}, draft(), {}, "Bearer user", "tenant")
    assert caught.value.status_code == 502


@pytest.mark.asyncio
async def test_review_requires_every_business_question(monkeypatch):
    value = draft()
    value["semantics"] = {"questions": [{"id": "q1", "question": "Which products exist?"}]}

    async def post(*args):
        return {"review": {"summary": "review", "issues": [], "coverage": []}}

    monkeypatch.setattr(assistant_client, "_post", post)
    with pytest.raises(HTTPException):
        await assistant_client.review({"sheets": []}, value, {}, "Bearer user", "tenant")


@pytest.mark.asyncio
async def test_authoritative_questions_and_context_are_preserved(monkeypatch):
    value = draft()
    value["semantics"] = {
        "context": "model-changed context",
        "questions": [{"id": "invented", "question": "wrong question"}],
    }
    seen = []

    async def post(operation, payload, *args):
        seen.append(payload)
        return {"draft": value}

    monkeypatch.setattr(assistant_client, "_post", post)
    questions = [{"id": "user_q1", "question": "Which products exist?", "expected": "Products"}]
    result = await assistant_client.generate(
        {}, "User business context", questions, [], "Bearer user", "tenant"
    )
    assert seen[0]["outputSchema"]["title"] == "Draft"
    assert result["semantics"]["context"] == "User business context"
    assert result["semantics"]["questions"] == questions


@pytest.mark.asyncio
async def test_malformed_provider_output_has_safe_field_diagnostics(monkeypatch):
    value = draft()
    value["classes"][0]["properties"][0]["dataType"] = "secret-sensitive-invalid-value"

    async def post(*args):
        return {"draft": value}

    monkeypatch.setattr(assistant_client, "_post", post)
    with pytest.raises(HTTPException) as caught:
        await assistant_client.generate({}, "", [], [], "Bearer user", "tenant")
    assert "classes.0.properties.0.dataType" in caught.value.detail
    assert "secret-sensitive" not in caught.value.detail


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "detail,is_safe",
    [
        ("AI 建模结果不符合结构或跨表概念约束，草稿未修改", True),
        ("无法连接 AI 模型服务，自动重试后仍失败，请检查服务地址和网络；草稿未修改", True),
        ("AI 模型服务响应超时，请稍后重试；草稿未修改", True),
        ("AI 建模结果不符合结构或跨表概念约束，草稿未修改（mapping_unknown_class：映射引用了全局候选中不存在的对象类型）", True),
        ("AI 建模结果不符合结构或跨表概念约束，草稿未修改（mapping_unknown_class：secret-value）", False),
        ("unexpected-secret-provider-response", False),
    ],
)
async def test_only_curated_service_errors_are_exposed(monkeypatch, detail, is_safe):
    import httpx

    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(502, json={"detail": detail}))
    monkeypatch.setattr(
        assistant_client.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=transport, **kwargs),
    )
    with pytest.raises(HTTPException) as caught:
        await assistant_client._post("generate", {}, "Bearer user", "tenant")
    assert caught.value.status_code == 502
    assert (detail in caught.value.detail) == is_safe
