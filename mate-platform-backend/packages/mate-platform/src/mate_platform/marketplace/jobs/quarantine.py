"""quarantine store — 半成品/已安装路径。

默认根:`/var/lib/mate-marketplace/{quarantine,installed}`,
可用环境变量 ``MP_QUARANTINE_ROOT`` / ``MP_INSTALLED_ROOT`` 覆盖(便于本地开发/测试)。
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path

_DEFAULT_ROOT = Path(os.environ.get("MP_MARKETPLACE_ROOT", "/var/lib/mate-marketplace"))

QUARANTINE: Path = Path(
    os.environ.get("MP_QUARANTINE_ROOT", str(_DEFAULT_ROOT / "quarantine"))
)
INSTALLED: Path = Path(
    os.environ.get("MP_INSTALLED_ROOT", str(_DEFAULT_ROOT / "installed"))
)


def store(
    install_id: str,
    blob: bytes,
    *,
    kind: str,
    artifact_id: str,
    version: str,
) -> Path:
    """把 blob 落 quarantine/install_id/bundle.tar.gz。"""
    target = QUARANTINE / install_id
    target.mkdir(parents=True, exist_ok=True)
    path = target / "bundle.tar.gz"
    path.write_bytes(blob)
    return path


def commit(
    install_id: str,
    *,
    kind: str,
    artifact_id: str,
    version: str,
) -> str:
    """把 quarantine 的 bundle 移动到 installed/{kind}/{artifact_id}/{version}/。"""
    src = QUARANTINE / install_id / "bundle.tar.gz"
    if not src.exists():
        raise FileNotFoundError(src)
    dest = INSTALLED / kind / artifact_id / version
    dest.mkdir(parents=True, exist_ok=True)
    final = dest / "bundle.tar.gz"
    shutil.move(str(src), str(final))
    return str(final)


def rollback(install_id: str) -> None:
    """失败时清理 quarantine。"""
    p = QUARANTINE / install_id
    if p.exists():
        shutil.rmtree(p)