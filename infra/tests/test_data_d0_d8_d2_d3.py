"""DATA-D0-D8 D2 + D3 e2e tests.

Per ADR-0016: D2 = DataHub DataProduct + ingest pipeline,
D3 = Great Expectations + Airflow integration. Both build on the
D0 chart stubs and turn them on.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"
UMBRELLA = REPO / "infra" / "helm" / "Chart.yaml"


class TestDataD2DataHubExpansion:
    def test_datahub_values_has_data_products(self) -> None:
        text = (CHARTS / "datahub" / "values.yaml").read_text(encoding="utf-8")
        assert "dataProducts:" in text
        assert "versioning:" in text
        assert "tenant:" in text
        assert "ingest:" in text

    def test_datahub_values_has_tenant_partition(self) -> None:
        """Per SEC-TENANT-01: data products are scoped per tenant."""
        text = (CHARTS / "datahub" / "values.yaml").read_text(encoding="utf-8")
        assert "partitionByCorpGroup: true" in text

    def test_datahub_has_data_product_crd_template(self) -> None:
        path = CHARTS / "datahub" / "templates" / "dataproduct.yaml"
        assert path.is_file()
        text = path.read_text(encoding="utf-8")
        assert "kind: DataProduct" in text
        assert "tenantId" in text
        assert "lineage" in text  # D1 integration

    def test_datahub_has_ingest_kafka_pipeline(self) -> None:
        """D2 ingest pulls from Kafka topics per PLATFORM-EVENT-01."""
        text = (CHARTS / "datahub" / "values.yaml").read_text(encoding="utf-8")
        assert "kafkaConnect:" in text
        assert "metaplatform.*.*.*.cdc" in text
        assert "metaplatform.*.*.*.event" in text


class TestDataD3GEExpansion:
    def test_ge_values_has_airflow_integration(self) -> None:
        text = (CHARTS / "ge" / "values.yaml").read_text(encoding="utf-8")
        assert "airflow:" in text
        assert "expectations:" in text
        assert "storagePerTenant: true" in text

    def test_ge_values_has_tenant_scoping(self) -> None:
        """Per SEC-TENANT-01: GE expectations are scoped per tenant."""
        text = (CHARTS / "ge" / "values.yaml").read_text(encoding="utf-8")
        assert "storagePerTenant: true" in text

    def test_ge_has_airflow_dag_template(self) -> None:
        path = CHARTS / "ge" / "templates" / "dag-template.py"
        assert path.is_file()
        text = path.read_text(encoding="utf-8")
        assert "from airflow import DAG" in text
        assert "great_expectations" in text
        assert "{{ domain }}" in text  # templated per data product


class TestUmbrellaChartStillWired:
    def test_umbrella_chart_includes_d2_d3_components(self) -> None:
        text = UMBRELLA.read_text(encoding="utf-8")
        for chart in ("debezium", "marquez", "datahub", "ge"):
            assert f"- name: {chart}" in text, (
                f"{chart} missing from umbrella dependencies"
            )