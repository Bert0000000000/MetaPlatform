"""一次性验证夹具：故意让 ruff 报错，验证 required check 真的卡得住。"""

import os  # noqa: F401  -> 故意未使用，ruff F401


def keep() -> None:
    return None
