"""Shared fixtures for the PLATFORM-K8S-01 pytest suite.

Lays out the infra/ directory in a way the test modules can rely on
without re-deriving paths. The repository root is the parent of infra/.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterator

import pytest

# Repo root is the directory three levels up from this file.
# infra/tests/conftest.py -> infra/tests -> infra -> <repo>
REPO_ROOT = Path(__file__).resolve().parents[2]
INFRA_DIR = REPO_ROOT / "infra"
HELM_DIR = INFRA_DIR / "helm"
CHARTS_DIR = HELM_DIR / "charts"


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def helm_dir() -> Path:
    return HELM_DIR


@pytest.fixture(scope="session")
def charts_dir() -> Path:
    return CHARTS_DIR


@pytest.fixture(scope="session")
def umbrella_chart(helm_dir: Path) -> Path:
    """The umbrella chart directory (containing Chart.yaml)."""
    return helm_dir


@pytest.fixture
def helm_binary() -> str | None:
    """Return the path to the helm binary or None if not installed."""
    return shutil.which("helm")


@pytest.fixture
def kubeconform_binary() -> str | None:
    """Return the path to the kubeconform binary or None if not installed."""
    return shutil.which("kubeconform")


@pytest.fixture
def helm_docs_binary() -> str | None:
    return shutil.which("helm-docs")


@pytest.fixture
def chart_yaml_paths(charts_dir: Path) -> list[Path]:
    """Every Chart.yaml in the umbrella tree, including sub-charts."""
    return sorted(charts_dir.rglob("Chart.yaml"))


@pytest.fixture
def templates_per_chart(charts_dir: Path) -> dict[str, list[Path]]:
    """Map chart name -> list of template YAML files."""
    result: dict[str, list[Path]] = {}
    for chart_yaml in charts_dir.rglob("Chart.yaml"):
        name = chart_yaml.parent.name
        tmpl = chart_yaml.parent / "templates"
        if tmpl.exists():
            result[name] = sorted(tmpl.glob("*.yaml")) + sorted(tmpl.glob("*.tpl"))
    return result
# DATA-D0-D8 D5: cross-tenant audit tests need auth module on path.
import sys as _d5_sys
from pathlib import Path as _d5_Path
_D5_AUTH_SRC = _d5_Path(__file__).resolve().parents[3] / "mate-platform-backend" / "packages" / "mate-platform" / "src"
if str(_D5_AUTH_SRC) not in _d5_sys.path:
    _d5_sys.path.insert(0, str(_D5_AUTH_SRC))
