import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Descriptions, Input, Tag, Timeline, Toast, Tree } from '@douyinfe/semi-ui';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, ExternalLink, Play, RefreshCw, Search } from 'lucide-react';
import {
  domainOfObjectType,
  getIndividual,
  listActionAudit,
  listIndividuals,
  listObjectTypes,
  propSlug,
  searchAround,
  type ActionAuditRow,
  type KernelIndividual,
  type KernelObjectType,
  type KernelProperty,
  type SearchAroundGroup,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, SheetDetail, SplitPane } from '@/components/skeleton';
import { setOntologySelection } from '../hooks/assistantContext';
import ActionFormDrawer from './ActionFormDrawer';
import ProposalConfirmDrawer from '../components/ProposalConfirmDrawer';
import './explorer.css';
import '../ontology.css';

const PAGE_SIZE = 20;
const LOAD_LIMIT = 500;

type SemiTableProps = React.ComponentProps<typeof DataTablePro<KernelIndividual>>;
type Column = SemiTableProps['columns'][number];

/** 属性值 → 单行文本（对象/数组折叠为 JSON，过长截断）。 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function propertyLabel(p: KernelProperty): string {
  return p.title || propSlug(p.rid);
}

/**
 * 对象浏览器（DESIGN-SPEC §5 版式 B）：左类型树 + 满宽实例表 + 右侧非模态详情浮层。
 * 承接原「对象数据」tab；数据面沿用 src/api/ont/kernel，未新增后端契约。
 */
export default function ObjectExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // IA2-4 路由驱动详情：URL 段 /ontology/explore/objects/:rid 是「打开中的对象」
  // 唯一真相（旧 ?id= 深链在下方重定向到段形式）；列表 state 不因打开/关闭详情而重挂。
  const { rid: ridParam } = useParams<{ rid?: string }>();

  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState('');
  const [typeQuery, setTypeQuery] = useState('');

  const [selectedRid, setSelectedRid] = useState<string>(searchParams.get('class') ?? '');

  const [individuals, setIndividuals] = useState<KernelIndividual[]>([]);
  const [indsLoading, setIndsLoading] = useState(false);
  const [indsError, setIndsError] = useState('');
  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '');
  const [page, setPageState] = useState(() => {
    const raw = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);

  const [detail, setDetail] = useState<KernelIndividual | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [relations, setRelations] = useState<SearchAroundGroup[]>([]);
  const [audit, setAudit] = useState<ActionAuditRow[]>([]);
  /** 本次会话内是否发生过关系跳转（决定 Sheet 的「返回」按钮走 history.back）。 */
  const jumpedRef = useRef(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionProposalId, setActionProposalId] = useState<string | null>(null);

  const selectedType = useMemo(
    () => types.find((t) => t.rid === selectedRid) ?? null,
    [types, selectedRid],
  );

  // ── 类型清单 ──
  const loadTypes = useCallback(async () => {
    setTypesLoading(true);
    setTypesError('');
    try {
      const list = await listObjectTypes();
      setTypes(list);
    } catch (e) {
      setTypesError(e instanceof Error ? e.message : String(e));
    } finally {
      setTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  // 无显式选中时落到第一个类型
  useEffect(() => {
    if (!selectedRid && types.length > 0) setSelectedRid(types[0].rid);
  }, [selectedRid, types]);

  /** 页码受控（IA2-4：进 URL，由同步 effect 写 ?page=）。 */
  const setPage = useCallback((next: number) => {
    setPageState(next);
  }, []);

  // ── 实例清单（沿用既有做法：一次取 LOAD_LIMIT 条，客户端过滤 + 分页）──
  useEffect(() => {
    if (!selectedRid) {
      setIndividuals([]);
      return;
    }
    let active = true;
    setIndsLoading(true);
    setIndsError('');
    setSelectedKeys([]);
    setPage(1);
    (async () => {
      try {
        const rows = await listIndividuals({ classRid: selectedRid, limit: LOAD_LIMIT, offset: 0 });
        if (active) setIndividuals(rows);
      } catch (e) {
        if (active) {
          setIndividuals([]);
          setIndsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (active) setIndsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedRid]);

  // 同步 URL（?class= / ?q= / ?page=）便于「新标签页打开」深链（IA2-4：页码进 URL）
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedRid && selectedRid !== next.get('class')) next.set('class', selectedRid);
    if (keyword) {
      if (next.get('q') !== keyword) next.set('q', keyword);
    } else {
      next.delete('q');
    }
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // searchParams 由本次写入驱动，无需作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRid, keyword, page]);

  // 旧深链 ?id=<rid>（IA2-1 之前的形态）→ replace 到段路由 /objects/:rid
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    navigate(
      { pathname: `/ontology/explore/objects/${encodeURIComponent(id)}`, search: next.toString() },
      { replace: true },
    );
    // 仅首次挂载迁移旧深链
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── IA2-4 路由驱动详情：:rid 段是「打开中的对象」唯一真相 ──
  useEffect(() => {
    if (!ridParam) {
      setDetail(null);
      setRelations([]);
      setAudit([]);
      jumpedRef.current = false;
      return;
    }
    let active = true;
    (async () => {
      try {
        const one = await getIndividual(ridParam);
        if (active) {
          setDetail(one);
          void reloadDetail(one);
        }
      } catch {
        // 深链失效（实例被删/跨租户）：清空详情回到列表视图，不打断浏览
        if (active) {
          setDetail(null);
          setRelations([]);
          setAudit([]);
        }
      }
    })();
    return () => {
      active = false;
    };
    // ridParam 驱动；reloadDetail 是稳定引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ridParam]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return individuals;
    return individuals.filter((i) => {
      if (i.primary_key?.toLowerCase().includes(kw)) return true;
      if (i.rid.toLowerCase().includes(kw)) return true;
      return Object.values(i.props).some((v) => String(v ?? '').toLowerCase().includes(kw));
    });
  }, [individuals, keyword]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // ── 发布列表**选中态**给域级 store（ADR-0065 S2）──
  //
  // 选中态 = 表格的行选中（`selectedKeys`）——这是本页唯一能被称作"用户此刻在看
  // 哪些对象"的语义。**只发标识**：rid（供 agent 水合）+ 主键当 label（人可读）。
  // `capturedAt` 记这批选中被确认的时刻（**毫秒**），服务端按它判陈旧（R2）。
  //
  // 注意"选中"与"打开"是两回事：打开的对象走 navigation.openRecordIds（由域壳按
  // `?id=` 深链发布），这里只管勾选。
  useEffect(() => {
    const items = selectedKeys
      .map((key) => individuals.find((row) => row.rid === String(key)))
      .filter((row): row is KernelIndividual => Boolean(row))
      .map((row) => ({ rid: row.rid, label: row.primary_key || row.rid }));
    setOntologySelection(
      items.length > 0
        ? { kind: 'ontology.instances', items, capturedAt: Date.now() }
        : null,
    );
  }, [selectedKeys, individuals]);

  // 离开对象浏览器时清空：v1 请求作用域，过期选中态不该被下一次发问带上。
  useEffect(() => () => setOntologySelection(null), []);

  // ── 列：主键 + 该类型前 6 个属性 + 更新时间 ──
  const columns = useMemo<Column[]>(() => {
    const propCols: Column[] = (selectedType?.properties ?? []).slice(0, 6).map((p) => ({
      title: propertyLabel(p),
      dataIndex: propSlug(p.rid),
      width: 170,
      ellipsis: true,
      render: (_: unknown, row: KernelIndividual) => {
        const text = formatValue(row.props[p.rid]);
        return <span title={text}>{text}</span>;
      },
    }));
    return [
      {
        title: '主键',
        dataIndex: 'primary_key',
        width: 200,
        ellipsis: true,
        sorter: (a: KernelIndividual, b: KernelIndividual) =>
          String(a.primary_key).localeCompare(String(b.primary_key)),
        render: (v: string) => <span className="mp-onto-strong">{v || '—'}</span>,
      },
      ...propCols,
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 180,
        ellipsis: true,
        render: (v: unknown) => <span className="mp-onto-muted">{v ? String(v) : '—'}</span>,
      },
    ];
  }, [selectedType]);

  /** 拉取某对象的关系与变更记录（打开、跳转、提案执行后共用）。 */
  const reloadDetail = useCallback(async (row: KernelIndividual) => {
    setDetailLoading(true);
    setRelations([]);
    setAudit([]);
    try {
      const [around, auditRows] = await Promise.all([
        searchAround(row.rid, 50).catch(() => [] as SearchAroundGroup[]),
        listActionAudit(200).catch(() => [] as ActionAuditRow[]),
      ]);
      setRelations(around);
      setAudit(auditRows.filter((a) => a.target_iid === row.rid));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── 详情浮层数据（IA2-4：打开/跳转/返回/关闭全部走路由，浏览器历史天然可返回）──
  /** 打开对象：URL 追加 /:rid 段（保留列表 query；详情数据由 ridParam 效应加载）。 */
  const openDetail = useCallback(
    (row: KernelIndividual) => {
      const next = new URLSearchParams(searchParams);
      next.delete('page'); // 打开详情不看列表页码
      navigate({
        pathname: `/ontology/explore/objects/${encodeURIComponent(row.rid)}`,
        search: next.toString(),
      });
    },
    [navigate, searchParams],
  );

  /** 沿关系跳到关联对象：URL 换 :rid 段（push 历史，浏览器返回即回到上一对象）。 */
  const openRelated = useCallback(
    (peerRid: string) => {
      if (!detail || !peerRid) return;
      jumpedRef.current = true;
      const next = new URLSearchParams(searchParams);
      navigate({
        pathname: `/ontology/explore/objects/${encodeURIComponent(peerRid)}`,
        search: next.toString(),
      });
    },
    [detail, navigate, searchParams],
  );

  /** 返回上一个对象（浏览器历史；未跳转过则回列表）。 */
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  /** 关闭详情：去掉 /:rid 段回列表（保留 class/q）。 */
  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    navigate({ pathname: '/ontology/explore/objects', search: next.toString() });
  }, [navigate, searchParams]);

  const exportCsv = useCallback(() => {
    const props = selectedType?.properties ?? [];
    const header = ['primary_key', ...props.map((p) => propertyLabel(p))];
    const lines = filtered.map((row) =>
      [row.primary_key, ...props.map((p) => formatValue(row.props[p.rid]))]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedType ? propSlug(selectedType.rid) : 'objects'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success(`已导出 ${filtered.length} 行`);
  }, [filtered, selectedType]);

  // ── 类型树 ──
  const treeData = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    const groups = new Map<string, KernelObjectType[]>();
    for (const t of types) {
      if (q && !`${t.display_name} ${t.rid}`.toLowerCase().includes(q)) continue;
      const domain = domainOfObjectType(t.rid) || '未分组';
      const bucket = groups.get(domain) ?? [];
      bucket.push(t);
      groups.set(domain, bucket);
    }
    return Array.from(groups.entries()).map(([domain, items]) => ({
      key: `domain:${domain}`,
      label: domain,
      children: items.map((t) => ({
        key: t.rid,
        label: t.display_name || propSlug(t.rid),
        count: t.properties.length,
      })),
    }));
  }, [types, typeQuery]);

  const typePane = (
    <div className="mp-explorer-tree">
      <div className="mp-explorer-tree-head">
        <span className="mp-explorer-tree-title">对象类型</span>
        <Button
          theme="borderless"
          type="tertiary"
          icon={<RefreshCw size={15} strokeWidth={1.5} />}
          aria-label="刷新类型清单"
          loading={typesLoading}
          onClick={() => void loadTypes()}
        />
      </div>

      <div className="mp-pane-block">
        <Input
          prefix={<Search size={14} strokeWidth={1.5} />}
          placeholder="筛选对象类型"
          value={typeQuery}
          onChange={setTypeQuery}
          showClear
        />
      </div>

      <div className="mp-pane-scroll">
        {typesError ? (
          <div className="mp-pane-block">
            <EmptyState
              illustration="failure"
              title="类型清单加载失败"
              desc={typesError}
              actions={
                <Button theme="solid" type="primary" onClick={() => void loadTypes()}>
                  重试
                </Button>
              }
            />
          </div>
        ) : treeData.length === 0 && !typesLoading ? (
          <div className="mp-pane-block">
            <EmptyState illustration="no-result" title="没有匹配的对象类型" desc="换个关键词试试。" />
          </div>
        ) : (
          <Tree
            treeData={treeData}
            value={selectedRid}
            defaultExpandAll
            motion={false}
            onSelect={(key: unknown) => {
              const next = String(key);
              if (next.startsWith('domain:')) return;
              setSelectedRid(next);
            }}
            renderLabel={(label: unknown, node: unknown) => {
              const n = node as { key?: string; count?: number };
              if (node && typeof node === 'object' && typeof n.count === 'number') {
                return (
                  <span className="mp-explorer-type">
                    <span className="mp-explorer-type-name">{String(label)}</span>
                    <span className="mp-explorer-type-count">{n.count} 属性</span>
                  </span>
                );
              }
              return <span>{String(label)}</span>;
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="mp-page-full mp-explorer">
      <SplitPane ariaLabel="对象浏览器" defaultWidth={248} pane={typePane}>
        <div className="mp-explorer-list">
          <div className="mp-explorer-list-head">
            <FilterBar
              search={{
                value: keyword,
                onChange: setKeyword,
                placeholder: selectedType
                  ? `搜索「${selectedType.display_name}」：主键、属性值…`
                  : '搜索实例',
              }}
              filters={
                selectedType ? (
                  <>
                    <Tag color="blue" type="light">
                      {selectedType.display_name}
                    </Tag>
                    <Tag type="light">{filtered.length} / {individuals.length} 条</Tag>
                  </>
                ) : null
              }
              right={
                <Button
                  icon={<Download size={15} strokeWidth={1.5} />}
                  disabled={filtered.length === 0}
                  onClick={exportCsv}
                >
                  导出
                </Button>
              }
            />
          </div>

          <div className="mp-explorer-list-body">
            <DataTablePro<KernelIndividual>
              columns={columns}
              dataSource={paged}
              rowKey="rid"
              loading={indsLoading}
              rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filtered.length,
                onChange: setPage,
              }}
              onRow={(record) => ({ onClick: () => void openDetail(record) })}
              empty={
                indsError ? (
                  <EmptyState
                    illustration="failure"
                    title="实例加载失败"
                    desc={indsError}
                  />
                ) : (
                  <EmptyState
                    illustration="no-result"
                    title="没有匹配的实例"
                    desc="换个类型，或清空搜索关键词。"
                  />
                )
              }
            />
          </div>
        </div>
      </SplitPane>

      <SheetDetail
        title="对象详情"
        open={detail !== null}
        onClose={closeDetail}
        footer={
          <>
            {jumpedRef.current ? (
              <Button
                icon={<ArrowLeft size={15} strokeWidth={1.5} />}
                onClick={goBack}
              >
                返回
              </Button>
            ) : (
              <Button
                icon={<Copy size={15} strokeWidth={1.5} />}
                onClick={() => {
                  if (!detail) return;
                  void navigator.clipboard?.writeText(detail.rid);
                  Toast.success('RID 已复制');
                }}
              >
                复制 RID
              </Button>
            )}
            <Button
              icon={<Play size={15} strokeWidth={1.5} />}
              disabled={!detail}
              onClick={() => setActionOpen(true)}
            >
              执行动作
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<ExternalLink size={15} strokeWidth={1.5} />}
              onClick={() => {
                if (!detail) return;
                // IA2-4：分享 URL 即段路由——刷新/直达同一 Sheet 容器
                const next = new URLSearchParams(searchParams);
                next.set('class', detail.class_rid);
                const url = new URL(
                  `/ontology/explore/objects/${encodeURIComponent(detail.rid)}?${next.toString()}`,
                  window.location.origin,
                );
                window.open(url.toString(), '_blank', 'noopener');
              }}
            >
              新标签页打开
            </Button>
          </>
        }
      >
        {detail ? (
          <>
            <div className="mp-explorer-detail-head">
              <div>
                <div className="mp-explorer-detail-title">{detail.primary_key || detail.rid}</div>
                <div className="mp-explorer-rel-chips">
                  <Tag color="blue" type="light">
                    {selectedType?.display_name ?? domainOfObjectType(detail.class_rid)}
                  </Tag>
                  <Tag type="light">{domainOfObjectType(detail.class_rid)}</Tag>
                </div>
              </div>
            </div>

            <Descriptions
              row
              data={[
                {
                  key: '所属类型',
                  value: selectedType?.display_name ?? detail.class_rid,
                },
                { key: 'RID', value: detail.rid },
                ...(selectedType?.properties ?? []).slice(0, 12).map((p) => ({
                  key: propertyLabel(p),
                  value: formatValue(detail.props[p.rid]),
                })),
                { key: '更新时间', value: detail.updated_at ?? '—' },
              ]}
            />

            <div>
              <div className="mp-explorer-rel-label">关系（LinkType）</div>
              {relationChips(relations)}
            </div>

            <div>
              <div className="mp-explorer-rel-label">变更记录（Action 审计）</div>
              {detailLoading ? (
                <div className="mp-onto-muted">加载中…</div>
              ) : audit.length === 0 ? (
                <EmptyState illustration="no-content" title="暂无变更记录" desc="该实例还没有经 Action 落库的变更。" />
              ) : (
                <Timeline>
                  {audit.slice(0, 10).map((a) => (
                    <Timeline.Item key={a.audit_id} time={a.created_at}>
                      {a.action_rid}
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </div>
          </>
        ) : null}
      </SheetDetail>

      {/* 人工执行动作：只收参数并建提案，确认与执行复用同一条 HITL 管道 */}
      <ActionFormDrawer
        open={actionOpen}
        target={detail}
        onClose={() => setActionOpen(false)}
        onProposed={(pid) => setActionProposalId(pid)}
      />
      <ProposalConfirmDrawer
        open={actionProposalId !== null}
        proposalId={actionProposalId}
        initialKind="action"
        onExecuted={() => {
          setActionProposalId(null);
          if (detail) void reloadDetail(detail);
        }}
        onClosed={() => setActionProposalId(null)}
      />
    </div>
  );

  function relationChips(groups: SearchAroundGroup[]) {
    if (groups.length === 0) {
      return <div className="mp-onto-muted">未配置关系类型，或该实例暂无关联对象。</div>;
    }
    return (
      <>
        {groups.map((g) => (
          <div className="mp-explorer-rel-group" key={`${g.link_type_rid}-${g.direction}`}>
            <div className="mp-explorer-rel-label">
              {g.link_display || g.link_type_rid} · {g.direction === 'out' ? '出' : '入'} · {g.peers.length}
            </div>
            <div className="mp-explorer-rel-chips">
              {g.peers.slice(0, 12).map((peer, index) => {
                const peerRid = peer.__rid__ ? String(peer.__rid__) : '';
                const label = String(peer.__display_name__ ?? peerRid ?? `#${index + 1}`);
                return peerRid ? (
                  <button
                    key={peerRid}
                    type="button"
                    className="mp-explorer-rel-chip"
                    title={peerRid}
                    onClick={() => void openRelated(peerRid)}
                  >
                    {label}
                  </button>
                ) : (
                  <Tag key={index} type="light">
                    {label}
                  </Tag>
                );
              })}
              {g.peers.length > 12 ? <Tag type="light">+{g.peers.length - 12}</Tag> : null}
            </div>
          </div>
        ))}
      </>
    );
  }
}
