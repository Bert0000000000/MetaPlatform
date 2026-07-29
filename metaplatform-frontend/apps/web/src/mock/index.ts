/**
 * MOCK 数据层
 *
 * 所有 mock 数据集中在此文件，统一管理。
 * 后端联调时，只需将 API 调用从 mock 切换为真实请求。
 *
 * 标识规则：
 * - 文件级：本文件所有导出均为 MOCK 数据
 * - 使用方：import { xxx } from '@/mock'  // MOCK
 */

// ============ 通用类型 ============
export interface MockUser {
  id: string;
  username: string;
  realName: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'inactive';
  lastLogin: string;
}

// ============ 认证 Mock ============
export const MOCK_LOGIN = {
  user: {
    id: 'u-001',
    username: 'admin',
    realName: '管理员',
    tenantId: 'tenant-001',
    roles: ['admin'],
    email: 'admin@metaplatform.com',
  },
  accessToken: 'mock-token-admin-20260722',
  refreshToken: 'mock-refresh-token-20260722',
};

// ============ 工作台 Mock ============
export const MOCK_DASHBOARD_STATS = [
  { label: '应用总数', value: '24', trend: '+3', trendUp: true, icon: 'boxes' },
  { label: '数字员工', value: '12', trend: '+2', trendUp: true, icon: 'bot' },
  { label: '今日任务', value: '156', trend: '+23%', trendUp: true, icon: 'check-circle' },
  { label: '待审批', value: '8', trend: '-2', trendUp: false, icon: 'clock' },
];

export const MOCK_MY_APPS = [
  { id: 'app-001', name: '客户服务系统', status: 'published', version: 'v2.1.0', updatedAt: '2小时前', icon: 'headphones' },
  { id: 'app-002', name: '订单管理平台', status: 'published', version: 'v1.8.3', updatedAt: '1天前', icon: 'shopping-cart' },
  { id: 'app-003', name: '数据分析看板', status: 'draft', version: 'v0.9.0', updatedAt: '3天前', icon: 'bar-chart' },
  { id: 'app-004', name: '库存管理系统', status: 'published', version: 'v3.0.1', updatedAt: '1周前', icon: 'package' },
  { id: 'app-005', name: '员工入职流程', status: 'review', version: 'v1.2.0', updatedAt: '2周前', icon: 'user-plus' },
  { id: 'app-006', name: '财务报销系统', status: 'published', version: 'v2.0.0', updatedAt: '1月前', icon: 'receipt' },
];

export const MOCK_MY_AGENTS = [
  { id: 'agent-001', name: '客服小蜜', type: '对话型', status: 'running', tasks: 128, successRate: 96.8 },
  { id: 'agent-002', name: '数据分析师', type: '分析型', status: 'running', tasks: 56, successRate: 98.2 },
  { id: 'agent-003', name: '文档摘要助手', type: '生成型', status: 'idle', tasks: 342, successRate: 94.1 },
  { id: 'agent-004', name: '代码审查员', type: '审查型', status: 'running', tasks: 89, successRate: 91.5 },
  { id: 'agent-005', name: '运维巡检员', type: '监控型', status: 'error', tasks: 1024, successRate: 88.3 },
  { id: 'agent-006', name: '财务报表生成', type: '生成型', status: 'idle', tasks: 45, successRate: 99.1 },
];

export const MOCK_MESSAGES = [
  { id: 'msg-001', type: 'approval', title: '应用发布审批', summary: '客户服务系统 v2.1.0 待审批', time: '10分钟前', priority: 'high', read: false },
  { id: 'msg-002', type: 'task', title: '任务执行完成', summary: '数据分析师完成了 Q3 销售数据分析', time: '30分钟前', priority: 'medium', read: false },
  { id: 'msg-003', type: 'system', title: '系统告警', summary: 'Milvus 向量数据库连接数达到 80%', time: '1小时前', priority: 'high', read: false },
  { id: 'msg-004', type: 'collaboration', title: '协作邀请', summary: '周杰邀请您参与「API网关设计」评审', time: '2小时前', priority: 'low', read: true },
  { id: 'msg-005', type: 'approval', title: '审批已通过', summary: '库存管理系统 v3.0.1 发布已批准', time: '3小时前', priority: 'medium', read: true },
  { id: 'msg-006', type: 'task', title: '任务异常', summary: '运维巡检员执行失败，请查看日志', time: '5小时前', priority: 'high', read: true },
  { id: 'msg-007', type: 'system', title: '系统更新', summary: 'MCP 中心已升级至 v2.1.0', time: '1天前', priority: 'low', read: true },
  { id: 'msg-008', type: 'collaboration', title: '知识库评论', summary: '周杰在「产品技术文档」中评论了 RAG 检索策略', time: '1天前', priority: 'low', read: true },
];

export const MOCK_DELIVERABLES = [
  { id: 'del-001', name: 'Q3 季度分析报告', type: 'report', size: '2.4MB', updatedAt: '1小时前', status: 'completed' },
  { id: 'del-002', name: '客户服务流程优化方案', type: 'document', size: '890KB', updatedAt: '3小时前', status: 'completed' },
  { id: 'del-003', name: 'API 接口文档 v2', type: 'document', size: '1.2MB', updatedAt: '1天前', status: 'processing' },
  { id: 'del-004', name: '系统架构设计稿', type: 'design', size: '5.6MB', updatedAt: '2天前', status: 'completed' },
  { id: 'del-005', name: '数据治理报告', type: 'report', size: '3.1MB', updatedAt: '1周前', status: 'completed' },
];

// ============ 架构中心 Mock ============
export const MOCK_ARCH_BUSINESS = [
  { id: 'vs-001', name: '订单到现金', level: 'L1', status: 'active', processes: 12, owner: '张三' },
  { id: 'vs-002', name: '采购到付款', level: 'L1', status: 'active', processes: 8, owner: '李四' },
  { id: 'vs-003', name: '产品研发', level: 'L1', status: 'active', processes: 15, owner: '王五' },
  { id: 'vs-004', name: '客户服务', level: 'L1', status: 'review', processes: 6, owner: '赵六' },
];

// ============ 应用中心 Mock ============
export const MOCK_APPS = MOCK_MY_APPS;

// ============ 本体引擎 Mock ============
export const MOCK_ONTOLOGY_ENTITIES = [
  { id: 'ent-001', name: '客户', type: 'G2-业务对象', status: 'published', attributes: 12, relations: 8 },
  { id: 'ent-002', name: '订单', type: 'G2-业务对象', status: 'published', attributes: 15, relations: 12 },
  { id: 'ent-003', name: '产品', type: 'G2-业务对象', status: 'published', attributes: 10, relations: 6 },
  { id: 'ent-004', name: '供应商', type: 'G2-业务对象', status: 'draft', attributes: 8, relations: 4 },
  { id: 'ent-005', name: '退款流程', type: 'G3-流程', status: 'published', attributes: 6, relations: 3 },
  { id: 'ent-006', name: '会员等级', type: 'G1-枚举', status: 'published', attributes: 3, relations: 2 },
];

// ============ 知识库 Mock ============
export const MOCK_KNOWLEDGE_BASES = [
  { id: 'kb-001', name: '产品技术文档', desc: '核心技术方案与设计文档', docs: 456, dim: '1536d', model: 'text-embedding-3-small', status: 'indexed', updatedAt: '2小时前' },
  { id: 'kb-002', name: '客户服务 FAQ', desc: '客服问答与问题库', docs: 1234, dim: '768d', model: 'bge-large-zh', status: 'indexed', updatedAt: '30分钟前' },
  { id: 'kb-003', name: '合同条款库', desc: '法律合同与协议条款', docs: 89, dim: '1536d', model: 'text-embedding-3-small', status: 'indexing', progress: 67, updatedAt: '5分钟前' },
  { id: 'kb-004', name: '运维知识库', desc: '系统运维与故障排查', docs: 234, dim: '1024d', model: 'bge-base-zh', status: 'indexed', updatedAt: '1天前' },
  { id: 'kb-005', name: '架构设计文档', desc: '系统架构与设计方案', docs: 156, dim: '1536d', model: 'text-embedding-3-small', status: 'indexed', updatedAt: '3天前' },
  { id: 'kb-006', name: 'API 参考手册', desc: '接口文档与调用说明', docs: 378, dim: '768d', model: 'bge-large-zh', status: 'indexed', updatedAt: '6小时前' },
  { id: 'kb-007', name: '培训材料', desc: '员工培训与学习资料', docs: 67, dim: '1024d', model: 'bge-base-zh', status: 'partial', progress: 42, updatedAt: '1周前' },
  { id: 'kb-008', name: '竞品分析报告', desc: '行业竞品与市场分析', docs: 33, dim: '1536d', model: 'text-embedding-3-small', status: 'indexed', updatedAt: '2天前' },
];

// ============ MCP 中心 Mock ============
export const MOCK_MCP_TOOLS = [
  { id: 'tool-001', name: 'query_database', server: 'mate-db-server', desc: '查询企业数据库', status: 'enabled', calls: 15420 },
  { id: 'tool-002', name: 'send_notification', server: 'mate-msg-server', desc: '发送消息通知', status: 'enabled', calls: 8932 },
  { id: 'tool-003', name: 'create_ticket', server: 'mate-ticket-server', desc: '创建工单', status: 'enabled', calls: 3456 },
  { id: 'tool-004', name: 'search_knowledge', server: 'mate-rag-server', desc: '知识库语义检索', status: 'enabled', calls: 23120 },
  { id: 'tool-005', name: 'generate_report', server: 'mate-report-server', desc: '生成分析报告', status: 'disabled', calls: 892 },
  { id: 'tool-006', name: 'call_external_api', server: 'mate-gw-server', desc: '调用外部 API', status: 'enabled', calls: 5678 },
];

export const MOCK_MCP_SERVERS = [
  { id: 'srv-001', name: 'mate-db-server', url: 'nacos://mate-db-server:8080', status: 'online', tools: 4, latency: 23 },
  { id: 'srv-002', name: 'mate-msg-server', url: 'nacos://mate-msg-server:8080', status: 'online', tools: 2, latency: 12 },
  { id: 'srv-003', name: 'mate-rag-server', url: 'nacos://mate-rag-server:8080', status: 'online', tools: 3, latency: 45 },
  { id: 'srv-004', name: 'mate-ticket-server', url: 'nacos://mate-ticket-server:8080', status: 'degraded', tools: 1, latency: 1200 },
  { id: 'srv-005', name: 'mate-report-server', url: 'nacos://mate-report-server:8080', status: 'offline', tools: 0, latency: 0 },
];

// ============ 数字员工 Mock ============
export const MOCK_AGENTS = MOCK_MY_AGENTS;

// ============ 后台管理 Mock ============
export const MOCK_USERS: MockUser[] = [
  { id: 'u-001', username: 'admin', realName: '管理员', email: 'admin@metaplatform.com', role: '超级管理员', department: '技术部', status: 'active', lastLogin: '2026-07-22 08:30' },
  { id: 'u-002', username: 'zhangsan', realName: '张三', email: 'zhangsan@metaplatform.com', role: '应用管理员', department: '业务部', status: 'active', lastLogin: '2026-07-21 18:22' },
  { id: 'u-003', username: 'lisi', realName: '李四', email: 'lisi@metaplatform.com', role: '开发者', department: '研发部', status: 'active', lastLogin: '2026-07-22 09:15' },
  { id: 'u-004', username: 'wangwu', realName: '王五', email: 'wangwu@metaplatform.com', role: '只读用户', department: '运营部', status: 'inactive', lastLogin: '2026-07-15 14:30' },
  { id: 'u-005', username: 'zhaoliu', realName: '赵六', email: 'zhaoliu@metaplatform.com', role: '开发者', department: '研发部', status: 'active', lastLogin: '2026-07-22 10:00' },
];
