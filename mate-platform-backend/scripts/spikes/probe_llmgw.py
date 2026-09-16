import asyncio
import pathlib
import sys

ROOT = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "packages/mate-clients/src"))
sys.path.insert(0, str(ROOT / "scripts"))
from dev_user_token import login


async def main():
    import httpx

    tok = login()
    body = {
        "provider": "openai",
        "model": "glm-5.3-flash",
        "messages": [{"role": "user", "content": "只回复两个字：收到"}],
        "temperature": 0.0,
        "tenant_id": "tenant-default",
    }
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(
            "http://localhost:8008/api/v1/llmgw/chat/real",
            json=body,
            headers={"Authorization": f"Bearer {tok}", "X-Tenant-Id": "tenant-default"},
        )
        print("HTTP", r.status_code)
        print(r.text[:600])


asyncio.run(main())
