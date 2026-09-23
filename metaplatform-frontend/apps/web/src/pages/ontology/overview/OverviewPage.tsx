import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  Code2,
  Plug,
  RefreshCw,
  Scale,
  Share2,
  Zap,
} from 'lucide-react';
import {
  getDatasourceSyncStatus,
  listActionAudit,
  listActionTypes,
  listAxioms,
  listFunctions,
  listInterfaces,
  listLinkTypes,
  listObjectTypes,
  type ActionAuditRow,
  type SyncStatusRow,
} from '@/api/ont/kernel';
import { lintAntiPatterns, listSchemaWip } from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { ridTail } from '../rid';
import './overview.css';
import '../ontology.css';

/**
 * 本体概览（DESIGN-SPEC §5 版式 A：页头 + KPI bento + 主列/侧列）。
 *
 * 这块是 2026-09-17 IA 重排新增的落地页，回答「进了本体，从哪开始」——
 * 此前域默认落在对象浏览器（实例数据面），对建模者是错的入口。
 * 数据全部取自既有端点，不新增后端契约。
 */

interface PrimitiveKpi {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number | null;
  hint: string;
  /** IA v2：KPI 卡直达所属基元页（ADR-0069 六大功能域）。 */
  path: string;
}

const ICON = 16;

export default function OverviewPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [counts, setCounts] = useState<Record<string, number | null>>({
    object: null,
    link: null,
    action: null,
    function: null,
    interface: null,
    axiom: null,
  });

  const [audit, setAudit] = useState<ActionAuditRow[]>([]);
  const [sync, setSync] = useState<SyncStatusRow[]>([]);
  // IA v2（ADR-0069 §7.1）：总览不再依赖 agentMetrics —— 改用治理面真实数据
  const [drafts, setDrafts] = useState<number | null>(null);
  const [lintCount, setLintCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    // 六类基元一荣俱荣：任一失败说明内核读不通，整页给失败态而不是逐块空态。
    const [ot, lt, at, fn, ifc, ax] = await Promise.allSettled([
      listObjectTypes(),
      listLinkTypes(),
      listActionTypes(),
      listFunctions(),
      listInterfaces(),
      listAxioms(),
    ]);

    if (ot.status === 'rejected') {
      setError(ot.reason instanceof Error ? ot.reason.message : String(ot.reason));
      setLoading(false);
      return;
    }

    setCounts({
      object: ot.value.length,
      link: lt.status === 'fulfilled' ? lt.value.length : null,
      action: at.status === 'fulfilled' ? at.value.length : null,
      function: fn.status === 'fulfilled' ? fn.value.length : null,
      interface: ifc.status === 'fulfilled' ? ifc.value.length : null,
      axiom: ax.status === 'fulfilled' ? ax.value.length : null,
    });

    // 三块侧栏数据各自独立降级：慢/挂不影响概览主结论。
    const [auditRes, syncRes, wipRes, lintRes] = await Promise.allSettled([
      listActionAudit(20),
      getDatasourceSyncStatus(),
      listSchemaWip(),
      lintAntiPatterns(),
    ]);
    setAudit(auditRes.status === 'fulfilled' ? auditRes.value : []);
    setSync(syncRes.status === 'fulfilled' ? syncRes.value : []);
    setDrafts(wipRes.status === 'fulfilled' ? wipRes.value.length : null);
    setLintCount(lintRes.status === 'fulfilled' ? lintRes.value.length : null);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo<PrimitiveKpi[]>(
    () => [
      {
        key: 'object',
        label: '对象类型',
        icon: <Box size={ICON} strokeWidth={1.5} />,
        path: '/ontology/model/object-types',
        count: counts.object,
        hint: '本体的概念层',
      },
      {
        key: 'link',
        label: '关系类型',
        icon: <Share2 size={ICON} strokeWidth={1.5} />,
        path: '/ontology/model/link-types',
        count: counts.link,
        hint: '概念之间的联系',
      },
      {
        key: 'action',
        label: '动作类型',
        icon: <Zap size={ICON} strokeWidth={1.5} />,
        path: '/ontology/logic/actions',
        count: counts.action,
        hint: '可对对象执行的操作',
      },
      {
        key: 'function',
        label: '函数',
        icon: <Code2 size={ICON} strokeWidth={1.5} />,
        path: '/ontology/logic/functions',
        count: counts.function,
        hint: '动作背后的执行体',
      },
      {
        key: 'interface',
        label: '接口',
        icon: <Plug size={ICON} strokeWidth={1.5} />,
        path: '/ontology/model/interfaces',
        count: counts.interface,
        hint: '跨类型的多态约束',
      },
      {
        key: 'axiom',
        label: '公理',
        icon: <Scale size={ICON} strokeWidth={1.5} />,
        path: '/ontology/model/axioms',
        count: counts.axiom,
        hint: '语义约束与推理规则',
      },
    ],
    [counts],
  );

  const syncFailures = useMemo(() => sync.filter((r) => (r.consecutive_failures ?? 0) > 0), [sync]);

  // ── 三态：加载中 → 失败 → 内容（避免加载期先闪一次假空态）──
  if (loading) {
    return (
      <>
        <PageHeader title="本体概览" desc="正在读取本体内核…" />
        <div className="mp-onto-ov-skeleton" aria-busy="true" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="本体概览" desc="本体内核读取失败" />
        <EmptyState
          illustration="failure"
          title="本体内核读取失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      </>
    );
  }

  const noPrimitives = (counts.object ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="本体概览"
        desc="本体的概念层、动能层与数据落地面"
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => navigate('/ontology/model/object-types')}
            >
              去语义模型
            </Button>
          </>
        }
      />

      {noPrimitives ? (
        <EmptyState
          illustration="no-content"
          title="本体里还没有对象类型"
          desc="先建第一个概念：定义它有哪些属性、与谁有关联、以及对它能做什么。"
          actions={
            <Button theme="solid" type="primary" onClick={() => navigate('/ontology/model/object-types')}>
              新建本体概念
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI bento：点击进对应基元的清单 */}
          <div className="mp-onto-ov-kpis">
            {kpis.map((k) => (
              <button
                key={k.key}
                type="button"
                className="mp-onto-ov-kpi"
                onClick={() => navigate(k.path)}
              >
                <span className="mp-onto-ov-kpi-label">
                  {k.icon}
                  {k.label}
                </span>
                <span className="mp-onto-ov-kpi-value">
                  {k.count === null ? '—' : k.count}
                </span>
                <span className="mp-onto-ov-kpi-hint">{k.hint}</span>
              </button>
            ))}
          </div>

          <div className="mp-onto-ov-grid">
            {/* ── 主列 ── */}
            <div className="mp-onto-ov-col">
              <section className="mp-onto-ov-card">
                <div className="mp-onto-ov-card-head">
                  <h3 className="mp-onto-ov-card-title">最近变更</h3>
                  <Button
                    theme="borderless"
                    type="primary"
                    size="small"
                    onClick={() => navigate('/ontology/logic/runs')}
                  >
                    执行记录 <ArrowRight size={14} strokeWidth={1.5} />
                  </Button>
                </div>
                {audit.length === 0 ? (
                  <div className="mp-onto-ov-empty">本租户还没有经 Action 落库的变更。</div>
                ) : (
                  <ul className="mp-onto-ov-list">
                    {audit.slice(0, 8).map((a) => (
                      <li key={a.audit_id} className="mp-onto-ov-list-row">
                        <span className="mp-onto-ov-list-main">{ridTail(a.action_rid)}</span>
                        <span className="mp-onto-ov-list-sub">{ridTail(a.target_iid)}</span>
                        <span className="mp-onto-ov-list-time">{a.created_at}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mp-onto-ov-card">
                <div className="mp-onto-ov-card-head">
                  <h3 className="mp-onto-ov-card-title">去哪里</h3>
                </div>
                <div className="mp-onto-ov-jumps">
                  <JumpCard
                    title="语义模型"
                    desc="对象类型、关系、接口、公理与模型图谱"
                    onClick={() => navigate('/ontology/model/object-types')}
                  />
                  <JumpCard
                    title="对象与查询"
                    desc="查实例、看关系、对对象执行动作"
                    onClick={() => navigate('/ontology/explore/objects')}
                  />
                  <JumpCard
                    title="数据映射"
                    desc="对象映射、背挂数据源与本体血缘"
                    onClick={() => navigate('/ontology/data/mappings')}
                  />
                  <JumpCard
                    title="动作与函数"
                    desc="动作类型、函数、Action 编排与执行记录"
                    onClick={() => navigate('/ontology/logic/actions')}
                  />
                  <JumpCard
                    title="发布与治理"
                    desc="草稿、版本发布、模型校验与审计"
                    onClick={() => navigate('/ontology/governance/drafts')}
                  />
                </div>
              </section>
            </div>

            {/* ── 侧列 ── */}
            <div className="mp-onto-ov-col">
              <section className="mp-onto-ov-card">
                <div className="mp-onto-ov-card-head">
                  <h3 className="mp-onto-ov-card-title">数据源同步健康</h3>
                  <Button
                    theme="borderless"
                    type="primary"
                    size="small"
                    onClick={() => navigate('/ontology/data/sync')}
                  >
                    同步任务 <ArrowRight size={14} strokeWidth={1.5} />
                  </Button>
                </div>
                {sync.length === 0 ? (
                  <div className="mp-onto-ov-empty">
                    调度器尚未跑过同步任务，或本租户还没有接数据源。
                  </div>
                ) : (
                  <>
                    <div className="mp-onto-ov-sync">
                      <span className="mp-onto-ov-sync-ok">
                        {sync.length - syncFailures.length} 正常
                      </span>
                      <span
                        className={
                          syncFailures.length > 0
                            ? 'mp-onto-ov-sync-bad'
                            : 'mp-onto-ov-sync-none'
                        }
                      >
                        {syncFailures.length} 异常
                      </span>
                    </div>
                    {syncFailures.slice(0, 3).map((r) => (
                      <div key={r.class_rid} className="mp-onto-ov-fail">
                        <span className="mp-onto-ov-list-main">{ridTail(r.class_rid)}</span>
                        <span className="mp-onto-ov-list-sub">{r.last_error || '未知错误'}</span>
                      </div>
                    ))}
                  </>
                )}
              </section>

              {/* IA v2（ADR-0069 §7.1）：原「AI 提案回归」卡已删（agentMetrics 依赖），
                  改用治理面真实数据：草稿数 + 反模式发现数。Agent 服务关闭时本页不受影响。 */}
              <section className="mp-onto-ov-card">
                <div className="mp-onto-ov-card-head">
                  <h3 className="mp-onto-ov-card-title">治理与健康</h3>
                  <Button
                    theme="borderless"
                    type="primary"
                    size="small"
                    onClick={() => navigate('/ontology/governance/drafts')}
                  >
                    发布与治理 <ArrowRight size={14} strokeWidth={1.5} />
                  </Button>
                </div>
                <div className="mp-onto-ov-sync">
                  <span className="mp-onto-ov-sync-ok">{drafts ?? '—'} 条草稿待发布</span>
                  <span className={lintCount ? 'mp-onto-ov-sync-bad' : 'mp-onto-ov-sync-none'}>
                    {lintCount ?? '—'} 项反模式发现
                  </span>
                </div>
                <div className="mp-onto-ov-tags">
                  <Tag size="small" type="light">草稿 → /governance/drafts</Tag>
                  <Tag size="small" type="light">模型校验 → /model/validation</Tag>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function JumpCard({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="mp-onto-ov-jump" onClick={onClick}>
      <span className="mp-onto-ov-jump-title">
        {title}
        <ArrowRight size={14} strokeWidth={1.5} />
      </span>
      <span className="mp-onto-ov-jump-desc">{desc}</span>
    </button>
  );
}
