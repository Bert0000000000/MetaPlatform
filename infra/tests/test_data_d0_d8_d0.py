"""DATA-D0-D8 D0 e2e smoke: 4 new data-platform sub-charts exist with
the right shape and are wired into the umbrella Chart.yaml.

Per ADR-0016 D0: Debezium (CDC) + Marquez (lineage) + DataHub
(catalog) + GE (quality) all stub-charted, with the first two
ready to enable. Catalog and quality are stubbed; their
production-ready chart is in the D1+ sub-batches.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"
UMBRELLA = REPO / "infra" / "helm" / "Chart.yaml"


class TestDataD0D8SubChartsExist:
    def test_debezium_chart_exists(self) -> None:
        assert (CHARTS / "debezium" / "Chart.yaml").is_file()
        assert (CHARTS / "debezium" / "values.yaml").is_file()

    def test_marquez_chart_exists(self) -> None:
        assert (CHARTS / "marquez" / "Chart.yaml").is_file()
        assert (CHARTS / "marquez" / "values.yaml").is_file()

    def test_datahub_stub_exists(self) -> None:
        assert (CHARTS / "datahub" / "Chart.yaml").is_file()
        assert (CHARTS / "datahub" / "values.yaml").is_file()

    def test_ge_stub_exists(self) -> None:
        assert (CHARTS / "ge" / "Chart.yaml").is_file()
        assert (CHARTS / "ge" / "values.yaml").is_file()


class TestDataD0D8UmbrellaWiring:
    def test_umbrella_chart_mentions_data_d0_d8(self) -> None:
        text = UMBRELLA.read_text(encoding="utf-8")
        assert "- name: debezium" in text
        assert "- name: marquez" in text
        assert "- name: datahub" in text
        assert "- name: ge" in text


class TestChartYamlShape:
    """Each new chart has apiVersion v2, version, and type fields."""

    def test_all_charts_v2(self) -> None:
        for chart in ("debezium", "marquez", "datahub", "ge"):
            text = (CHARTS / chart / "Chart.yaml").read_text(encoding="utf-8")
            assert "apiVersion: v2" in text, f"{chart}/Chart.yaml not v2"
            assert "version:" in text, f"{chart}/Chart.yaml no version"
            assert "type:" in text, f"{chart}/Chart.yaml no type"
