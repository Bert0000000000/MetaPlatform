// ObjectTypeEditorV2Drawer - 类型/属性编辑器 v2（EXP-02 语义表达力 + EXP-04 治理元数据）。
//
// create / edit 双模式：完整 ObjectTypeDTO 经 schema-WIP 暂存与发布；新建保留严格拒重意图。
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
// 原生表单沿用平台控件样式；草稿、预检和发布继续使用既有提交契约。

import { useContext, useEffect, useRef, useState } from 'react';
import { createUuid } from '@/utils/uuid';
import { useAuth } from '@mate/shared';
import { discardEditorInput,editorIdentity,editorInputKey,readEditorInput,retainEditorInput } from '../hooks/editorSession';
import { UNSAFE_NavigationContext, Link } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { listBigDataSources } from '@/api/ontology-bigdata';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import {
  propSlug, slugAndVersionOfObjectType, listSchemaWip, saveSchemaWip, validateObjectTypeModel, errDetailText, getObjectType, assessMigration, inspectObjectType, getObjectBindingUsage, type AppBindingUsage,
  type MigrationAssessment,
  type SchemaWipEntry, type ModelPreflight,
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

// This editor is eagerly imported by the ontology route table. Register before
// BrowserRouter's popstate listener; its synchronous update can otherwise unmount
// the editor before a listener installed by an effect gets a chance to cancel.
let activeDraftHistoryGuard: ((event: PopStateEvent) => void) | null = null;
const guardDraftHistory = (event: PopStateEvent) => activeDraftHistoryGuard?.(event);
if (typeof window !== 'undefined') window.addEventListener('popstate', guardDraftHistory, true);
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('popstate', guardDraftHistory, true));

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
    payload: KernelObjectTypeCreate, mode: 'create' | 'edit', expectedChecksum?: string,
  ) => Promise<string | DestructiveConfirmDetail | null>;
  onLocateExisting?: (rid: string) => Promise<void>;
  /** create 模式概念名失焦 → 页面触发相似扫描（MP-DEDUP-01）。 */
  onCreateNameBlur?: (name: string, slug: string, domain: string) => void;
  /** 相似扫描进行中（create 概念名旁的提示）。 */
  prechecking?: boolean;
  /** True backend WIP stage handler; never calls direct upsert. */
  onSaveDraft?: (payload: KernelObjectTypeCreate, mode: 'create' | 'edit', expectedChecksum?: string) => Promise<string | null>;
  onDirtyChange?: (dirty: boolean) => void;
  auxiliaryErrors?: string[];
  auxiliaryLoading?: boolean;
  onRetryAuxiliary?: () => void;
  externalError?: string;
  /** Caller-owned similarity continuation shares the form's write lock. */
  externalSubmitting?: boolean;
}

interface RenderHintRow {
  key: string;
  k: string;
  v: string;
}

interface EditorInput {
  displayName:string;slug:string;domain:string;description:string;parentClass:string;
  interfacesSel:string[];status:string;typeGroup:string;renderHints:RenderHintRow[];marking:string[];
  propDrafts:PropertyDraft[];expanded:string|null;baseline:string;liveDefinition:string;checksum?:string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'active', label: 'active（启用）' },
  { value: 'draft', label: 'draft（草稿）' },
  { value: 'deprecated', label: 'deprecated（已废弃）' },
];

// ─────────────────── 组件 ───────────────────

export default function ObjectTypeEditorV2Drawer({
  open, mode, objectType, objectTypes, linkTypes, interfaces, valueTypes,
  tenant, domainOptions, prefill, onClose, onSubmit, onCreateNameBlur, prechecking, onLocateExisting, onSaveDraft, onDirtyChange, auxiliaryErrors, auxiliaryLoading, onRetryAuxiliary, externalError, externalSubmitting = false,
}: ObjectTypeEditorV2DrawerProps) {
  const {user}=useAuth();
  const identity=editorIdentity(user);
  const sessionKey=editorInputKey(identity,mode,objectType?.rid);
  const [loadedSessionKey,setLoadedSessionKey]=useState('');
  const [sessionNotice,setSessionNotice]=useState('');
  const [baseline, setBaseline] = useState<string | undefined>(objectType?.checksum);
  const [latest, setLatest] = useState<KernelObjectType | null>(null);
  const [applicationReferences, setApplicationReferences] = useState<AppBindingUsage[] | null>(null);
  const [applicationReferenceError, setApplicationReferenceError] = useState('');
  const [actionReferences, setActionReferences] = useState<string[] | null>(null);
  const [impact, setImpact] = useState<MigrationAssessment | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [validated, setValidated] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const [drafts, setDrafts] = useState<SchemaWipEntry[]>([]);
  const [notice, setNotice] = useState('');
  const [preflight, setPreflight] = useState<ModelPreflight | null>(null);
  const [sources, setSources] = useState<Array<{sourceId: string; name: string}>>([]);
  const [sourceId, setSourceId] = useState('');
  const [sourceTables, setSourceTables] = useState<Array<{name: string; columns: Array<{name: string; type: string; nullable?: boolean; primary_key?: boolean}>}>>([]);
  const [sourceError, setSourceError] = useState('');
  const [sourceBusy, setSourceBusy] = useState(false);
  const lastSaved = useRef<KernelObjectTypeCreate | null>(null);
  const navigation = useContext(UNSAFE_NavigationContext);
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
  const busy = submitting || externalSubmitting;
  const [error, setError] = useState('');
  // G33：409 破坏性变更二段确认（页面 onSubmit 返回 DestructiveConfirmDetail 时激活）
  const [destructive, setDestructive] = useState<DestructiveConfirmDetail | null>(null);
  const [destructiveChecksum, setDestructiveChecksum] = useState<string | undefined>();
  const [confirmInput, setConfirmInput] = useState('');
  const [closeRequested, setCloseRequested] = useState(false);
  const initial = useRef('');
  const baselineLive = useRef('');
  const submitGeneration = useRef(0);
  useEffect(()=>()=>{submitGeneration.current++;},[open,mode,objectType?.rid,identity]);
  const snapshot = (name:string, sl:string, dom:string, desc:string, parent:string, ifcs:string[], st:string, group:string, hints:RenderHintRow[], marks:string[], drafts:PropertyDraft[]) =>
    JSON.stringify({name,sl,dom,desc,parent,ifcs,st,group,hints:hints.map(h=>[h.k,h.v]),marks,drafts:drafts.map(({uid:_uid,...d})=>d)});
  const current = snapshot(displayName,slug,domain,description,parentClass,interfacesSel,status,typeGroup,renderHints,marking,propDrafts);
  const dirty = open && !!initial.current && current !== initial.current;
  useEffect(()=>{
    if (!open || loadedSessionKey!==sessionKey) return;
    if (dirty) retainEditorInput<EditorInput>(identity,sessionKey,{displayName,slug,domain,description,parentClass,interfacesSel,status,typeGroup,renderHints,marking,propDrafts,expanded,baseline:initial.current,liveDefinition:baselineLive.current,checksum:baseline});
    else discardEditorInput(sessionKey);
  },[open,loadedSessionKey,sessionKey,identity,dirty,current,expanded,baseline]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty,onDirtyChange]);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (e:BeforeUnloadEvent) => {e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  },[open,dirty]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      e.preventDefault();
      if (dirty) setCloseRequested(true); else onClose();
    };
    window.addEventListener('keydown',escape);
    return () => window.removeEventListener('keydown',escape);
  },[open,dirty,busy,onClose]);

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
    // This caller keeps a closed drawer mounted. Do not re-retain its old fields
    // on the next open before initialization/restoration has finished.
    if (!open) { setLoadedSessionKey(''); return; }
    setError('');
    setSubmitting(false);
    setExpanded(null);
    setDestructive(null);
    setDestructiveChecksum(undefined);
    setConfirmInput('');
    setCloseRequested(false);
    const pf = prefillRef.current;
    const saved=readEditorInput<EditorInput>(identity,sessionKey);
    setLoadedSessionKey(sessionKey);
    setSessionNotice('');
    if(saved){
      setDisplayName(saved.displayName);setSlug(saved.slug);setDomain(saved.domain);setDescription(saved.description);setParentClass(saved.parentClass);setInterfacesSel(saved.interfacesSel);setStatus(saved.status);setTypeGroup(saved.typeGroup);setRenderHints(saved.renderHints);setMarking(saved.marking);setPropDrafts(saved.propDrafts);setExpanded(saved.expanded);
      initial.current=saved.baseline;
      baselineLive.current=saved.liveDefinition;
      setSessionNotice(`未保存输入已保留在当前会话，尚未提交后端${saved.liveDefinition!==JSON.stringify(objectType)?'。当前生效定义已变化，请重新核对并校验；旧确认已失效。':''}`);
      return;
    }
    baselineLive.current=JSON.stringify(objectType);
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
      initial.current = snapshot(objectType.display_name??'',slug,domain,objectType.description??'',objectType.parent_class??'',objectType.interfaces??[],objectType.status||'active',objectType.type_group??'',(objectType.render_hints??[]).map(([k,v],i)=>({key:String(i),k,v})),objectType.marking??[],objectType.properties.map(draftFromProperty));
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
      // Initialization must use the reset values, not the previous mounted form's slug/domain.
      pk.rid = `ont.${tenant}.prop.${domainOptions[0]?.code ?? 'crm'}.<slug>-id.v1`;
      setPropDrafts([pk]);
      setExpanded(pk.uid);
      initial.current = snapshot('','',domainOptions[0]?.code??'crm','','',[],'active','',[],[],[pk]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, objectType?.rid, prefillKey, identity, resetTick]);

  // create 模式：概念 slug/领域变化 → 联动重算新建属性的 rid 预览
  useEffect(() => {
    if (!open || mode !== 'create') return;
    setPropDrafts((ds) => ds.map((d) => (d.isNew ? { ...d, rid: makePropRid(d.name) } : d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, domain, open, mode]);

  const restorePayload = (payload: KernelObjectTypeCreate) => {
    const parts = payload.rid.split('.');
    setDisplayName(payload.display_name ?? ''); setSlug(parts[4] ?? ''); setDomain(parts[3] ?? 'crm');
    setDescription(payload.description ?? ''); setParentClass(payload.parent_class ?? '');
    setInterfacesSel(payload.interfaces ?? []); setStatus(payload.status ?? 'active');
    setTypeGroup(payload.type_group ?? ''); setMarking(payload.marking ?? []);
    setRenderHints((payload.render_hints ?? []).map(([k,v], i) => ({key: `restored-${i}`,k,v})));
    const restoredDrafts = payload.properties.map(p => mode === 'create'
      ? {...draftFromProperty(p), isNew: true, name: p.rid.split('.').at(-2)!.replace(new RegExp(`^${parts[4]}-`), '')}
      : draftFromProperty(p));
    setPropDrafts(restoredDrafts);
    initial.current = snapshot(payload.display_name ?? '', parts[4] ?? '', parts[3] ?? 'crm', payload.description ?? '', payload.parent_class ?? '', payload.interfaces ?? [], payload.status ?? 'active', payload.type_group ?? '', (payload.render_hints ?? []).map(([k,v],i)=>({key:String(i),k,v})), payload.marking ?? [], restoredDrafts);
    discardEditorInput(sessionKey);
    setError(''); setPreflight(null); setNotice('草稿已恢复，尚未发布。');
    lastSaved.current = payload;
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setValidated(false); setNotice(''); setPreflight(null); setLatest(null); setImpact(null); setActionReferences(null); const savedInput = readEditorInput<EditorInput>(identity, sessionKey); setBaseline(savedInput ? savedInput.checksum : objectType?.checksum); lastSaved.current = null;
    listSchemaWip().then(rows => { if (alive) setDrafts(rows.filter(w => mode === 'create' ? w.create_only || !objectTypes.some(o => o.rid === w.rid) : w.rid === objectType?.rid)); })
      .catch(() => { if (alive) setNotice('草稿清单暂不可用，请重新打开重试；当前输入可继续编辑。'); });
    return () => { alive = false; };
  }, [open, mode, objectType?.rid, identity]);

  useEffect(() => {
    if (!open || !dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    // BrowserRouter records an idx for same-document history. Capture before its
    // bubble listener so a cancelled back/forward cannot unmount this draft.
    const currentIndex: unknown = window.history.state?.idx;
    let restoringHistory = false;
    const beforeHistoryNavigation = (event: PopStateEvent) => {
      if (restoringHistory) {
        restoringHistory = false;
        event.stopImmediatePropagation();
        return;
      }
      const targetIndex: unknown = event.state?.idx;
      if (typeof currentIndex !== 'number' || typeof targetIndex !== 'number' || targetIndex === currentIndex) return;
      if (!window.confirm('有未保存的更改，确定离开？')) {
        event.stopImmediatePropagation();
        restoringHistory = true;
        window.history.go(currentIndex - targetIndex);
      }
    };
    activeDraftHistoryGuard = beforeHistoryNavigation;
    // BrowserRouter navigation uses these same methods for sidebar links/buttons.
    const navigator = navigation?.navigator;
    const push = navigator?.push, replace = navigator?.replace;
    if (navigator && push && replace) {
      navigator.push = (...args) => { if (window.confirm('有未保存的更改，确定离开？')) push.apply(navigator, args); };
      navigator.replace = (...args) => { if (window.confirm('有未保存的更改，确定离开？')) replace.apply(navigator, args); };
    }
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      if (activeDraftHistoryGuard === beforeHistoryNavigation) activeDraftHistoryGuard = null;
      if (navigator && push && replace) { navigator.push = push; navigator.replace = replace; }
    };
  }, [open, dirty, navigation]);

  if (!open) return null;
  const requestClose = () => { if (busy) return; if (dirty) setCloseRequested(true); else {discardEditorInput(sessionKey);onClose();} };

  const updatePropDraft = (uid: string, next: PropertyDraft) => {
    setPreflight(null);
    setPropDrafts((ds) => ds.map((d) => {
      if (d.uid !== uid) return d;
      if (d.isNew && next.name !== d.name) return { ...next, rid: makePropRid(next.name) };
      return next;
    }));
  };

  const removePropDraft = (uid: string) => {
    setPreflight(null);
    setPropDrafts((ds) => ds.filter((d) => d.uid !== uid));
    if (expanded === uid) setExpanded(null);
  };

  const addPropDraft = () => {
    setPreflight(null);
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
  const submit = async (confirmNameVal?: string, action: 'publish' | 'draft' | 'preflight' = 'publish', retryChecksum?: string) => {
    if (busy) return;
    if (mode === 'edit' && !objectType) return;
    setValidated(true);
    const errs: string[] = [];
    if (!displayName.trim()) errs.push('业务名称必填');
    if (mode === 'create' && !tenant) errs.push('认证租户不可用，不能生成模型标识');
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
    setDestructiveChecksum(undefined);
    const gen = ++submitGeneration.current;
    try {
      if (action === 'draft') {
        if (onSaveDraft) {
          const draftError = await onSaveDraft(payload, mode, baseline);
          if (gen !== submitGeneration.current) return;
          if (draftError) { setError(draftError); return; }
        } else {
          await saveSchemaWip(payload, mode === 'create', baseline);
          if (gen !== submitGeneration.current) return;
        }
        lastSaved.current = payload;
        initial.current = current;
        discardEditorInput(sessionKey);
        onDirtyChange?.(false);
        setNotice('草稿已保存，刷新后可恢复；尚未发布。');
        return;
      }
      const report = await validateObjectTypeModel(payload as unknown as Record<string, unknown>);
      if (gen !== submitGeneration.current) return;
      setPreflight(report);
      if (mode === 'edit' && report.valid) {
        setActionReferences(null);
        setApplicationReferences(null); setApplicationReferenceError('');
        const [assessment, inspection] = await Promise.all([
          assessMigration(payload.rid, {targetPayload: payload as unknown as Record<string, unknown>}),
          inspectObjectType(payload.rid),
        ]);
        if (gen !== submitGeneration.current) return;
        setImpact(assessment); setActionReferences(inspection.actions);
        try {
          const usage = await getObjectBindingUsage(payload.rid);
          if (gen !== submitGeneration.current) return;
          setApplicationReferences(usage);
        } catch (e) {
          if (gen !== submitGeneration.current) return;
          setApplicationReferenceError('应用引用未知，请重试预检'); throw e;
        }
      }
      if (!report.valid || action === 'preflight') return;
      const submittedChecksum = retryChecksum ?? baseline;
      const result = await onSubmit(payload, mode, submittedChecksum);
      if (gen !== submitGeneration.current) return;
      if (result && typeof result === 'object') {
        // 409 destructive_confirm_required：抽屉底部展开二段确认区
        setDestructive(result);
        setDestructiveChecksum(submittedChecksum);
        setConfirmInput('');
      } else if (result) {
        setLatest(null);
        setError(result);
      } else {
        initial.current = current;
        discardEditorInput(sessionKey);
        onDirtyChange?.(false);
        onClose();
      }
    } catch (cause) {
      if (gen !== submitGeneration.current) return;
      setLatest(null);
      setError(errDetailText(cause, cause instanceof Error ? cause.message : '操作失败，请重试；输入已保留。'));
    } finally {
      if(gen===submitGeneration.current) setSubmitting(false);
    }
  };

  // derived 对端提示用：create 模式的"未来 rid"
  const currentTypeRid = objectType?.rid
    ?? (mode === 'create' ? `ont.${tenant}.obj.${domain}.${slug.trim() || '<slug>'}.v1` : '');

  const parentOptions = objectTypes.filter((ot) => ot.rid !== objectType?.rid);

  return (
    <div
      onClick={requestClose}
      className="mp-flex mp-justify-end mp-onto-drawer-mask mp-onto-drawer-mask--top"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="模型编辑器"
        className="mp-native-controls mp-model-editor mp-h-full mp-flex-col mp-onto-drawer-panel mp-onto-drawer-panel--fixed"
      >
        {/* Header */}
        <div className="mp-justify-between mp-border mp-shrink-0 mp-flex-center mp-py-3 mp-px-5" >
          <div className="mp-min-w-0">
            <div className="mp-text-xs mp-text-2 mp-mb-1" >
              1 业务信息 → 2 选择字段 → 3 关联 → 4 校验与发布
            </div>
            <h3 className="mp-fw-600 mp-m-0 mp-text-md" >
              {mode === 'create' ? '新建对象类型' : `编辑对象类型：${objectType?.display_name ?? ''}`}
            </h3>
          </div>
          <button type="button" onClick={requestClose} disabled={busy} aria-label="关闭" className="mp-border mp-text-2 mp-bg-1 mp-rounded-sm mp-onto-close-btn mp-onto-close-btn--sm">
            <X className="mp-icon-14" />
          </button>
        </div>

        {/* Body */}
        <fieldset disabled={busy} onClickCapture={busy ? (event)=>{event.preventDefault();event.stopPropagation();} : undefined} className="mp-flex-1 mp-overflow-y-auto mp-py-4 mp-px-5 mp-border-none mp-m-0" onChangeCapture={() => { setPreflight(null); setNotice(''); }} >
          {externalSubmitting && <p role="status">相似概念续接写入中，请等待当前提交完成。</p>}
          {auxiliaryLoading && <p role="status">正在读取编辑辅助信息；已有参考值与输入保持不变。</p>}
          {sessionNotice && <p role="status">{sessionNotice}</p>}
          {!identity && <p role="alert" className="mp-text-danger">身份不可用，跨页后未保存输入无法恢复。请先保存当前输入，或复制备份后<a href="/login">重新登录</a>。</p>}
          {externalError && <p role="alert" className="mp-text-danger">{externalError}</p>}
          {dirty && identity && !sessionNotice && <p role="status">未保存输入已保留在当前会话，尚未提交后端。离开后重新打开可继续编辑。</p>}
          {auxiliaryErrors?.length ? <div role="alert" className="mp-text-danger">partial · 编辑辅助信息读取失败：{auxiliaryErrors.join('；')} {onRetryAuxiliary && <button type="button" onClick={onRetryAuxiliary}>重试编辑辅助信息</button>}</div> : null}
          {drafts.map(wip => <button type="button" key={wip.rid} onClick={() => { restorePayload(wip.payload as unknown as KernelObjectTypeCreate); setBaseline(wip.base_checksum); }}>
            恢复草稿：{String(wip.payload.display_name || wip.rid)}
          </button>)}
          <p>订单对象是一笔订单；订单类型定义所有订单共有的字段。保存草稿不会发布模型。</p>
          {/* ── 基础信息 ── */}
          <div className="mp-mb-5">
            <div className="mp-onto-section-title">基础信息</div>
            {mode === 'create' ? (
              <div className="mp-grid mp-gap-2 mp-onto-grid-3">
                <div>
                  <div className="mp-onto-field-label mp-onto-field-label--stacked">业务名称 *</div>
                  <div className="mp-relative">
                    <input
                      type="text"
                      aria-label="业务名称" aria-invalid={validated && !displayName.trim()}
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
                  <div className="mp-onto-field-label mp-onto-field-label--stacked">业务标识 *</div>
                  <input
                    type="text"
                    aria-label="业务标识" aria-invalid={validated && !/^[a-z0-9-]+$/.test(slug.trim())}
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
                <div className="mp-onto-field-label mp-onto-field-label--stacked">业务名称 *</div>
                <input
                  type="text"
                  aria-label="业务名称" aria-invalid={validated && !displayName.trim()}
                      value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mp-w-full mp-onto-input mp-onto-input--lg"
                />
                <div className="mp-mono mp-onto-hint">rid：<code>{objectType?.rid}</code>（整体 upsert，不可改）</div>
              </>
            )}
            {advanced && mode === 'create' && (
              <div className="mp-mono mp-onto-hint">
                生成 rid：<code>ont.{tenant}.obj.{domain}.{slug.trim() || '<slug>'}.v1</code>
                ；主键属性自动创建：<code>ont.{tenant}.prop.{domain}.{slug.trim() || '<slug>'}-id.v1</code>
              </div>
            )}
          </div>

          <label className="mp-model-editor-description">业务说明<textarea aria-label="业务说明" value={description} onChange={e => setDescription(e.target.value)} /></label>
          {validated && !displayName.trim() && <p role="alert">业务名称必填</p>}
          {validated && !/^[a-z0-9-]+$/.test(slug.trim()) && mode === 'create' && <p role="alert">业务标识必填，仅限小写字母、数字和连字符</p>}
          <button type="button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>高级设置</button>
          {/* ── 类型元数据（v2）── */}
          {advanced && <>
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
                <div className="mp-onto-field-label mp-onto-field-label--stacked">生命周期状态（仅元数据，不等同于保存草稿）</div>
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
                  onClick={() => setRenderHints((rs) => [...rs, { key: createUuid(), k: '', v: '' }])}
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

          </>}
          <div className="mp-mb-3">
            <h4>从数据表选择字段</h4>
            <div className="mp-model-editor-source-tools">
            <button type="button" disabled={sourceBusy} onClick={async () => {
              setSourceBusy(true); setSourceError('');
              try { setSources(await listBigDataSources()); } catch { setSourceError('数据源暂不可用，请重试或先到数据接入配置。'); }
              finally { setSourceBusy(false); }
            }}>读取数据源</button>
            <select aria-label="选择数据源" value={sourceId} onChange={async e => {
              const id=e.target.value; setSourceId(id); setSourceTables([]); if (!id) return;
              setSourceBusy(true); setSourceError('');
              try {
                const response=await apiClient.get(`/data/sources/${encodeURIComponent(id)}/schema`);
                if (!Array.isArray(response.data?.tables) || !response.data?.discovered_at) throw new Error('missing verified discovery');
                setSourceTables(response.data.tables);
              } catch { setSourceError('尚未取得可验证的实际字段，请检查数据源连接后重试。'); }
              finally { setSourceBusy(false); }
            }}><option value="">选择已有数据源</option>{sources.map(source => <option key={source.sourceId} value={source.sourceId}>{source.name}</option>)}</select>
            </div>
            {sourceBusy && <p>正在读取实际字段…</p>}{sourceError && <p role="alert">{sourceError}</p>}
            {sourceTables.map(table => <fieldset key={table.name}><legend>{table.name}</legend>{table.columns.map(column => <button type="button" key={column.name} onClick={() => {
              const name=column.name.toLowerCase().replace(/[^a-z0-9-]/g,'-');
              const format=/int/.test(column.type) ? 'integer' : /numeric|decimal|float|double|real/.test(column.type) ? 'double' : /bool/.test(column.type) ? 'boolean' : /time/.test(column.type) ? 'timestamp' : /date/.test(column.type) ? 'date' : 'string';
              const draft={...emptyPropertyDraft(name), rid:makePropRid(name), title:column.name, typeId:format, fallbackFormat:format, nullable:column.nullable ?? true, primaryKey:column.primary_key ?? false};
              setPropDrafts(previous => [...previous.filter(p => p.name !== name), draft]); setExpanded(draft.uid); setPreflight(null);
            }}>添加字段 {column.name}（{column.type}）</button>)}</fieldset>)}
            <p><Link to="/ontology/data/mappings">打开数据映射</Link> · <Link to="/ontology/model/link-types">选择关系并查看关联</Link></p>
          </div>
          {/* ── 属性定义 ── */}
          <div>
            <div className="mp-justify-between mp-flex-center mp-onto-section-title">
              <span>属性定义（{propDrafts.length} 个，主键 {propDrafts.filter((d) => d.primaryKey).length} 个）</span>
              <button type="button" onClick={addPropDraft} className="mp-onto-btn mp-onto-btn--xs">
                <Plus className="mp-icon-12" />添加属性
              </button>
            </div>
            {validated && !propDrafts.some(p => p.primaryKey) && <p role="alert">至少需要一个主键属性</p>}
            {propDrafts.map((d, i) => {
              const isOpen = expanded === d.uid;
              const errs = validatePropertyDraft(d, vts);
              return (
                <div
                  key={d.uid}
                  className="mp-border mp-rounded mp-mb-2 mp-bg-1"
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
                      {errs.map((message,i) => <p role="alert" key={i}>{message}</p>)}
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
        </fieldset>

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
                  onClick={() => void submit(confirmInput.trim(), 'publish', destructiveChecksum)}
                  disabled={busy || !confirmInput.trim()}
                  className="mp-fw-600 mp-onto-btn mp-onto-btn--md mp-onto-btn--solid-danger"
                >
                  {submitting ? '重发中…' : '确认重发'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDestructive(null); setDestructiveChecksum(undefined); setConfirmInput(''); }}
                  disabled={busy}
                  className="mp-onto-btn mp-onto-btn--md"
                >
                  取消
                </button>
              </div>
            </div>
          )}
          {notice && <p role="status">{notice}</p>}
          {preflight && <div aria-label="预检结果">
            <strong>{preflight.valid ? '模型校验通过' : '请修正以下问题'}</strong>
            {[...preflight.errors, ...preflight.warnings, ...preflight.destructive].map((message,i) => <p key={i}>{message}</p>)}
            <p>依赖：{preflight.references.dependencies.join('、') || '无'}；未解析引用：{preflight.references.unresolved.join('、') || '无'}</p>
          </div>}
          {preflight && mode === 'create' && <p>新建对象类型尚无已发布历史引用；重复标识会拒绝发布。</p>}
          {preflight && mode === 'edit' && <p>引用动作：{actionReferences === null ? '尚未取得，请重试预检' : actionReferences.length ? actionReferences.join('、') : '无'}</p>}
          {impact && <div aria-label="变更影响"><p>受影响数据：{impact.counts.instances_affected ?? impact.counts.reattach_pending ?? '未提供'} 条</p>
            {impact.changes.map((change,i) => <p key={i}>{change}</p>)}
            <div aria-label="应用引用">
              {applicationReferences === null ? <p role="status">{applicationReferenceError || '应用引用尚未查询，状态未知'}</p>
                : applicationReferences.length === 0 ? <p>当前租户没有实际应用绑定引用</p>
                : applicationReferences.map((a, i) => <p key={a.app_id + a.page_id + a.status + i}>
                    <Link to={'/apps/mine?app=' + encodeURIComponent(a.app_id)}>{a.app_name}</Link>
                    {' · ' + a.app_id + ' · ' + a.model_version + ' · ' + (a.status === 'PUBLISHED' ? '已发布' : a.status === 'OFFLINE' ? '已下线' : '草稿')}
                    {a.version_id && ' · ' + a.version_id}
                  </p>)}
              </div>
            {impact.warnings.map((warning,i) => <p key={i}>{warning}</p>)}
          </div>}
          {latest && <div aria-label="最新版本比较"><p>最新名称：{latest.display_name}；最新说明：{latest.description || '无'}；最新属性：{latest.properties.map(p => p.title || propSlug(p.rid)).join('、')}</p>
            <p>当前表单保持不变。确认比较后，将以最新模型为基线重试。</p>
            <button type="button" onClick={() => void submit(undefined, 'publish', latest.checksum)}>使用最新基线重试发布</button>
          </div>}
          {error && (
            <div className="mp-flex mp-mb-2 mp-gap-1 mp-p-2 mp-text-sm mp-text-danger mp-items-start mp-lh-16 mp-rounded mp-onto-box-danger">
              <AlertTriangle className="mp-shrink-0 mp-mt-1 mp-icon-12"  />
              <span>{error}</span>
              <button type="button" onClick={async () => { try { setLatest(await getObjectType(currentTypeRid)); } catch { setNotice('最新模型读取失败，请重试。'); } }}>比较最新模型</button>
              {onLocateExisting && <button type="button" onClick={async () => { try { await onLocateExisting(currentTypeRid); } catch { setNotice('未找到已有类型，请检查标识后重试。'); } }}>定位已有类型</button>}
            </div>
          )}
          <div className="mp-model-editor-actions mp-flex mp-justify-end mp-gap-2">
            <button type="button" disabled={busy} onClick={() => { if(lastSaved.current) restorePayload(lastSaved.current); else { discardEditorInput(sessionKey); setResetTick(t=>t+1); } }}>撤销更改</button>
            <button type="button" disabled={busy} onClick={() => void submit(undefined, 'draft')}>保存草稿</button>
            <button type="button" disabled={busy} onClick={() => void submit(undefined, 'preflight')}>预检与影响</button>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              取消
            </button>
                        <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="mp-fw-600 mp-onto-btn mp-onto-btn--lg mp-onto-btn--solid"
            >
              {submitting ? '处理中…' : '发布对象类型'}
            </button>
          </div>
        </div>
        {closeRequested && <div role="dialog" aria-modal="true" aria-label="未保存的修改" className="mp-p-4 mp-border mp-bg-1">
          <p>存在未保存的修改。继续编辑或明确放弃后关闭。</p>
          <button type="button" disabled={busy} onClick={() => setCloseRequested(false)} className="mp-onto-btn mp-onto-btn--lg">继续编辑</button>
          <button type="button" disabled={busy} onClick={() => {if(busy)return;discardEditorInput(sessionKey);onDirtyChange?.(false);onClose();}} className="mp-onto-btn mp-onto-btn--lg">放弃修改并关闭</button>
        </div>}
      </div>
    </div>
  );
}
