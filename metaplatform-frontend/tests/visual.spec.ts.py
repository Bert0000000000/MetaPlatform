"""Visual regression placeholder (ST-6.6.3)."""
# 视觉回归测试：P0 apps 加 snapshot
# 误报率 < 5%
import pytest


@pytest.mark.skip(reason="requires playwright visual comparison")
def test_visual_regression_placeholder() -> None:
    assert True