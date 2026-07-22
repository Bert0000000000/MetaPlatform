import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, Wrench, Percent, Layers, Tag, GitMerge,
  Database, Shield, Rocket, ListChecks, Plus, Filter, FileWarning,
  ExternalLink, GitPullRequest, ScrollText,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

// MOCK
const stats = [
  { label: '治理规则', value: '24', sub: '命名 / 接口 / 数据 / 安全 / 部署', icon: <ShieldCheck /> },
  { label: '违规记录', value: '7', sub: '本月累计', valueColor: 'var(--destructive)', icon: <AlertTriangle /> },
  { label: '待整改', value: '3', sub: '需人工处理', valueColor: 'var(--warning)', icon: <Wrench /> },
  { label: '合规率', value: '87.5%', sub: '较上月 +2.1%', valueColor: 'var(--success)', icon: <Percent /> },
];

// MOCK
const categories = [
  { name: '命名规范', count: 5, icon: <Tag />, active: true },
  { name: '接口规范', count: 6, icon: <GitMerge /> },
  { name: '数据规范', count: 4, icon: <Database /> },
  { name: '安全规范', count: 5, icon: <Shield /> },
  { name: '部署规范', count: 4, icon: <Rocket /> },
];

// MOCK
const rules = [
  { id: 'GR-001', name: 'API 路径命名规范', cat: '命名', catBadge: 'neutral', scope: '全量服务', violations: 0, severity: 'mid', status: '已生效', badge: 'success', selected: true },
  { id: 'GR-002', name: 'OAuth2 鉴权强制启用', cat: '安全', catBadge: 'error', scope: 'TECH-GW, TECH-IAM', violations: 0, severity: 'high', status: '已生效', badge: 'success' },
  { id: 'GR-003', name: '接口响应 P99 < 200ms', cat: '接口', catBadge: 'warning', scope: '全量服务', violations: 2, severity: 'mid', status: '已生效', badge: 'success' },
  { id: 'GR-004', name: '实体主键命名 entity_id', cat: '数据', catBadge: 'neutral', scope: 'TECH-ONT, TECH-DATA', violations: 0, severity: 'mid', status: '已生效', badge: 'success' },
  { id: 'GR-005', name: '接口契约注册到 Nacos', cat: '接口', catBadge: 'info', scope: '全量服务', violations: 1, severity: 'high', status: '已生效', badge: 'success' },
  { id: 'GR-006', name: 'Kafka 消息 Outbox 模式', cat: '数据', catBadge: 'neutral', scope: 'TECH-MSG, 全量生产者', violations: 0, severity: 'high', status: '已生效', badge: 'success' },
  { id: 'GR-007', name: 'Java 包名 com.metaplatform.*', cat: '命名', catBadge: 'neutral', scope: '全量 Java 服务', violations: 1, severity: 'low', status: '待修订', badge: 'warning' },
  { id: 'GR-008', name: 'trace_id 全链路传播', cat: '接口', catBadge: 'warning', scope: '全量服务', violations: 1, severity: 'high', status: '已生效', badge: 'success' },
  { id: 'GR-009', name: 'MCP/A2A 必须经过 IAM 鉴权', cat: '安全', catBadge: 'error', scope: 'TECH-MCP, TECH-A2A', violations: 2, severity: 'high', status: '已生效', badge: 'success' },
  { id: 'GR-010', name: '容器镜像须通过 CI 扫描', cat: '部署', catBadge: 'neutral', scope: '全量服务', violations: 0, severity: 'mid', status: '已生效', badge: 'success' },
];

// MOCK
const adrTimeline = [
  { id: 'ADR-005', date: '2026-07-21', status: 'accepted', heading: '后端统一迁移至 Java 21 + Spring AI Alibaba', desc: '全量后端服务从 Python FastAPI 重写为 Java 21 + Spring Boot 3.5 + SAA 1.1.2.0，消除双栈运维成本。Python 仅保留运维脚本。' },
  { id: 'ADR-004', date: '2026-07-18', status: 'accepted', heading: 'Nacos 3.0+ 作为 MCP / A2A 统一注册中心', desc: 'MCP Server 与 A2A Agent 统一注册到 Nacos 3.0+ Registry，实现动态服务发现与模型路由配置，替代自研注册表。' },
  { id: 'ADR-003', date: '2026-07-15', status: 'superseded', heading: '向量数据库选型 Milvus 2.5', desc: '选定 Milvus 2.5 作为 RAG 向量检索引擎，通过 SAA VectorStore 适配。后续需评估 RaBitQ 量化对精度的影响。（已被 ADR-004 补充 Nacos 集成方案）' },
  { id: 'ADR-002', date: '2026-07-10', status: 'accepted', heading: '数据湖格式 Hudi 为主 / Iceberg 为备', desc: 'Hudi 作为主数据湖格式（原生 CDC/upsert 支持），Iceberg 作为备选方案。OLAP 通过 StarRocks 直读。' },
  { id: 'ADR-006', date: '2026-07-22', status: 'pending', heading: '前端框架升级至 React 19 + Ant Design 6.0', desc: '评估 React 19 新并发特性与 Ant Design 6.0 的 AI 组件（Ant Design X 2.0）对 APP-SUPERAI 的支撑能力，待架构委员会审批。' },
];

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

export default function ArchGovernancePage() {
  const location = useLocation();
  const [selectedRule, setSelectedRule] = useState(0);

  return (
    <>
      <style>{`
        :root { --destructive-subtle:#2a1418; --info:#60a5fa; --info-subtle:rgba(59,130,246,0.12); }
        .ag-page-header { margin-bottom:24px; }
        .ag-page-header h1 { font-size:24px; font-weight:700; margin-bottom:6px; }
        .ag-page-header p { font-size:14px; color:var(--muted-foreground); }
        .ag-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .ag-stat-card { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:16px; }
        .ag-stat-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; display:flex; align-items:center; gap:6px; }
        .ag-stat-label svg { width:14px; height:14px; }
        .ag-stat-value { font-size:28px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
        .ag-stat-sub { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ag-governance-body { display:grid; grid-template-columns:200px 1fr 300px; gap:16px; margin-bottom:24px; }
        .ag-category-panel { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:16px; align-self:start; position:sticky; top:24px; }
        .ag-category-title { font-size:13px; font-weight:600; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
        .ag-category-title svg { width:14px; height:14px; color:var(--muted-foreground); }
        .ag-category-item { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:var(--radius); cursor:pointer; font-size:12px; margin-bottom:2px; transition:background .15s; }
        .ag-category-item:hover { background:var(--muted); }
        .ag-category-item.active { background:var(--muted); color:var(--foreground); }
        .ag-category-name { color:var(--foreground); }
        .ag-category-count { font-family:var(--font-mono); font-size:11px; color:var(--muted-foreground); background:var(--muted); padding:1px 6px; border-radius:3px; }
        .ag-category-item.active .ag-category-count { background:var(--border); color:var(--foreground); }
        .ag-category-icon { width:14px; height:14px; margin-right:8px; flex-shrink:0; color:var(--muted-foreground); }
        .ag-rules-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
        .ag-rules-header { display:flex; align-items:center; justify-content:space-between; padding:16px 16px 12px; border-bottom:1px solid var(--border); }
        .ag-rules-header-title { font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; }
        .ag-rules-header-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .ag-rules-header-actions { display:flex; gap:6px; }
        .ag-rules-meta { font-size:11px; color:var(--muted-foreground); }
        .ag-v-table { width:100%; border-collapse:collapse; }
        .ag-v-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:500; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); white-space:nowrap; }
        .ag-v-table td { padding:10px 14px; font-size:12px; color:var(--foreground); border-bottom:1px solid var(--border); }
        .ag-v-table tr:last-child td { border-bottom:none; }
        .ag-v-table tr:hover td { background:var(--muted); }
        .ag-v-table tr.selected td { background:rgba(250,250,250,0.04); }
        .ag-v-mono { font-family:var(--font-mono); font-size:11px; color:var(--muted-foreground); }
        .ag-sev-high { color:var(--destructive); }
        .ag-sev-mid { color:var(--warning); }
        .ag-sev-low { color:var(--muted-foreground); }
        .ag-sev-indicator { display:inline-flex; align-items:center; gap:4px; }
        .ag-sev-dot { width:6px; height:6px; border-radius:50%; }
        .ag-sev-dot.high { background:var(--destructive); }
        .ag-sev-dot.mid { background:var(--warning); }
        .ag-sev-dot.low { background:var(--muted-foreground); }
        .v-badge-error { background:var(--destructive-subtle); color:var(--destructive); }
        .v-badge-info { background:var(--info-subtle); color:var(--info); }
        .ag-detail-panel { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:16px; align-self:start; position:sticky; top:24px; }
        .ag-detail-title { font-size:13px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .ag-detail-title svg { width:14px; height:14px; color:var(--muted-foreground); }
        .ag-detail-section { margin-bottom:16px; }
        .ag-detail-section:last-child { margin-bottom:0; }
        .ag-detail-label { font-size:11px; color:var(--muted-foreground); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em; }
        .ag-detail-value { font-size:13px; color:var(--foreground); line-height:1.6; }
        .ag-detail-value.code { font-family:var(--font-mono); font-size:12px; color:var(--muted-foreground); background:var(--muted); padding:2px 6px; border-radius:3px; display:inline-block; }
        .ag-detail-divider { border-top:1px solid var(--border); margin:14px 0; }
        .ag-impact-tags { display:flex; gap:6px; flex-wrap:wrap; }
        .ag-impact-tag { font-size:11px; background:var(--muted); color:var(--muted-foreground); padding:2px 8px; border-radius:3px; font-family:var(--font-mono); }
        .ag-suggestion-item { font-size:12px; color:var(--foreground); padding:6px 0; padding-left:14px; position:relative; line-height:1.5; }
        .ag-suggestion-item::before { content:''; position:absolute; left:0; top:13px; width:6px; height:6px; border-radius:50%; background:var(--border); }
        .ag-ticket-link { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#60a5fa; font-family:var(--font-mono); padding:4px 0; }
        .ag-ticket-link svg { width:12px; height:12px; }
        .ag-adr-section { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-top:24px; }
        .ag-adr-title { font-size:14px; font-weight:600; margin-bottom:20px; display:flex; align-items:center; gap:8px; }
        .ag-adr-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .ag-adr-timeline { position:relative; padding-left:28px; }
        .ag-adr-timeline::before { content:''; position:absolute; left:9px; top:8px; bottom:8px; width:1px; background:var(--border); }
        .ag-adr-item { position:relative; padding-bottom:20px; margin-left:-28px; padding-left:28px; }
        .ag-adr-item:last-child { padding-bottom:0; }
        .ag-adr-dot { position:absolute; left:0; top:4px; width:18px; height:18px; border-radius:50%; background:var(--muted); border:2px solid var(--border); display:flex; align-items:center; justify-content:center; }
        .ag-adr-dot.accepted { border-color:var(--success); background:var(--success-subtle); }
        .ag-adr-dot.superseded { border-color:var(--warning); background:var(--warning-subtle); }
        .ag-adr-dot.pending { border-color:var(--muted-foreground); background:var(--muted); }
        .ag-adr-dot-inner { width:6px; height:6px; border-radius:50%; }
        .ag-adr-dot.accepted .ag-adr-dot-inner { background:var(--success); }
        .ag-adr-dot.superseded .ag-adr-dot-inner { background:var(--warning); }
        .ag-adr-dot.pending .ag-adr-dot-inner { background:var(--muted-foreground); }
        .ag-adr-meta { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
        .ag-adr-id { font-family:var(--font-mono); font-size:11px; color:#60a5fa; }
        .ag-adr-date { font-family:var(--font-mono); font-size:11px; color:var(--muted-foreground); }
        .ag-adr-status { font-size:10px; font-weight:600; letter-spacing:0.03em; padding:1px 6px; border-radius:3px; }
        .ag-adr-status.accepted { background:var(--success-subtle); color:var(--success); }
        .ag-adr-status.superseded { background:var(--warning-subtle); color:var(--warning); }
        .ag-adr-status.pending { background:var(--muted); color:var(--muted-foreground); }
        .ag-adr-heading { font-size:14px; font-weight:500; margin-bottom:4px; }
        .ag-adr-desc { font-size:12px; color:var(--muted-foreground); line-height:1.5; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="ag-page-header">
          <h1>架构治理</h1>
          <p>架构规范、评审与合规管理</p>
        </div>

        {/* Stats */}
        <div className="ag-stats-row">
          {stats.map((s) => (
            <div className="ag-stat-card" key={s.label}>
              <div className="ag-stat-label">{s.icon}{s.label}</div>
              <div className="ag-stat-value" style={s.valueColor ? { color: s.valueColor } : undefined}>
                {s.value.includes('%') && s.value !== '87.5%' ? s.value : s.value === '87.5%' ? <>{s.value.slice(0, -1)}<span style={{ fontSize: 16, fontWeight: 400 }}>%</span></> : s.value}
              </div>
              <div className="ag-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Three-column layout */}
        <div className="ag-governance-body">
          {/* Category panel */}
          <div className="ag-category-panel">
            <div className="ag-category-title"><Layers />规则分类</div>
            {categories.map((cat) => (
              <div key={cat.name} className={`ag-category-item${cat.active ? ' active' : ''}`} style={{ padding: '8px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="ag-category-icon">{cat.icon}</span>
                  <span className="ag-category-name">{cat.name}</span>
                </span>
                <span className="ag-category-count">{cat.count}</span>
              </div>
            ))}
          </div>

          {/* Rules table */}
          <div className="ag-rules-card">
            <div className="ag-rules-header" style={{ padding: '16px 16px 12px' }}>
              <div className="ag-rules-header-title"><ListChecks />治理规则（全部）</div>
              <div className="ag-rules-header-actions">
                <button className="v-btn" style={{ height: 30, fontSize: 12, gap: 6, display: 'inline-flex', alignItems: 'center' }}><Plus style={{ width: 13, height: 13 }} />新增规则</button>
                <button className="v-btn" style={{ height: 30, fontSize: 12, gap: 6, display: 'inline-flex', alignItems: 'center' }}><Filter style={{ width: 13, height: 13 }} />筛选</button>
              </div>
            </div>
            <div className="ag-rules-meta" style={{ padding: '0 16px 8px' }}>共 10 条规则</div>
            <table className="ag-v-table">
              <thead>
                <tr>
                  <th>编号</th><th>规则名称</th><th>类别</th><th>适用范围</th><th>违反次数</th><th>严重程度</th><th>状态</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, idx) => (
                  <tr
                    key={rule.id}
                    className={idx === selectedRule ? 'selected' : ''}
                    onClick={() => setSelectedRule(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="ag-v-mono">{rule.id}</td>
                    <td style={{ fontWeight: 500 }}>{rule.name}</td>
                    <td><span className={`v-badge v-badge-${rule.catBadge}`}>{rule.cat}</span></td>
                    <td>{rule.scope}</td>
                    <td>{rule.violations}</td>
                    <td>
                      <span className="ag-sev-indicator">
                        <span className={`ag-sev-dot ${rule.severity}`} />
                        <span className={`ag-sev-${rule.severity === 'high' ? 'high' : rule.severity === 'mid' ? 'mid' : 'low'}`}>
                          {rule.severity === 'high' ? '高' : rule.severity === 'mid' ? '中' : '低'}
                        </span>
                      </span>
                    </td>
                    <td><span className={`v-badge v-badge-${rule.badge}`}>{rule.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          <div className="ag-detail-panel">
            <div className="ag-detail-title"><FileWarning />违规详情</div>
            <div className="ag-detail-section">
              <div className="ag-detail-label">违规规则</div>
              <div className="ag-detail-value" style={{ fontWeight: 500 }}>GR-003 接口响应 P99 &lt; 200ms</div>
            </div>
            <div className="ag-detail-divider" />
            <div className="ag-detail-section">
              <div className="ag-detail-label">违规服务</div>
              <div className="ag-detail-value code">TECH-RAG</div>
            </div>
            <div className="ag-detail-section">
              <div className="ag-detail-label">违规详情</div>
              <div className="ag-detail-value" style={{ fontSize: 12, lineHeight: 1.6 }}>/api/v1/rag/retrieve 接口 P99 响应时间达 347ms，超出 200ms 阈值上限 73.5%。近 24 小时内累计触发 42 次超限。</div>
            </div>
            <div className="ag-detail-divider" />
            <div className="ag-detail-section">
              <div className="ag-detail-label">严重程度</div>
              <div className="ag-detail-value">
                <span className="ag-sev-indicator">
                  <span className="ag-sev-dot mid" />
                  <span className="ag-sev-mid" style={{ fontSize: 13 }}>中</span>
                </span>
              </div>
            </div>
            <div className="ag-detail-section">
              <div className="ag-detail-label">影响范围</div>
              <div className="ag-impact-tags">
                <span className="ag-impact-tag">APP-SUPERAI</span>
                <span className="ag-impact-tag">APP-DW</span>
                <span className="ag-impact-tag">APP-ONTSTUDIO</span>
              </div>
            </div>
            <div className="ag-detail-divider" />
            <div className="ag-detail-section">
              <div className="ag-detail-label">整改建议</div>
              <div className="ag-suggestion-item" style={{ padding: '6px 0', paddingLeft: 14 }}>Milvus 向量索引从 IVF_FLAT 切换为 HNSW，预期 P99 降低 40%</div>
              <div className="ag-suggestion-item" style={{ padding: '6px 0', paddingLeft: 14 }}>启用 RAG 查询结果缓存（Redis），命中率预估 35%</div>
              <div className="ag-suggestion-item" style={{ padding: '6px 0', paddingLeft: 14 }}>调整 embedding batch size 从 32 提升至 64</div>
            </div>
            <div className="ag-detail-divider" />
            <div className="ag-detail-section">
              <div className="ag-detail-label">关联工单</div>
              <div className="ag-ticket-link"><ExternalLink />RAG-2026-0742</div>
              <div className="ag-ticket-link" style={{ marginTop: 4 }}><GitPullRequest />PR #387</div>
            </div>
            <div className="ag-detail-divider" />
            <div className="ag-detail-section">
              <div className="ag-detail-label">检测时间</div>
              <div className="ag-detail-value code">2026-07-22 08:00:00</div>
            </div>
          </div>
        </div>

        {/* ADR Timeline */}
        <div className="ag-adr-section">
          <div className="ag-adr-title"><ScrollText />架构决策记录（ADR）</div>
          <div className="ag-adr-timeline" style={{ paddingLeft: 28 }}>
            {adrTimeline.map((adr) => (
              <div className="ag-adr-item" key={adr.id} style={{ paddingBottom: 20, marginLeft: -28, paddingLeft: 28 }}>
                <div className={`ag-adr-dot ${adr.status}`} style={{ left: 0 }}>
                  <div className="ag-adr-dot-inner" />
                </div>
                <div className="ag-adr-meta" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span className="ag-adr-id" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#60a5fa' }}>{adr.id}</span>
                  <span className="ag-adr-date" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)' }}>{adr.date}</span>
                  <span className={`ag-adr-status ${adr.status}`} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize' }}>{adr.status}</span>
                </div>
                <div className="ag-adr-heading" style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{adr.heading}</div>
                <div className="ag-adr-desc" style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{adr.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
