/**
 * Keycloak Identity Provider Integration (ESM, stub)
 *
 * Phase 2 / Phase 3: Identity federation.
 * Stub implementation — real OAuth/OIDC integration comes in Phase 3.
 */
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "metaplatform";

export function isConfigured() {
  return Boolean(KEYCLOAK_URL);
}

export async function getAuthorizationUrl(redirectUri, state) {
  if (!isConfigured()) return null;
  return `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=metaplatform&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code`;
}

export async function exchangeCode(code, redirectUri) {
  if (!isConfigured()) return null;
  return { stub: true, message: "Keycloak token exchange not yet implemented" };
}

export default { isConfigured, getAuthorizationUrl, exchangeCode };