import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tabs, Tag } from '@douyinfe/semi-ui';
import { Plus, RefreshCw } from 'lucide-react';
import {
  listActionTypes,
  listAxioms,
  listFunctions,
  listInterfaces,
  listLinkTypes,
  listObjectTypes,
  type KernelActionType,
  type KernelAxiom,
  type KernelFunction,
  type KernelInterface,
  type KernelLinkType,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import OntologyModelingPage from '../OntologyModelingPage';
import OntologyGraphView from './OntologyGraphView';
import { ridTail } from '../rid';
import '../ontology.css';

export type KindKey = 'object' | 'link' | 'action' | 'function' | 'interface' | 'axiom' | 'graph';

const PAGE_SIZE = 20;

const KIND_LABEL: Record<KindKey, string> = {
  object: '对象类型',
  link: '关系类型',
  action: '动作类型',
  function: '函数',
  interface: '接口',
  axiom: '公理',
  graph: '本体图谱',
};

/** 公理类型中文标签（内核 AxiomKind；未收录的原样显示）。 */
const AXIOM_KIND_LABEL: Record<string, string> = {
  subclass: '子类',
  transitivity: '传递性',
  property: '属性约束',
  same_as: '同一性',
  disjoint: '不相交',
  has_key: '唯一键',
  equivalent_class: '等价类',
  property_domain: '定义域',
  property_range: '值域',
  functional: '函数性',
  inverse_functional: '逆函数性',
  transitive_property: '传递属性',
  symmetric_property: '对称属性',
  property_chain: '属性链',
};

/**
 * 概念建模（DESIGN-SPEC §5 版式 E 的容器形态）。
 * 12 基元的可读清单：对象 / 关系 / 动作 / 函数 / 接口 / 公理 + 本体图谱。
 *
 * 2026-09-17 IA 重排：
 *  - 「对象类型」不再是只读清单，直接挂完整建模工作台（OntologyModelingPage：
 *    领域树 + 概念表 + 详情 + V2 编辑器 + 相似合并），此前它藏在 /ontology/model/editor 子路由；
 *  - 新增「本体图谱」视图（节点 ObjectType / 边 LinkType），由数据中心迁入（模型层的图）；
 *  - 「新建本体」走创建向导（IA-6）。
 */
export interface ModelingPageProps {
  /**
   * 初始 kind（IA v2 过渡 Adapter：新路由 model/link-types 等挂本页时指定，
   * IA2-2 拆分后随容器退役）。组件内部切换仍是 useState——本参数只定初值。
   */
  initialKind?: KindKey;
}

export default function ModelingPage({ initialKind = 'object' }: ModelingPageProps) {
  const [kind, setKind] = useState<KindKey>(initialKind);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [linkTypes, setLinkTypes] = useState<KernelLinkType[]>([]);
  const [actionTypes, setActionTypes] = useState<KernelActionType[]>([]);
  const [functions, setFunctions] = useState<KernelFunction[]>([]);
  const [interfaces, setInterfaces] = useState<KernelInterface[]>([]);
  const [axioms, setAxioms] = useState<KernelAxiom[]>([]);
  const [objectCount, setObjectCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      listObjectTypes(),
      listLinkTypes(),
      listActionTypes(),
      listFunctions(),
      listInterfaces(),
      listAxioms(),
    ]);
    const [ot, lt, at, fn, ifc, ax] = results;
    if (ot.status === 'fulfilled') setObjectCount(ot.value.length);
    else setError(ot.reason instanceof Error ? ot.reason.message : String(ot.reason));
    if (lt.status === 'fulfilled') setLinkTypes(lt.value);
    if (at.status === 'fulfilled') setActionTypes(at.value);
    if (fn.status === 'fulfilled') setFunctions(fn.value);
    if (ifc.status === 'fulfilled') setInterfaces(ifc.value);
    if (ax.status === 'fulfilled') setAxioms(ax.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [kind, keyword]);

  const counts: Record<KindKey, number | null> = {
    object: objectCount,
    link: linkTypes.length,
    action: actionTypes.length,
    function: functions.length,
    interface: interfaces.length,
    axiom: axioms.length,
    graph: null,
  };

  const kw = keyword.trim().toLowerCase();
  const match = (haystack: string) => !kw || haystack.toLowerCase().includes(kw);

  const filteredLinks = useMemo(
    () =>
      linkTypes.filter((l) =>
        match(`${l.rid} ${l.src} ${l.dst} ${l.src_display_name ?? ''} ${l.dst_display_name ?? ''}`),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linkTypes, kw],
  );
  const filteredActions = useMemo(
    () => actionTypes.filter((a) => match(`${a.title ?? ''} ${a.rid} ${a.function_ref}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionTypes, kw],
  );
  const filteredFunctions = useMemo(
    () => functions.filter((f) => match(`${f.rid} ${f.source_ref} ${f.language}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [functions, kw],
  );
  const filteredInterfaces = useMemo(
    () => interfaces.filter((i) => match(i.rid)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interfaces, kw],
  );
  const filteredAxioms = useMemo(
    () => axioms.filter((a) => match(`${a.kind} ${a.rid} ${a.rule_ref} ${a.operands.join(' ')}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axioms, kw],
  );

  const pageOf = <T,>(rows: T[]) => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const noData = (
    <EmptyState illustration="no-result" title={`没有匹配的${KIND_LABEL[kind]}`} desc="换个关键词试试。" />
  );

  const isGraph = kind === 'graph';
  const isWorkspace = kind === 'object';

  return (
    <>
      <PageHeader
        title={isGraph ? '本体图谱' : KIND_LABEL[kind]}
        desc={
          isGraph
            ? '节点是对象类型，边是关系类型 —— 本体即图谱'
            : isWorkspace
              ? '对象类型的完整建模工作台：领域树、概念表、属性与关系、相似概念合并'
              : typeof counts[kind] === 'number'
                ? `${counts[kind]} 个${KIND_LABEL[kind]} · 数据取自本体内核 v2`
                : `数据取自本体内核 v2`
        }
        actions={
          <>
            {isGraph ? null : (
              <Button
                icon={<RefreshCw size={15} strokeWidth={1.5} />}
                loading={loading}
                onClick={() => void load()}
              >
                刷新
              </Button>
            )}
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => {
                setKind('object');
                setCreateOpen(true);
              }}
            >
              新建本体
            </Button>
          </>
        }
      />

      <Tabs
        type="button"
        activeKey={kind}
        tabList={(Object.keys(KIND_LABEL) as KindKey[]).map((k) => ({
          tab: typeof counts[k] === 'number' ? `${KIND_LABEL[k]} · ${counts[k]}` : KIND_LABEL[k],
          itemKey: k,
        }))}
        onChange={(key) => setKind(key as KindKey)}
      />

      {isGraph ? (
        <OntologyGraphView />
      ) : isWorkspace ? (
        <OntologyModelingPage createOpen={createOpen} setCreateOpen={setCreateOpen} />
      ) : (
        <>
          <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: `搜索${KIND_LABEL[kind]}` }} />

          {error ? (
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
          ) : kind === 'link' ? (
            <DataTablePro<KernelLinkType>
              columns={[
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
                  title: '源 → 目标',
                  dataIndex: 'src',
                  width: 320,
                  ellipsis: true,
                  render: (_: unknown, row: KernelLinkType) =>
                    `${row.src_display_name || ridTail(row.src)} → ${row.dst_display_name || ridTail(row.dst)}`,
                },
                { title: '基数', dataIndex: 'cardinality', width: 120 },
                { title: '方向性', dataIndex: 'directionality', width: 130 },
                {
                  title: '链属性',
                  dataIndex: 'link_properties',
                  width: 100,
                  render: (v: KernelLinkType['link_properties']) => v.length,
                },
                { title: 'rid', dataIndex: 'rid', ellipsis: true },
              ]}
              dataSource={pageOf(filteredLinks)}
              rowKey="rid"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredLinks.length,
                onChange: setPage,
              }}
              empty={noData}
            />
          ) : kind === 'action' ? (
            <DataTablePro<KernelActionType>
              columns={[
                {
                  title: '动作',
                  dataIndex: 'title',
                  width: 220,
                  ellipsis: true,
                  render: (v: string | undefined, row: KernelActionType) => (
                    <span className="mp-onto-strong">{v || ridTail(row.rid)}</span>
                  ),
                },
                { title: 'rid', dataIndex: 'rid', width: 300, ellipsis: true },
                {
                  title: '绑定类型',
                  dataIndex: 'on',
                  width: 110,
                  render: (v: string[]) => v.length,
                },
                {
                  title: '参数',
                  dataIndex: 'parameters',
                  width: 90,
                  render: (v: KernelActionType['parameters']) => v.length,
                },
                {
                  title: '提交条件',
                  dataIndex: 'submission_criteria',
                  width: 120,
                  render: (v: string[]) => v.length,
                },
                { title: '函数引用', dataIndex: 'function_ref', ellipsis: true },
              ]}
              dataSource={pageOf(filteredActions)}
              rowKey="rid"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredActions.length,
                onChange: setPage,
              }}
              empty={noData}
            />
          ) : kind === 'function' ? (
            <DataTablePro<KernelFunction>
              columns={[
                {
                  title: '函数',
                  dataIndex: 'rid',
                  width: 240,
                  ellipsis: true,
                  render: (_: unknown, row: KernelFunction) => (
                    <span className="mp-onto-strong">{ridTail(row.rid)}</span>
                  ),
                },
                { title: 'rid', dataIndex: 'rid', width: 300, ellipsis: true },
                { title: '语言', dataIndex: 'language', width: 120 },
                { title: '版本', dataIndex: 'version', width: 90 },
                {
                  title: '签名',
                  dataIndex: 'signatures',
                  width: 90,
                  render: (v: KernelFunction['signatures']) => v.length,
                },
                { title: '来源', dataIndex: 'source_ref', ellipsis: true },
              ]}
              dataSource={pageOf(filteredFunctions)}
              rowKey="rid"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredFunctions.length,
                onChange: setPage,
              }}
              empty={noData}
            />
          ) : kind === 'interface' ? (
            <DataTablePro<KernelInterface>
              columns={[
                {
                  title: '接口',
                  dataIndex: 'rid',
                  width: 260,
                  ellipsis: true,
                  render: (_: unknown, row: KernelInterface) => (
                    <span className="mp-onto-strong">{ridTail(row.rid)}</span>
                  ),
                },
                { title: 'rid', dataIndex: 'rid', ellipsis: true },
                {
                  title: '属性签名',
                  dataIndex: 'properties',
                  width: 120,
                  render: (v: KernelInterface['properties']) => v.length,
                },
                {
                  title: '必填关系',
                  dataIndex: 'required_links',
                  width: 120,
                  render: (v: string[]) => v.length,
                },
                {
                  title: '多态动作约束',
                  dataIndex: 'polymorphic_action_constraints',
                  width: 140,
                  render: (v: string[]) => v.length,
                },
              ]}
              dataSource={pageOf(filteredInterfaces)}
              rowKey="rid"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredInterfaces.length,
                onChange: setPage,
              }}
              empty={noData}
            />
          ) : (
            <DataTablePro<KernelAxiom>
              columns={[
                {
                  title: '公理',
                  dataIndex: 'rid',
                  width: 300,
                  ellipsis: true,
                  render: (_: unknown, row: KernelAxiom) => (
                    <span className="mp-onto-strong">{ridTail(row.rid)}</span>
                  ),
                },
                {
                  title: '类型',
                  dataIndex: 'kind',
                  width: 130,
                  render: (v: string) => (
                    <Tag size="small" type="light">
                      {AXIOM_KIND_LABEL[v] ?? v}
                    </Tag>
                  ),
                },
                { title: '规则', dataIndex: 'rule_ref', width: 170, ellipsis: true },
                {
                  title: '操作数',
                  dataIndex: 'operands',
                  ellipsis: true,
                  render: (v: string[]) =>
                    v.length ? v.map(ridTail).join(' → ') : <span className="mp-onto-muted">—</span>,
                },
                {
                  title: '元数据',
                  dataIndex: 'metadata',
                  width: 200,
                  ellipsis: true,
                  render: (v: string[][]) =>
                    v.length ? (
                      v.map(([k, val]) => `${k}=${val}`).join('; ')
                    ) : (
                      <span className="mp-onto-muted">—</span>
                    ),
                },
              ]}
              dataSource={pageOf(filteredAxioms)}
              rowKey="rid"
              loading={loading}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total: filteredAxioms.length,
                onChange: setPage,
              }}
              empty={noData}
            />
          )}
        </>
      )}
    </>
  );
}
