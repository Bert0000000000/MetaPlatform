-- V4: 工作台页面（/page/*）4 张表 + 种子数据
-- 本脚本幂等：可重复执行

CREATE TABLE IF NOT EXISTS dashboard_page_stat (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    label VARCHAR(64) NOT NULL,
    value VARCHAR(32) NOT NULL,
    trend_label VARCHAR(64),
    trend_value VARCHAR(32),
    trend_up BOOLEAN DEFAULT true,
    icon VARCHAR(64),
    sort_order INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_page_stat_user ON dashboard_page_stat(user_id, sort_order);

CREATE TABLE IF NOT EXISTS dashboard_page_recent_task (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    name VARCHAR(256) NOT NULL,
    type_label VARCHAR(32) NOT NULL,
    type_class VARCHAR(64) NOT NULL,
    agent VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    status_class VARCHAR(64) NOT NULL,
    time VARCHAR(64) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_page_recent_task_user ON dashboard_page_recent_task(user_id, sort_order);

CREATE TABLE IF NOT EXISTS dashboard_page_system_health (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    dot_class VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    detail VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL,
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dashboard_page_system_health_user ON dashboard_page_system_health(user_id, sort_order);

CREATE TABLE IF NOT EXISTS dashboard_page_active_agent (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'u-001',
    dot_class VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(64) NOT NULL,
    tasks INT DEFAULT 0,
    status_bg VARCHAR(64),
    status_color VARCHAR(64),
    status_label VARCHAR(32) NOT NULL,
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dashboard_page_active_agent_user ON dashboard_page_active_agent(user_id, sort_order);

-- 种子数据（4 统计 / 15 任务 / 3 健康 / 4 员工）
INSERT INTO dashboard_page_stat (label, value, trend_label, trend_value, trend_up, icon, sort_order)
SELECT * FROM (VALUES
  ('活跃应用', '18', '本周', '+3', true, 'boxes', 1),
  ('数字员工在线', '8/12', '', '运行中', true, 'bot', 2),
  ('今日任务', '234', '较昨日', '+18%', true, 'check-circle', 3),
  ('待处理审批', '5', '', '需要关注', false, 'clock', 4)
) AS v(label, value, trend_label, trend_value, trend_up, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_stat WHERE user_id = 'u-001');

INSERT INTO dashboard_page_recent_task (name, type_label, type_class, agent, status, status_class, time, sort_order)
SELECT * FROM (VALUES
  ('财务报销审核', '审批', 'v-badge-purple', '合同审核员', '完成', 'v-badge-success', '10 分钟前', 1),
  ('客户数据周报生成', '分析', 'v-badge-cyan', '数据分析师', '进行中', 'v-badge-warning', '25 分钟前', 2),
  ('安全漏洞扫描', '巡检', 'v-badge-blue', '安全巡检员', '失败', 'v-badge-error', '42 分钟前', 3),
  ('营销邮件撰写', '生成', 'v-badge-neutral', '营销文档', '完成', 'v-badge-success', '1 小时前', 4),
  ('知识库索引重建', '维护', 'v-badge-neutral', '知识库管理员', '完成', 'v-badge-success', '2 小时前', 5),
  ('PR 代码审查', '审核', 'v-badge-purple', '代码审查员', '等待中', 'v-badge-warning', '3 小时前', 6),
  ('订单数据对账', '对账', 'v-badge-blue', '财务对账员', '完成', 'v-badge-success', '4 小时前', 7),
  ('客户投诉回复', '回复', 'v-badge-cyan', '客服小助手', '完成', 'v-badge-success', '5 小时前', 8),
  ('产品需求评审', '评审', 'v-badge-purple', '产品助理', '等待中', 'v-badge-warning', '6 小时前', 9),
  ('供应链异常告警', '监控', 'v-badge-blue', '供应链监控员', '完成', 'v-badge-success', '7 小时前', 10),
  ('数据质量检查', '巡检', 'v-badge-blue', '数据质量巡检员', '完成', 'v-badge-success', '昨天 18:42', 11),
  ('合同条款比对', '审核', 'v-badge-purple', '合同审核员', '失败', 'v-badge-error', '昨天 17:30', 12),
  ('周报自动生成', '生成', 'v-badge-neutral', '知识库管理员', '完成', 'v-badge-success', '昨天 16:15', 13),
  ('客户画像更新', '分析', 'v-badge-cyan', '数据分析师', '进行中', 'v-badge-warning', '昨天 14:50', 14),
  ('服务器健康巡检', '巡检', 'v-badge-blue', '运维巡检员', '完成', 'v-badge-success', '昨天 11:00', 15)
) AS v(name, type_label, type_class, agent, status, status_class, time, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_recent_task WHERE user_id = 'u-001');

INSERT INTO dashboard_page_system_health (dot_class, name, detail, status, sort_order)
SELECT * FROM (VALUES
  ('health-dot-ok', 'LLM Gateway', '响应正常，P99 120ms', '正常', 1),
  ('health-dot-ok', 'MCP Registry', '已注册 23 个服务', '正常', 2),
  ('health-dot-warn', 'Kafka 消息队列', 'Lag 偏高 (1,204)', '警告', 3)
) AS v(dot_class, name, detail, status, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_system_health WHERE user_id = 'u-001');

INSERT INTO dashboard_page_active_agent (dot_class, name, type, tasks, status_bg, status_color, status_label, sort_order)
SELECT * FROM (VALUES
  ('agent-mini-dot-online', '客服助手', '对话型', 23, 'var(--success-subtle)', 'var(--success)', '在线', 1),
  ('agent-mini-dot-busy', '合同审核员', '审核型', 8, 'var(--warning-subtle)', 'var(--warning)', '处理中', 2),
  ('agent-mini-dot-online', '营销文档', '生成型', 15, 'var(--success-subtle)', 'var(--success)', '在线', 3),
  ('agent-mini-dot-online', '代码审查员', '审核型', 5, 'var(--success-subtle)', 'var(--success)', '在线', 4)
) AS v(dot_class, name, type, tasks, status_bg, status_color, status_label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_page_active_agent WHERE user_id = 'u-001');