"""Every pure YAML in the umbrella chart must parse and conform to K8s schema basics.

Files under templates/ that contain Helm template syntax ({{ ... }}) are
NOT valid YAML by themselves; they are rendered by `helm template` and
verified in CI via helm lint + helm-unittest.
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

HELM_ROOT = Path(__file__).resolve().parents[1] / "helm"


def _is_pure_yaml(path: Path) -> bool:
    """A file is pure YAML only if it does not contain Helm template syntax."""
    text = path.read_text(encoding="utf-8")
    return "{{" not in text and "}}" not in text


def _id_for(p: Path) -> str:
    return str(p.relative_to(HELM_ROOT))


PURE_YAML_FILES = sorted(p for p in HELM_ROOT.rglob("*.yaml") if _is_pure_yaml(p))
TEMPLATE_YAML_FILES = sorted(p for p in HELM_ROOT.rglob("*.yaml") if not _is_pure_yaml(p))


class TestPureYamlParses:
    @pytest.mark.parametrize("yaml_path", PURE_YAML_FILES, ids=_id_for)
    def test_yaml_file_parses(self, yaml_path: Path) -> None:
        docs = list(yaml.safe_load_all(yaml_path.read_text(encoding="utf-8")))
        assert all(d is None or isinstance(d, dict) for d in docs), (
            f"{yaml_path} contains non-mapping document"
        )

    @pytest.mark.parametrize("yaml_path", PURE_YAML_FILES, ids=_id_for)
    def test_k8s_manifest_has_required_fields(self, yaml_path: Path) -> None:
        docs = list(yaml.safe_load_all(yaml_path.read_text(encoding="utf-8")))
        for doc in docs:
            if not isinstance(doc, dict) or "kind" not in doc:
                continue
            assert "apiVersion" in doc, f"{yaml_path} doc missing apiVersion"
            assert "metadata" in doc, f"{yaml_path} doc missing metadata"
            assert "name" in doc["metadata"], f"{yaml_path} doc missing metadata.name"


class TestTemplateFilesExist:
    """Smoke test that all template files are non-empty; the real validation
    is helm lint / helm-unittest in CI."""

    @pytest.mark.parametrize("yaml_path", TEMPLATE_YAML_FILES, ids=_id_for)
    def test_template_file_non_empty(self, yaml_path: Path) -> None:
        text = yaml_path.read_text(encoding="utf-8").strip()
        assert text, f"{yaml_path} is empty"

    @pytest.mark.parametrize("yaml_path", TEMPLATE_YAML_FILES, ids=_id_for)
    def test_template_file_uses_helm_syntax(self, yaml_path: Path) -> None:
        text = yaml_path.read_text(encoding="utf-8")
        assert "{{" in text and "}}" in text, (
            f"{yaml_path} is in templates/ but contains no Helm template directives"
        )


class TestValuesYaml:
    def test_values_yaml_parses(self, helm_dir: Path) -> None:
        data = yaml.safe_load((helm_dir / "values.yaml").read_text(encoding="utf-8"))
        assert isinstance(data, dict)

    def test_env_values_override_only_deltas(self, helm_dir: Path) -> None:
        default_keys = set(
            yaml.safe_load((helm_dir / "values.yaml").read_text(encoding="utf-8")).keys()
        )
        for env in ("local", "staging", "production"):
            data = yaml.safe_load(
                (helm_dir / f"values-{env}.yaml").read_text(encoding="utf-8")
            )
            extras = set(data.keys()) - default_keys
            assert not extras, f"values-{env}.yaml introduces new top-level keys: {extras}"
