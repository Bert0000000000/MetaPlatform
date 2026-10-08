"""Record exact pytest identities without persisting configuration/environment."""

import json
import os
from pathlib import Path


def pytest_collection_modifyitems(items):
    for item in items:
        item.user_properties.append(("ont_required_nodeid", item.nodeid))


def pytest_collection_finish(session):
    manifest = os.environ.get("ONT_REQUIRED_COLLECTION_PATH")
    if manifest:
        Path(manifest).write_text(
            json.dumps({"nodeids": [item.nodeid for item in session.items]}, indent=2),
            encoding="utf-8",
        )
