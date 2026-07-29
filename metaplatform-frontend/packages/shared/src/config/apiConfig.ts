/**
 * Backend service routing table.
 *
 * Dev mode: use vite proxy to forward /api/v1/{module}/* to the
 * matching TECH-* service.
 * Prod mode: route via TECH-GW gateway (TBD) for a single ingress.
 *
 * Current v1.4: direct mode (gateway pending).
 */

export interface ServiceRoute {
  /** service name (Nacos registry name) */
  name: string;
  /** service port (used in dev direct mode; prod uses gateway) */
  port: number;
  /** API path prefix */
  apiPrefix: string;
  /** service label (ASCII-safe, used in logs / error messages) */
  label: string;
}

export const SERVICES: Record<string, ServiceRoute> = {
  iam:     { name: 'tech-iam',     port: 8101, apiPrefix: '/api/v1/iam',     label: 'IAM' },
  kb:      { name: 'tech-kb',      port: 9004, apiPrefix: '/api/v1/kb',      label: 'KB' },
  agent:   { name: 'mate-agent',   port: 8511, apiPrefix: '/api/v1/agent',   label: 'AGENT' },
  apphub:  { name: 'tech-apphub',  port: 8202, apiPrefix: '/api/v1/apphub',  label: 'APP' },
  superai: { name: 'tech-superai', port: 8601, apiPrefix: '/api/v1/superai', label: 'SUPERAI' },
  mcp:     { name: 'tech-mcp',     port: 8105, apiPrefix: '/api/v1/mcp',     label: 'MCP' },
  rag:     { name: 'tech-rag',     port: 8901, apiPrefix: '/api/v1/rag',     label: 'RAG' },
  ont:     { name: 'tech-ont',     port: 8301, apiPrefix: '/api/v1/ont',     label: 'ONT' },
  wfe:     { name: 'tech-wfe',     port: 8311, apiPrefix: '/api/v1/wfe',     label: 'WFE' },
  ea:      { name: 'tech-ea',      port: 8321, apiPrefix: '/api/v1/ea',      label: 'EA' },
  rule:    { name: 'tech-rule',    port: 8331, apiPrefix: '/api/v1/rule',    label: 'RULE' },
  action:  { name: 'tech-action',  port: 8341, apiPrefix: '/api/v1/action',  label: 'ACTION' },
  data:    { name: 'mate-data',    port: 8701, apiPrefix: '/api/v1/data',    label: 'DATA' },
  llmgw:   { name: 'tech-llmgw',   port: 8210, apiPrefix: '/api/v1/llmgw',   label: 'LLMGW' },
  obs:     { name: 'tech-obs',     port: 8401, apiPrefix: '/api/v1/obs',     label: 'OBS' },
  msg:     { name: 'tech-msg',     port: 8411, apiPrefix: '/api/v1/msg',     label: 'MSG' },
  a2a:     { name: 'mate-a2a',     port: 8502, apiPrefix: '/api/v1/a2a',     label: 'A2A' },
  gw:      { name: 'tech-gw',      port: 8000, apiPrefix: '/api/v1',         label: 'GW' },
};

/** default API base (all services route through /api/v1 in dev) */
export const API_BASE = '/api/v1';

/** compose a full API path for a service module */
export function apiPath(module: keyof typeof SERVICES, path: string): string {
  const svc = SERVICES[module];
  if (!svc) {
    throw new Error('[apiConfig] Unknown service module: ' + String(module));
  }
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return svc.apiPrefix + cleanPath;
}