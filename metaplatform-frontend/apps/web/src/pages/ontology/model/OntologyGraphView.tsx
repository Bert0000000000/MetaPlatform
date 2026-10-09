import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  listObjectTypes,
  listLinkTypes,
  validateObjectTypeModel,
  propSlug,
  type KernelObjectType,
  type KernelLinkType,
  type ModelPreflight,
} from '@/api/ont/kernel';
import ModelGraphCanvas from './graph/ModelGraphCanvas';
import ModelInspector from './graph/ModelInspector';
import ModelResourceTree from './graph/ModelResourceTree';
import { resourceUrl } from '../hooks/resourceContext';
import { resourceError } from '../hooks/resourceErrors';
import './graph/model-workbench.css';

export default function OntologyGraphView() {
  const navigate = useNavigate(),
    location = useLocation();
  const [params, setParams] = useSearchParams();
  const [treeOpen, setTreeOpen] = useState(
      () => !window.matchMedia('(max-width: 680px)').matches,
    ),
    [inspectorOpen, setInspectorOpen] = useState(
      () => !window.matchMedia('(max-width: 680px)').matches,
    );
  const [types, setTypes] = useState<KernelObjectType[]>([]),
    [links, setLinks] = useState<KernelLinkType[]>([]);
  const [loading, setLoading] = useState(true),
    [errors, setErrors] = useState<string[]>([]);
  const [check, setCheck] = useState<ModelPreflight | null>(null),
    [checkError, setCheckError] = useState(''),
    [checking, setChecking] = useState(false);
  const generation = useRef(0),
    checkGeneration = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setErrors([]);
    const result = await Promise.allSettled([
      listObjectTypes(),
      listLinkTypes(),
    ]);
    if (n !== generation.current) return;
    setTypes(result[0].status === 'fulfilled' ? result[0].value : []);
    setLinks(result[1].status === 'fulfilled' ? result[1].value : []);
    setErrors(
      result.flatMap((r, i) =>
        r.status === 'rejected'
          ? [`${i === 0 ? '对象类型' : '关系'} · ${resourceError(r.reason)}`]
          : [],
      ),
    );
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const query = params.get('q') ?? '',
    view = params.get('view') === 'list' ? 'list' : 'graph',
    rid = params.get('typeRef') || params.get('class') || '';
  const filtered = useMemo(
    () =>
      types.filter((t) =>
        `${t.display_name} ${t.rid}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [types, query],
  );
  const known = new Set(filtered.map((t) => t.rid));
  const visibleLinks = links.filter(
    (l) => known.has(l.src) && known.has(l.dst),
  );
  const selected = filtered.find((t) => t.rid === rid) ?? null;
  const unavailableSelection = !rid || selected
    ? undefined
    : errors.length
      ? `模型读取未完成 · ${rid}`
      : types.some((t) => t.rid === rid)
        ? `所选资源被筛选隐藏 · ${rid}`
        : `未找到请求的模型 · ${rid}`;
  useEffect(() => {
    checkGeneration.current++;
    setCheck(null);
    setCheckError('');
    setChecking(false);
  }, [selected]);
  useEffect(
    () => () => {
      checkGeneration.current++;
    },
    [],
  );
  const update = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p);
  };
  const back = location.pathname + location.search;
  const open = (id: string) =>
    navigate(
      resourceUrl(
        `/ontology/model/object-types/${encodeURIComponent(id)}/properties`,
        id,
        back,
        params.get('changeRef') || undefined,
      ),
    );
  const runCheck = async () => {
    if (!selected) return;
    const n = ++checkGeneration.current;
    setChecking(true);
    setCheck(null);
    setCheckError('');
    try {
      const result = await validateObjectTypeModel({ ...selected });
      if (n === checkGeneration.current) setCheck(result);
    } catch (e) {
      if (n === checkGeneration.current) setCheckError(resourceError(e));
    } finally {
      if (n === checkGeneration.current) setChecking(false);
    }
  };
  return (
    <section className="mw-workbench" aria-label="模型工作台">
      <div className="mw-toolbar">
        <button
          aria-pressed={view === 'graph'}
          onClick={() => update('view', 'graph')}
        >
          图谱视图
        </button>
        <button
          aria-pressed={view === 'list'}
          onClick={() => update('view', 'list')}
        >
          资源列表
        </button>
        <input
          aria-label="筛选模型"
          placeholder="搜索模型名称或标识"
          value={query}
          onChange={(e) => update('q', e.target.value)}
        />
        <span>
          {loading
            ? '模型读取中…'
            : errors.length
              ? '计数未完成'
              : `${filtered.length} 类型 · ${visibleLinks.length} 关系`}
        </span>
        <button aria-expanded={treeOpen} aria-controls="model-resource-tree"
          onClick={() => setTreeOpen((open) => !open)}>资源树</button>
        <button aria-expanded={inspectorOpen} aria-controls="model-inspector"
          onClick={() => setInspectorOpen((open) => !open)}>属性检查器</button>
        <button onClick={() => void load()}>刷新</button>
        <button
          disabled={!selected || checking}
          onClick={() => void runCheck()}
        >
          {checking ? '校验中…' : '校验选中模型'}
        </button>
        <button
          onClick={() => navigate('/ontology/model/object-types?create=true')}
        >
          新建资源
        </button>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="mw-error">
          {types.length > 0 ? 'partial · ' : ''}
          {errors.join('；')} <button onClick={() => void load()}>重试</button>
        </div>
      )}
      {loading ? (
        <p className="mw-hint">正在读取模型定义…</p>
      ) : (
        <div className={`mw-content ${treeOpen ? 'has-tree' : ''} ${inspectorOpen ? 'has-inspector' : ''}`}>
          <div id="model-resource-tree" className="mw-tree-panel" hidden={!treeOpen}>
            <ModelResourceTree
              types={filtered} selectedRid={rid} query={query}
              incomplete={errors.length > 0}
              onQuery={(value) => update('q', value)}
              onSelect={(id) => update('typeRef', id)} onOpen={open}
            />
          </div>
          <div className="mw-visual-panel">
            <div className="mw-view-heading">
              <strong>{view === 'graph' ? '模型关系图' : '对象资源列表'}</strong>
              <small>同源模型定义 · {errors.length ? '读取未完成' : `${filtered.length} 类型 · ${visibleLinks.length} 关系`}</small>
            </div>
            {filtered.length === 0 ? (
              <p className="mw-hint">
                {errors.length ? '模型读取未完成' : '没有匹配的对象类型'}
              </p>
            ) : view === 'graph' ? (
              <ModelGraphCanvas
                types={filtered}
                links={visibleLinks}
                selectedRid={rid}
                onSelect={(id) => update('typeRef', id)}
                onOpen={open}
              />
            ) : (
              <div className="mw-list">
                {filtered.map((t) => (
                  <button
                    key={t.rid}
                    aria-label={`选择模型 ${t.display_name || propSlug(t.rid)}`}
                    aria-pressed={rid === t.rid}
                    onClick={() => update('typeRef', t.rid)}
                    onDoubleClick={() => open(t.rid)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault();
                        open(t.rid);
                      }
                    }}
                  >
                    {t.display_name}
                    <small>
                      {t.rid} · {t.properties.length} 属性
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div id="model-inspector" className="mw-inspector-panel" hidden={!inspectorOpen}>
            <ModelInspector
              type={selected}
              unavailableSelection={unavailableSelection}
              linksUnavailable={errors.length > 0}
              links={visibleLinks.filter((l) => l.src === rid || l.dst === rid)}
              onOpen={() => open(rid)}
              onBinding={() =>
                navigate(
                  resourceUrl(
                    '/ontology/data/mappings',
                    rid,
                    back,
                    params.get('changeRef') || undefined,
                  ),
                )
              }
              onExplore={() =>
                navigate(resourceUrl('/ontology/explore/objects', rid, back))
              }
            />
          </div>
        </div>
      )}
      <div className="mw-check" aria-live="polite">
        <strong>模型检查</strong> ·{' '}
        {checking
          ? '正在执行真实预检'
          : checkError
            ? `校验失败 · ${checkError}`
            : check
              ? `${check.valid ? '校验通过' : '校验未通过'} · ${check.errors.length} 错误 · ${check.warnings.length} 提示`
              : '尚未校验'}
        {check && (
          <ul>
            {[
              ...check.errors,
              ...check.warnings,
              ...check.destructive.map((d) => `破坏性变更：${d}`),
            ].map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
