"""Use the existing service entry points against this image's source snapshot."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

sources = sorted(Path("/app/packages").glob("*/src"))
sources += sorted(Path("/app/services").glob("*/src"))
os.environ["PYTHONPATH"] = os.pathsep.join(str(path) for path in sources)
if len(sys.argv) < 2:
    raise SystemExit("Supply the existing service command, such as uvicorn module:app ...")
# These services share the metadata database. Complete the additive upgrade
# under its transaction lock before reporting healthy or reading legacy rows.
if (
    len(sys.argv) >= 3
    and sys.argv[1] == "uvicorn"
    and sys.argv[2]
    in {
        "mate_app_hub.main:app",
        "mate_tech_mcp.main:app",
    }
):
    subprocess.run([sys.executable, "/app/demo/configure_schema.py"], check=True)
os.execvp(sys.argv[1], sys.argv[1:])  # noqa: S606 - exec the trusted Compose service entrypoint
