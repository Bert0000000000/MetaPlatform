"""Verify the deployed demo through real login, gateway, ontology and PostgreSQL."""

from __future__ import annotations

import argparse
import base64
import json
import secrets
import subprocess
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TENANT = "tenant-default"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def verify_platform_access(call, claims: dict, checks: list) -> None:
    scope = claims.get("scope")
    require(
        isinstance(scope, str) and {"platform.read", "platform.write"} <= set(scope.split()),
        "Administrator token is missing required platform scopes",
    )
    username = claims.get("preferred_username")
    session = claims.get("sid") or claims.get("session_state")
    client = claims.get("azp")
    require(
        all(
            isinstance(value, str) and bool(value.strip()) for value in (username, session, client)
        ),
        "Login token is missing signed human identity metadata",
    )
    checks.append("Keycloak platform read/write scopes and signed human identity metadata verified")
    call("GET", "/api/v1/data/sources")
    checks.append("Data sources read through gateway")
    call("GET", "/api/v1/apphub/apps")
    checks.append("AppHub applications read through gateway")


def verify_sparql_boundary(call, checks: list) -> None:
    """Read-only, authenticated probes for the legacy execution and explain routes."""
    supported = 'SELECT ?FILTER WHERE { ?FILTER <urn:issue131:OPTIONAL> "FILTER" } LIMIT 1'
    unsupported = (
        ("FILTER", "SELECT ?s WHERE { ?s rdf:type ?o.FILTER(?o = ?o) }"),
        ("OPTIONAL", "SELECT ?s WHERE { ?s rdf:type ?o.OPTIONAL { ?s label ?v } }"),
    )
    for path in ("/api/v1/ont/sparql", "/api/v1/ont/explain"):
        call("POST", path, {"query": supported}, authenticated=False, expected=(401,))
        for keyword, query in unsupported:
            result = call("POST", path, {"query": query}, expected=(400,))
            require(
                isinstance(result, dict)
                and result.get("detail") == f"Parse failed: Unsupported SPARQL syntax: {keyword}",
                "Legacy SPARQL syntax error does not identify the unsupported keyword",
            )
        result = call("POST", path, {"query": supported}, expected=(200,))
        if path.endswith("/sparql"):
            require(
                isinstance(result, dict) and isinstance(result.get("bindings"), list),
                "Legacy SPARQL SELECT bindings are missing",
            )
        else:
            require(
                isinstance(result, dict) and result.get("variables") == ["FILTER"],
                "Legacy SPARQL EXPLAIN projection changed",
            )
    checks.append(
        "Legacy SPARQL/EXPLAIN: anonymous 401, FILTER/OPTIONAL 400, keyword RDF terms 200 verified"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument(
        "--read-only",
        action="store_true",
        help="Read the prior verification records after a restart.",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    checks = []
    token = ""

    def call(
        method: str, path: str, body=None, *, authenticated=True, headers=None, expected=(200, 201)
    ):
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        if authenticated and token:
            request_headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(
            base + path,
            data=None if body is None else json.dumps(body).encode("utf-8"),
            headers=request_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        require(
            status in expected,
            f"{method} {path}: HTTP {status}: {raw.decode('utf-8', errors='replace')[:500]}",
        )
        return json.loads(raw) if raw else None

    call("GET", "/api/v1/ont/v2/object-types", authenticated=False, expected=(401, 403))
    checks.append("anonymous ontology request rejected")
    accounts = json.loads((HERE / "private/demo-accounts.json").read_text(encoding="utf-8"))
    account = next(value for value in accounts if value["username"] == "admin")
    login = call("POST", "/api/v1/iam/auth/login", account, authenticated=False)
    token = login.get("accessToken") or login.get("token")
    require(bool(token), "Login returned no access token")
    encoded = token.split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
    require(claims.get("tenant_id") == TENANT, "Login tenant does not match the demo tenant")
    require(bool(claims.get("sub")), "Login token has no subject")
    checks.append("Keycloak login through gateway with tenant-bound subject")
    verify_platform_access(call, claims, checks)
    verify_sparql_boundary(call, checks)

    state_path = HERE / "artifacts/acceptance-state.json"
    if args.read_only:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    else:
        namespace = (
            "cloud-demo-" + datetime.now(UTC).strftime("%Y%m%d%H%M%S") + "-" + secrets.token_hex(2)
        )
        state = {
            "object_rid": f"ont.{TENANT}.obj.{namespace}.v1",
            "id_rid": f"ont.{TENANT}.prop.{namespace}-id.v1",
            "title_rid": f"ont.{TENANT}.prop.{namespace}-title.v1",
            "individual_rid": f"ont.{TENANT}.ind.{namespace}.demo-1",
            "title": "Tencent cloud demo persistence verification",
            "display_name": namespace,
        }
        schema = {
            "rid": state["object_rid"],
            "display_name": state["display_name"],
            "confirm_name": state["display_name"],
            "primary_key": [state["id_rid"]],
            "properties": [
                {
                    "rid": state["id_rid"],
                    "type_id": "string",
                    "primary_key": True,
                    "nullable": False,
                    "title": "ID",
                    "format": "string",
                },
                {
                    "rid": state["title_rid"],
                    "type_id": "string",
                    "primary_key": False,
                    "nullable": True,
                    "title": "Title",
                    "format": "string",
                },
            ],
            "interfaces": [],
            "parent_class": "",
        }
        call("POST", "/api/v1/ont/v2/object-types", schema)
        checks.append("ontology object type written through gateway")
        other = dict(schema, rid=state["object_rid"].replace(TENANT, "other-tenant"))
        call("POST", "/api/v1/ont/v2/object-types", other, expected=(403,))
        checks.append("cross-tenant ontology write rejected")
        proposal = call(
            "POST",
            f"/api/v1/ont/v2/classes/{state['object_rid']}/propose-instance",
            {
                "props": {namespace + "-id": "demo-1", namespace + "-title": state["title"]},
                "impact_summary": "Dedicated synthetic cloud deployment verification record",
            },
        )
        require(
            proposal.get("preflight", {}).get("blocked") is False,
            "Instance proposal preflight was blocked",
        )
        state["proposal_id"] = proposal["proposal_id"]
        for operation in ("confirm", "execute"):
            call(
                "POST",
                f"/api/v1/ont/v2/proposals/{state['proposal_id']}/{operation}",
                {},
                headers={"Idempotency-Key": namespace + "-" + operation},
            )
        checks.append("instance proposal confirmed and executed")
        state_path.parent.mkdir(exist_ok=True)
        state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")

    saved_type = call("GET", "/api/v1/ont/v2/object-types/" + state["object_rid"])
    require(saved_type["display_name"] == state["display_name"], "Object type read-back mismatch")
    individual = call("GET", "/api/v1/ont/v2/individuals/" + state["individual_rid"])
    require(individual["tenant_id"] == TENANT, "Individual tenant mismatch")
    require(
        individual["props"].get(state["title_rid"]) == state["title"],
        "Individual property read-back mismatch",
    )
    proposal = call("GET", "/api/v1/ont/v2/proposals/" + state["proposal_id"])
    require(proposal["status"] == "executed", "Proposal terminal state was not persisted")
    checks.append("object type, individual and executed proposal read back")

    # Check the real application role and tenant visibility without exposing its password.
    compose = [
        "sudo",
        "-n",
        "docker",
        "compose",
        "--env-file",
        "infra/demo-cloud/private/.env",
        "-f",
        "docker-compose.yml",
        "-f",
        "infra/demo-cloud/compose.yml",
    ]
    sql = f"""
SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user;
SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='ont_individual'::regclass;
BEGIN;
SET LOCAL app.tenant_id='{TENANT}';
SELECT count(*) FROM ont_individual WHERE rid='{state["individual_rid"]}';
ROLLBACK;
BEGIN;
SET LOCAL app.tenant_id='other-tenant';
SELECT count(*) FROM ont_individual WHERE rid='{state["individual_rid"]}';
ROLLBACK;
"""
    result = subprocess.run(
        [
            *compose,
            "exec",
            "-T",
            "postgres",
            "sh",
            "-c",
            'PGPASSWORD="$ONT_APP_PASSWORD" exec psql -h 127.0.0.1 -U mate_app -d metaplatform_ont -v ON_ERROR_STOP=1 -qAt',
        ],
        input=sql,
        text=True,
        capture_output=True,
        cwd=ROOT,
        check=True,
    )
    rows = result.stdout.strip().splitlines()
    require(
        rows == ["mate_app|f|f", "t|t", "1", "0"],
        f"Unexpected PostgreSQL role/RLS verification: {rows}",
    )
    checks.append(
        "PostgreSQL NOSUPERUSER/NOBYPASSRLS role, forced RLS and tenant visibility verified"
    )

    report = {
        "verified_at": datetime.now(UTC).isoformat(),
        "phase": "after-restart" if args.read_only else "initial-write",
        "base_url": base,
        "tenant_id": TENANT,
        "subject": claims["sub"],
        "object_rid": state["object_rid"],
        "individual_rid": state["individual_rid"],
        "proposal_id": state["proposal_id"],
        "checks": checks,
    }
    report_path = (
        HERE
        / "artifacts"
        / ("acceptance-after-restart.json" if args.read_only else "acceptance-initial.json")
    )
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
