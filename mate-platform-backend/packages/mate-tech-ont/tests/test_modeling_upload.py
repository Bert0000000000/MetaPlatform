"""Exercise actual multipart parsing, filename validation and workbook decoding."""

from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from openpyxl import Workbook

from mate_platform.tenancy.context import AuthMethod, RequestContext
from mate_tech_ont.modeling import api

PATH = "/api/v1/ont/v2/modeling/sources"
MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
# Literal wire values emitted by .NET MultipartFormDataContent for 企业 世界.xlsx.
DOTNET = (
    'form-data; name="file"; filename="=?utf-8?B?5LyB5LiaIOS4lueVjC54bHN4?="; '
    "filename*=utf-8''%E4%BC%81%E4%B8%9A%20%E4%B8%96%E7%95%8C.xlsx"
)


def workbook():
    book = Workbook()
    sheet = book.active
    sheet.title = "业务资料"
    sheet.append(["编号", "名称"])
    sheet.append(["P1", "中文产品"])
    book.create_sheet("空表").append(["备注"])
    output = BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()


def multipart(disposition, content):
    boundary = "issue142-filename-boundary"
    body = (
        (
            f"--{boundary}\r\nContent-Disposition: {disposition}\r\nContent-Type: {MIME}\r\n\r\n"
        ).encode()
        + content
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


@pytest.fixture
def client(monkeypatch):
    # Only persistence is substituted; multipart, context, workbook and profile
    # processing are the real production route. PostgreSQL readback has its own gate.
    records = []

    def create(name, owner, profile, rows, headers, content):
        records.append({"name": name, "rows": rows, "headers": headers, "content": content})
        return {"id": "test-source", "name": name, "profile": profile, "owner": owner}

    def store(request, mutate=False):
        api.context(request, mutate)
        return SimpleNamespace(create=create)

    monkeypatch.setattr(api, "store_for", store)
    app = FastAPI()

    @app.middleware("http")
    async def identity(request: Request, call_next):
        role = request.headers.get("x-test-role", "PLATFORM_ADMIN")
        if request.headers.get("x-test-anonymous") != "true":
            request.state.ctx = RequestContext(
                request_id="issue142",
                trace_id="issue142",
                tenant_id="issue142",
                user_id="admin",
                roles=frozenset({role}),
                permissions=frozenset(),
                scopes=frozenset({"platform.read", "platform.write"}),
                auth_method=AuthMethod.USER,
            )
        return await call_next(request)

    app.include_router(api.router)
    with TestClient(app) as result:
        result.records = records
        yield result


@pytest.mark.parametrize(
    ("disposition", "name"),
    [
        ('form-data; name="file"; filename="企业 世界.xlsx"', "企业 世界.xlsx"),
        ('form-data; name="file"; filename="company.xlsx"', "company.xlsx"),
        ('form-data; name="file"; filename="company world.xlsx"', "company world.xlsx"),
        ('form-data; name="file"; filename="企业.XLSX"', "企业.XLSX"),
        (DOTNET, "企业 世界.xlsx"),
        (
            'form-data; name="file"; filename="=?UTF-8?Q?=E4=BC=81=E4=B8=9A_=E4=B8=96=E7=95=8C.xlsx?="',
            "企业 世界.xlsx",
        ),
    ],
    ids=["browser-utf8", "english", "spaces", "uppercase", "dotnet-base64", "mime-q"],
)
def test_multipart_upload_preserves_decoded_name_and_chinese_workbook(client, disposition, name):
    content = workbook()
    body, headers = multipart(disposition, content)
    response = client.post(PATH, content=body, headers=headers)
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["name"] == name
    assert source["profile"]["rowCount"] == 1
    assert [(s["name"], s["rows"]) for s in source["profile"]["sheets"]] == [
        ("业务资料", 1),
        ("空表", 0),
    ]
    assert client.records == [
        {
            "name": name,
            "rows": [{"sheet": "业务资料", "row": 2, "values": {"编号": "P1", "名称": "中文产品"}}],
            "headers": {"业务资料": ["编号", "名称"], "空表": ["备注"]},
            "content": content,
        }
    ]


@pytest.mark.parametrize("filename", ["report.txt", "=?utf-8?B?cmVwb3J0LnR4dA==?="])
def test_extended_filename_cannot_override_rejected_plain_extension(client, filename):
    disposition = f'form-data; name="file"; filename="{filename}"; filename*=utf-8\'\'report.xlsx'
    body, headers = multipart(disposition, workbook())
    response = client.post(PATH, content=body, headers=headers)
    assert response.status_code == 422
    assert ".xlsx" in response.json()["detail"]
    assert client.records == []


@pytest.mark.parametrize(
    "filename",
    [
        "=?not-a-charset?B?cmVwb3J0Lnhsc3g=?=",
        "=?utf-8?B?/w==?=",
        "=?utf-8?B?A?=",
    ],
)
def test_bad_filename_encoding_has_encoding_error_and_does_not_persist(client, filename):
    body, headers = multipart(f'form-data; name="file"; filename="{filename}"', workbook())
    response = client.post(PATH, content=body, headers=headers)
    assert response.status_code == 422
    assert "编码" in response.json()["detail"]
    assert client.records == []


def test_encoded_xlsx_name_does_not_allow_invalid_content(client):
    body, headers = multipart(DOTNET, b"not a workbook")
    response = client.post(PATH, content=body, headers=headers)
    assert response.status_code == 422
    assert "xlsx 文件" in response.json()["detail"]
    assert client.records == []


def test_encoded_filename_does_not_bypass_input_size_limit(client):
    body, headers = multipart(DOTNET, b"x" * (12 * 1024 * 1024 + 1))
    response = client.post(PATH, content=body, headers=headers)
    assert response.status_code == 413
    assert client.records == []


@pytest.mark.parametrize(
    ("identity", "status"), [({"x-test-role": "USER"}, 403), ({"x-test-anonymous": "true"}, 401)]
)
def test_encoded_filename_does_not_bypass_mutation_identity(client, identity, status):
    body, headers = multipart(DOTNET, workbook())
    response = client.post(PATH, content=body, headers={**headers, **identity})
    assert response.status_code == status
    assert client.records == []
