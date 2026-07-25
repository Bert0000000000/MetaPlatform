/**
 * 后端服务路由表
 *
 * 开发模式：通过 vite proxy 将 /api/v1/{module}/* 反代到对应 TECH-* 服务
 * 生产模式：通过 TECH-GW 网关（待实现）统一入口
 *
 * 当前 v1.4 阶段：直连模式（演进到网关前）
 */

export interface ServiceRoute {
  /** 服务名（Nacos 注册名） */
  name: string;
  /** 服务端口（dev 模式直连时使用，prod 模式由网关代理） */
  port: number;
  /** API 路径前缀 */
  apiPrefix: string;
  /** 服务中文描述（用于日志/错误信息） */
  label: string;
}

export const SERVICES: Record<string, ServiceRoute> = {
  iam:    { name: 'tech-iam',     port: 8101, apiPrefix: '/api/v1/iam',    label: '身份认证' },
  agent:  { name: 'mate-agent',   port: 8511, apiPrefix: '/api/v1/agent',  label: '数字员工' },
  mcp:    { name: 'tech-mcp',     port: 8105, apiPrefix: '/api/v1/mcp',    label: 'MCP 中心' },
  rag:    { name: 'tech-rag',     port: 8901, apiPrefix: '/api/v1/rag',    label: '知识库' },
  ont:    { name: 'tech-ont',     port: 8301, apiPrefix: '/api/v1/ont',    label: '本体引擎' },
  wfe:    { name: 'tech-wfe',     port: 8311, apiPrefix: '/api/v1/wfe',    label: '流程引擎' },
  ea:     { name: 'tech-ea',      port: 8321, apiPrefix: '/api/v1/ea',     label: '企业架构' },
  rule:   { name: 'tech-rule',    port: 8331, apiPrefix: '/api/v1/rule',   label: '规则引擎' },
  action: { name: 'tech-action',  port: 8341, apiPrefix: '/api/v1/action', label: 'Action 中心' },
  data:   { name: 'mate-data',    port: 8701, apiPrefix: '/api/v1/data',   label: '数据集成' },
  llmgw:  { name: 'tech-llmgw',   port: 8210, apiPrefix: '/api/v1/llmgw',  label: 'LLM 网关' },
  obs:    { name: 'tech-obs',     port: 8401, apiPrefix: '/api/v1/obs',    label: '可观测性' },
  msg:    { name: 'tech-msg',     port: 8411, apiPrefix: '/api/v1/msg',    label: '消息中心' },
  a2a:    { name: 'mate-a2a',     port: 8502, apiPrefix: '/api/v1/a2a',    label: 'A2A 协议' },
  gw:     { name: 'tech-gw',      port: 8000, apiPrefix: '/api/v1',        label: 'API 网关' },
};

/** 默认 API 基础路径（直连各服务时统一通过 dev proxy 转到 /api/v1） */
export const API_BASE = '/api/v1';

/** 拼接完整 API 路径 */
export function apiPath(module: keyof typeof SERVICES, path: string): string {
  const svc = SERVICES[module];
  if (!svc) {
    throw new Error('[apiConfig] Unknown service module: ' + String(module));
  }
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return svc.apiPrefix + cleanPath;
}
