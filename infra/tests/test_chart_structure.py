"""Verify the umbrella + sub-chart structural invariants.

These checks run without helm / kubectl and act as a static smoke test.
The real helm lint / kubeconform / helm-unittest runs in CI.
"""
from __future__ import annotations

from pathlib import Path

import yaml

REQUIRED_TOP_LEVEL_FILES = {
    "Chart.yaml",
    "values.yaml",
    "values-local.yaml",
    "values-staging.yaml",
    "values-production.yaml",
    ".helmignore",
}

REQUIRED_SUB_CHARTS = {
    "otel-collector",
    "keycloak",
    "kafka",
    "network-policies",
    "service-templates",
    "debezium",
    "marquez",
    "datahub",
    "ge",
}


class TestUmbrellaLayout:
    def test_umbrella_chart_yaml_exists(self, helm_dir: Path) -> None:
        assert (helm_dir / "Chart.yaml").is_file(), "umbrella Chart.yaml missing"

    def test_all_required_top_level_files_present(self, helm_dir: Path) -> None:
        present = {p.name for p in helm_dir.iterdir() if p.is_file()}
        missing = REQUIRED_TOP_LEVEL_FILES - present
        assert not missing, f"umbrella missing files: {missing}"

    def test_helpers_template_exists(self, helm_dir: Path) -> None:
        helpers = helm_dir / "templates" / "_helpers.tpl"
        assert helpers.is_file()
        content = helpers.read_text(encoding="utf-8")
        for required in [
            "metaplatform.name",
            "metaplatform.fullname",
            "metaplatform.labels",
            "metaplatform.selectorLabels",
            "metaplatform.image",
        ]:
            assert required in content, f"helper template {required} missing"


class TestUmbrellaChartYaml:
    def test_api_version(self, helm_dir: Path) -> None:
        data = yaml.safe_load((helm_dir / "Chart.yaml").read_text(encoding="utf-8"))
        assert data["apiVersion"] == "v2"

    def test_chart_type(self, helm_dir: Path) -> None:
        data = yaml.safe_load((helm_dir / "Chart.yaml").read_text(encoding="utf-8"))
        assert data["type"] == "application"

    def test_dependencies_present(self, helm_dir: Path) -> None:
        data = yaml.safe_load((helm_dir / "Chart.yaml").read_text(encoding="utf-8"))
        deps = data.get("dependencies", [])
        names = {d["name"] for d in deps}
        assert names == REQUIRED_SUB_CHARTS, (
            f"expected {REQUIRED_SUB_CHARTS}, got {names}"
        )

    def test_dependencies_have_conditions(self, helm_dir: Path) -> None:
        data = yaml.safe_load((helm_dir / "Chart.yaml").read_text(encoding="utf-8"))
        for dep in data.get("dependencies", []):
            assert "condition" in dep, f"dep {dep['name']} has no condition"
            assert "version" in dep, f"dep {dep['name']} has no version"


class TestSubChartLayout:
    def test_required_sub_charts_exist(self, charts_dir: Path) -> None:
        names = {p.name for p in charts_dir.iterdir() if p.is_dir()}
        missing = REQUIRED_SUB_CHARTS - names
        assert not missing, f"missing sub-charts: {missing}"

    def test_each_sub_chart_has_chart_yaml(self, charts_dir: Path) -> None:
        for sub in charts_dir.iterdir():
            if not sub.is_dir():
                continue
            assert (sub / "Chart.yaml").is_file(), f"{sub.name}/Chart.yaml missing"

    def test_each_sub_chart_has_values(self, charts_dir: Path) -> None:
        for sub in charts_dir.iterdir():
            if not sub.is_dir():
                continue
            assert (sub / "values.yaml").is_file(), f"{sub.name}/values.yaml missing"

    def test_each_sub_chart_has_templates_dir(self, charts_dir: Path) -> None:
        for sub in charts_dir.iterdir():
            if not sub.is_dir():
                continue
            tpl = sub / "templates"
            assert tpl.is_dir(), f"{sub.name}/templates/ missing"
            assert any(tpl.glob("*.yaml")) or any(tpl.glob("*.tpl")), (
                f"{sub.name}/templates/ empty"
            )


class TestHelmignore:
    def test_helmignore_present(self, helm_dir: Path) -> None:
        assert (helm_dir / ".helmignore").is_file()

    def test_helmignore_excludes_tests(self, helm_dir: Path) -> None:
        content = (helm_dir / ".helmignore").read_text(encoding="utf-8")
        assert "tests/" in content, "tests/ must be excluded from helm package"
