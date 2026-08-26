"""Regression tests for tenant-scoped digital employee identities."""
from __future__ import annotations

import re


def test_custom_employee_id_uses_tenant_namespace(client, auth_headers_acme) -> None:
    response = client.post(
        "/api/v1/dw/employees",
        json={"name": "定制员工", "roleCategory": "CUSTOM"},
        headers=auth_headers_acme,
    )

    assert response.status_code == 201, response.text
    employee_id = response.json()["data"]["employeeId"]
    assert re.fullmatch(r"dw-emp-acme-\d+", employee_id), employee_id
