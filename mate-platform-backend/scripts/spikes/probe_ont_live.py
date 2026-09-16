import asyncio
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "packages/mate-clients/src"))
sys.path.insert(0, str(ROOT / "scripts"))
from dev_user_token import login

from mate_clients.ontology import OntAgentToolsClient


async def main():
    tok = login()
    print("token len:", len(tok))
    c = OntAgentToolsClient("http://localhost:8007", token=tok, tenant_id="tenant-default")
    try:
        try:
            classes = await c.list_classes(limit=50)
            print("object-types OK, n =", len(classes) if isinstance(classes, list) else classes)
            if isinstance(classes, list) and classes:
                print("  sample:", json.dumps(classes[0], ensure_ascii=False)[:260])
        except Exception as e:
            print("object-types FAILED:", e)
        try:
            tools = await c.list_agent_tools()
            names = [t["name"] for t in tools]
            print("agent-tools OK, n =", len(names))
            print("  query_*:", [n for n in names if n.startswith("query_")][:8])
        except Exception as e:
            print("agent-tools FAILED:", e)
    finally:
        await c.aclose()


asyncio.run(main())
