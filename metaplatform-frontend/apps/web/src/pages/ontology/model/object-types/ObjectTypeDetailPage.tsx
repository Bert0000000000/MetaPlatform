import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Tag } from '@douyinfe/semi-ui';
import { Link } from 'react-router-dom';
import {
  getMaterialization,
  getObjectType,
  listActionTypes,
  listLinkTypes,
  listObjectTypes,
  type KernelActionType,
  type KernelLinkType,
  type KernelObjectType,
  type MaterializationResult,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState } from '@/components/skeleton';
import ResourceDetailLayout from '../../layout/ResourceDetailLayout';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 对象类型详情（IA2-2 资源详情路由）：/ontology/model/object-types/:rid[/:tab]。
 *
 * <p>四个**有真实数据**的 Tab 进 URL（ADR-0069 路由即状态）：概览 / 属性 / 关系 /
 * 数据源（物化）。矩阵里的 interfaces / axioms / dependents / history / security
 * 尚无独立数据面——不渲染页签、不造假（设计规格 §2.5），随批次补。
 *
 * <p>:rid 由 React Router 解码；构造链接时调用方需 encodeURIComponent。
 */
type DetailTab = 'overview' | 'properties' | 'links' | 'datasources' | 'history';

const TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'properties', label: '属性' },
  { key: 'links', label: '关系' },
  { key: 'datasources', label: '数据源' },
  { key: 'history', label: '版本历史' },
];

function normalizeTab(raw: string | undefined): DetailTab {
  return TABS.some((t) => t.key === raw) ? (raw as DetailTab) : 'overview';
}

export default function ObjectTypeDetailPage() {
  const { rid = '', tab: rawTab } = useParams<{ rid: string; tab?: string }>();
  const navigate = useNavigate();
  const tab = normalizeTab(rawTab);

  const [type, setType] = useState<KernelObjectType | null>(null);
  const [actions, setActions] = useState<KernelActionType[] | null>(null);
  const [links, setLinks] = useState<KernelLinkType[] | null>(null);
  const [materialization, setMaterialization] = useState<MaterializationResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const t = await getObjectType(rid);
      setType(t);
      // 关系与物化是详情页的两个独立数据面，各自失败不拖垮整页
      listLinkTypes()
        .then((all) => setLinks(all.filter((l) => l.src === rid || l.dst === rid)))
        .catch(() => setLinks([]));
      getMaterialization(rid)
        .then(setMaterialization)
        .catch(() => setMaterialization(null));
      // 概念完整性 K：概览的关联 Action 直达（与概念抽屉对齐）
      listActionTypes()
        .then((all) => setActions(all.filter((at) => at.on.includes(rid))))
        .catch(() => setActions([]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 切 Tab = 换路由段（可分享 / 可返回），不改本地 state。 */
  const switchTab = (key: string) => navigate(`/ontology/model/object-types/${encodeURIComponent(rid)}/${key}`);

  const title = type?.display_name || ridTail(rid);

  const relationColumns = useMemo(
    () => [
      {
        title: '关系',
        dataIndex: 'rid',
        width: 200,
        ellipsis: true,
        render: (_: unknown, row: KernelLinkType) => (
          <span className="mp-onto-strong">{ridTail(row.rid)}</span>
        ),
      },
      {
        title: '方向',
        dataIndex: 'src',
        width: 320,
        ellipsis: true,
        render: (_: unknown, row: KernelLinkType) =>
          row.src === rid
            ? `出 → ${row.dst_display_name || ridTail(row.dst)}`
            : `入 ← ${row.src_display_name || ridTail(row.src)}`,
      },
      { title: '基数', dataIndex: 'cardinality', width: 120 },
      { title: '方向性', dataIndex: 'directionality', width: 130 },
    ],
    [rid],
  );

  return (
    <ResourceDetailLayout
      title={title}
      desc={`${rid} · 对象类型详情 · 数据取自本体内核 v2`}
      tabs={TABS.map((t) => ({
        key: t.key,
        label: t.key === 'links' ? `关系${links ? ` · ${links.length}` : ''}` : t.label,
      }))}
      activeTab={tab}
      onTabChange={switchTab}
    >
      {error ? (
        <EmptyState
          illustration="failure"
          title="对象类型读取失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <EmptyState illustration="no-content" title="读取中…" desc="数据取自本体内核 v2" />
      ) : !type ? null : tab === 'overview' ? (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>rid</dt>
            <dd className="mp-onto-mono">{type.rid}</dd>
            <dt>主键</dt>
            <dd>{type.primary_key.join(', ') || '—'}</dd>
            <dt>父类型</dt>
            <dd>{type.parent_class ? ridTail(type.parent_class) : '—'}</dd>
            <dt>类型组</dt>
            <dd>{type.type_group || '—'}</dd>
            <dt>状态</dt>
            <dd>{type.status ? <Tag size="small" type="light">{type.status}</Tag> : '—'}</dd>
            <dt>接口</dt>
            <dd>{type.interfaces.length ? type.interfaces.map(ridTail).join('、') : '—'}</dd>
            <dt>属性数</dt>
            <dd>{type.properties.length}</dd>
            <dt>关系数</dt>
            <dd>{links?.length ?? '…'}</dd>
            <dt>关联 Action</dt>
            <dd>
              {actions === null ? (
                '…'
              ) : actions.length === 0 ? (
                '—'
              ) : (
                <span className="mp-flex mp-wrap mp-gap-1">
                  {actions.map((at) => (
                    <Link
                      key={at.rid}
                      to={`/ontology/logic/actions/${encodeURIComponent(at.rid)}`}
                      title={at.rid}
                    >
                      <Tag size="small" type="light">{at.title || ridTail(at.rid)}</Tag>
                    </Link>
                  ))}
                </span>
              )}
            </dd>
            <dt>描述</dt>
            <dd>{type.description || '—'}</dd>
          </dl>
        </div>
      ) : tab === 'properties' ? (
        <DataTablePro
          columns={[
            { title: '属性', dataIndex: 'title', width: 200, ellipsis: true },
            {
              title: '类型',
              dataIndex: 'type_id',
              width: 160,
              ellipsis: true,
              render: (v: string) => <span className="mp-onto-mono">{ridTail(v)}</span>,
            },
            {
              title: '主键',
              dataIndex: 'primary_key',
              width: 80,
              render: (v: boolean) => (v ? '✓' : ''),
            },
            {
              title: '可空',
              dataIndex: 'nullable',
              width: 80,
              render: (v: boolean) => (v ? '✓' : '—'),
            },
            { title: '格式', dataIndex: 'format', width: 110 },
            {
              title: '共享',
              dataIndex: 'shared',
              width: 80,
              render: (v: boolean | undefined) => (v ? '✓' : '—'),
            },
            { title: 'rid', dataIndex: 'rid', ellipsis: true },
          ]}
          dataSource={type.properties}
          rowKey="rid"
          empty={<EmptyState illustration="no-content" title="该类型没有属性" />}
        />
      ) : tab === 'links' ? (
        <DataTablePro<KernelLinkType>
          columns={relationColumns}
          dataSource={links ?? []}
          rowKey="rid"
          loading={links === null}
          empty={<EmptyState illustration="no-content" title="没有挂在该类型上的关系" />}
        />
      ) : tab === 'history' ? (
        <VersionHistory rid={rid} />
      ) : materialization ? (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>实例数（物化）</dt>
            <dd>{materialization.count}</dd>
            <dt>生成时间</dt>
            <dd>{materialization.generated_at ?? '—'}</dd>
            <dt>物化列</dt>
            <dd>{Object.keys(materialization.schema).length}</dd>
          </dl>
          <DataTablePro
            columns={Object.keys(materialization.schema).slice(0, 6).map((col) => ({
              title: col,
              dataIndex: col,
              ellipsis: true,
            }))}
            dataSource={materialization.rows.slice(0, 20).map((r, i) => ({ ...r, __row__: String(i) }))}
            rowKey="__row__"
            empty={<EmptyState illustration="no-content" title="暂无物化行" />}
          />
        </div>
      ) : (
        <EmptyState
          illustration="no-content"
          title="暂无物化数据"
          desc="该类型尚未声明背挂数据源或未触发同步。"
        />
      )}
    </ResourceDetailLayout>
  );
}

/**
 * 版本历史（概念完整性批次 · D）：Version 基元的语义层呈现。
 * 同族版本 = listObjectTypes 里 rid 去掉末段版本号的聚合（零新契约）。
 */
function VersionHistory({ rid }: { rid: string }) {
  const [rows, setRows] = useState<KernelObjectType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = await listObjectTypes();
        if (!active) return;
        const family = rid.replace(/\.v\d+$/, '');
        setRows(all.filter((t) => t.rid.replace(/\.v\d+$/, '') === family));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [rid]);

  return (
    <DataTablePro
      columns={[
        {
          title: '版本',
          dataIndex: 'rid',
          width: 140,
          render: (v: string) => {
            const ver = v.match(/\.v(\d+)$/)?.[1] ?? '—';
            return <span className="mp-onto-strong">v{ver}</span>;
          },
        },
        {
          title: '显示名',
          dataIndex: 'display_name',
          width: 200,
          ellipsis: true,
        },
        {
          title: '属性数',
          dataIndex: 'properties',
          width: 90,
          render: (v: KernelObjectType['properties']) => v.length,
        },
        {
          title: '当前查看',
          dataIndex: '__current',
          width: 100,
          render: (_: unknown, row: KernelObjectType) =>
            row.rid === rid ? <Tag size="small" color="blue" type="light">当前</Tag> : null,
        },
        { title: 'rid', dataIndex: 'rid', ellipsis: true },
      ]}
      dataSource={rows}
      rowKey="rid"
      loading={loading}
      empty={<EmptyState illustration="no-content" title="未找到同族版本" />}
    />
  );
}
