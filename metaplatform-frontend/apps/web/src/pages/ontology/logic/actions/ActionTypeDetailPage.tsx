import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tag } from '@douyinfe/semi-ui';
import {
  listActionAudit,
  listActionTypes,
  type ActionAuditRow,
  type KernelActionType,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState } from '@/components/skeleton';
import ResourceDetailLayout from '../../layout/ResourceDetailLayout';
import { ridTail } from '../../rid';
import { actionDisplayName } from './displayName';
import '../../ontology.css';

type DetailTab = 'overview' | 'parameters' | 'rules' | 'runs';

const TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'parameters', label: '参数' },
  { key: 'rules', label: '提交条件' },
  { key: 'runs', label: '运行记录' },
];

function normalizeTab(raw: string | undefined): DetailTab {
  return TABS.some((t) => t.key === raw) ? (raw as DetailTab) : 'overview';
}

/**
 * ActionType 详情（IA2-5 资源详情路由）：/ontology/logic/actions/:rid[/:tab]。
 *
 * <p>数据面全走**既有契约端点**：详情体来自列表侧按 rid 过滤
 * （GET /action-types/{rid} 存在于后端但未契约化——硬规则 1 禁用未登记接口）；
 * 运行记录用 listActionAudit(actionRid)（契约已有 action_rid 过滤参数）。
 * 设计规格的 approvals（审批策略）无真实数据，不渲染页签。
 */
export default function ActionTypeDetailPage() {
  const { rid = '', tab: rawTab } = useParams<{ rid: string; tab?: string }>();
  const navigate = useNavigate();
  const tab = normalizeTab(rawTab);

  const [action, setAction] = useState<KernelActionType | null>(null);
  const [runs, setRuns] = useState<ActionAuditRow[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await listActionTypes();
      const hit = all.find((a) => a.rid === rid);
      if (hit) setAction(hit);
      else setError(`未找到动作类型：${rid}`);
      listActionAudit(200, rid)
        .then(setRuns)
        .catch(() => setRuns([]));
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
  const switchTab = (key: string) =>
    navigate(`/ontology/logic/actions/${encodeURIComponent(rid)}/${key}`);

  if (loading) {
    return <EmptyState illustration="no-content" title="读取中…" desc="数据取自本体内核 v2" />;
  }
  if (error || !action) {
    return (
      <EmptyState
        illustration="failure"
        title="动作类型读取失败"
        desc={error}
      />
    );
  }

  return (
    <ResourceDetailLayout
      title={actionDisplayName(action)}
      desc={`${action.rid} · 动作类型详情 · 数据取自本体内核 v2`}
      tabs={TABS.map((t) =>
        t.key === 'runs' ? { key: t.key, label: `运行记录${runs ? ` · ${runs.length}` : ''}` } : t,
      )}
      activeTab={tab}
      onTabChange={switchTab}
    >
      {tab === 'overview' ? (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>rid</dt>
            <dd className="mp-onto-mono">{action.rid}</dd>
            <dt>函数引用</dt>
            <dd className="mp-onto-mono">{action.function_ref || '—'}</dd>
            <dt>绑定类型（on）</dt>
            <dd>
              {action.on.length
                ? action.on.map((o) => (
                    <Tag key={o} size="small" type="light">
                      {ridTail(o)}
                    </Tag>
                  ))
                : '—'}
            </dd>
            <dt>副作用（side effects）</dt>
            <dd>
              {action.side_effects.length ? action.side_effects.join('、') : '—'}
            </dd>
            <dt>描述</dt>
            <dd>{action.description || '—'}</dd>
          </dl>
        </div>
      ) : tab === 'parameters' ? (
        <DataTablePro
          columns={[
            { title: '参数', dataIndex: 'title', width: 200, ellipsis: true },
            {
              title: '类型',
              dataIndex: 'type_id',
              width: 160,
              ellipsis: true,
              render: (v: string) => <span className="mp-onto-mono">{v}</span>,
            },
            {
              title: '可空',
              dataIndex: 'nullable',
              width: 80,
              render: (v: boolean) => (v ? '✓' : '—'),
            },
            { title: '格式', dataIndex: 'format', width: 110 },
            { title: 'rid', dataIndex: 'rid', ellipsis: true },
          ]}
          dataSource={action.parameters}
          rowKey="rid"
          empty={<EmptyState illustration="no-content" title="该动作没有参数" />}
        />
      ) : tab === 'rules' ? (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>提交条件（submission criteria）</dt>
            <dd>
              {action.submission_criteria.length
                ? action.submission_criteria.join('；')
                : '—'}
            </dd>
            <dt>副作用（side effects）</dt>
            <dd>{action.side_effects.length ? action.side_effects.join('；') : '—'}</dd>
          </dl>
        </div>
      ) : (
        <DataTablePro<ActionAuditRow>
          columns={[
            {
              title: '动作',
              dataIndex: 'action_rid',
              width: 240,
              ellipsis: true,
              render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
            },
            {
              title: '目标实例',
              dataIndex: 'target_iid',
              width: 300,
              ellipsis: true,
              render: (v: string) => <span className="mp-onto-muted">{ridTail(v)}</span>,
            },
            { title: '执行者', dataIndex: 'actor_id', width: 200, ellipsis: true },
            {
              title: '提案',
              dataIndex: 'proposal_id',
              width: 220,
              ellipsis: true,
              render: (v: string) => <span className="mp-onto-faint">{v}</span>,
            },
            {
              title: '结果',
              dataIndex: 'result',
              width: 120,
              render: (v: Record<string, unknown>) => (
                <Tag
                  size="small"
                  color={Object.keys(v ?? {}).length > 0 ? 'green' : 'grey'}
                  type="light"
                >
                  {Object.keys(v ?? {}).length > 0 ? '已落库' : '空'}
                </Tag>
              ),
            },
            {
              title: '时间',
              dataIndex: 'created_at',
              ellipsis: true,
              render: (v: string) => <span className="mp-onto-muted">{v}</span>,
            },
          ]}
          dataSource={runs ?? []}
          rowKey="audit_id"
          loading={runs === null}
          empty={<EmptyState illustration="no-content" title="该动作还没有执行记录" />}
        />
      )}
    </ResourceDetailLayout>
  );
}
