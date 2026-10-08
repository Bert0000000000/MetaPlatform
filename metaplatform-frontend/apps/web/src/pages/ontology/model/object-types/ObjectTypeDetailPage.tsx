import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  getObjectType,
  listObjectTypes,
  listActionTypes,
  listLinkTypes,
  listBackingDatasources,
  getMaterialization,
  listValueTypes,
  listInterfaces,
  createObjectType,
  saveSchemaWip,
  extractDestructiveConfirm,
  type KernelObjectType,
  type KernelObjectTypeCreate,
  type KernelLinkType,
  type KernelBackingDatasource,
  type KernelActionType,
  type KernelValueType,
  type KernelInterface,
  type MaterializationResult,
} from '@/api/ont/kernel';
import { getTenantId } from '@/utils/auth';
import { DataTablePro } from '@/components/skeleton';
import ResourceDetailLayout from '../../layout/ResourceDetailLayout';
import ObjectTypeEditorV2Drawer, {
  type ObjectTypeEditorPrefill,
} from '../../components/ObjectTypeEditorV2Drawer';
import VersionHistory from '../../components/VersionHistory';
import { resourceUrl, safeReturnTo } from '../../hooks/resourceContext';
import { resourceError } from '../../hooks/resourceErrors';
import '../graph/model-workbench.css';
import '../../ontology.css';

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'properties', label: '属性与约束' },
  { key: 'links', label: '关系' },
  { key: 'datasources', label: '来源绑定' },
  { key: 'actions', label: '业务动作' },
  { key: 'history', label: '版本与影响' },
];
type Aux =
  | 'resources'
  | 'links'
  | 'bindings'
  | 'samples'
  | 'actions'
  | 'valueTypes'
  | 'interfaces';
export default function ObjectTypeDetailPage() {
  const { rid = '', tab: rawTab } = useParams();
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab : 'overview';
  const navigate = useNavigate(),
    location = useLocation();
  const [params] = useSearchParams();
  const [resourcesOpen, setResourcesOpen] = useState(
    () => !window.matchMedia('(max-width: 680px)').matches,
  );
  const [type, setType] = useState<KernelObjectType | null>(null),
    [types, setTypes] = useState<KernelObjectType[]>([]),
    [links, setLinks] = useState<KernelLinkType[]>([]),
    [bindings, setBindings] = useState<KernelBackingDatasource[]>([]),
    [samples, setSamples] = useState<MaterializationResult | null>(null),
    [actions, setActions] = useState<KernelActionType[]>([]),
    [valueTypes, setValueTypes] = useState<KernelValueType[]>([]),
    [interfaces, setInterfaces] = useState<KernelInterface[]>([]);
  const [error, setError] = useState(''),
    [errors, setErrors] = useState<Partial<Record<Aux, string>>>({}),
    [pending, setPending] = useState<Partial<Record<Aux, boolean>>>({}),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false),
    [prefill, setPrefill] = useState<ObjectTypeEditorPrefill>({}),
    [notice, setNotice] = useState('');
  const [wipRef, setWipRef] = useState('');
  const generation = useRef(0),
    auxGeneration = useRef<Partial<Record<Aux, number>>>({});
  const readAux = useCallback(
    async (key: Aux, gen: number) => {
      const request = (auxGeneration.current[key] ?? 0) + 1;
      auxGeneration.current[key] = request;
      setErrors((e) => ({ ...e, [key]: undefined }));
      setPending((p) => ({ ...p, [key]: true }));
      const fresh = () =>
        generation.current === gen && auxGeneration.current[key] === request;
      try {
        switch (key) {
          case 'resources': {
            const x = await listObjectTypes();
            if (fresh()) setTypes(x);
            break;
          }
          case 'links': {
            const x = await listLinkTypes();
            if (fresh())
              setLinks(x.filter((l) => l.src === rid || l.dst === rid));
            break;
          }
          case 'bindings': {
            const x = await listBackingDatasources(rid);
            if (fresh()) setBindings(x);
            break;
          }
          case 'samples': {
            const x = await getMaterialization(rid);
            if (fresh()) setSamples(x);
            break;
          }
          case 'actions': {
            const x = await listActionTypes();
            if (fresh()) setActions(x.filter((a) => a.on.includes(rid)));
            break;
          }
          case 'valueTypes': {
            const x = await listValueTypes();
            if (fresh()) setValueTypes(x);
            break;
          }
          case 'interfaces': {
            const x = await listInterfaces();
            if (fresh()) setInterfaces(x);
            break;
          }
        }
      } catch (e) {
        if (fresh()) setErrors((x) => ({ ...x, [key]: resourceError(e) }));
      } finally {
        if (fresh()) setPending((p) => ({ ...p, [key]: false }));
      }
    },
    [rid],
  );
  const load = useCallback(async () => {
    const gen = ++generation.current;
    setNotice('');
    setWipRef('');
    setEditing(false);
    setLoading(true);
    setType(null);
    setTypes([]);
    setLinks([]);
    setBindings([]);
    setSamples(null);
    setActions([]);
    setValueTypes([]);
    setInterfaces([]);
    setErrors({});
    setPending({});
    setError('');
    try {
      const t = await getObjectType(rid);
      if (generation.current !== gen) return;
      setType(t);
      setLoading(false);
      (
        [
          'resources',
          'links',
          'bindings',
          'samples',
          'actions',
          'valueTypes',
          'interfaces',
        ] as Aux[]
      ).forEach((key) => void readAux(key, gen));
    } catch (e) {
      if (generation.current === gen) {
        setError(resourceError(e));
        setLoading(false);
      }
    }
  }, [rid, readAux]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const back = location.pathname + location.search,
    changeRef = wipRef || params.get('changeRef') || undefined;
  const route = (path: string) =>
    navigate(resourceUrl(path, rid, back, changeRef));
  const edit = (pf: ObjectTypeEditorPrefill = {}) => {
    setPrefill(pf);
    setEditing(true);
  };
  const write = async (payload: KernelObjectTypeCreate) => {
    const gen = generation.current;
    try {
      await createObjectType(payload);
      if (gen === generation.current) void load();
      return null;
    } catch (e) {
      return extractDestructiveConfirm(e) || resourceError(e);
    }
  };
  const draft = async (payload: KernelObjectTypeCreate) => {
    const gen = generation.current;
    try {
      const result = await saveSchemaWip(payload);
      if (gen === generation.current) {
        setNotice(`未发布草稿已暂存 · ${result.rid}`);
        setWipRef(result.rid);
      }
      return null;
    } catch (e) {
      return resourceError(e);
    }
  };
  const auxiliary = (key: Aux, label: string, children: React.ReactNode) =>
    errors[key] ? (
      <div role="alert" className="mw-error">
        partial · {label} · {errors[key]}{' '}
        <button onClick={() => void readAux(key, generation.current)}>
          重试{label}
        </button>
      </div>
    ) : pending[key] ? (
      <p>{label}读取中…</p>
    ) : (
      children
    );
  return (
    <div className={`mw-detail ${resourcesOpen ? 'has-resources' : ''}`}>
      <button className="mw-resource-toggle" aria-controls="detail-resources"
        aria-expanded={resourcesOpen} onClick={() => setResourcesOpen((open) => !open)}>
        切换对象资源
      </button>
      <aside id="detail-resources" className="mw-resource-list" aria-label="对象资源" hidden={!resourcesOpen}>
        <strong>对象资源 · {loading || pending.resources ? '读取中' : errors.resources ? '计数未完成' : types.length}</strong>
        <input
          aria-label="筛选资源"
          placeholder="筛选资源"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {auxiliary(
          'resources',
          '资源列表',
          types
            .filter((t) =>
              `${t.display_name} ${t.rid}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((t) => (
              <button
                key={t.rid}
                aria-current={t.rid === rid ? 'page' : undefined}
                disabled={editing}
                onClick={() =>
                  navigate(
                    resourceUrl(
                      `/ontology/model/object-types/${encodeURIComponent(t.rid)}/${tab}`,
                      t.rid,
                      safeReturnTo(params.get('returnTo')),
                      changeRef,
                    ),
                  )
                }
              >
                {t.display_name || t.rid}
                <small>{t.rid}</small>
              </button>
            )),
        )}
      </aside>
      <div className="mw-detail-main">
        <ResourceDetailLayout
          title={type?.display_name || rid}
          desc={`${type?.type_group || '未分组'} · ${rid}`}
          tabs={TABS}
          tabType="line"
          activeTab={tab}
          onTabChange={(key) =>
            navigate(
              `/ontology/model/object-types/${encodeURIComponent(rid)}/${key}${location.search}`,
            )
          }
          actions={
            <>
              {safeReturnTo(params.get('returnTo')) && (
                <button
                  onClick={() =>
                    navigate(safeReturnTo(params.get('returnTo'))!)
                  }
                >
                  返回工作台
                </button>
              )}
              <button disabled={!type} onClick={() => edit()}>
                编辑模型
              </button>
              <button
                disabled={!type}
                onClick={() => edit({ addNewProp: true })}
              >
                添加属性
              </button>
              <button
                disabled={!type}
                onClick={() => route('/ontology/governance/drafts')}
              >
                审阅与发布
              </button>
            </>
          }
        >
          {type && (
            <div className="mw-resource-heading">
              <span>{type.description || '暂无描述'}</span>
              <span className="mw-definition-status">定义状态 · {type.status || '未提供'}</span>
            </div>
          )}
          {notice && (
            <p role="status">
              {notice}{' '}
              <button onClick={() => route('/ontology/governance/drafts')}>
                前往变更草稿
              </button>
            </p>
          )}
          {error ? (
            <div role="alert" className="mw-error">
              对象类型 · {error}
              <button onClick={() => void load()}>重试</button>
            </div>
          ) : loading ? (
            <p>读取对象类型…</p>
          ) : !type ? null : tab === 'properties' ? (
            <>
              <div className="mw-property-heading">
                <h3>属性定义 · {type.properties.length} 属性</h3>
                <span>主键 · {type.primary_key.map((r) =>
                  type.properties.find((p) => p.rid === r)?.title || r,
                ).join(' + ') || '未提供'}</span>
              </div>
              <DataTablePro
                columns={[
                  { title: '属性业务名', dataIndex: 'title', width: 170 },
                  {
                    title: '属性标识',
                    dataIndex: 'rid',
                    width: 210,
                    render: (v: string) => v,
                  },
                  { title: '数据类型', dataIndex: 'format', width: 100 },
                  {
                    title: '必填',
                    dataIndex: 'nullable',
                    width: 70,
                    render: (v: boolean) => (v ? '—' : '✓'),
                  },
                  {
                    title: '主键',
                    dataIndex: 'primary_key',
                    width: 70,
                    render: (v: boolean) => (v ? '✓' : '—'),
                  },
                  { title: '说明', dataIndex: 'description', ellipsis: true },
                  {
                    title: '操作',
                    key: 'edit',
                    dataIndex: 'rid',
                    width: 90,
                    render: (v: string) => (
                      <button
                        aria-label={`编辑属性 ${type.properties.find((p) => p.rid === v)?.title || v}`}
                        onClick={() => edit({ expandPropRid: v })}
                      >
                        编辑
                      </button>
                    ),
                  },
                ]}
                dataSource={type.properties}
                rowKey="rid"
                empty={<p>暂无属性</p>}
              />
              <p>
                主键与类型变更在既有写入门禁中检查；发布与实例迁移分别处理。
              </p>
            </>
          ) : tab === 'links' ? (
            auxiliary(
              'links',
              '关系',
              <DataTablePro
                columns={[
                  {
                    title: '关系',
                    dataIndex: 'rid',
                    render: (v: string) => v,
                  },
                  { title: '来源类型', dataIndex: 'src' },
                  { title: '目标类型', dataIndex: 'dst' },
                  { title: '基数', dataIndex: 'cardinality' },
                ]}
                dataSource={links}
                rowKey="rid"
                empty={<p>暂无关系</p>}
              />,
            )
          ) : tab === 'datasources' ? (
            <>
              <h3>来源绑定</h3>
              <button onClick={() => route('/ontology/data/mappings')}>
                配置来源映射
              </button>
              {auxiliary(
                'bindings',
                '来源绑定',
                bindings.length ? (
                  <DataTablePro
                    columns={[
                      { title: '来源', dataIndex: 'name' },
                      { title: '类型', dataIndex: 'kind' },
                      { title: '来源表', dataIndex: 'table_name' },
                      { title: '主键列', dataIndex: 'pk_column' },
                      { title: '水位列（实际配置）', dataIndex: 'ts_column' },
                    ]}
                    dataSource={bindings}
                    rowKey="rid"
                  />
                ) : (
                  <p>暂无来源绑定</p>
                ),
              )}
              <h3>物化样本</h3>
              {auxiliary(
                'samples',
                '物化样本',
                samples ? (
                  <>
                    <p>
                      实例数 {samples.count} ·{' '}
                      {samples.generated_at || '生成时间未提供'} ·
                      读取不触发同步
                    </p>
                    <DataTablePro
                      columns={Object.keys(samples.schema).map((col) => ({
                        title: col,
                        dataIndex: col,
                      }))}
                      dataSource={samples.rows
                        .slice(0, 20)
                        .map((r, i) => ({ ...r, __row__: i }))}
                      rowKey="__row__"
                      empty={<p>暂无物化样本</p>}
                    />
                  </>
                ) : (
                  <p>暂无物化样本</p>
                ),
              )}
            </>
          ) : tab === 'history' ? (
            <>
              {(errors.resources || pending.resources) &&
                auxiliary('resources', '当前生效定义', null)}
              <VersionHistory
                rid={rid}
                currentChecksum={
                  !errors.resources && !pending.resources ? types.find(
                    (t) =>
                      t.rid.replace(/\.v\d+$/, '') ===
                      rid.replace(/\.v\d+$/, ''),
                  )?.checksum : undefined
                }
              />
              <button onClick={() => route('/ontology/governance/releases')}>
                查看发布与迁移影响
              </button>
            </>
          ) : tab === 'actions' ? (
            auxiliary(
              'actions',
              '业务动作',
              <>
                <button onClick={() => route('/ontology/logic/actions')}>
                  配置业务动作
                </button>
                {actions.length ? (
                  actions.map((a) => (
                    <p key={a.rid}>
                      <button
                        onClick={() =>
                          route(
                            `/ontology/logic/actions/${encodeURIComponent(a.rid)}`,
                          )
                        }
                      >
                        {a.title || a.rid}
                      </button>
                    </p>
                  ))
                ) : (
                  <p>暂无关联业务动作</p>
                )}
              </>,
            )
          ) : (
            <>
              <dl className="mp-onto-detail-list">
                <dt>业务名</dt>
                <dd>{type.display_name}</dd>
                <dt>资源标识</dt>
                <dd>{type.rid}</dd>
                <dt>主键</dt>
                <dd>{type.primary_key.join(' + ')}</dd>
                <dt>父类型</dt>
                <dd>{type.parent_class || '—'}</dd>
                <dt>接口</dt>
                <dd>{type.interfaces.join('、') || '—'}</dd>
                <dt>标记</dt>
                <dd>{type.marking?.join('、') || '—'}</dd>
                <dt>定义状态</dt>
                <dd>{type.status || '未提供'}</dd>
                <dt>描述</dt>
                <dd>{type.description || '—'}</dd>
              </dl>
              <button onClick={() => route('/ontology/data/mappings')}>
                来源与映射
              </button>
              <button onClick={() => route('/ontology/explore/objects')}>
                查询对象实例
              </button>
              {Object.values(errors).some(Boolean) && (
                <p className="mw-error">
                  partial · 部分辅助信息读取失败，请在相应页签重试。
                </p>
              )}
            </>
          )}
          {editing && type && (
            <>
              {(['valueTypes', 'interfaces'] as Aux[]).map(
                (key) =>
                  errors[key] && (
                    <p role="alert" key={key}>
                      编辑辅助信息 · {errors[key]}
                    </p>
                  ),
              )}
              <ObjectTypeEditorV2Drawer
                open={editing}
                mode="edit"
                objectType={type}
                objectTypes={types}
                linkTypes={links}
                interfaces={interfaces}
                valueTypes={valueTypes}
                tenant={getTenantId() || ''}
                domainOptions={[]}
                prefill={prefill}
                onClose={() => setEditing(false)}
                onSubmit={write}
                onSaveDraft={draft}
                auxiliaryErrors={(
                  ['resources', 'links', 'valueTypes', 'interfaces'] as Aux[]
                ).flatMap((key) =>
                  errors[key] ? [`${key} · ${errors[key]}`] : [],
                )}
                onRetryAuxiliary={() => {
                  (
                    ['resources', 'links', 'valueTypes', 'interfaces'] as Aux[]
                  ).forEach((key) => void readAux(key, generation.current));
                }}
              />
            </>
          )}
        </ResourceDetailLayout>
      </div>
    </div>
  );
}
