"""Seed the isolated demo tenant and apply the repository's existing ontology RLS."""

from __future__ import annotations

import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
COMPOSE = [
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


def main() -> None:
    # Empty default tenant keeps unscoped maintenance/restart connections fail-closed.
    subprocess.run(
        [
            *COMPOSE,
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "meta",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input="ALTER DATABASE metaplatform SET app.tenant_id = '';\nALTER DATABASE metaplatform_ont SET app.tenant_id = '';\n",
        text=True,
        cwd=ROOT,
        check=True,
    )
    code = """
import os, sys
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
from mate_tech_ont.v2_kernel.seed import seed_demo, backfill_action_display
dsn = os.environ['KERNEL_PG_DSN']
repo = PgOntologyRepository(dsn=dsn)
with repo.tenant_scope('tenant-default'):
    demo = seed_demo(repo)
    backfill_action_display(repo)
print('Tenant-scoped core demo seed:', demo)
scope = {'__name__': 'demo_rls_bootstrap'}
exec(compile(sys.stdin.read(), 'scripts/ont/apply_rls.py', 'exec'), scope)
raise SystemExit(scope['apply_rls'](dsn))
"""
    # Call apply_rls() directly; its CLI main prints the DSN including the password.
    source = (ROOT / "scripts/ont/apply_rls.py").read_text(encoding="utf-8-sig")
    subprocess.run(
        [
            *COMPOSE,
            "exec",
            "-T",
            "mate-tech-ont",
            "python",
            "/app/demo/run_service.py",
            "python",
            "-c",
            code,
        ],
        input=source,
        text=True,
        cwd=ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
