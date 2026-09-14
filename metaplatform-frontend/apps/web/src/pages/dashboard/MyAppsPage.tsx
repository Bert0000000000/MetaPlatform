import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Form, List, Select, Tag, Toast } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  Activity,
  Bookmark,
  BookOpen,
  Building2,
  FileText,
  Headphones,
  LayoutGrid,
  ListChecks,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getMyApps, type MyAppItem } from '@/api/dashboard/workbench';
import { EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import './home.css';

/**
 * 工作台 · 我的应用（DESIGN-SPEC §5 版式 C：页头 + 筛选栏 + 卡片网格）。
 *
 * 数据唯一来源 = src/api/dashboard/workbench.getMyApps（BFF /dashboard/page/myapps）。
 * 与旧页面的差异：删除了本地 FALLBACK_APPS 样例数组；接口失败时不再伪装成「有数据」，
 * 直接呈现 failure 空态（DESIGN-SPEC §5 共享元素 · 空状态）。
 */

/** 后端返回的 icon 是名字字符串，按名字映射 lucide；未命中用 FileText 兜底。 */
const APP_ICONS: Record<string, LucideIcon> = {
  ShoppingBag,
  Users,
  TrendingUp,
  Headphones,
  ListChecks,
  TriangleAlert,
  BookOpen,
  Building2,
  FileText,
  ShieldCheck,
  Activity,
};

const FALLBACK_APP_ICON = FileText;

function appIcon(name: string): LucideIcon {
  return APP_ICONS[name] ?? FALLBACK_APP_ICON;
}

/** 应用分类色（沿用旧页面语义：业务蓝 / 数据绿 / AI 紫）。 */
const TYPE_COLOR: Record<string, TagColor> = {
  business: 'blue',
  data: 'green',
  ai: 'purple',
};

/** 卡片网格的一格：加载期用数字占位，复用 Semi Card 自带骨架。 */
type AppCardSlot = MyAppItem | number;

function appMetaText(app: MyAppItem): string {
  const base = app.last_used
    ? `最近使用：${app.last_used}`
    : app.date
      ? `创建：${app.date}`
      : '暂无使用记录';
  return app.usage ? `${base} · ${app.usage}` : base;
}

function AppCard({ app }: { app: MyAppItem }) {
  const Icon = appIcon(app.icon);
  return (
    <Card
      title={
        <span className="mp-home-agent">
          <Avatar size="small" color="light-blue">
            <Icon size={16} strokeWidth={1.5} />
          </Avatar>
          <span className="mp-home-agent-name">{app.name}</span>
        </span>
      }
      headerExtraContent={
        <Tag type="light" color={TYPE_COLOR[app.type] ?? 'grey'}>
          {app.type_label}
        </Tag>
      }
      footer={
        <div className="mp-home-todo">
          <span className="mp-home-feed-meta">{appMetaText(app)}</span>
          <Button theme="solid" type="primary" size="small">
            打开
          </Button>
        </div>
      }
    >
      <div className="mp-home-feed-meta">{app.description}</div>
    </Card>
  );
}

interface CreateAppValues {
  name: string;
  code?: string;
  type: string;
  description?: string;
  icon: string;
  visibility: string;
}

export default function MyAppsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apps, setApps] = useState<MyAppItem[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<CreateAppValues>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setApps(await getMyApps());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 派生视图：先按类型 / 关键词过滤，再按 pinned 拆成「常用应用」和「全部应用」。
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter(
      (a) =>
        (type === 'all' || a.type === type) &&
        (q === '' || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)),
    );
  }, [apps, query, type]);

  const pinnedApps = useMemo(() => filtered.filter((a) => a.pinned), [filtered]);
  const otherApps = useMemo(() => filtered.filter((a) => !a.pinned), [filtered]);

  const renderSlot = (slot: AppCardSlot) => (
    <List.Item key={typeof slot === 'number' ? `loading-${slot}` : slot.name}>
      {typeof slot === 'number' ? <Card loading /> : <AppCard app={slot} />}
    </List.Item>
  );

  const section = (title: string, Icon: LucideIcon, items: AppCardSlot[]) => (
    <List<AppCardSlot>
      header={
        <span className="mp-home-kpi-label">
          <Icon size={14} strokeWidth={1.5} />
          {title}
        </span>
      }
      grid={{ gutter: 12, span: 12 }}
      split={false}
      dataSource={items}
      renderItem={renderSlot}
    />
  );

  /** 新建应用：后端暂无写接口，校验通过后如实提示，不伪造创建成功。 */
  const submitCreate = useCallback(async () => {
    const values = await createForm.validate().catch(() => null);
    if (!values) return; // 校验失败，Semi Form 已就地提示
    Toast.info(`新建应用写接口尚未接入（${values.name}）`);
    setCreating(false);
    createForm.reset();
  }, [createForm]);

  return (
    <>
      <PageHeader
        title="我的应用"
        desc="管理并快速访问你有权限的所有应用"
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => setCreating(true)}
            >
              新建应用
            </Button>
          </>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="应用列表加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : !loading && apps.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="还没有可访问的应用"
          desc="申请应用权限或联系管理员开通后，这里会列出你的应用。"
        />
      ) : (
        <>
          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: '搜索应用名称或描述' }}
            filters={
              <Select value={type} onChange={(v) => setType(String(v))}>
                <Select.Option value="all">全部类型</Select.Option>
                <Select.Option value="business">业务应用</Select.Option>
                <Select.Option value="data">数据应用</Select.Option>
                <Select.Option value="ai">AI 应用</Select.Option>
              </Select>
            }
          />

          {!loading && filtered.length === 0 ? (
            <EmptyState
              illustration="no-result"
              title="没有匹配的应用"
              desc="换个关键词，或清除类型筛选。"
              actions={
                <Button
                  theme="solid"
                  type="primary"
                  onClick={() => {
                    setQuery('');
                    setType('all');
                  }}
                >
                  清除筛选
                </Button>
              }
            />
          ) : (
            <div className="mp-home-col">
              {loading || pinnedApps.length > 0
                ? section('常用应用', Bookmark, loading ? [0, 1, 2, 3] : pinnedApps)
                : null}
              {section(
                '全部应用',
                LayoutGrid,
                loading ? [0, 1, 2, 3, 4, 5] : otherApps,
              )}
            </div>
          )}
        </>
      )}

      <SheetDetail
        title="新建应用"
        open={creating}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>取消</Button>
            <Button theme="solid" type="primary" onClick={() => void submitCreate()}>
              创建
            </Button>
          </>
        }
      >
        <Form form={createForm} labelPosition="top">
          <Form.Input
            field="name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
            placeholder="请输入应用名称"
          />
          <Form.Input field="code" label="应用编码" placeholder="如 app-order-mgmt" />
          <Form.Select
            field="type"
            label="应用类型"
            initValue="business"
            optionList={[
              { label: '业务应用', value: 'business' },
              { label: '工具应用', value: 'tool' },
              { label: '数据分析', value: 'data' },
              { label: 'AI 助手', value: 'ai' },
            ]}
          />
          <Form.TextArea field="description" label="描述" placeholder="请输入应用描述" rows={4} />
          <Form.Select
            field="icon"
            label="图标"
            initValue="app"
            optionList={[
              { label: '应用图标', value: 'app' },
              { label: '图表图标', value: 'chart' },
              { label: '机器人图标', value: 'bot' },
              { label: '数据库图标', value: 'db' },
              { label: '文档图标', value: 'doc' },
            ]}
          />
          <Form.Select
            field="visibility"
            label="可见范围"
            initValue="company"
            optionList={[
              { label: '全公司', value: 'company' },
              { label: '指定组织', value: 'org' },
              { label: '私有', value: 'private' },
            ]}
          />
        </Form>
      </SheetDetail>
    </>
  );
}
