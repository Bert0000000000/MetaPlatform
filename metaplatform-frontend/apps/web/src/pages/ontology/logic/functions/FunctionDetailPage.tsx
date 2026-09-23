import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listActionTypes, listFunctions, type KernelActionType, type KernelFunction } from '@/api/ont/kernel';
import { EmptyState } from '@/components/skeleton';
import ResourceDetailLayout from '../../layout/ResourceDetailLayout';
import { ridTail } from '../../rid';
import { actionDisplayName } from '../actions/displayName';
import '../../ontology.css';

type DetailTab = 'overview' | 'signatures' | 'usage';

const TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'signatures', label: '签名' },
  { key: 'usage', label: '使用方' },
];

function normalizeTab(raw: string | undefined): DetailTab {
  return TABS.some((t) => t.key === raw) ? (raw as DetailTab) : 'overview';
}

/**
 * Function 详情（IA2-5 资源详情路由）：/ontology/logic/functions/:rid[/:tab]。
 *
 * <p>数据面全走既有契约端点：函数体来自列表侧过滤（GET /functions/{rid} 未契约化）；
 * 「被哪些 Action 使用」= listActionTypes 按 function_ref 过滤。
 * 设计规格的 versions / dependencies / runs 段当前无独立数据面，不渲染页签。
 */
export default function FunctionDetailPage() {
  const { rid = '', tab: rawTab } = useParams<{ rid: string; tab?: string }>();
  const navigate = useNavigate();
  const tab = normalizeTab(rawTab);

  const [fn, setFn] = useState<KernelFunction | null>(null);
  const [usedBy, setUsedBy] = useState<KernelActionType[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fns, actions] = await Promise.all([listFunctions(), listActionTypes()]);
      const hit = fns.find((f) => f.rid === rid);
      if (hit) setFn(hit);
      else setError(`未找到函数：${rid}`);
      setUsedBy(actions.filter((a) => a.function_ref === rid));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchTab = (key: string) =>
    navigate(`/ontology/logic/functions/${encodeURIComponent(rid)}/${key}`);

  if (loading) {
    return <EmptyState illustration="no-content" title="读取中…" desc="数据取自本体内核 v2" />;
  }
  if (error || !fn) {
    return <EmptyState illustration="failure" title="函数读取失败" desc={error} />;
  }

  return (
    <ResourceDetailLayout
      title={ridTail(fn.rid)}
      desc={`${fn.rid} · 函数详情 · 数据取自本体内核 v2`}
      tabs={TABS.map((t) =>
        t.key === 'usage' ? { key: t.key, label: `使用方 · ${usedBy.length}` } : t,
      )}
      activeTab={tab}
      onTabChange={switchTab}
    >
      {tab === 'overview' ? (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>rid</dt>
            <dd className="mp-onto-mono">{fn.rid}</dd>
            <dt>语言</dt>
            <dd>{fn.language}</dd>
            <dt>版本</dt>
            <dd>v{fn.version}</dd>
            <dt>来源（source_ref）</dt>
            <dd className="mp-onto-mono">{fn.source_ref || '—'}</dd>
            <dt>被引用</dt>
            <dd>{usedBy.length} 个动作类型</dd>
          </dl>
        </div>
      ) : tab === 'signatures' ? (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            {fn.signatures.length === 0 ? (
              <>
                <dt>签名</dt>
                <dd>该函数没有登记签名</dd>
              </>
            ) : (
              fn.signatures.map(([name, type], i) => (
                <>
                  <dt key={`n-${i}`}>{name || `参数 ${i + 1}`}</dt>
                  <dd key={`t-${i}`} className="mp-onto-mono">{type}</dd>
                </>
              ))
            )}
          </dl>
        </div>
      ) : (
        <div className="mp-onto-detail-grid">
          <dl className="mp-onto-detail-list">
            <dt>使用方（ActionType）</dt>
            <dd>
              {usedBy.length === 0
                ? '没有动作类型引用该函数'
                : usedBy.map((a) => actionDisplayName(a)).join('、')}
            </dd>
          </dl>
        </div>
      )}
    </ResourceDetailLayout>
  );
}
