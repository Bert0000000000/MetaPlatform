"""Drop TECH-LLMGW tables so create_all rebuilds them with the new schema.

Run once after changing LLMModelORM primary key from ``model_id`` to ``id``.
"""

import asyncio

from app.common.db import get_engine
from app.models.orm import Base


async def main() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("dropped all TECH-LLMGW tables")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
