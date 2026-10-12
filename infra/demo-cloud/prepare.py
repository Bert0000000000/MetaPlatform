"""Create isolated demo configuration and export the frozen runtime dependencies."""

from __future__ import annotations

import argparse
import json
import secrets
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SERVICES = (
    "mate-tech-dw",
    "mate-tech-rag",
    "mate-tech-agent",
    "mate-app-kb",
    "mate-tech-llmgw",
    "mate-app-copilot",
    "mate-app-arch",
    "mate-app-hub",
    "mate-tech-data",
    "mate-app-a2a",
    "mate-tech-orchestrator",
    "mate-tech-agent-team",
    "mate-tech-ont",
    "mate-tech-msg",
    "mate-tech-mcp",
    "mate-tech-etl",
    "mate-tech-scheduler",
    "mate-tech-metrics",
    "mate-api-gateway",
    "mate-auth-service",
)


def export_runtime() -> None:
    artifacts = HERE / "artifacts"
    artifacts.mkdir(exist_ok=True)
    command = [
        "uv",
        "export",
        "--frozen",
        "--no-dev",
        "--no-emit-workspace",
        "--no-hashes",
        "--no-annotate",
        "--no-header",
    ]
    for package in SERVICES:
        command += ["--package", package]
    command += ["--output-file", str(artifacts / "requirements.txt")]
    subprocess.run(
        command, cwd=ROOT / "mate-platform-backend", check=True, stdout=subprocess.DEVNULL
    )
    print("Exported runtime dependencies from mate-platform-backend/uv.lock.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--http-port", type=int, default=8080)
    parser.add_argument("--project", default="metaplatform-demo")
    parser.add_argument("--skip-export", action="store_true")
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="CI: export dependencies without creating credentials",
    )
    args = parser.parse_args()
    if not 1 <= args.http_port <= 65535:
        parser.error("HTTP port must be between 1 and 65535")
    if args.export_only:
        if args.skip_export:
            parser.error("--export-only cannot be combined with --skip-export")
        export_runtime()
        return

    private = HERE / "private"
    private.mkdir(exist_ok=True)
    private.chmod(0o700)
    env_path = private / ".env"
    if not env_path.exists():
        if (ROOT / ".git").exists():
            revision = subprocess.check_output(
                [shutil.which("git"), "rev-parse", "HEAD"], cwd=ROOT, text=True
            ).strip()
        else:
            revision = (HERE / "artifacts/source-revision.txt").read_text(encoding="utf-8").strip()
        config = {
            "COMPOSE_PROJECT_NAME": args.project,
            "DEMO_BACKEND_IMAGE": f"metaplatform-demo-backend:{revision}",
            "DEMO_FRONTEND_IMAGE": f"metaplatform-demo-web:{revision}",
            "DEMO_HTTP_PORT": str(args.http_port),
            "DEMO_BIND_ADDRESS": "127.0.0.1",
            "POSTGRES_USER": "meta",
            "POSTGRES_PASSWORD": secrets.token_hex(24),
            "ONT_APP_USER": "mate_app",
            "ONT_APP_PASSWORD": secrets.token_hex(24),
            "KEYCLOAK_ADMIN": "cloud-admin",
            "KEYCLOAK_ADMIN_PASSWORD": secrets.token_hex(24),
            "KEYCLOAK_CLIENT_SECRET": secrets.token_hex(24),
            "MCP_TENANT_PROXY_CLIENT_SECRET": secrets.token_hex(24),
            "AGENT_TEAM_RUNTIME_CLIENT_ID": "agent-team-runtime",
            "AGENT_TEAM_RUNTIME_CLIENT_SECRET": secrets.token_hex(24),
            "MINIO_ROOT_USER": "meta-demo",
            "MINIO_ROOT_PASSWORD": secrets.token_hex(24),
            "NEO4J_USER": "neo4j",
            "NEO4J_PASSWORD": secrets.token_hex(24),
        }
        # Generate a fresh private realm. Never deploy the repository's known passwords.
        realm = json.loads(
            (ROOT / "infra/keycloak/realm-mate.json").read_text(encoding="utf-8-sig")
        )
        client_secrets = {
            "metaplatform-backend": config["KEYCLOAK_CLIENT_SECRET"],
            "mcp-tenant-proxy": config["MCP_TENANT_PROXY_CLIENT_SECRET"],
            "agent-team-runtime": config["AGENT_TEAM_RUNTIME_CLIENT_SECRET"],
        }
        for client in realm["clients"]:
            if client["clientId"] in client_secrets:
                client["secret"] = client_secrets[client["clientId"]]
        accounts = []
        for user in realm.get("users", []):
            password = secrets.token_urlsafe(24)
            user["credentials"] = [{"type": "password", "value": password, "temporary": False}]
            accounts.append({"username": user["username"], "password": password})
        for filename, value in [("realm-mate.json", realm), ("demo-accounts.json", accounts)]:
            (private / filename).write_text(json.dumps(value, indent=2), encoding="utf-8")
            (private / filename).chmod(0o600)
        env_path.write_text(
            "".join(f"{key}={value}\n" for key, value in config.items()), encoding="utf-8"
        )
        env_path.chmod(0o600)
        print(f"Created private configuration in {private}; credentials are not printed.")
    else:
        if not (private / "realm-mate.json").exists():
            raise SystemExit(
                "Existing environment has no realm file; restore its private configuration."
            )
        print("Existing private configuration preserved.")

    if not args.skip_export:
        export_runtime()
    elif not (HERE / "artifacts/requirements.txt").exists():
        raise SystemExit(
            "No exported requirements found; prepare the source bundle on the build machine first."
        )


if __name__ == "__main__":
    main()
