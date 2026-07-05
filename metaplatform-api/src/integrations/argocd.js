/**
 * ArgoCD GitOps Integration
 *
 * Provides application listing, synchronization, status retrieval, and rollback.
 * When ARGOCD_URL is not configured, exports stub methods that log and return null.
 *
 * @module integrations/argocd
 */

const ARGOCD_URL = process.env.ARGOCD_URL || '';
const ARGOCD_TOKEN = process.env.ARGOCD_TOKEN || '';

/**
 * Check if ArgoCD is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(ARGOCD_URL);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[ArgoCD] ${methodName}: Service not configured (ARGOCD_URL is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Make an authenticated request to the ArgoCD API
 * @param {string} path - API path
 * @param {object} [options] - Fetch options
 * @returns {Promise<object>} Parsed JSON response
 */
async function argoFetch(path, options = {}) {
  const url = `${ARGOCD_URL}/api/v1${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(ARGOCD_TOKEN ? { Authorization: `Bearer ${ARGOCD_TOKEN}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`ArgoCD API ${path} failed: HTTP ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * List all ArgoCD applications
 * @param {object} [options] - Query options (namespace, selector)
 * @returns {Promise<object[]|null>} Array of application objects or null
 */
async function listApps(options = {}) {
  if (!isConfigured()) {
    return stub('listApps')(options);
  }

  try {
    const params = new URLSearchParams();
    if (options.namespace) params.set('appNamespace', options.namespace);
    if (options.selector) params.set('selector', options.selector);

    const query = params.toString() ? `?${params.toString()}` : '';
    const result = await argoFetch(`/applications${query}`);

    return (result.items || []).map((app) => ({
      name: app.metadata?.name,
      namespace: app.metadata?.namespace,
      project: app.spec?.project,
      repoURL: app.spec?.source?.repoURL,
      targetRevision: app.spec?.source?.targetRevision,
      path: app.spec?.source?.path,
      syncStatus: app.status?.sync?.status,
      healthStatus: app.status?.health?.status,
      createdAt: app.metadata?.creationTimestamp,
    }));
  } catch (err) {
    console.error('[ArgoCD] listApps error:', err.message);
    throw err;
  }
}

/**
 * Sync (deploy) an ArgoCD application
 * @param {string} appName - The application name
 * @param {object} [options] - Sync options (prune, dryRun, revision)
 * @returns {Promise<object|null>} Sync result or null
 */
async function syncApp(appName, options = {}) {
  if (!isConfigured()) {
    return stub('syncApp')(appName, options);
  }

  try {
    const body = {
      prune: options.prune || false,
      dryRun: options.dryRun || false,
      ...(options.revision ? { revision: options.revision } : {}),
    };

    const result = await argoFetch(`/applications/${appName}/sync`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    console.log(`[ArgoCD] Sync triggered for app '${appName}'`);
    return {
      phase: result.status?.phase || result.phase,
      message: result.message || result.status?.message,
      syncResult: result.status?.syncResult,
    };
  } catch (err) {
    console.error('[ArgoCD] syncApp error:', err.message);
    throw err;
  }
}

/**
 * Get the status of an ArgoCD application
 * @param {string} appName - The application name
 * @returns {Promise<object|null>} Application status or null
 */
async function getAppStatus(appName) {
  if (!isConfigured()) {
    return stub('getAppStatus')(appName);
  }

  try {
    const result = await argoFetch(`/applications/${appName}`);

    return {
      name: result.metadata?.name,
      syncStatus: result.status?.sync?.status,
      healthStatus: result.status?.health?.status,
      healthMessage: result.status?.health?.message,
      revision: result.status?.sync?.revision,
      comparedTo: result.status?.sync?.comparedTo,
      resources: (result.status?.resources || []).map((r) => ({
        name: r.name,
        kind: r.kind,
        namespace: r.namespace,
        status: r.status,
        health: r.health,
      })),
      operationState: result.status?.operationState?.phase,
      conditions: result.status?.conditions || [],
    };
  } catch (err) {
    console.error('[ArgoCD] getAppStatus error:', err.message);
    throw err;
  }
}

/**
 * Rollback an ArgoCD application to a previous revision
 * @param {string} appName - The application name
 * @param {string} [revision] - Specific revision to rollback to (optional, defaults to previous)
 * @returns {Promise<object|null>} Rollback result or null
 */
async function rollback(appName, revision) {
  if (!isConfigured()) {
    return stub('rollback')(appName, revision);
  }

  try {
    // Get the application history first
    const history = await argoFetch(`/applications/${appName}/revisions`);
    const revisions = history.revisions || history || [];

    if (!revision && revisions.length < 2) {
      throw new Error('No previous revision available for rollback');
    }

    const targetRevision = revision || revisions[revisions.length - 2]?.revision;

    if (!targetRevision) {
      throw new Error('Could not determine target revision for rollback');
    }

    // Trigger sync with the previous revision
    const result = await argoFetch(`/applications/${appName}/sync`, {
      method: 'POST',
      body: JSON.stringify({
        revision: targetRevision,
        prune: true,
      }),
    });

    console.log(`[ArgoCD] Rollback triggered for app '${appName}' to revision ${targetRevision}`);
    return {
      phase: result.status?.phase || result.phase,
      revision: targetRevision,
      message: `Rolled back to ${targetRevision}`,
    };
  } catch (err) {
    console.error('[ArgoCD] rollback error:', err.message);
    throw err;
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { listApps, syncApp, getAppStatus, rollback };
} else {
  module.exports = {
    listApps: stub('listApps'),
    syncApp: stub('syncApp'),
    getAppStatus: stub('getAppStatus'),
    rollback: stub('rollback'),
  };
}
