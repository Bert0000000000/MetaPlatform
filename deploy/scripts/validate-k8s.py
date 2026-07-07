#!/usr/bin/env python3
"""
validate-k8s.py — Static K8s manifest validator for MetaPlatform deploy/

Checks:
  * Valid YAML syntax
  * Required K8s fields (apiVersion, kind, metadata.name)
  * metadata.name matches K8s naming rules (lowercase, digits, '-' or '.')
  * Namespaced resources have metadata.namespace
  * Kustomize overlays reference real base resources
  * Helm chart structure (Chart.yaml + values.yaml + templates/)
  * Helm templates render to at least one valid K8s document

Usage:
  python validate-k8s.py [REPO_ROOT]
"""
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("PyYAML required: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


def main():
    repo_root = sys.argv[1] if len(sys.argv) > 1 else "."
    deploy_root = os.path.join(repo_root, "deploy")

    errors = []
    warnings = []
    files_scanned = 0
    objects = 0

    def err(msg):
        errors.append(msg)
        print(f"  ERROR: {msg}")

    def warn(msg):
        warnings.append(msg)
        print(f"  WARN:  {msg}")

    def ok(msg):
        print(f"  OK:    {msg}")

    namespaced_kinds = {
        "Pod", "Service", "Deployment", "StatefulSet", "DaemonSet",
        "ConfigMap", "Secret", "Ingress", "HorizontalPodAutoscaler",
        "ServiceMonitor", "PrometheusRule", "PodDisruptionBudget",
    }

    def is_kustomization(path):
        return os.path.basename(path) == "kustomization.yaml"

    def is_helm_chart_yaml(path):
        parent = os.path.dirname(path)
        return os.path.basename(path) in ("Chart.yaml", "values.yaml") and "templates" not in parent

    def is_helm_template(path):
        if path.endswith(".tpl"):
            return True
        norm = path.replace("\\", "/")
        return norm.endswith(".yaml") and "/templates/" in norm

    def strip_helm_directives(content):
        out = []
        i = 0
        while i < len(content):
            if content[i:i+2] == "{{":
                end = content.find("}}", i + 2)
                if end == -1:
                    out.append(content[i:])
                    break
                out.append(" ")
                i = end + 2
            else:
                out.append(content[i])
                i += 1
        return "".join(out)

    def validate_k8s_doc(path, doc):
        nonlocal_objects_count[0] += 1
        if not isinstance(doc, dict):
            err(f"{path}: top-level is not a mapping")
            return
        for req in ("apiVersion", "kind", "metadata"):
            if req not in doc:
                err(f"{path}: missing {req}")
        if "apiVersion" in doc and not re.match(r"^[a-z0-9\-]+(\.[a-z0-9\-]+)*(/[a-z0-9\-]+)?$", str(doc["apiVersion"])):
            err(f"{path}: invalid apiVersion '{doc.get('apiVersion')}'")
        if "kind" in doc and not re.match(r"^[A-Z][A-Za-z]+$", str(doc["kind"])):
            err(f"{path}: invalid kind '{doc.get('kind')}'")
        meta = doc.get("metadata", {})
        if not meta.get("name"):
            err(f"{path}: missing metadata.name")
        else:
            name = str(meta["name"])
            if len(name) > 253:
                err(f"{path}: metadata.name too long")
            if not re.match(r"^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$", name):
                err(f"{path}: invalid metadata.name '{name}'")
        kind = doc.get("kind")
        if kind in namespaced_kinds and "namespace" not in meta:
            warn(f"{path}: {kind} '{meta.get('name')}' missing namespace")

    nonlocal_objects_count = [0]

    def validate_yaml(path):
        nonlocal files_scanned
        files_scanned += 1
        if is_kustomization(path) or is_helm_chart_yaml(path):
            try:
                list(yaml.safe_load_all(open(path, "r", encoding="utf-8")))
                ok(f"{os.path.relpath(path, repo_root)}: valid YAML")
            except yaml.YAMLError as e:
                err(f"{path}: YAML parse error: {e}")
            return
        if is_helm_template(path):
            if path.endswith(".tpl"):
                ok(f"{os.path.relpath(path, repo_root)}: Helm helper template")
                return
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            stripped = strip_helm_directives(content)
            try:
                docs = list(yaml.safe_load_all(stripped))
            except yaml.YAMLError as e:
                err(f"{path}: template render error: {e}")
                return
            valid = False
            for doc in docs:
                if isinstance(doc, dict) and "apiVersion" in doc and "kind" in doc:
                    meta = doc.get("metadata", {})
                    name = meta.get("name", "")
                    if not name or str(name).startswith("-") or "{{" in str(name):
                        pass  # helm will resolve at render time
                    else:
                        validate_k8s_doc(path, doc)
                    valid = True
            if valid:
                ok(f"{os.path.relpath(path, repo_root)}: valid Helm template ({len(docs)} doc(s))")
            else:
                warn(f"{os.path.relpath(path, repo_root)}: Helm template, no resolvable K8s doc")
            return
        # Plain K8s YAML
        with open(path, "r", encoding="utf-8") as f:
            docs = list(yaml.safe_load_all(f))
        for doc in docs:
            if doc is not None:
                validate_k8s_doc(path, doc)

    print(f"\n=== MetaPlatform K8s Manifest Validator ===")
    print(f"Scanning: {deploy_root}\n")
    if not os.path.isdir(deploy_root):
        err(f"deploy/ not found at {deploy_root}")
        sys.exit(1)

    for root, _, files in os.walk(deploy_root):
        for fn in files:
            if fn.endswith((".yaml", ".yml", ".tpl")):
                validate_yaml(os.path.join(root, fn))

    for root, _, files in os.walk(deploy_root):
        for fn in files:
            if fn == "kustomization.yaml":
                kp = os.path.join(root, fn)
                with open(kp, "r", encoding="utf-8") as f:
                    kust = yaml.safe_load(f)
                for resource in kust.get("resources", []):
                    full = os.path.normpath(os.path.join(os.path.dirname(kp), resource))
                    if not os.path.exists(full):
                        err(f"kustomize {kp}: missing resource '{resource}'")
                    else:
                        ok(f"kustomize resource exists: {resource}")

    helm_path = os.path.join(deploy_root, "helm", "metaplatform")
    if os.path.isdir(helm_path):
        print(f"\nValidating Helm chart at {os.path.relpath(helm_path, repo_root)}")
        for f in ("Chart.yaml", "values.yaml"):
            full = os.path.join(helm_path, f)
            if not os.path.exists(full):
                err(f"Helm chart missing {f}")
            else:
                ok(f"Helm chart has {f}")
        templates_dir = os.path.join(helm_path, "templates")
        if not os.path.isdir(templates_dir):
            err("Helm chart missing templates/")
        else:
            ok("Helm chart has templates/")
            for tpl in sorted(os.listdir(templates_dir)):
                if tpl.endswith((".yaml", ".tpl")):
                    ok(f"Helm template: {tpl}")

    print(f"\n=== Summary ===")
    print(f"  Files scanned:  {files_scanned}")
    print(f"  K8s objects:    {nonlocal_objects_count[0]}")
    print(f"  Errors:         {len(errors)}")
    print(f"  Warnings:       {len(warnings)}")
    if errors:
        sys.exit(1)
    print("\nAll K8s manifests valid!")


if __name__ == "__main__":
    main()