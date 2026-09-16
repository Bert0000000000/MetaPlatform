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
    c = OntAgentToolsClient("http://localhost:8007", token=login(), tenant_id="tenant-default")
    try:
        r = await c.object_query(
            {"source": "ont.tenant-default.obj.crm.contract.v1", "paging_limit": 5}
        )
        print("object_query OK:", json.dumps(r, ensure_ascii=False)[:500])
        r2 = await c.object_query(
            {
                "source": "ont.tenant-default.obj.crm.contract.v1",
                "aggregation": {"group_by": [], "metrics": [{"op": "count", "field": "*"}]},
            }
        )
        print("aggregation:", json.dumps(r2, ensure_ascii=False)[:300])
    except Exception as e:
        print("FAILED:", type(e).__name__, e)
    finally:
        await c.aclose()


asyncio.run(main())
