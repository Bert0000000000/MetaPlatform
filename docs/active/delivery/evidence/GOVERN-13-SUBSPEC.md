# GOVERN-13 — NetworkPolicy service coverage acceptance evidence

> Scope status: **Accepted for the rendered Helm governance gate**
> Date: 2026-08-27

## Contract

The canonical runtime inventory is the non-null `runtimeModule` set in
`mate-platform-backend/contracts/openapi/manifest.yaml`. It currently contains
21 service ids. `infra/helm/values.yaml` declares the same ids in the same
order as `applicationServices`.

## Enforcement

- `infra/helm/templates/application-networkpolicies.yaml` renders one targeted
  ingress+egress default-deny policy per application service.
- The existing namespace-wide ingress and egress default-deny policies remain
  required.
- `scripts/ci/validate_networkpolicy_coverage.py` rejects inventory drift,
  duplicate/unexpected service ids, missing policies, selector drift, missing
  ingress/egress coverage, and missing namespace defaults.
- `ga-013-networkpolicy` renders local, staging, and production values and runs
  the validator for each render.

## Verification

- Unit/governance coverage: 14 focused tests passed.
- Helm lint: passed (only the existing recommended-icon informational message).
- Helm template + coverage validator: local, staging, and production each
  reported `21 runtime services have targeted ingress+egress policies`.
- This is a rendered-manifest gate; it does not claim that a staging or
  production Kubernetes cluster has already been deployed or exercised.
