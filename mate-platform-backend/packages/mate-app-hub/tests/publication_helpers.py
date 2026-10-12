"""Shared saved-page publication setup for runtime behavior tests."""


def save_runtime_fixture(client, headers, code="kb", publish=True):
    from dataclasses import replace

    from mate_app_hub.repositories import in_memory as repo

    module = repo.ApphubModule(
        "fixture-" + code, "tenant-acme", "Saved", "fixture-" + code, code, "", ""
    )
    repo.put_module("tenant-acme", module)
    repo.put_page(
        "tenant-acme",
        replace(
            repo.ApphubPage(
                "fixture-" + code, "tenant-acme", "Saved", "fixture-" + code, module.code, "grid"
            ),
            definition={"widgets": [{"id": "saved", "type": "text"}]},
        ),
    )
    if publish:
        result = client.post("/api/v1/apphub/apps/" + code + "/publish", headers=headers)
        assert result.status_code == 200, result.text
    return repo.get_app("tenant-acme", code).id
