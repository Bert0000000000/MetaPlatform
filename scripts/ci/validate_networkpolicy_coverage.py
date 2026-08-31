"""Validate Hard Rule #13 against the canonical runtime inventory.

The namespace-wide default-deny policies are necessary but not sufficient for
the application layer.  This check reconciles the OpenAPI runtime inventory,
the Helm application-service inventory, and the rendered per-service policies.
It intentionally accepts a rendered YAML file so CI validates what Helm will
actually install rather than only checking template text.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / "mate-platform-backend" / "contracts" / "openapi" / "manifest.yaml"
HELM_VALUES = REPO / "infra" / "helm" / "values.yaml"


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"expected a YAML mapping in {path}")
    return data


def load_manifest_service_ids(path: Path = MANIFEST) -> tuple[str, ...]:
    """Return runtime domains in manifest declaration order."""

    domains = _load_yaml(path).get("domains")
    if not isinstance(domains, dict):
        raise ValueError(f"manifest {path} has no domains mapping")
    result: list[str] = []
    for service_id, definition in domains.items():
        if not isinstance(service_id, str) or not isinstance(definition, dict):
            raise ValueError(f"invalid service entry in {path}: {service_id!r}")
        if definition.get("runtimeModule") is not None:
            result.append(service_id)
    return tuple(result)


def load_helm_service_ids(path: Path = HELM_VALUES) -> tuple[str, ...]:
    """Return the explicit application service ids configured for Helm."""

    services = _load_yaml(path).get("applicationServices")
    if not isinstance(services, list):
        raise ValueError(f"{path} must define applicationServices as a list")
    result: list[str] = []
    for item in services:
        if isinstance(item, str):
            service_id = item
        elif isinstance(item, dict) and isinstance(item.get("id"), str):
            service_id = item["id"]
        else:
            raise ValueError(f"invalid application service entry: {item!r}")
        result.append(service_id)
    return tuple(result)


def _policy_service_id(document: Any) -> str | None:
    if not isinstance(document, dict) or document.get("kind") != "NetworkPolicy":
        return None
    metadata = document.get("metadata")
    if not isinstance(metadata, dict):
        return None
    labels = metadata.get("labels")
    if not isinstance(labels, dict):
        return None
    service_id = labels.get("metaplatform.io/protected-service")
    return service_id if isinstance(service_id, str) else None


def _collect_rendered_policies(
    rendered_text: str,
) -> tuple[dict[str, list[dict[str, Any]]], set[str]]:
    policies: dict[str, list[dict[str, Any]]] = {}
    namespace_default_deny: set[str] = set()
    for document in yaml.safe_load_all(rendered_text):
        if isinstance(document, dict) and document.get("kind") == "NetworkPolicy":
            metadata = document.get("metadata")
            name = metadata.get("name") if isinstance(metadata, dict) else None
            spec = document.get("spec")
            if (
                isinstance(name, str)
                and name.endswith(("-default-deny-ingress", "-default-deny-egress"))
                and isinstance(spec, dict)
                and spec.get("podSelector") == {}
            ):
                policy_types = spec.get("policyTypes")
                if isinstance(policy_types, list):
                    namespace_default_deny.update(
                        policy_type
                        for policy_type in policy_types
                        if policy_type in {"Ingress", "Egress"}
                    )
        service_id = _policy_service_id(document)
        if service_id is not None:
            policies.setdefault(service_id, []).append(document)
    return policies, namespace_default_deny


def _validate_service_policy(
    service_id: str, matches: list[dict[str, Any]]
) -> list[str]:
    if not matches:
        return [f"missing per-service NetworkPolicy: {service_id}"]
    if len(matches) != 1:
        return [
            f"expected one per-service NetworkPolicy for {service_id}, "
            f"found {len(matches)}"
        ]
    spec = matches[0].get("spec")
    if not isinstance(spec, dict):
        return [f"policy has no spec: {service_id}"]

    violations: list[str] = []
    selector = spec.get("podSelector")
    match_labels = selector.get("matchLabels") if isinstance(selector, dict) else None
    if not isinstance(match_labels, dict) or match_labels.get(
        "app.kubernetes.io/name"
    ) != service_id:
        violations.append(f"policy selector does not target service: {service_id}")
    policy_types = spec.get("policyTypes")
    if not isinstance(policy_types, list) or not {
        "Ingress",
        "Egress",
    }.issubset(policy_types):
        violations.append(f"policy must cover ingress and egress: {service_id}")
    return violations


def validate_rendered_coverage(
    rendered_text: str, expected_service_ids: tuple[str, ...]
) -> list[str]:
    """Return ASCII-only violations for targeted ingress+egress policies."""

    policies, namespace_default_deny = _collect_rendered_policies(rendered_text)

    violations: list[str] = []
    for policy_type in ("Ingress", "Egress"):
        if policy_type not in namespace_default_deny:
            violations.append(
                f"rendered output missing namespace default-deny {policy_type.lower()}"
            )
    expected = set(expected_service_ids)
    unexpected = sorted(set(policies) - expected)
    if unexpected:
        violations.append(f"unexpected protected services: {', '.join(unexpected)}")

    for service_id in expected_service_ids:
        violations.extend(_validate_service_policy(service_id, policies.get(service_id, [])))
    return violations


def validate_inventory(repo_root: Path = REPO) -> list[str]:
    manifest_services = load_manifest_service_ids(
        repo_root / "mate-platform-backend" / "contracts" / "openapi" / "manifest.yaml"
    )
    helm_services = load_helm_service_ids(repo_root / "infra" / "helm" / "values.yaml")
    violations: list[str] = []
    if len(manifest_services) != 21:
        violations.append(
            f"canonical runtime inventory has {len(manifest_services)} services; expected 21"
        )
    if len(set(manifest_services)) != len(manifest_services):
        violations.append("canonical runtime inventory contains duplicate service ids")
    if len(set(helm_services)) != len(helm_services):
        violations.append("Helm application service inventory contains duplicates")
    if manifest_services != helm_services:
        violations.append(
            "Helm application service inventory does not match the OpenAPI runtime inventory"
        )
    return violations


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rendered", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=REPO)
    args = parser.parse_args()

    violations = validate_inventory(args.repo_root)
    expected = load_manifest_service_ids(
        args.repo_root / "mate-platform-backend" / "contracts" / "openapi" / "manifest.yaml"
    )
    violations.extend(
        validate_rendered_coverage(
            args.rendered.read_text(encoding="utf-8"), expected
        )
    )
    if violations:
        print("validate_networkpolicy_coverage: rule 13 violation(s):")
        for violation in violations:
            print(violation)
        return 1
    print(f"OK: {len(expected)} runtime services have targeted ingress+egress policies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
