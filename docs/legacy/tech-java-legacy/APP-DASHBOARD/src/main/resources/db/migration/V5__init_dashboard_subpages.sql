-- V5: 工作台 5 个子页面（MyApps / MyAgents / Messages / Portal / Deliverables）的数据表 + 种子
-- 全部使用 CREATE TABLE IF NOT EXISTS + INSERT WHERE NOT EXISTS，幂等可重跑

-- ============ My Apps ============
CREATE TABLE IF NOT EXISTS dashboard_page_my_app (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL,
    type_label VARCHAR(32) NOT NULL,
    description TEXT,
    last_used VARCHAR(64),
    date VARCHAR(32),
    usage VARCHAR(64),
    icon VARCHAR(64),
    pinned BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_my_app_user ON dashboard_page_my_app(user_id);

INSERT INTO dashboard_page_my_app (name, type, type_label, description, last_used, date, usage, icon, pinned, sort_order)
SELECT * FROM (VALUES
  ('订单管理系统', 'business', '业务', '全流程订单管理，从创建、审核到发货追踪，支持多渠道订单聚合与异常处理', '3 分钟前', NULL, NULL, 'ShoppingBag', true, 1),
  ('客户 CRM', 'business', '业务', '统一管理客户信息、跟进记录与销售线索，AI 自动打标与流失预警', '15 分钟前', NULL, NULL, 'Users', true, 2),
  ('供应链看板', 'data', '数据', '端到端供应链可视化，实时追踪库存、物流与供应商交易状态', '1 小时前', NULL, NULL, 'TrendingUp', true, 3),
  ('智能客服', 'ai', 'AI', '基于 RAG 的多轮对话客服，支持知识库检索、工单自动创建与人工转接', '2 小时前', NULL, NULL, 'Headphones', true, 4),
  ('智能审批流', 'business', '业务', '基于规则的自动化审批流程，支持多级会签与条件分支', NULL, '2026-06-10', '328 次', 'ListChecks', false, 5),
  ('数据质量监控', 'data', '数据', '实时检测数据异常，自动生成质量评分与修复建议', NULL, '2026-06-18', '156 次', 'TriangleAlert', false, 6),
  ('知识库检索', 'ai', 'AI', '基于向量语义的企业知识库智能检索与问答', NULL, '2026-05-22', '892 次', 'BookOpen', false, 7),
  ('供应商评分', 'data', '数据', '多维度供应商打分评估，自动生成分级与推荐报告', NULL, '2026-07-01', '74 次', 'Building2', false, 8),
  ('合同分析助手', 'ai', 'AI', 'AI 驱动的合同条款智能解析与风险标注', NULL, '2026-07-08', '213 次', 'FileText', false, 9),
  ('风险预警平台', 'business', '业务', '实时监测业务风险指标，自动触发预警与通知', NULL, '2026-07-14', '447 次', 'TriangleAlert', false, 10)
) AS v(name, type, type_label, description, last_used, date, usage, icon, pinned, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_my_app WHERE user_id = 'u-001');

-- ============ My Agents ============
CREATE TABLE IF NOT EXISTS dashboard_page_my_agent (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    name VARCHAR(128) NOT NULL,
    type VARCHAR(64) NOT NULL,
    type_label VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    status_class VARCHAR(64),
    description TEXT,
    tasks INT DEFAULT 0,
    success_rate NUMERIC(5,2) DEFAULT 0,
    icon VARCHAR(64),
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_my_agent_user ON dashboard_page_my_agent(user_id);

CREATE TABLE IF NOT EXISTS dashboard_page_agent_exec_log (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    log_id VARCHAR(64) NOT NULL,
    agent VARCHAR(128) NOT NULL,
    agent_id VARCHAR(128),
    exec_time VARCHAR(64) NOT NULL,
    duration VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    status_class VARCHAR(64) NOT NULL,
    dot_class VARCHAR(64),
    trigger VARCHAR(32) NOT NULL,
    tokens VARCHAR(32),
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_agent_log_user ON dashboard_page_agent_exec_log(user_id, sort_order);

INSERT INTO dashboard_page_my_agent (name, type, type_label, status, status_class, description, tasks, success_rate, icon, sort_order)
SELECT * FROM (VALUES
  ('数据质量巡检员', 'inspection', '质检型', 'running', 'status-running', '定时巡检数据库表，自动修复常见数据问题', 1024, 88.30, 'ShieldCheck', 1),
  ('供应链监控员', 'monitor', '监控型', 'running', 'status-running', '实时监控供应链异常，自动通知采购与销售', 512, 92.10, 'Activity', 2),
  ('合同审核员', 'review', '审核型', 'running', 'status-running', 'AI 智能识别合同条款风险，支持多版本对比', 89, 91.50, 'FileText', 3),
  ('知识库管理员', 'maintain', '维护型', 'running', 'status-running', '知识库索引重建与版本管理', 156, 96.40, 'BookOpen', 4),
  ('财务对账员', 'finance', '财务型', 'error', 'status-error', '订单与财务流水对账，标记差异并生成报告', 78, 85.20, 'Receipt', 5),
  ('客服助手', 'service', '服务型', 'running', 'status-running', '基于知识库的多轮对话客服，支持人工接管', 128, 96.80, 'Headphones', 6),
  ('数据分析师', 'analysis', '分析型', 'running', 'status-running', '根据问题自动选择数据集进行多维分析', 56, 98.20, 'BarChart3', 7),
  ('文档摘要助手', 'generation', '生成型', 'idle', 'status-idle', '长文档摘要与结构化提取', 342, 94.10, 'FileText', 8)
) AS v(name, type, type_label, status, status_class, description, tasks, success_rate, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_my_agent WHERE user_id = 'u-001');

INSERT INTO dashboard_page_agent_exec_log (log_id, agent, agent_id, exec_time, duration, status, status_class, dot_class, trigger, tokens, sort_order)
SELECT * FROM (VALUES
  ('l01', '数据质量巡检员', 'data-quality', '07-22 14:32:08', '1.8s', '成功', 'v-badge-success', 'dot-success', '定时触发', '2,340', 1),
  ('l02', '供应链监控员', 'supply-chain', '07-22 14:28:45', '4.2s', '成功', 'v-badge-success', 'dot-success', '事件触发', '5,120', 2),
  ('l03', '合同审核员', 'contract-review', '07-22 14:15:22', '12.6s', '成功', 'v-badge-success', 'dot-success', '手动触发', '18,740', 3),
  ('l04', '知识库管理员', 'kb-admin', '07-22 14:02:11', '6.3s', '成功', 'v-badge-success', 'dot-success', '定时触发', '8,960', 4),
  ('l05', '财务对账员', 'finance-recon', '07-22 13:48:37', '7.1s', '失败', 'v-badge-destructive', 'dot-destructive', '定时触发', '10,280', 5),
  ('l06', '数据质量巡检员', 'data-quality', '07-22 13:30:00', '2.4s', '成功', 'v-badge-success', 'dot-success', '定时触发', '3,100', 6),
  ('l07', '供应链监控员', 'supply-chain', '07-22 12:55:19', '3.8s', '超时', 'v-badge-warning', 'dot-warning', '事件触发', '4,620', 7),
  ('l08', '知识库管理员', 'kb-admin', '07-22 12:30:05', '4.5s', '成功', 'v-badge-success', 'dot-success', '定时触发', '6,530', 8),
  ('l09', '客服助手', 'service-bot', '07-22 12:10:44', '1.2s', '成功', 'v-badge-success', 'dot-success', '用户提问', '1,870', 9),
  ('l10', '数据分析师', 'analyst', '07-22 11:45:22', '8.7s', '成功', 'v-badge-success', 'dot-success', '手动触发', '14,200', 10),
  ('l11', '合同审核员', 'contract-review', '07-22 11:20:08', '15.3s', '成功', 'v-badge-success', 'dot-success', '上传触发', '21,540', 11),
  ('l12', '财务对账员', 'finance-recon', '07-22 10:55:33', '6.8s', '失败', 'v-badge-destructive', 'dot-destructive', '定时触发', '9,840', 12),
  ('l13', '知识库管理员', 'kb-admin', '07-22 10:30:00', '5.2s', '成功', 'v-badge-success', 'dot-success', '定时触发', '7,210', 13),
  ('l14', '数据质量巡检员', 'data-quality', '07-22 10:00:00', '1.9s', '成功', 'v-badge-success', 'dot-success', '定时触发', '2,580', 14),
  ('l15', '客服助手', 'service-bot', '07-22 09:42:17', '0.8s', '成功', 'v-badge-success', 'dot-success', '用户提问', '1,120', 15)
) AS v(log_id, agent, agent_id, exec_time, duration, status, status_class, dot_class, trigger, tokens, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_agent_exec_log WHERE user_id = 'u-001');

-- ============ Messages ============
CREATE TABLE IF NOT EXISTS dashboard_page_message (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    msg_id VARCHAR(64) NOT NULL,
    sender VARCHAR(128) NOT NULL,
    avatar_class VARCHAR(64) NOT NULL,
    icon VARCHAR(64),
    title VARCHAR(256) NOT NULL,
    summary TEXT,
    time VARCHAR(64) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    unread BOOLEAN DEFAULT false,
    attachments INT DEFAULT 0,
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_message_user ON dashboard_page_message(user_id, sort_order);

INSERT INTO dashboard_page_message (msg_id, sender, avatar_class, icon, title, summary, time, priority, unread, attachments, sort_order)
SELECT * FROM (VALUES
  ('m01', '审批中心', 'approval', 'FileCheck2', '应用发布审批：客户 CRM v2.1.0 待您审批', '客户 CRM v2.1.0 已通过测试，部署计划 7 月 30 日上线，请尽快审核。', '10 分钟前', 'high', true, 0, 1),
  ('m02', '数据分析师', 'task', 'BarChart3', '任务执行完成：Q3 销售数据分析', '数据分析师完成了 Q3 销售数据的多维分析，输出 12 项关键指标。', '30 分钟前', 'medium', true, 3, 2),
  ('m03', '系统', 'system', 'AlertTriangle', '系统警告：Milvus 向量数据库连接数达到 80%', '检测到向量数据库连接数接近上限，建议扩容或检查连接泄漏。', '1 小时前', 'high', true, 0, 3),
  ('m04', '产品组周磊', 'collab', 'MessageSquare', '协作邀请：参与 API 网关设计评审', '周磊邀请您参与 API 网关设计的评审会议，明天上午 10 点。', '2 小时前', 'low', true, 0, 4),
  ('m05', '审批中心', 'approval', 'FileCheck2', '审批已通过：库存管理系统 v3.0.1', '库存管理系统 v3.0.1 发布申请已通过审批，可进入部署阶段。', '3 小时前', 'medium', false, 0, 5),
  ('m06', '运维巡检员', 'task', 'Activity', '任务异常：运维巡检员执行失败', '运维巡检员定时任务执行失败，请查看日志并人工干预。', '5 小时前', 'high', false, 1, 6),
  ('m07', '系统', 'system', 'Settings', '系统更新：MCP 中心已升级至 v2.1.0', 'MCP 中心完成本次升级，新增 3 个工具，建议尽快适配。', '1 天前', 'low', false, 0, 7),
  ('m08', '产品组周磊', 'collab', 'MessageSquare', '知识库评论：产研文档中的 RAG 策略', '周磊在产品技术文档库中评论了 RAG 检索策略的优化方案。', '1 天前', 'low', false, 0, 8),
  ('m09', '审批中心', 'approval', 'FileCheck2', '应用发布审批：数据看板 v1.5.0', '数据看板 v1.5.0 已完成开发，预计影响 3 个下游系统，请评估风险。', '今天 09:15', 'medium', false, 0, 9),
  ('m10', '营销助手', 'task', 'Sparkles', '营销活动建议：周末促销方案', '基于历史数据，建议本周末开展会员专享促销，预计提升转化 15%。', '今天 08:30', 'medium', false, 2, 10),
  ('m11', '数据分析组', 'collab', 'GitMerge', 'PR 合入通知：feature/dw-metrics 已合并', 'feature/dw-metrics 已合入 main，包含 5 项新指标与 2 个修复。', '昨天 17:20', 'low', false, 0, 11),
  ('m12', '本体引擎', 'approval', 'FileCheck2', '审批已通过：产品领域本体模型 v2.0', '产品领域本体模型 v2.0 已通过终审，新增 12 个 G2 业务对象与 5 条推理规则。', '昨天 11:05', 'low', false, 0, 12),
  ('m13', '合同审核员', 'task', 'Zap', '合同审核报告生成完毕', '已完成 3 份供应商合同的自动审核，风险摘要报告已推送至审批流。', '2 天前', 'low', false, 4, 13),
  ('m14', '架构中心', 'collab', 'GitMerge', '代码合并通知：TECH-LLMGW 分支合入 main', 'feature/saa-chatmodel 分支已合并至 main，包含 SAA ChatModel 适配器与多模型路由重构。', '2 天前', 'low', false, 0, 14),
  ('m15', '周磊', 'collab', 'MessageSquare', '知识库评论：RAG 检索策略优化建议', '周磊在《产品技术文档》知识库中评论了 RAG 检索策略的优化方案。', '3 天前', 'low', false, 0, 15)
) AS v(msg_id, sender, avatar_class, icon, title, summary, time, priority, unread, attachments, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_message WHERE user_id = 'u-001');

-- ============ Portal ============
CREATE TABLE IF NOT EXISTS dashboard_page_portal (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    name VARCHAR(128) NOT NULL,
    kind VARCHAR(16) NOT NULL,            -- 'internal' | 'external'
    description TEXT,
    icon VARCHAR(64) NOT NULL,
    visits INT DEFAULT 0,
    last_visit VARCHAR(64),
    url VARCHAR(512),
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_portal_user ON dashboard_page_portal(user_id, kind, sort_order);

INSERT INTO dashboard_page_portal (name, kind, description, icon, visits, last_visit, url, sort_order)
SELECT * FROM (VALUES
  ('MatePortal 工作台', 'internal', '个人工作台统一入口', 'LayoutDashboard', 128, '今天', '/dashboard', 1),
  ('MateCRM', 'internal', '客户关系管理', 'Users', 86, '今天', '/apps/crm', 2),
  ('MateBI', 'internal', '商业智能分析平台', 'BarChart3', 64, '昨天', '/arch/data', 3),
  ('MateHR', 'internal', '人力资源管理', 'UserCheck', 32, '3 天前', '/admin/org', 4),
  ('MateDoc', 'internal', '企业知识库', 'BookOpen', 245, '今天', '/knowledge', 5),
  ('MateOps', 'internal', '运维一体化平台', 'Activity', 18, '昨天', '/aiops', 6),
  ('Notion', 'external', '团队协作与文档', 'ExternalLink', 56, '今天', 'https://notion.so', 1),
  ('Figma', 'external', '设计与原型协作', 'ExternalLink', 23, '2 天前', 'https://figma.com', 2),
  ('Jira', 'external', '项目与缺陷跟踪', 'ExternalLink', 41, '今天', 'https://atlassian.com', 3),
  ('GitHub', 'external', '代码托管与协作', 'ExternalLink', 87, '今天', 'https://github.com', 4)
) AS v(name, kind, description, icon, visits, last_visit, url, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_portal WHERE user_id = 'u-001');

-- ============ Deliverables ============
-- 交付材料已有 dashboard_deliverables（V2），这里新增工作台页用到的 timeline
CREATE TABLE IF NOT EXISTS dashboard_page_deliverable_timeline (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    time_label VARCHAR(64) NOT NULL,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    icon VARCHAR(64),
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_deliverable_timeline_user ON dashboard_page_deliverable_timeline(user_id, sort_order);

INSERT INTO dashboard_page_deliverable_timeline (time_label, title, description, icon, sort_order)
SELECT * FROM (VALUES
  ('07-22 14:30', 'Q2 架构评审报告已发布', 'AI 助手完成 Q2 架构评审报告生成并已发送至工作台', 'FileText', 1),
  ('07-22 10:15', '客户行为数据集 v3 已发布', '数据管家完成客户行为分析数据集 v3 发布', 'BarChart3', 2),
  ('07-21 16:42', '意图分类模型 v2.1 已发布', '模型训练官完成意图分类模型 v2.1 训练并发布', 'BrainCircuit', 3),
  ('07-21 09:08', '数据治理月度报告已发布', '张明完成数据治理月度报告生成', 'FileSpreadsheet', 4),
  ('07-20 14:22', '知识库质量评估报告已发布', '质检专员完成知识库质量评估报告', 'Database', 5),
  ('07-19 11:37', 'Agent 能效评估报告已发布', '评估助手完成 Agent 能效评估报告', 'FileText', 6)
) AS v(time_label, title, description, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_deliverable_timeline WHERE user_id = 'u-001');

-- 给已有 dashboard_deliverables 补一些符合前端 mock 的种子
INSERT INTO dashboard_deliverables (deliverable_id, user_id, title, type, source_type, source_id, description, status, created_at)
SELECT * FROM (VALUES
  ('d-001', 'u-001', 'Q2 架构评审报告', 'REPORT', 'AI_GENERATED', 'analyst-bot', 'AI 助手生成的 Q2 架构评审报告', 'ACTIVE', NOW() - INTERVAL '4 days'),
  ('d-002', 'u-001', '客户行为数据集 v3', 'DATASET', 'AI_GENERATED', 'data-keeper', '客户行为分析数据集 v3', 'ACTIVE', NOW() - INTERVAL '5 days'),
  ('d-003', 'u-001', '意图分类模型 v2.1', 'MODEL', 'AI_GENERATED', 'model-trainer', '意图分类模型 v2.1', 'ACTIVE', NOW() - INTERVAL '6 days'),
  ('d-004', 'u-001', '数据治理月度报告', 'DOCUMENT', 'MANUAL_UPLOADED', 'manual', '张明整理的数据治理月度报告', 'ACTIVE', NOW() - INTERVAL '7 days'),
  ('d-005', 'u-001', '知识库质量评估报告', 'REPORT', 'AI_GENERATED', 'quality-bot', '知识库质量评估报告', 'ACTIVE', NOW() - INTERVAL '8 days'),
  ('d-006', 'u-001', 'Agent 能效评估报告', 'REPORT', 'AI_GENERATED', 'eval-bot', 'Agent 能效评估报告', 'ACTIVE', NOW() - INTERVAL '10 days'),
  ('d-007', 'u-001', '系统运维周报 W28', 'DOCUMENT', 'MANUAL_UPLOADED', 'manual', '李工整理的运维周报', 'ACTIVE', NOW() - INTERVAL '11 days'),
  ('d-008', 'u-001', '用户留存分析数据集', 'DATASET', 'AI_GENERATED', 'data-keeper', '用户留存分析数据集', 'ACTIVE', NOW() - INTERVAL '12 days')
) AS v(deliverable_id, user_id, title, type, source_type, source_id, description, status, created_at)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_deliverables WHERE deliverable_id IN ('d-001','d-002','d-003','d-004','d-005','d-006','d-007','d-008'));