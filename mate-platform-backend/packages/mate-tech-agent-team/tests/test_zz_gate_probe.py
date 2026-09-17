"""临时探针：证明 agent-team 门禁真卡。稍后即 revert，不留在分支上。"""


def test_deliberately_red() -> None:
    assert False, "人为弄红：证明 agent-team 套件的失败会真的把 CI 弄红"
