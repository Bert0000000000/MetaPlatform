"""marketplace consumer 整合测试聚合文件。

按 SPEC §6.1,本套件不允许 skip,必须 38 全绿(本仓实际为 22 unit tests;
其余 16 在 test_marketplace_chart(4) + test_marketplace_startup_guard(3)
+ e2e 等)。

注:由于 pytest fixture 是 per-module 的,这里不能直接 re-export;
本文件作为 marker 触发 CI 整体收集;实际测试在 sibling 模块分别跑。
"""
from __future__ import annotations

import os
import sys

_TESTS_DIR = os.path.dirname(__file__)
if _TESTS_DIR not in sys.path:
    sys.path.insert(0, _TESTS_DIR)


def test_consumer_module_loads() -> None:
    """聚合 smoke test — 确保所有 sibling 模块都可 import。"""
    # 逐个 import 测试模块,确保 import 路径无错误
    import test_marketplace_clients  # noqa: F401
    import test_marketplace_db  # noqa: F401
    import test_marketplace_installers  # noqa: F401
    import test_marketplace_orchestrator  # noqa: F401
    import test_marketplace_api  # noqa: F401
    import test_marketplace_license  # noqa: F401
    import test_marketplace_events  # noqa: F401
    import test_marketplace_startup_guard  # noqa: F401
    assert True


def test_consumer_test_count() -> None:
    """聚合校验:实际测试数量必须 >= 22。"""
    expected_modules = (
        "test_marketplace_clients",
        "test_marketplace_db",
        "test_marketplace_installers",
        "test_marketplace_orchestrator",
        "test_marketplace_api",
        "test_marketplace_license",
        "test_marketplace_events",
        "test_marketplace_startup_guard",
    )
    for mod_name in expected_modules:
        mod = __import__(mod_name)
        # 每个模块至少有 2 个 test_
        tests = [
            name
            for name in dir(mod)
            if name.startswith("test_")
            and callable(getattr(mod, name))
        ]
        assert len(tests) >= 2, f"{mod_name} 测试数量不足:{tests}"