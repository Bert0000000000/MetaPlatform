// ObjectTypeEditorV2Drawer - 类型/属性编辑器 v2（EXP-02 语义表达力 + EXP-04 治理元数据）。
//
// create / edit 双模式，提交 = POST /ont/v2/object-types 整体 upsert（body 即 ObjectTypeDTO）。
// 注意：不能用 POST /object-types/{rid}/properties 追加 —— 该端点合并时会丢
// parent_class / status / type_group / render_hints 等扩展字段，v2 编辑必须整体提交。
//
// 覆盖字段：
//   ObjectType 级：display_name / parent_class（同租户其他类型，含「无」）/ interfaces
//     （GET /ont/v2/interfaces 多选）/ status（active/draft/deprecated）/ type_group /
//     description / render_hints（kv 行编辑）
//   Property 级：见 PropertyEditorV2（title/description/值类型联动/array+reducer/
//     derived/struct_fields/shared/nullable/primary_key）
//
// dev 模式 Semi 交互组件 onClick 被截 noop —— 全部原生元素 + 内联样式。

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import {
  propSlug, slugAndVersionOfObjectType,
  type DestructiveConfirmDetail, type KernelInterface, type KernelLinkType,
  type KernelObjectType, type KernelObjectTypeCreate, type KernelValueType,
} from '@/api/ont/kernel';
import PropertyEditorV2, {
  FALLBACK_VALUE_TYPES, draftFormat, draftFromProperty, draftToPropertyDTO,
  emptyPropertyDraft, validatePropertyDraft, type PropertyDraft,
} from './PropertyEditorV2';

// ─────────────────── 样式 ───────────────────

// 属性徽标的色值随草稿状态动态变化（format / 主键 / 派生 / 数组 / 共享），
// 保留为按色值生成的动态行内样式；其余静态样式一律走 mp-onto-* 类。
const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', fontSize: 10, lineHeight: '16px', padding: '0 6px',
  borderRadius: 999, border: `1px solid ${color}`, color, flexShrink: 0,
});

// ─────────────────── Props ───────────────────

export interface ObjectTypeEditorPrefill {
  /** 打开后直接展开某个属性编辑区（按属性 rid）。 */
  expandPropRid?: string;
  /** 打开后直接追加一个新属性草稿并展开。 */
  addNewProp?: boolean;
}

export interface ObjectTypeEditorV2DrawerProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** edit 模式必填：现有 ObjectType 完整 DTO。 */
  objectType: KernelObjectType | null;
  /** 同租户全部 ObjectType（parent_class 选项 + derived 对端提示）。 */
  objectTypes: KernelObjectType[];
  linkTypes: KernelLinkType[];
  interfaces: KernelInterface[];
  valueTypes: KernelValueType[];
  tenant: string;
  /** create 模式领域选项。 */
  domainOptions: Array<{ code: string; label: string }>;
  prefill?: ObjectTypeEditorPrefill;
  onClose: () => void;
  /**
   * 提交钩子（页面负责 create 的 precheck 门禁 + POST /object-types + 刷新）。
   * 返回 null = 成功（抽屉自行关闭）；string = 错误信息（抽屉内展示并保持打开）；
   * DestructiveConfirmDetail 对象 = 409 破坏性门禁（抽屉底部展示二段确认区，
   * 确认重发时在 payload 顶层加 confirm_name 再走本钩子）。
   */
  onSubmit: (
    payload: KernelObjectTypeCreate, mode: 'create' | 'edit',
  ) => Promise<string | DestructiveConfirmDetail | null>;
  /** create 模式概念名失焦 → 页面触发相似扫描（MP-DEDUP-01）。 */
  onCreateNameBlur?: (name: string, slug: string, domain: string) => void;
  /** 相似扫描进行中（create 概念名旁的提示）。 */
  prechecking?: boolean;
}

interface RenderHintRow {
  key: string;
  k: string;
  v: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'active', label: 'active（启用）' },
  { value: 'draft', label: 'draft（草稿）' },
  { value: 'deprecated', label: 'deprecated（已废弃）' },
];

// ─────────────────── 组件 ───────────────────

export default function ObjectTypeEditorV2Drawer({
  open, mode, objectType, objectTypes, linkTypes, interfaces, valueTypes,
  tenant, domainOptions, prefill, onClose, onSubmit, onCreateNameBlur, prechecking,
}: ObjectTypeEditorV2DrawerProps) {
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState(domainOptions[0]?.code ?? 'crm');
  const [description, setDescription] = useState('');
  const [parentClass, setParentClass] = useState('');
  const [interfacesSel, setInterfacesSel] = useState<string[]>([]);
  const [status, setStatus] = useState('active');
  const [typeGroup, setTypeGroup] = useState('');
  const [renderHints, setRenderHints] = useState<RenderHintRow[]>([]);
  // marking 无独立编辑 UI（v2 未要求），编辑时透传保留原值
  const [marking, setMarking] = useState<string[]>([]);
  const [propDrafts, setPropDrafts] = useState<PropertyDraft[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // G33：409 破坏性变更二段确认（页面 onSubmit 返回 DestructiveConfirmDetail 时激活）
  const [destructive, setDestructive] = useState<DestructiveConfirmDetail | null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  const vts = valueTypes.length > 0 ? valueTypes : FALLBACK_VALUE_TYPES;

  // edit 模式属性 rid 基座：概念 rid 的 obj.<domain>.<slug> 去 obj. 前缀
  // （与既有 append 流约定一致：ont.<tenant>.prop.<domain>.<slug>-<属性名>.v1）
  const editBaseSlug = objectType
    ? slugAndVersionOfObjectType(objectType.rid).slug.replace(/^obj\./, '').replace(/\.v\d+$/, '')
    : '';

  // 新建属性 rid：create 模式随概念 slug/领域联动（占位 <slug> 在提交校验前必然被替换）
  const makePropRid = (name: string): string => {
    const n = name.trim();
    if (mode === 'create') {
      const s = slug.trim() || '<slug>';
      return `ont.${tenant}.prop.${domain}.${s}${n ? `-${n}` : ''}.v1`;
    }
    return `ont.${tenant}.prop.${editBaseSlug}${n ? `-${n}` : ''}.v1`;
  };

  // prefill 只在打开瞬间生效：用 ref 读取，避免对象身份变化重置表单
  const prefillRef = useRef(prefill);
  prefillRef.current = prefill;
  const prefillKey = prefill?.expandPropRid
    ? `x:${prefill.expandPropRid}`
    : prefill?.addNewProp ? 'n' : '';

  // 打开/切换目标时初始化表单
  useEffect(() => {
    if (!open) return;
    setError('');
    setSubmitting(false);
    setExpanded(null);
    setDestructive(null);
    setConfirmInput('');
    const pf = prefillRef.current;
    if (mode === 'edit' && objectType) {
      setDisplayName(objectType.display_name ?? '');
      setDescription(objectType.description ?? '');
      setParentClass(objectType.parent_class ?? '');
      setInterfacesSel(objectType.interfaces ?? []);
      setStatus(objectType.status || 'active');
      setTypeGroup(objectType.type_group ?? '');
      setMarking(objectType.marking ?? []);
      setRenderHints((objectType.render_hints ?? []).map(([k, v], i) => ({ key: `rh-${i}-${k}`, k, v })));
      let drafts = objectType.properties.map((p) => draftFromProperty(p));
      if (pf?.addNewProp) {
        const d = { ...emptyPropertyDraft(''), rid: makePropRid('') };
        drafts = [...drafts, d];
        setExpanded(d.uid);
      } else if (pf?.expandPropRid) {
        const hit = drafts.find((dp) => dp.rid === pf.expandPropRid);
        if (hit) setExpanded(hit.uid);
      }
      setPropDrafts(drafts);
    } else if (mode === 'create') {
      setDisplayName('');
      setSlug('');
      setDomain(domainOptions[0]?.code ?? 'crm');
      setDescription('');
      setParentClass('');
      setInterfacesSel([]);
      setStatus('active');
      setTypeGroup('');
      setMarking([]);
      setRenderHints([]);
      // 新概念自动带一个主键属性（概念必有主键；kind 段用 prop —— ClassRef 正则只认 prop）
      const pk = { ...emptyPropertyDraft('id'), nullable: false, primaryKey: true };
      pk.rid = makePropRid('id');
      setPropDrafts([pk]);
      setExpanded(pk.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, objectType?.rid, prefillKey]);

  // create 模式：概念 slug/领域变化 → 联动重算新建属性的 rid 预览
  useEffect(() => {
    if (!open || mode !== 'create') return;
    setPropDrafts((ds) => ds.map((d) => (d.isNew ? { ...d, rid: makePropRid(d.name) } : d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, domain, open, mode]);

  if (!open) return null;

  const updatePropDraft = (uid: string, next: PropertyDraft) => {
    setPropDrafts((ds) => ds.map((d) => {
      if (d.uid !== uid) return d;
      if (d.isNew && next.name !== d.name) return { ...next, rid: makePropRid(next.name) };
      return next;
    }));
  };

  const removePropDraft = (uid: string) => {
    setPropDrafts((ds) => ds.filter((d) => d.uid !== uid));
    if (expanded === uid) setExpanded(null);
  };

  const addPropDraft = () => {
    const d = { ...emptyPropertyDraft(''), rid: makePropRid('') };
    setPropDrafts((ds) => [...ds, d]);
    setExpanded(d.uid);
  };

  const propBadges = (d: PropertyDraft): Array<{ text: string; color: string }> => {
    const fmt = draftFormat(d, vts);
    const out: Array<{ text: string; color: string }> = [{ text: fmt, color: '#62d178' }];
    if (d.primaryKey) out.push({ text: '主键', color: 'var(--semi-color-success)' });
    if (d.derivedEnabled) out.push({ text: `派生·${d.derivedFn}`, color: '#fbbf24' });
    if (d.array) out.push({ text: `数组·${d.reducer || '未选归约'}`, color: '#c084fc' });
    if (d.shared) out.push({ text: '共享', color: '#60a5fa' });
    if (fmt === 'struct') out.push({ text: `struct·${d.structFields.length} 字段`, color: '#62d178' });
    return out;
  };

  /** 提交（整体 upsert）。confirmNameVal 非空 = 破坏性 409 后的确认重发（payload 顶层加 confirm_name）。 */
  const submit = async (confirmNameVal?: string) => {
    if (mode === 'edit' && !objectType) return;
    const errs: string[] = [];
    if (!displayName.trim()) errs.push('概念显示名必填');
    if (mode === 'create' && !/^[a-z0-9_-]+$/.test(slug.trim())) {
      errs.push('slug 必填，仅限小写字母 / 数字 / 下划线 / 连字符');
    }
    const dtoProps = propDrafts.map((d) => draftToPropertyDTO(d, vts));
    propDrafts.forEach((d, i) => {
      const label = d.name || `#${i + 1}`;
      for (const m of validatePropertyDraft(d, vts)) errs.push(`属性「${label}」：${m}`);
    });
    const rids = dtoProps.map((p) => p.rid);
    if (new Set(rids).size !== rids.length) errs.push('存在重复的属性 rid（属性名重复）');
    const pks = dtoProps.filter((p) => p.primary_key).map((p) => p.rid);
    if (pks.length === 0) errs.push('至少需要一个主键属性');
    if (renderHints.some((h) => !h.k.trim() && h.v.trim())) errs.push('render_hints 每行 key 必填');
    if (errs.length > 0) {
      const shown = errs.slice(0, 6).join('；');
      setError(shown + (errs.length > 6 ? ` …等共 ${errs.length} 处待修正` : ''));
      return;
    }
    const payload: KernelObjectTypeCreate = {
      rid: mode === 'create'
        ? `ont.${tenant}.obj.${domain}.${slug.trim()}.v1`
        : objectType!.rid,
      display_name: displayName.trim(),
      primary_key: pks,
      properties: dtoProps,
      interfaces: interfacesSel,
      marking: marking.length > 0 ? marking : undefined,
      parent_class: parentClass,
      description: description.trim(),
      status,
      type_group: typeGroup.trim(),
      render_hints: renderHints
        .filter((h) => h.k.trim())
        .map((h) => [h.k.trim(), h.v] as [string, string]),
    };
    // G33：破坏性变更确认重发 —— confirm_name 加在 payload 顶层
    if (confirmNameVal) payload.confirm_name = confirmNameVal;
    setSubmitting(true);
    setError('');
    setDestructive(null);
    try {
      const result = await onSubmit(payload, mode);
      if (result && typeof result === 'object') {
        // 409 destructive_confirm_required：抽屉底部展开二段确认区
        setDestructive(result);
        setConfirmInput('');
      } else if (result) {
        setError(result);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // derived 对端提示用：create 模式的"未来 rid"
  const currentTypeRid = objectType?.rid
    ?? (mode === 'create' ? `ont.${tenant}.obj.${domain}.${slug.trim() || '<slug>'}.v1` : '');

  const parentOptions = objectTypes.filter((ot) => ot.rid !== objectType?.rid);

  return (
    <div
      onClick={() => !submitting && onClose()}
      className="mp-flex mp-justify-end mp-onto-drawer-mask mp-onto-drawer-mask--top"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mp-h-full mp-flex-col mp-onto-drawer-panel mp-onto-drawer-panel--fixed"
      >
        {/* Header */}
        <div className="mp-justify-between mp-border mp-shrink-0 mp-flex-center mp-py-3 mp-px-5" >
          <div className="mp-min-w-0">
            <div className="mp-text-xs mp-text-2 mp-mb-1" >
              类型 / 属性编辑器 v2 · 整体 upsert（POST /ont/v2/object-types）
            </div>
            <h3 className="mp-fw-600 mp-m-0 mp-text-md" >
              {mode === 'create' ? '新建概念（ObjectType）' : `编辑概念：${objectType?.display_name ?? ''}`}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="mp-border mp-text-2 mp-bg-1 mp-rounded-sm mp-onto-close-btn mp-onto-close-btn--sm">
            <X className="mp-icon-14" />
          </button>
        </div>

        {/* Body */}
        <div className="mp-flex-1 mp-overflow-y-auto mp-py-4 mp-px-5" >
          {/* ── 基础信息 ── */}
          <div className="mp-mb-5">
            <div className="mp-onto-section-title">基础信息</div>
            {mode === 'create' ? (
              <div className="mp-grid mp-gap-2 mp-onto-grid-3">
                <div>
                  <div className="mp-onto-field-label mp-onto-field-label--stacked">概念名称 *</div>
                  <div className="mp-relative">
                    <input
                      type="text"
                      value={displayName}
                      placeholder="例如：客户"
                      onChange={(e) => setDisplayName(e.target.value)}
                      onBlur={() => onCreateNameBlur?.(displayName.trim(), slug.trim(), domain)}
                      className="mp-w-full mp-onto-input mp-onto-input--lg"
                    />
                    {prechecking && (
                      <span className="mp-text-xs mp-text-2 mp-onto-precheck-hint">
                        相似扫描中…
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mp-onto-field-label mp-onto-field-label--stacked">slug（rid 末段）*</div>
                  <input
                    type="text"
                    value={slug}
                    placeholder="例如：customer"
                    onChange={(e) => setSlug(e.target.value)}
                    className="mp-w-full mp-onto-input mp-onto-input--lg"
                  />
                </div>
                <div>
                  <div className="mp-onto-field-label mp-onto-field-label--stacked">领域</div>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="mp-w-full mp-onto-input mp-onto-input--lg"
                  >
                    {domainOptions.map((d) => (
                      <option key={d.code} value={d.code}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="mp-onto-field-label mp-onto-field-label--stacked">概念显示名 *</div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mp-w-full mp-onto-input mp-onto-input--lg"
                />
                <div className="mp-mono mp-onto-hint">rid：<code>{objectType?.rid}</code>（整体 upsert，不可改）</div>
              </>
            )}
            {mode === 'create' && (
              <div className="mp-mono mp-onto-hint">
                生成 rid：<code>ont.{tenant}.obj.{domain}.{slug.trim() || '<slug>'}.v1</code>
                ；主键属性自动创建：<code>ont.{tenant}.prop.{domain}.{slug.trim() || '<slug>'}-id.v1</code>
              </div>
            )}
          </div>

          {/* ── 类型元数据（v2）── */}
          <div className="mp-mb-5">
            <div className="mp-onto-section-title">类型元数据（EXP-01 层级 / EXP-04 治理）</div>
            <div className="mp-grid mp-mb-2 mp-gap-2 mp-grid-2" >
              <div>
                <div className="mp-onto-field-label mp-onto-field-label--stacked">父类型（parent_class，限 1 层）</div>
                <select
                  value={parentClass}
                  onChange={(e) => setParentClass(e.target.value)}
                  className="mp-w-full mp-onto-input mp-onto-input--lg"
                >
                  <option value="">无（顶层类型）</option>
                  {parentOptions.map((ot) => (
                    <option key={ot.rid} value={ot.rid} title={ot.rid}>
                      {ot.display_name || ot.rid}（{slugAndVersionOfObjectType(ot.rid).slug.replace(/^obj\./, '')}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mp-onto-field-label mp-onto-field-label--stacked">生命周期状态（status）</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mp-w-full mp-onto-input mp-onto-input--lg"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mp-mb-2">
              <div className="mp-onto-field-label mp-onto-field-label--stacked">实现 Interface（多选，多态契约）</div>
              <select
                multiple
                value={interfacesSel}
                onChange={(e) => setInterfacesSel(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="mp-onto-input mp-onto-input--multi"
              >
                {interfaces.map((i) => (
                  <option key={i.rid} value={i.rid} title={i.rid} className="mp-py-1 mp-px-1">
                    {propSlug(i.rid)}（{i.properties.length} 属性契约）
                  </option>
                ))}
              </select>
              <div className="mp-onto-hint">
                {interfaces.length === 0
                  ? '暂无 Interface（可先不选，选项来自 GET /ont/v2/interfaces）'
                  : `按住 Ctrl / Cmd 可多选；当前已选 ${interfacesSel.length} 个`}
              </div>
            </div>
            <div className="mp-mb-2">
              <div className="mp-onto-field-label mp-onto-field-label--stacked">类型分组（type_group）</div>
              <input
                type="text"
                value={typeGroup}
                placeholder="例如 核心域 / 参考数据"
                onChange={(e) => setTypeGroup(e.target.value)}
                className="mp-w-full mp-onto-input mp-onto-input--lg"
              />
            </div>
            <div className="mp-mb-2">
              <div className="mp-onto-field-label mp-onto-field-label--stacked">描述（description）</div>
              <textarea
                value={description}
                placeholder="可选；概念的业务语义说明"
                onChange={(e) => setDescription(e.target.value)}
                className="mp-onto-textarea mp-onto-textarea--lg"
              />
            </div>
            <div>
              <div className="mp-justify-between mp-flex-center mp-onto-field-label mp-onto-field-label--stacked">
                <span>渲染提示（render_hints，key/value）</span>
                <button
                  type="button"
                  onClick={() => setRenderHints((rs) => [...rs, { key: crypto.randomUUID(), k: '', v: '' }])}
                  className="mp-onto-btn mp-onto-btn--xs"
                >
                  <Plus className="mp-icon-12" />添加
                </button>
              </div>
              {renderHints.map((h) => (
                <div key={h.key} className="mp-mb-2 mp-gap-2 mp-flex-center">
                  <input
                    type="text"
                    value={h.k}
                    placeholder="key，例如 icon"
                    onChange={(e) => setRenderHints((rs) => rs.map((x) => (x.key === h.key ? { ...x, k: e.target.value } : x)))}
                    className="mp-flex-1 mp-mono mp-onto-input mp-onto-input--lg"
                  />
                  <input
                    type="text"
                    value={h.v}
                    placeholder="value，例如 user"
                    onChange={(e) => setRenderHints((rs) => rs.map((x) => (x.key === h.key ? { ...x, v: e.target.value } : x)))}
                    className="mp-flex-1 mp-onto-input mp-onto-input--lg"
                  />
                  <button
                    type="button"
                    aria-label="删除此行"
                    onClick={() => setRenderHints((rs) => rs.filter((x) => x.key !== h.key))}
                    className="mp-text-danger mp-onto-btn mp-onto-btn--xs"
                  >
                    <Trash2 className="mp-icon-12" />
                  </button>
                </div>
              ))}
              {renderHints.length === 0 && (
                <div className="mp-onto-hint">暂无渲染提示；key 必填，空 key 行提交时会被忽略。</div>
              )}
            </div>
          </div>

          {/* ── 属性定义 ── */}
          <div>
            <div className="mp-justify-between mp-flex-center mp-onto-section-title">
              <span>属性定义（{propDrafts.length} 个，主键 {propDrafts.filter((d) => d.primaryKey).length} 个）</span>
              <button type="button" onClick={addPropDraft} className="mp-onto-btn mp-onto-btn--xs">
                <Plus className="mp-icon-12" />添加属性
              </button>
            </div>
            {propDrafts.map((d, i) => {
              const isOpen = expanded === d.uid;
              const errs = validatePropertyDraft(d, vts);
              return (
                <div
                  key={d.uid}
                  className="mp-hidden mp-border mp-rounded mp-mb-2 mp-bg-1"
                >
                  <div
                    className="mp-gap-2 mp-flex-center mp-clickable mp-py-2 mp-px-3"
                    onClick={() => setExpanded(isOpen ? null : d.uid)}
                  >
                    {isOpen
                      ? <ChevronDown className="mp-icon-14 mp-text-2 mp-shrink-0"  />
                      : <ChevronRight className="mp-icon-14 mp-text-2 mp-shrink-0"  />}
                    <span className="mp-fw-600 mp-text-sm mp-shrink-0" >
                      {d.name || <span className="mp-text-danger">（未命名）</span>}
                    </span>
                    {d.title && (
                      <span className="mp-text-xs mp-text-2 mp-shrink-0" >{d.title}</span>
                    )}
                    <div className="mp-flex mp-gap-1 mp-wrap mp-min-w-0" >
                      {propBadges(d).map((b) => (
                        <span key={b.text} style={badge(b.color)}>{b.text}</span>
                      ))}
                    </div>
                    {!isOpen && errs.length > 0 && (
                      <span className="mp-text-xs mp-text-danger mp-shrink-0" >待修正 {errs.length}</span>
                    )}
                    <div className="mp-shrink-0 mp-ml-auto">
                      <button
                        type="button"
                        aria-label={`删除属性 ${d.name || i + 1}`}
                        onClick={(e) => { e.stopPropagation(); removePropDraft(d.uid); }}
                        className="mp-text-danger mp-onto-btn mp-onto-btn--xs"
                        title={d.primaryKey ? '删除主键属性后需保证仍有主键' : undefined}
                      >
                        <Trash2 className="mp-icon-12" />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mp-border mp-onto-prop-body">
                      <PropertyEditorV2
                        draft={d}
                        onChange={(next) => updatePropDraft(d.uid, next)}
                        valueTypes={vts}
                        linkTypes={linkTypes}
                        objectTypes={objectTypes}
                        currentTypeRid={currentTypeRid}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mp-border mp-shrink-0 mp-py-3 mp-px-5" >
          {/* G33：破坏性变更二段确认区（409 destructive_confirm_required） */}
          {destructive && (
            <div className="mp-mb-2 mp-p-2 mp-text-sm mp-bg-1 mp-lh-16 mp-rounded mp-onto-box-danger">
              <div className="mp-fw-600 mp-text-danger mp-flex-center mp-mb-1 mp-gap-1" >
                <AlertTriangle className="mp-shrink-0 mp-icon-12"  />
                保存被拦截：检测到破坏性变更，需二次确认
              </div>
              <div className="mp-flex mp-mb-2 mp-gap-1 mp-flex-col" >
                {destructive.changes.map((c, i) => (
                  <div key={i} className="mp-text-xs mp-text-danger mp-break-all mp-mono" >
                    · {c}
                  </div>
                ))}
              </div>
              <div className="mp-mb-2 mp-text-xs mp-text-2">
                输入 <code className="mp-text-danger">{destructive.confirm_with}</code>
                （该类型当前显示名）以确认执行；确认重发会在提交体顶层附带 confirm_name。
              </div>
              <div className="mp-gap-2 mp-flex-center">
                <input
                  type="text"
                  value={confirmInput}
                  placeholder={`输入 ${destructive.confirm_with} 以确认`}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-mono mp-onto-input mp-onto-input--md"
                />
                <button
                  type="button"
                  onClick={() => void submit(confirmInput.trim())}
                  disabled={submitting || !confirmInput.trim()}
                  className="mp-fw-600 mp-onto-btn mp-onto-btn--md mp-onto-btn--solid-danger"
                >
                  {submitting ? '重发中…' : '确认重发'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDestructive(null); setConfirmInput(''); }}
                  disabled={submitting}
                  className="mp-onto-btn mp-onto-btn--md"
                >
                  取消
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="mp-flex mp-mb-2 mp-gap-1 mp-p-2 mp-text-sm mp-text-danger mp-items-start mp-lh-16 mp-rounded mp-onto-box-danger">
              <AlertTriangle className="mp-shrink-0 mp-mt-1 mp-icon-12"  />
              <span>{error}</span>
            </div>
          )}
          <div className="mp-flex mp-justify-end mp-gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="mp-fw-600 mp-onto-btn mp-onto-btn--lg mp-onto-btn--solid"
            >
              {submitting ? '保存中…' : '保存（整体 upsert）'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
