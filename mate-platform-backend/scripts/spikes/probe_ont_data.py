import asyncio
import pathlib
import sys

ROOT = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "packages/mate-clients/src"))
sys.path.insert(0, str(ROOT / "scripts"))
from dev_user_token import login

from mate_clients.ontology import OntAgentToolsClient


async def main():
    c = OntAgentToolsClient("http://localhost:8007", token=login(), tenant_id="tenant-default")
    try:
        classes = await c.list_classes(limit=200)
        rids = [t["rid"] for t in classes]
        print("scanning", len(rids), "classes…")
        for rid in rids:
            try:
                r = await c.object_query({"source": rid, "paging_limit": 3})
                rows = r.get("rows") or []
                if rows:
                    print(f"NON-EMPTY {rid}  rows={len(rows)}")
                    print("   sample:", str(rows[0])[:240])
            except Exception:
                pass
    finally:
        await c.aclose()


asyncio.run(main())
