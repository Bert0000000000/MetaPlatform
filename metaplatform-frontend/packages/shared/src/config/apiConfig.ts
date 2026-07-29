/**
 * 鍚庣鏈嶅姟璺敱琛? *
 * 寮€鍙戞ā寮忥細閫氳繃 vite proxy 灏?/api/v1/{module}/* 鍙嶄唬鍒板搴?TECH-* 鏈嶅姟
 * 鐢熶骇妯″紡锛氶€氳繃 TECH-GW 缃戝叧锛堝緟瀹炵幇锛夌粺涓€鍏ュ彛
 *
 * 褰撳墠 v1.4 闃舵锛氱洿杩炴ā寮忥紙婕旇繘鍒扮綉鍏冲墠锛? */

export interface ServiceRoute {
  /** 鏈嶅姟鍚嶏紙Nacos 娉ㄥ唽鍚嶏級 */
  name: string;
  /** 鏈嶅姟绔彛锛坉ev 妯″紡鐩磋繛鏃朵娇鐢紝prod 妯″紡鐢辩綉鍏充唬鐞嗭級 */
  port: number;
  /** API 璺緞鍓嶇紑 */
  apiPrefix: string;
  /** 鏈嶅姟涓枃鎻忚堪锛堢敤浜庢棩蹇?閿欒淇℃伅锛?*/
  label: string;
}

export const SERVICES: Record<string, ServiceRoute> = {
  iam:    { name: 'tech-iam',     port: 8101, apiPrefix: '/api/v1/iam',    label: '韬唤璁よ瘉' },
  kb:     { name: 'tech-kb',      port: 9004, apiPrefix: '/api/v1/kb',     label: '鐭ヨ瘑搴? },
  agent:  { name: 'mate-agent',   port: 8511, apiPrefix: '/api/v1/agent',  label: '鏁板瓧鍛樺伐' },
  apphub: { name: 'tech-apphub',  port: 8202, apiPrefix: '/api/v1/apphub', label: '搴旂敤涓績' },
  superai:{ name: 'tech-superai', port: 8601, apiPrefix: '/api/v1/superai',label: 'SuperAI' },
  mcp:    { name: 'tech-mcp',     port: 8105, apiPrefix: '/api/v1/mcp',    label: 'MCP 涓績' },
  rag:    { name: 'tech-rag',     port: 8901, apiPrefix: '/api/v1/rag',    label: '鐭ヨ瘑搴? },
  ont:    { name: 'tech-ont',     port: 8301, apiPrefix: '/api/v1/ont',    label: '鏈綋寮曟搸' },
  wfe:    { name: 'tech-wfe',     port: 8311, apiPrefix: '/api/v1/wfe',    label: '娴佺▼寮曟搸' },
  ea:     { name: 'tech-ea',      port: 8321, apiPrefix: '/api/v1/ea',     label: '浼佷笟鏋舵瀯' },
  rule:   { name: 'tech-rule',    port: 8331, apiPrefix: '/api/v1/rule',   label: '瑙勫垯寮曟搸' },
  action: { name: 'tech-action',  port: 8341, apiPrefix: '/api/v1/action', label: 'Action 涓績' },
  data:   { name: 'mate-data',    port: 8701, apiPrefix: '/api/v1/data',   label: '鏁版嵁闆嗘垚' },
  llmgw:  { name: 'tech-llmgw',   port: 8210, apiPrefix: '/api/v1/llmgw',  label: 'LLM 缃戝叧' },
  obs:    { name: 'tech-obs',     port: 8401, apiPrefix: '/api/v1/obs',    label: '鍙娴嬫€? },
  msg:    { name: 'tech-msg',     port: 8411, apiPrefix: '/api/v1/msg',    label: '娑堟伅涓績' },
  a2a:    { name: 'mate-a2a',     port: 8502, apiPrefix: '/api/v1/a2a',    label: 'A2A 鍗忚' },
  gw:     { name: 'tech-gw',      port: 8000, apiPrefix: '/api/v1',        label: 'API 缃戝叧' },
};

/** 榛樿 API 鍩虹璺緞锛堢洿杩炲悇鏈嶅姟鏃剁粺涓€閫氳繃 dev proxy 杞埌 /api/v1锛?*/
export const API_BASE = '/api/v1';

/** 鎷兼帴瀹屾暣 API 璺緞 */
export function apiPath(module: keyof typeof SERVICES, path: string): string {
  const svc = SERVICES[module];
  if (!svc) {
    throw new Error('[apiConfig] Unknown service module: ' + String(module));
  }
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return svc.apiPrefix + cleanPath;
}
