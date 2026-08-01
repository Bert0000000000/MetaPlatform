"""DATA-D0-D8 D2 v2 CRD structural tests.

Verifies the DataJob + Dataset CRD templates added in D2 v2:
  - template files exist under infra/helm/charts/datahub/templates
  - SEC-TENANT-01 hard rule 3: tenantId is mandatory on both CRDs
  - DataJob carries lineage.marquezJob (D1 integration)
  - Dataset carries partition.byTenant (SEC-TENANT-01) + sla contract
  - datahub values.yaml exposes dataJobs + datasets toggles

These tests are structural (file content assertions) and complement
the Python-side e2e tests in
``mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d2.py``.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"
DATAHUB = CHARTS / "datahub"


class TestDataJobCRD:
    def test_datajob_crd_template_exists(self) -> None:
        path = DATAHUB / "templates" / "datajob.yaml"
        assert path.is_file(), "datajob.yaml CRD template missing"
        text = path.read_text(encoding="utf-8")
        assert "kind: DataJob" in text
        assert "apiVersion: datahub.metaplatform.io/v1" in text

    def test_datajob_crd_has_tenant_id(self) -> None:
        """Per SEC-TENANT-01 hard rule 3: tenantId is mandatory."""
        text = (DATAHUB / "templates" / "datajob.yaml").read_text(encoding="utf-8")
        assert "tenantId:" in text
        # inputs/outputs/schedule are the DataJob-defining fields.
        assert "inputs:" in text
        assert "outputs:" in text
        assert "schedule:" in text

    def test_datajob_crd_has_lineage(self) -> None:
        """D1 integration: each DataJob run emits to a Marquez job."""
        text = (DATAHUB / "templates" / "datajob.yaml").read_text(encoding="utf-8")
        assert "lineage:" in text
        assert "marquezJob:" in text


class TestDatasetCRD:
    def test_dataset_crd_template_exists(self) -> None:
        path = DATAHUB / "templates" / "dataset.yaml"
        assert path.is_file(), "dataset.yaml CRD template missing"
        text = path.read_text(encoding="utf-8")
        assert "kind: Dataset" in text
        assert "apiVersion: datahub.metaplatform.io/v1" in text

    def test_dataset_crd_has_partition_by_tenant(self) -> None:
        """SEC-TENANT-01 hard rule 3: physical partitioning per tenant."""
        text = (DATAHUB / "templates" / "dataset.yaml").read_text(encoding="utf-8")
        assert "partition:" in text
        assert "byTenant: true" in text
        # tenantId still mandatory on the Dataset itself.
        assert "tenantId:" in text

    def test_dataset_crd_has_sla(self) -> None:
        """Hard rule 9: SLO/SLA contract published to the catalog."""
        text = (DATAHUB / "templates" / "dataset.yaml").read_text(encoding="utf-8")
        assert "sla:" in text
        assert "availability:" in text
        assert "freshness:" in text
        assert "latencyP99Ms:" in text
        # schema block feeds GMS search + GE binding (D3).
        assert "schema:" in text


class TestDataHubValuesD2V2:
    def test_datahub_values_has_datajobs(self) -> None:
        text = (DATAHUB / "values.yaml").read_text(encoding="utf-8")
        assert "dataJobs:" in text
        assert "enabled: true" in text
        assert "defaultSchedule:" in text
        assert "0 2 * * *" in text

    def test_datahub_values_has_datasets(self) -> None:
        text = (DATAHUB / "values.yaml").read_text(encoding="utf-8")
        assert "datasets:" in text
        assert "partitionByTenant: true" in text
