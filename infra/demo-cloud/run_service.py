"""Use the existing service entry points against this image's source snapshot."""

from __future__ import annotations

import os
import sys
from pathlib import Path

sources = sorted(Path("/app/packages").glob("*/src"))
sources += sorted(Path("/app/services").glob("*/src"))
os.environ["PYTHONPATH"] = os.pathsep.join(str(path) for path in sources)
if len(sys.argv) < 2:
    raise SystemExit("Supply the existing service command, such as uvicorn module:app ...")
os.execvp(sys.argv[1], sys.argv[1:])  # noqa: S606 - exec the trusted Compose service entrypoint
