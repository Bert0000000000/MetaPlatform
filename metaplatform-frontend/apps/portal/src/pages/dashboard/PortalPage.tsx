import { useLocation } from 'react-router-dom';
import {
  FileText,
  Users,
  Headphones,
  Activity,
  Handshake,
  Briefcase,
  Hash,
  CheckCircle,
  ArrowUpRight,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

const DASHBOARD_TABS = [
  { label: '工作台', path: '/dashboard' },
  { label: '我的应用', path: '/dashboard/my-apps' },
  { label: '我的数字员工', path: '/dashboard/my-agents' },
  { label: '消息', path: '/dashboard/messages' },
  { label: '门户', path: '/dashboard/portal' },
  { label: '交付材料', path: '/dashboard/deliverables' },
];

const portalItemStyle = (isFirst: boolean, isLast: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '16px 20px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: isFirst ? '4px 4px 0 0' : isLast ? '0 0 4px 4px' : 0,
  borderTop: isFirst ? '1px solid var(--border)' : 'none',
});

// MOCK: internal portals
const internalPortals = [
  { icon: FileText, title: 'API 文档门户', desc: 'Swagger/OpenAPI 统一接口文档，覆盖所有平台开放接口', url: 'docs.mateplatform.io/api', metricIcon: Hash, metricText: '1,234', metricSuffix: 'API endpoints', statusOk: false },
  { icon: Users, title: '开发者社区', desc: '技术讨论、最佳实践分享和插件生态 Marketplace', url: 'community.mateplatform.io', metricIcon: Activity, metricText: '3,456', metricSuffix: '活跃用户', statusOk: false },
  { icon: Headphones, title: '客户自助服务', desc: '工单提交、账单查询、SLA 监控与服务等级管理', url: 'support.mateplatform.io', metricIcon: Activity, metricText: '今日 23', metricSuffix: '工单', statusOk: false },
  { icon: Activity, title: '运维监控', desc: 'Grafana 集成，全链路指标仪表盘与告警管理', url: 'monitor.mateplatform.io', metricIcon: CheckCircle, metricText: '系统正常 99.9%', metricSuffix: '', statusOk: true },
];

// MOCK: external portals
const externalPortals = [
  { icon: Handshake, title: '合作伙伴门户', desc: '供应商入驻、合作资质管理、合同与结算', url: 'partner.mateplatform.io' },
  { icon: Briefcase, title: '客户门户', desc: '项目交付进度、里程碑管理与交付物查看', url: 'client.mateplatform.io' },
];

// MOCK: portal access stats
const portalStats = [
  { value: '12,345', label: '今日访问' },
  { value: '89万', label: 'API 调用' },
  { value: '456', label: '活跃用户' },
];

export default function PortalPage() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={DASHBOARD_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.01em' }}>门户</h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>内部门户与外部门户统一管理，快速访问平台各类入口</p>
      </div>

      {/* Internal portals */}
      <div style={{ marginBottom: 32 }}>
        <div className="v-eyebrow" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>内部门户</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {internalPortals.map((p, i) => {
            const Icon = p.icon;
            const MetricIcon = p.metricIcon;
            return (
              <div key={i} style={portalItemStyle(i === 0, i === internalPortals.length - 1)}>
                <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-foreground)', flexShrink: 0 }}>
                  <Icon style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', marginBottom: 2 }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{p.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{p.url}</span>
                    <span style={{ fontSize: 12, color: p.statusOk ? 'var(--success)' : 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MetricIcon style={{ width: 12, height: 12 }} />
                      <strong style={{ fontWeight: 500, color: p.statusOk ? 'var(--success)' : 'var(--foreground)' }}>{p.metricText}</strong>
                      {p.metricSuffix && ` ${p.metricSuffix}`}
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button className="v-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13 }}>
                    <span>访问</span>
                    <ArrowUpRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* External portals */}
      <div style={{ marginBottom: 32 }}>
        <div className="v-eyebrow" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>外部门户</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {externalPortals.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} style={portalItemStyle(i === 0, i === externalPortals.length - 1)}>
                <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-foreground)', flexShrink: 0 }}>
                  <Icon style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', marginBottom: 2 }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{p.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{p.url}</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button className="v-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13 }}>
                    <span>访问</span>
                    <ArrowUpRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portal access stats */}
      <div>
        <div className="v-eyebrow" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>门户访问统计</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {portalStats.map((s, i) => (
            <div key={i} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: i === 0 ? '4px 0 0 4px' : i === portalStats.length - 1 ? '0 4px 4px 0' : 0,
              borderLeft: i === 0 ? '1px solid var(--border)' : 'none', borderRight: i === portalStats.length - 1 ? '1px solid var(--border)' : 'none',
              padding: 20, display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
