/**
 * Keycloak Authentication Integration
 *
 * Provides SSO initialization, token verification, user info retrieval, and token refresh.
 * When KEYCLOAK_URL is not configured, exports stub methods that log and return null.
 *
 * @module integrations/keycloak
 */

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || '';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'metaplatform';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'metaplatform-api';
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

let keycloakAdmin = null;
let keycloakGrantManager = null;

/**
 * Check if Keycloak is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(KEYCLOAK_URL && KEYCLOAK_REALM);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[Keycloak] ${methodName}: Service not configured (KEYCLOAK_URL is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Get the Keycloak realm URL
 * @returns {string}
 */
function getRealmUrl() {
  return `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
}

/**
 * Get the OIDC well-known configuration
 * @returns {Promise<object|null>}
 */
async function getOpenIdConfig() {
  try {
    const url = `${getRealmUrl()}/.well-known/openid-configuration`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('[Keycloak] Failed to fetch OpenID config:', err.message);
    return null;
  }
}

/**
 * Initialize Keycloak integration
 * Fetches OIDC configuration and prepares the grant manager
 * @returns {Promise<object|null>} The OpenID configuration or null
 */
async function init() {
  if (!isConfigured()) {
    console.warn('[Keycloak] init: Service not configured (KEYCLOAK_URL is not set)');
    return null;
  }

  try {
    const config = await getOpenIdConfig();
    if (!config) {
      throw new Error('Could not fetch OpenID configuration');
    }

    keycloakGrantManager = {
      issuer: config.issuer,
      authorization_endpoint: config.authorization_endpoint,
      token_endpoint: config.token_endpoint,
      userinfo_endpoint: config.userinfo_endpoint,
      jwks_uri: config.jwks_uri,
    };

    console.log(`[Keycloak] Initialized for realm '${KEYCLOAK_REALM}' at ${KEYCLOAK_URL}`);
    return keycloakGrantManager;
  } catch (err) {
    console.error('[Keycloak] init error:', err.message);
    return null;
  }
}

/**
 * Verify a JWT token against Keycloak
 * @param {string} token - The JWT access token
 * @returns {Promise<object|null>} Token claims or null if invalid
 */
async function verifyToken(token) {
  if (!isConfigured()) {
    return stub('verifyToken')(token);
  }

  if (!keycloakGrantManager) {
    await init();
    if (!keycloakGrantManager) return null;
  }

  try {
    // Introspect the token via Keycloak's token introspection endpoint
    const introspectUrl = `${getRealmUrl()}/protocol/openid-connect/token/introspect`;

    const params = new URLSearchParams({
      token,
      client_id: KEYCLOAK_CLIENT_ID,
      ...(KEYCLOAK_CLIENT_SECRET ? { client_secret: KEYCLOAK_CLIENT_SECRET } : {}),
    });

    const response = await fetch(introspectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Introspection failed: HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.active) {
      return null; // Token is not active
    }

    return {
      sub: result.sub,
      preferred_username: result.preferred_username,
      email: result.email,
      name: result.name,
      realm_access: result.realm_access,
      resource_access: result.resource_access,
      exp: result.exp,
      iat: result.iat,
    };
  } catch (err) {
    console.error('[Keycloak] verifyToken error:', err.message);
    return null;
  }
}

/**
 * Get user information from Keycloak
 * @param {string} userId - The user ID (sub)
 * @returns {Promise<object|null>} User info or null
 */
async function getUserInfo(userId) {
  if (!isConfigured()) {
    return stub('getUserInfo')(userId);
  }

  if (!keycloakGrantManager) {
    await init();
    if (!keycloakGrantManager) return null;
  }

  try {
    // Get a service account token first
    const tokenUrl = `${getRealmUrl()}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: KEYCLOAK_CLIENT_ID,
      ...(KEYCLOAK_CLIENT_SECRET ? { client_secret: KEYCLOAK_CLIENT_SECRET } : {}),
    });

    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResp.ok) {
      throw new Error(`Service token failed: HTTP ${tokenResp.status}`);
    }

    const { access_token } = await tokenResp.json();

    // Fetch user info
    const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`;
    const response = await fetch(adminUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!response.ok) {
      throw new Error(`User info failed: HTTP ${response.status}`);
    }

    const user = await response.json();
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: user.enabled,
      emailVerified: user.emailVerified,
    };
  } catch (err) {
    console.error('[Keycloak] getUserInfo error:', err.message);
    return null;
  }
}

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<object|null>} New token set or null
 */
async function refreshToken(refreshToken) {
  if (!isConfigured()) {
    return stub('refreshToken')(refreshToken);
  }

  try {
    const tokenUrl = `${getRealmUrl()}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: KEYCLOAK_CLIENT_ID,
      ...(KEYCLOAK_CLIENT_SECRET ? { client_secret: KEYCLOAK_CLIENT_SECRET } : {}),
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: HTTP ${response.status}`);
    }

    const tokens = await response.json();
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    };
  } catch (err) {
    console.error('[Keycloak] refreshToken error:', err.message);
    return null;
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { init, verifyToken, getUserInfo, refreshToken };
} else {
  module.exports = {
    init: stub('init'),
    verifyToken: stub('verifyToken'),
    getUserInfo: stub('getUserInfo'),
    refreshToken: stub('refreshToken'),
  };
}
