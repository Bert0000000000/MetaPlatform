import { useLocation } from 'react-router-dom';
import { Button } from '@douyinfe/semi-ui';
import { useState, useEffect, useMemo } from 'react';
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
  LayoutDashboard,
  BarChart3,
  UserCheck,
  BookOpen,
  ExternalLink,
  Globe,
  Layers,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { getPortals, type PortalItem } from '@/api/dashboard/workbench';


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

// API 返回 icon 是字符串，需映射到 lucide 组件
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, FileText, Users, BarChart3, UserCheck,
  BookOpen, Activity, Handshake, Briefcase, Hash, CheckCircle,
  ExternalLink, Globe, Layers, Server, Headphones,
};
const getIcon = (name: string): LucideIcon => ICON_MAP[name] ?? Globe;

// FALLBACK：API 不可达时使用
const FALLBACK_PORTALS: PortalItem[] = [
  { name: 'API 文档门户', kind: 'internal', description: 'Swagger/OpenAPI 统一接口文档', icon: 'FileText', visits: 1234, last_visit: '今天', url: 'docs.mateplatform.io/api' },
  { name: '开发者社区', kind: 'internal', description: '技术讨论与最佳实践分享', icon: 'Users', visits: 3456, last_visit: '今天', url: 'community.mateplatform.io' },
  { name: '客户自助服务', kind: 'internal', description: '工单提交、SLA 监控', icon: 'Headphones', visits: 23, last_visit: '今天', url: 'support.mateplatform.io' },
  { name: '运维监控', kind: 'internal', description: 'Grafana 集成仪表盘与告警', icon: 'Activity', visits: 0, last_visit: '今天', url: 'monitor.mateplatform.io' },
  { name: '合作伙伴门户', kind: 'external', description: '供应商入驻与合作资质管理', icon: 'Handshake', visits: 0, last_visit: '今天', url: 'partner.mateplatform.io' },
  { name: '客户门户', kind: 'external', description: '项目交付进度与里程碑管理', icon: 'Briefcase', visits: 0, last_visit: '今天', url: 'client.mateplatform.io' },
];

// 简单的骨架占位（与 DashboardPage 风格一致）
const SkeletonLine: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({ width = '100%', height = '14px', style }) => (
  <div
    style={{
      width, height,
      background: 'linear-gradient(90deg, var(--muted) 0%, var(--border) 50%, var(--muted) 100%)',
      backgroundSize: '200% 100%',
      animation: 'workbench-shimmer 1.4s ease-in-out infinite',
      borderRadius: 4, ...style,
    }}
  />
);

export default function PortalPage() {
  
  // 数据状态
  const [portals, setPortals] = useState<PortalItem[]>(FALLBACK_PORTALS);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPortals()
      .then((res) => {
        if (cancelled) return;
        setPortals(res);
        setSource('api');
      })
      .catch(() => {
        if (cancelled) return;
        setSource('fallback');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 派生数据
  const internalPortals = useMemo(() => portals.filter(p => p.kind === 'internal'), [portals]);
  const externalPortals = useMemo(() => portals.filter(p => p.kind === 'external'), [portals]);
  const portalStats = useMemo(() => {
    const totalVisits = portals.reduce((s, p) => s + p.visits, 0);
    return [
      { value: String(portals.length), label: '门户总数' },
      { value: totalVisits.toLocaleString(), label: '累计访问' },
      { value: String(internalPortals.length), label: '内部门户' },
    ];
  }, [portals, internalPortals.length]);

  // 门户行渲染
  const renderPortalRow = (p: PortalItem, i: number, arr: PortalItem[], isInternal: boolean) => {
    const Icon = getIcon(p.icon);
    return (
      <div key={p.name + i} style={portalItemStyle(i === 0, i === arr.length - 1)}>
        <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-foreground)', flexShrink: 0 }}>
          <Icon style={{ width: 18, height: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', marginBottom: 2 }}>{p.name}</h3>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{p.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{p.url}</span>
            {isInternal && (
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Activity style={{ width: 12, height: 12 }} />
                <strong style={{ fontWeight: 500, color: 'var(--foreground)' }}>{p.visits.toLocaleString()}</strong>
                <span>次访问 · 最近 {p.last_visit}</span>
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Button theme="light" type="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13 }}>
            <span>访问</span>
            <ArrowUpRight style={{ width: 14, height: 14 }} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.01em' }}>门户</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>内部门户与外部门户统一管理，快速访问平台各类入口</p>
          </div>
          {source === 'fallback' && !loading && (
            <span title="API 不可达，使用本地兜底数据" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>本地数据</span>
          )}
        </div>

        {/* Internal portals */}
        <div style={{ marginBottom: 32 }}>
          <div className="v-eyebrow" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>内部门户</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={portalItemStyle(i === 0, i === 3)}>
                    <SkeletonLine width="40px" height="40px" style={{ borderRadius: 4 }} />
                    <div style={{ flex: 1 }}>
                      <SkeletonLine width="35%" height="13px" style={{ marginBottom: 6 }} />
                      <SkeletonLine width="60%" height="11px" style={{ marginBottom: 6 }} />
                      <SkeletonLine width="25%" height="11px" />
                    </div>
                  </div>
                ))
              : internalPortals.length > 0
                ? internalPortals.map((p, i, arr) => renderPortalRow(p, i, arr, true))
                : <div style={{ padding: 24, color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 4 }}>暂无内部门户</div>}
          </div>
        </div>

        {/* External portals */}
        <div style={{ marginBottom: 32 }}>
          <div className="v-eyebrow" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>外部门户</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} style={portalItemStyle(i === 0, i === 1)}>
                    <SkeletonLine width="40px" height="40px" style={{ borderRadius: 4 }} />
                    <div style={{ flex: 1 }}>
                      <SkeletonLine width="35%" height="13px" style={{ marginBottom: 6 }} />
                      <SkeletonLine width="60%" height="11px" />
                    </div>
                  </div>
                ))
              : externalPortals.length > 0
                ? externalPortals.map((p, i, arr) => renderPortalRow(p, i, arr, false))
                : <div style={{ padding: 24, color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 4 }}>暂无外部门户</div>}
          </div>
        </div>

        {/* Portal access stats */}
        <div>
          <div className="v-eyebrow" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>门户访问统计</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {portalStats.map((s, i) => (
              <div key={s.label} style={{
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