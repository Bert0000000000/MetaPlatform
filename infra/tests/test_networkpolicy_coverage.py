"""Hard Rule #13 — canonical service inventory and rendered policy coverage."""
from __future__ import annotations

from pathlib import Path

import yaml

from scripts.ci.validate_networkpolicy_coverage import (
    load_helm_service_ids,
    load_manifest_service_ids,
    validate_rendered_coverage,
)

REPO = Path(__file__).resolve().parents[1]
HELM = REPO / "helm"
MANIFEST = REPO.parent / "mate-platform-backend" / "contracts" / "openapi" / "manifest.yaml"


def test_manifest_has_the_canonical_21_runtime_services() -> None:
    services = load_manifest_service_ids(MANIFEST)

    assert len(services) == 21
    assert len(set(services)) == len(services)


def test_helm_inventory_matches_every_manifest_runtime_service() -> None:
    assert load_helm_service_ids(HELM / "values.yaml") == load_manifest_service_ids(
        MANIFEST
    )


def test_rendered_coverage_requires_ingress_and_egress_for_each_service() -> None:
    services = ("alpha", "beta")
    documents = [
        {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "NetworkPolicy",
            "metadata": {"name": "metaplatform-default-deny-ingress"},
            "spec": {"podSelector": {}, "policyTypes": ["Ingress"]},
        },
        {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "NetworkPolicy",
            "metadata": {"name": "metaplatform-default-deny-egress"},
            "spec": {"podSelector": {}, "policyTypes": ["Egress"]},
        }
    ]
    for service in services:
        documents.append(
            {
                "apiVersion": "networking.k8s.io/v1",
                "kind": "NetworkPolicy",
                "metadata": {
                    "name": f"{service}-default-deny",
                    "labels": {"metaplatform.io/protected-service": service},
                },
                "spec": {
                    "podSelector": {
                        "matchLabels": {"app.kubernetes.io/name": service}
                    },
                    "policyTypes": ["Ingress", "Egress"],
                },
            }
        )

    rendered = "---\n".join(yaml.safe_dump(document) for document in documents)

    assert validate_rendered_coverage(rendered, services) == []


def test_rendered_coverage_rejects_missing_service_policy() -> None:
    rendered = yaml.safe_dump(
        {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "NetworkPolicy",
            "metadata": {
                "name": "alpha-default-deny",
                "labels": {"metaplatform.io/protected-service": "alpha"},
            },
            "spec": {
                "podSelector": {
                    "matchLabels": {"app.kubernetes.io/name": "alpha"}
                },
                "policyTypes": ["Ingress", "Egress"],
            },
        }
    )
    rendered = "---\n".join(
        [
            yaml.safe_dump(
                {
                    "apiVersion": "networking.k8s.io/v1",
                    "kind": "NetworkPolicy",
                    "metadata": {"name": "metaplatform-default-deny-ingress"},
                    "spec": {"podSelector": {}, "policyTypes": ["Ingress"]},
                }
            ),
            yaml.safe_dump(
                {
                    "apiVersion": "networking.k8s.io/v1",
                    "kind": "NetworkPolicy",
                    "metadata": {"name": "metaplatform-default-deny-egress"},
                    "spec": {"podSelector": {}, "policyTypes": ["Egress"]},
                }
            ),
            rendered,
        ]
    )

    violations = validate_rendered_coverage(rendered, ("alpha", "beta"))

    assert any("beta" in violation for violation in violations)
