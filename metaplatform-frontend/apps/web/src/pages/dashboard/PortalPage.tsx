import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Descriptions, List, Skeleton } from '@douyinfe/semi-ui';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle,
  ExternalLink,
  FileText,
  Globe,
  Handshake,
  Hash,
  Headphones,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Server,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getPortals, type PortalItem } from '@/api/dashboard/workbench';
import { EmptyState, PageHeader } from '@/components/skeleton';
import './home.css';

/**
 * 工作台 · 门户（DESIGN-SPEC §5 版式 A 的 Card + List 组合）。
 *
 * 数据唯一来源 = src/api/dashboard/workbench.getPortals（BFF /dashboard/page/portal）。
 * 与旧页面的差异：删除了本地 FALLBACK_PORTALS 样例数组；接口失败时不再伪装成「有数据」，
 * 直接呈现 failure 空态。访问统计由已加载的门户数据本地派生，不额外造数。
 */

/** 后端返回的 icon 是名字字符串，按名字映射 lucide；未命中用 Globe 兜底。 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  UserCheck,
  BookOpen,
  Activity,
  Handshake,
  Briefcase,
  Hash,
  CheckCircle,
  ExternalLink,
  Globe,
  Layers,
  Server,
  Headphones,
};

function portalIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Globe;
}

function PortalRow({ portal, internal }: { portal: PortalItem; internal: boolean }) {
  const Icon = portalIcon(portal.icon);
  return (
    <List.Item
      main={
        <div className="mp-home-feed-row">
          <Avatar size="small" color="light-blue">
            <Icon size={16} strokeWidth={1.5} />
          </Avatar>
          <div className="mp-home-feed-main">
            <div className="mp-home-feed-title">{portal.name}</div>
            <div className="mp-home-feed-meta">{portal.description}</div>
            <div className="mp-home-feed-meta">
              {portal.url}
              {internal
                ? ` · ${portal.visits.toLocaleString()} 次访问 · 最近 ${portal.last_visit}`
                : ''}
            </div>
          </div>
          {/* 旧页面同样是占位按钮：门户暂未接入统一跳转，这里不伪造跳转目标。 */}
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<ArrowUpRight size={14} strokeWidth={1.5} />}
          >
            访问
          </Button>
        </div>
      }
    />
  );
}

const SKELETON_ROWS = [0, 1, 2];

function PortalList({ items, internal }: { items: PortalItem[]; internal: boolean }) {
  if (items.length === 0) {
    return (
      <EmptyState
        illustration="no-content"
        title={internal ? '暂无内部门户' : '暂无外部门户'}
        desc="门户接入后会在这里列出。"
      />
    );
  }
  return (
    <List
      split={false}
      dataSource={items}
      renderItem={(p: PortalItem) => <PortalRow portal={p} internal={internal} />}
    />
  );
}

export default function PortalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portals, setPortals] = useState<PortalItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPortals(await getPortals());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const internalPortals = useMemo(() => portals.filter((p) => p.kind === 'internal'), [portals]);
  const externalPortals = useMemo(() => portals.filter((p) => p.kind === 'external'), [portals]);
  const totalVisits = useMemo(() => portals.reduce((sum, p) => sum + p.visits, 0), [portals]);

  const renderLoading = (_: number, index: number) => (
    <List.Item
      key={`loading-${index}`}
      main={
        <>
          <Skeleton.Title />
          <Skeleton.Paragraph rows={2} />
        </>
      }
    />
  );

  const listOrSkeleton = (items: PortalItem[], internal: boolean) =>
    loading ? (
      <List split={false} dataSource={SKELETON_ROWS} renderItem={renderLoading} />
    ) : (
      <PortalList items={items} internal={internal} />
    );

  return (
    <>
      <PageHeader
        title="门户"
        desc="内部门户与外部门户统一管理，快速访问平台各类入口"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="门户加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : (
        <div className="mp-home-grid">
          <div className="mp-home-col">
            <Card title="内部门户">{listOrSkeleton(internalPortals, true)}</Card>
            <Card title="外部门户">{listOrSkeleton(externalPortals, false)}</Card>
          </div>

          <div className="mp-home-col">
            <Card title="门户访问统计">
              <Descriptions
                row
                column={1}
                data={[
                  { key: '门户总数', value: String(portals.length) },
                  { key: '累计访问', value: totalVisits.toLocaleString() },
                  { key: '内部门户', value: String(internalPortals.length) },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
