import { useState } from 'react';
import {
  FileText, AlertCircle, AlertTriangle, Activity,
  RefreshCw, Download, X, MessageSquare, Layers, GitBranch, Braces,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_USERS } from '@/mock'; // MOCK

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
];

// MOCK: 日志列表
interface LogRow {
  ts: string;
  level: string;
  levelBadge: string;
  service: string;
  traceId: string;
  message: string;
  duration: string;
}

const MOCK_LOGS: LogRow[] = [
  { ts: '2026-07-22 14:32:18.423', level: 'ERROR', levelBadge: 'v-badge-error', service: 'mate-ont-server', traceId: '4f8a2c1e-b3d7', message: 'OWL 本体导入失败：命名空间冲突 http://meta.org/ont/core 已存在', duration: '1,245ms' },
  { ts: '2026-07-22 14:31:55.102', level: 'ERROR', levelBadge: 'v-badge-error', service: 'mate-agent-server', traceId: '7e3f0d9a-a1c4', message: 'Graph 执行节点超时：LLM 响应等待超过 30s，task_id=agent-react-2891', duration: '30,012ms' },
  { ts: '2026-07-22 14:30:42.887', level: 'WARN', levelBadge: 'v-badge-warning', service: 'mate-mcp-server', traceId: '2b6e8f1c-d5a0', message: 'MCP Server「external-search」心跳超时，第 2 次重试中', duration: '5,023ms' },
  { ts: '2026-07-22 14:29:11.336', level: 'WARN', levelBadge: 'v-badge-warning', service: 'mate-llmgw-server', traceId: '9c1a4d7f-e8b2', message: '模型路由降级：doubao-pro-256k 限流 429，已切换至 doubao-lite-128k', duration: '892ms' },
  { ts: '2026-07-22 14:28:03.554', level: 'INFO', levelBadge: 'v-badge-info', service: 'mate-iam-server', traceId: '5d2f8b3a-c7e1', message: '用户「zhangsan」OAuth2 token 刷新成功，有效期 7200s', duration: '45ms' },
  { ts: '2026-07-22 14:27:38.191', level: 'INFO', levelBadge: 'v-badge-info', service: 'mate-rag-server', traceId: 'a8c3e6f2-4d9b', message: 'Milvus 向量检索完成，collection=knowledge_base_v3，top_k=10，耗时 23ms', duration: '23ms' },
  { ts: '2026-07-22 14:26:15.768', level: 'DEBUG', levelBadge: 'v-badge-neutral', service: 'mate-a2a-server', traceId: '1e7b4a9d-f2c6', message: 'A2A 消息投递至 agent-report-gen，payload size=2.3KB，nacos registry lookup', duration: '12ms' },
  { ts: '2026-07-22 14:25:44.005', level: 'INFO', levelBadge: 'v-badge-info', service: 'mate-wfe-server', traceId: 'f4d9c2e8-6a1b', message: 'BPMN 流程实例 proc-inst-4921 状态变更：PENDING -> RUNNING', duration: '156ms' },
  { ts: '2026-07-22 14:24:21.332', level: 'INFO', levelBadge: 'v-badge-info', service: 'mate-gw-server', traceId: '3b5e7f1a-d8c4', message: 'API 网关路由 POST /api/v1/agent/react -> mate-agent-server，status=200', duration: '8ms' },
  { ts: '2026-07-22 14:23:09.667', level: 'WARN', levelBadge: 'v-badge-warning', service: 'mate-data-server', traceId: '8a2c6d4e-b7f3', message: 'Kafka consumer lag 超过阈值：topic=ontology-events，partition=3，lag=1,247', duration: '--' },
];

// MOCK: 关联 Trace
const MOCK_TRACE_ITEMS = [
  { service: 'mate-gw', span: 'POST /api/v1/ont/import', dur: '2ms', danger: false },
  { service: 'mate-iam', span: 'OAuth2 token 验证', dur: '5ms', danger: false },
  { service: 'mate-ont', span: 'OWL 文件解析 + 命名空间校验', dur: '1,238ms', danger: true },
];

const LEVEL_BADGE: Record<string, string> = {
  ERROR: 'v-badge-error', WARN: 'v-badge-warning', INFO: 'v-badge-info', DEBUG: 'v-badge-neutral',
};

export default function AdminLogsPage() {
  const location = useLocation();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = MOCK_LOGS[selectedIdx];

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <style>{`
        .al-page-header { margin-bottom: 24px; }
        .al-page-header h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
        .al-page-header p { font-size: 14px; color: var(--muted-foreground); }
        .al-tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .al-tab-bar .v-tab { cursor: pointer; text-decoration: none; }
        .al-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .al-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .al-stat-card .stat-label { font-size: 13px; color: var(--muted-foreground); display: flex; align-items: center; gap: 8px; }
        .al-stat-card .stat-label svg { width: 16px; height: 16px; color: var(--muted-foreground); }
        .al-stat-card .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
        .al-stat-card .stat-sub { font-size: 12px; color: var(--muted-foreground); }
        .al-stat-card .stat-sub .up { color: var(--success); }
        .al-stat-card .stat-sub .down { color: var(--destructive); }
        .al-filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .al-filter-bar .v-input { height: 36px; }
        .al-filter-spacer { flex: 1; }
        .al-content-area { display: flex; gap: 16px; align-items: flex-start; }
        .al-content-left { flex: 1; min-width: 0; overflow-x: auto; }
        .al-detail-panel { width: 300px; flex-shrink: 0; position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow-y: auto; }
        .al-detail-section { margin-bottom: 20px; }
        .al-detail-section:last-child { margin-bottom: 0; }
        .al-detail-section-title { font-size: 12px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .al-detail-section-title svg { width: 14px; height: 14px; }
        .al-detail-msg { font-size: 13px; line-height: 1.7; color: var(--foreground); }
        .al-detail-stack { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; font-family: var(--font-mono); font-size: 11px; line-height: 1.65; color: var(--muted-foreground); overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
        .al-detail-stack .err-highlight { color: var(--destructive); }
        .al-detail-stack .pkg { color: #60a5fa; }
        .al-detail-stack .fn { color: var(--success); }
        .al-detail-trace-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
        .al-detail-trace-item:last-child { border-bottom: none; }
        .al-detail-trace-item .dt-service { color: var(--foreground); font-weight: 500; min-width: 80px; }
        .al-detail-trace-item .dt-span { font-family: var(--font-mono); color: var(--muted-foreground); flex: 1; }
        .al-detail-trace-item .dt-dur { font-family: var(--font-mono); color: var(--muted-foreground); text-align: right; white-space: nowrap; }
        .al-detail-json { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; font-family: var(--font-mono); font-size: 11px; line-height: 1.65; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
        .al-detail-json .json-key { color: #60a5fa; }
        .al-detail-json .json-str { color: var(--success); }
        .al-detail-json .json-num { color: var(--warning); }
        .al-detail-meta-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; }
        .al-detail-meta-row .dm-label { color: var(--muted-foreground); }
        .al-detail-meta-row .dm-value { color: var(--foreground); font-family: var(--font-mono); font-size: 11px; }
        .al-pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding: 12px 16px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); }
        .al-pagination-info { font-size: 13px; color: var(--muted-foreground); }
        .al-pagination-controls { display: flex; align-items: center; gap: 4px; }
        .al-pagination-controls button { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: var(--radius); background: transparent; color: var(--muted-foreground); cursor: pointer; font-size: 13px; font-family: var(--font-sans); }
        .al-pagination-controls button:hover { color: var(--foreground); background: var(--muted); }
        .al-pagination-controls button.pg-active { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
        .al-ts-cell { font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); white-space: nowrap; }
        .al-trace-cell { font-family: var(--font-mono); font-size: 11px; color: var(--muted-foreground); white-space: nowrap; cursor: pointer; }
        .al-trace-cell:hover { color: var(--foreground); }
        .al-msg-cell { max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .al-duration-cell { font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); white-space: nowrap; text-align: right; }
        .al-service-cell { font-size: 13px; white-space: nowrap; }
        .al-v-select { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 8px 30px 8px 12px; outline: none; font-family: var(--font-sans); appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
        .al-v-select:focus { border-color: var(--foreground); }
      `}</style>
      <div style={{ padding: '0 0 24px' }}>
        {/* Page Header */}
        <div className="al-page-header">
          <h1>日志管理</h1>
          <p>系统运行日志、错误追踪与审计分析</p>
        </div>

        {/* Stats */}
        <div className="al-stats-grid">
          <div className="al-stat-card">
            <div className="stat-label"><FileText />今日日志</div>
            <div className="stat-value">12,456</div>
            <div className="stat-sub">较昨日 <span className="up">+8.3%</span></div>
          </div>
          <div className="al-stat-card">
            <div className="stat-label"><AlertCircle style={{ color: 'var(--destructive)' }} />错误日志</div>
            <div className="stat-value" style={{ color: 'var(--destructive)' }}>23</div>
            <div className="stat-sub">较昨日 <span className="down">-12.0%</span></div>
          </div>
          <div className="al-stat-card">
            <div className="stat-label"><AlertTriangle style={{ color: 'var(--warning)' }} />警告</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>156</div>
            <div className="stat-sub">较昨日 <span className="up" style={{ color: 'var(--warning)' }}>+3.2%</span></div>
          </div>
          <div className="al-stat-card">
            <div className="stat-label"><Activity />API 调用</div>
            <div className="stat-value">89,234</div>
            <div className="stat-sub">较昨日 <span className="up">+15.7%</span></div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="al-filter-bar">
          <input className="v-input" type="datetime-local" defaultValue="2026-07-22T00:00" style={{ width: 200 }} title="开始时间" />
          <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>至</span>
          <input className="v-input" type="datetime-local" defaultValue="2026-07-22T23:59" style={{ width: 200 }} title="结束时间" />
          <select className="al-v-select" style={{ width: 140 }} title="日志级别">
            <option>全部级别</option><option>INFO</option><option>WARN</option><option>ERROR</option><option>DEBUG</option>
          </select>
          <select className="al-v-select" style={{ width: 170 }} title="服务筛选">
            <option>全部服务</option><option>mate-ont-server</option><option>mate-llmgw-server</option><option>mate-agent-server</option><option>mate-rag-server</option><option>mate-mcp-server</option><option>mate-a2a-server</option><option>mate-iam-server</option><option>mate-wfe-server</option><option>mate-gw-server</option>
          </select>
          <input className="v-input" type="text" placeholder="搜索日志内容..." style={{ width: 200 }} title="关键词搜索" />
          <div className="al-filter-spacer" />
          <button className="v-btn" style={{ gap: 6 }}><RefreshCw style={{ width: 14, height: 14 }} />刷新</button>
          <button className="v-btn" style={{ gap: 6 }}><Download style={{ width: 14, height: 14 }} />导出</button>
        </div>

        {/* Content area: table + detail panel */}
        <div className="al-content-area">
          <div className="al-content-left">
            <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 165, textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>时间戳</th>
                  <th style={{ width: 72, textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>级别</th>
                  <th style={{ width: 170, textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>服务名</th>
                  <th style={{ width: 130, textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Trace ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>消息内容</th>
                  <th style={{ width: 72, textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>耗时</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_LOGS.map((log, i) => {
                  const isActive = i === selectedIdx;
                  return (
                    <tr key={i} onClick={() => setSelectedIdx(i)} style={{ cursor: 'pointer', background: isActive ? 'var(--muted)' : undefined }}>
                      <td className="al-ts-cell" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{log.ts}</td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className={`v-badge ${log.levelBadge}`}>{log.level}</span></td>
                      <td className="al-service-cell" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{log.service}</td>
                      <td className="al-trace-cell" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{log.traceId}</td>
                      <td className="al-msg-cell" style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>{log.message}</td>
                      <td className="al-duration-cell" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{log.duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="al-pagination">
              <div className="al-pagination-info">共 12,456 条记录，第 1 / 1,246 页</div>
              <div className="al-pagination-controls">
                <button disabled style={{ opacity: 0.3, cursor: 'default' }}>«</button>
                <button className="pg-active">1</button>
                <button>2</button>
                <button>3</button>
                <button>...</button>
                <button>1,246</button>
                <button>»</button>
              </div>
            </div>
          </div>

          {/* Log detail panel */}
          <div className="al-detail-panel">
            <div className="v-card">
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>日志详情</div>
                <button className="v-btn" style={{ height: 28, width: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="关闭"><X style={{ width: 16, height: 16 }} /></button>
              </div>

              {/* Basic info */}
              <div className="al-detail-section">
                <div className="al-detail-meta-row">
                  <span className="dm-label">级别</span>
                  <span className={`v-badge ${LEVEL_BADGE[selected.level]}`}>{selected.level}</span>
                </div>
                <div className="al-detail-meta-row">
                  <span className="dm-label">服务</span>
                  <span className="dm-value">{selected.service}</span>
                </div>
                <div className="al-detail-meta-row">
                  <span className="dm-label">时间</span>
                  <span className="dm-value">{selected.ts.split(' ')[1]}</span>
                </div>
                <div className="al-detail-meta-row">
                  <span className="dm-label">Trace ID</span>
                  <span className="dm-value">4f8a2c1e-b3d7-4e8a-a1f2-c3d5e6f7a8b9</span>
                </div>
                <div className="al-detail-meta-row">
                  <span className="dm-label">耗时</span>
                  <span className="dm-value" style={{ color: 'var(--destructive)' }}>{selected.duration}</span>
                </div>
                <div className="al-detail-meta-row">
                  <span className="dm-label">线程</span>
                  <span className="dm-value">reactor-http-nio-4</span>
                </div>
              </div>

              {/* Full message */}
              <div className="al-detail-section">
                <div className="al-detail-section-title"><MessageSquare />完整消息</div>
                <div className="al-detail-msg">OWL 本体导入失败：命名空间冲突 http://meta.org/ont/core 已存在。导入文件为 order-ontology-v3.owl，目标命名空间与已有本体「业务核心域」冲突，请检查命名空间配置或选择覆盖导入模式。</div>
              </div>

              {/* Stack Trace */}
              <div className="al-detail-section">
                <div className="al-detail-section-title"><Layers />Stack Trace</div>
                <div className="al-detail-stack">
                  <span className="err-highlight">com.metaplatform.ont.exception.NamespaceConflictException</span>: Namespace already exists: http://meta.org/ont/core{'\n'}
                  {'  at '}<span className="pkg">com.metaplatform.ont.service</span>.<span className="fn">OntologyImportService.validateNamespace</span>(OntologyImportService.java:142){'\n'}
                  {'  at '}<span className="pkg">com.metaplatform.ont.service</span>.<span className="fn">OntologyImportService.importOwl</span>(OntologyImportService.java:87){'\n'}
                  {'  at '}<span className="pkg">com.metaplatform.ont.controller</span>.<span className="fn">OntologyController.importFile</span>(OntologyController.java:63){'\n'}
                  {'  at '}<span className="pkg">org.springframework.web.reactive</span>.<span className="fn">HandlerMethod.invoke</span>(HandlerMethod.java:256){'\n'}
                  {'  at '}<span className="pkg">org.springframework.web.reactive</span>.<span className="fn">DispatcherHandler.handleResult</span>(DispatcherHandler.java:189)
                </div>
              </div>

              {/* Related Trace */}
              <div className="al-detail-section">
                <div className="al-detail-section-title"><GitBranch />关联 Trace</div>
                <div className="v-card" style={{ padding: '10px 12px', background: 'var(--muted)' }}>
                  {MOCK_TRACE_ITEMS.map((t, i) => (
                    <div key={i} className="al-detail-trace-item">
                      <span className="dt-service">{t.service}</span>
                      <span className="dt-span">{t.span}</span>
                      <span className="dt-dur" style={t.danger ? { color: 'var(--destructive)' } : undefined}>{t.dur}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request params */}
              <div className="al-detail-section">
                <div className="al-detail-section-title"><Braces />请求参数</div>
                <div className="al-detail-json">
{'{'}{'\n'}
{'  '}<span className="json-key">{'"file"'}</span>: <span className="json-str">{'"order-ontology-v3.owl"'}</span>,{'\n'}
{'  '}<span className="json-key">{'"namespace"'}</span>: <span className="json-str">{'"http://meta.org/ont/core"'}</span>,{'\n'}
{'  '}<span className="json-key">{'"format"'}</span>: <span className="json-str">{'"OWL/XML"'}</span>,{'\n'}
{'  '}<span className="json-key">{'"mode"'}</span>: <span className="json-str">{'"MERGE"'}</span>,{'\n'}
{'  '}<span className="json-key">{'"fileSize"'}</span>: <span className="json-num">245760</span>,{'\n'}
{'  '}<span className="json-key">{'"userId"'}</span>: <span className="json-str">{'"qianqi"'}</span>,{'\n'}
{'  '}<span className="json-key">{'"override"'}</span>: <span className="json-num">false</span>{'\n'}
{'}'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
