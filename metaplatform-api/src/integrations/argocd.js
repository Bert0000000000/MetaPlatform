/**
 * ArgoCD GitOps Integration (ESM, stub)
 *
 * Phase 2 / Phase 6: GitOps continuous deployment.
 * Stub implementation — real ArgoCD API integration comes in Phase 6.
 */
const ARGOCD_URL = process.env.ARGOCD_URL || "";
const ARGOCD_TOKEN = process.env.ARGOCD_TOKEN || "";

export function isConfigured() {
  return Boolean(ARGOCD_URL && ARGOCD_TOKEN);
}

export async function listApplications() {
  if (!isConfigured()) return [];
  return [{ stub: true, name: "metaplatform-stub-app", syncStatus: "Synced" }];
}

export async function syncApplication(name) {
  if (!isConfigured()) return null;
  return { stub: true, name, action: "sync", result: "ok" };
}

export default { isConfigured, listApplications, syncApplication };