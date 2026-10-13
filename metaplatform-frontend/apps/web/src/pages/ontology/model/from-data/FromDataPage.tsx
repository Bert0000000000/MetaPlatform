import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Banner, Button, Checkbox, Modal, Spin, Tag } from '@douyinfe/semi-ui';
import { ArrowRight, Check, FileSpreadsheet, RefreshCw, Save, Sparkles, Upload } from 'lucide-react';
import { EmptyState, PageHeader, SheetDetail } from '@/components/skeleton';
import { listObjectTypes, type KernelObjectType } from '@/api/ont/kernel';
import { exportModelingQuarantine, getModelingSource, listModelingSources, runModelingOperation, saveModelingSource, uploadModelingSource, type ModelingSource } from '@/api/ont/modeling';
import DataReadiness from './DataReadiness';
import DraftEditorDetails, { type DraftEditorProps } from './DraftEditorDetails';
import { invalidateSemanticChanges, semanticOwner } from './review';
import PublicationAcceptance from './PublicationAcceptance';
import CandidateGraph from './CandidateGraph';
import GenerationProgress from './GenerationProgress';
import ReviewWorkspace from './ReviewWorkspace';
import SyncWorkspace from './SyncWorkspace';
import CompletionReview from './CompletionReview';
import PublicationReview from './PublicationReview';
import { included, selectedDraft } from './review';
import { clearProgress, readProgress, rememberProgress } from './workspaceProgress';
import { hasPublicationStarted } from './publicationState';
import './from-data.css';

const steps = ['资料与业务范围', '候选匹配与合并确认', '变更草稿与校验', '本体发布与验收', '数据同步（可选）'];
const message = (error: unknown) => {
  const value = error as { response?: { status?: number; data?: { detail?: unknown } }; message?: string };
  if (value.response?.status === 409) return '当前修订已过期或发布基线发生变化。请先刷新来源，再重新审核和校验。';
  const detail = value.response?.data?.detail;
  return typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : value.message || '操作失败，请重试。';
};
const readable = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value);

/** AI findings remain advisory; recursive rendering preserves report details without requiring JSON editing. */
function Findings({ value }: { value: unknown }) {
  if (value == null) return null;
  if (Array.isArray(value)) return <ul className="fd-findings">{value.map((item, i) => <li key={i}><Findings value={item} /></li>)}</ul>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  const labels: Record<string, string> = { summary: '审查结论', issues: '问题', findings: '发现', severity: '级别', message: '说明', recommendation: '建议', suggestions: '建议', questions: '业务问题', question: '问题', answer: '回答', status: '状态', target: '对象', item: '位置', reason: '依据', evidence: '证据', missingData: '缺少数据', gaps: '缺口', coverage: '问题覆盖', assumptions: '假设', title: '标题', supported: '支持情况', businessQuestions: '业务问题', warnings: '注意事项' };
  return <dl className="fd-findings">{Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null).map(([key, item]) => <div key={key}><dt>{labels[key] ?? key}</dt><dd><Findings value={item} /></dd></div>)}</dl>;
}

export default function FromDataPage() {
  const [params, setParams] = useSearchParams();
  const [resume, setResume] = useState(readProgress);
  const sourceId = params.get('source') || resume?.sourceId || null;
  const [sources, setSources] = useState<ModelingSource[]>([]);
  const [source, setSource] = useState<ModelingSource | null>(null);
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [catalogStatus, setCatalogStatus] = useState('');
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [publishError, setPublishError] = useState('');
  const [completionFeedback, setCompletionFeedback] = useState('');
  const [warningAck, setWarningAck] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [focusClassId, setFocusClassId] = useState<string | null>(null);
  const [inlineSelection, setInlineSelection] = useState<DraftEditorProps['selection']>();
  useEffect(() => {
    if (!inlineSelection) return;
    const prefix = inlineSelection.kind === 'classes' ? 'class' : inlineSelection.kind === 'relationships' ? 'relation' : 'mapping';
    const timer = window.setTimeout(() => document.getElementById(`fd-${prefix}-${inlineSelection.id}`)?.focus({ preventScroll: true }), 100);
    return () => window.clearTimeout(timer);
  }, [inlineSelection]);
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step !== 1 || !focusClassId) return;
    const element = document.getElementById(focusClassId);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [step, focusClassId]);
  const publicationStarted = hasPublicationStarted(source?.publication);
  const candidateLocked = Boolean(source?.publication?.inFlight) ||
    (publicationStarted && source?.publication?.status !== 'succeeded' && source?.publication?.status !== 'completed');
  const running = source?.job?.status === 'running';
  const syncing = source?.sync?.status === 'running';
  const repairing = source?.dataRepair?.status === 'running';
  const locked = Boolean(busy || running || syncing || repairing);
  const generating = busy === '生成候选模型' || (running && source?.job?.kind === 'generate');
  const confirmGenerate = () => {
    if (locked || candidateLocked) return;
    if (source?.draft) Modal.confirm({ title: '重新生成候选模型？', content: '相同数据、业务说明和平台定义将沿用同一生成基线，并替换当前人工修改及审核状态。输入变化时重新生成并执行全量预检；失败时保留原草稿。已有发布结果请另建来源候选。', okText: '重新生成', onOk: () => operate('generate') });
    else void operate('generate');
  };

  useEffect(() => {
    let active = true;
    void listModelingSources().then(listed => {
      if (!active) return;
      setSources(listed);
    }).catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sourceId || (step !== 1 && step !== 3)) return;
    let active = true, sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      setTypes([]); setCatalogStatus('正在读取当前已有本体目录…');
      try {
        const current = await listObjectTypes();
        if (active && request === sequence) { setTypes(current); setCatalogStatus(''); }
      } catch (err) {
        if (active && request === sequence) setCatalogStatus(`平台对象类型读取失败：${message(err)}；无法确认是否有同名对象，请重试。`);
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [sourceId, step]);

  const accept = useCallback((value: ModelingSource) => {
    setSource(value); setDirty(false); setWarningAck(false); setPublishConfirmed(false);
    setSources(items => [value, ...items.filter(item => item.id !== value.id)]);
  }, []);

  useEffect(() => {
    if (!sourceId) { setSource(null); return; }
    let active = true; setBusy('读取来源'); setError(''); setPublishError(''); setCompletionFeedback('');
    void getModelingSource(sourceId).then(value => {
      if (!active) return;
      const saved = readProgress();
      const progress = saved?.sourceId === sourceId ? saved : null;
      const defaultStep = value.sync ? 4 : value.publication?.status === 'succeeded' ? 3 : value.draft ? 1 : 0;
      const restoredStep = params.get('step') === 'sync' ? 4 : progress?.generating && value.job?.status === 'succeeded' ? 1 : progress?.step ?? defaultStep;
      accept(value);
      setStep(!value.draft && restoredStep > 0 ? 0 : restoredStep);
      if (progress?.edits) {
        setSource({ ...value, ...progress.edits, revision: progress.revision });
        setDirty(true);
        if (value.revision !== progress.revision) setError('服务端修订已变化，已保留上次未保存的修改。请核对后刷新来源；旧修订不能覆盖最新内容。');
      }
      if (value.job?.status === 'failed' || value.job?.status === 'interrupted') setError(value.job.error || '任务已中断，可重新发起。');
    })
      .catch(err => { if (active) setError(message(err)); }).finally(() => { if (active) setBusy(''); });
    return () => { active = false; };
  }, [sourceId, accept]);

  useEffect(() => {
    if (source && source.id === sourceId) rememberProgress(source, step, dirty);
  }, [source, sourceId, step, dirty]);

  useEffect(() => {
    if (!running || !sourceId) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getModelingSource(sourceId).then(value => {
        if (!active) return;
        accept(value);
        if (value.job?.status === 'succeeded' && value.job.kind === 'generate') { setStep(1); setError(''); }
        if (value.job?.status === 'failed' || value.job?.status === 'interrupted') setError(value.job.error || '任务已中断，可重新发起。');
      }).catch(err => { if (active) setError(message(err)); });
    }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [running, sourceId, accept]);

  useEffect(() => {
    if (!syncing || !sourceId) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getModelingSource(sourceId).then(value => { if (active) { accept(value); setError(''); } }).catch(() => { if (active) setError('同步状态暂时无法读取，已有写入不会回滚。请刷新核实结果。'); });
    }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [syncing, sourceId, accept]);

  useEffect(() => {
    if (!repairing || !sourceId) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getModelingSource(sourceId).then(value => { if (active) accept(value); }).catch(err => { if (active) setError(message(err)); });
    }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [repairing, sourceId, accept]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const edit = (fn: (next: ModelingSource) => void) => {
    if (!source || candidateLocked) return;
    const next = structuredClone(source); fn(next);
    // New business intent invalidates previous human approvals, as well as reports.
    if (next.draft && (next.context !== source.context || JSON.stringify(next.questions) !== JSON.stringify(source.questions))) {
      next.draft.classes.forEach(item => { item.accepted = false; });
      next.draft.mappings.forEach(item => { item.accepted = false; });
      next.draft.relationships.forEach(item => { item.accepted = false; });
      next.draft.semantics.definitions.forEach(item => { item.confirmed = false; });
      next.draft.semantics.context = next.context; next.draft.semantics.questions = structuredClone(next.questions);
    }
    if (source.draft && next.draft) invalidateSemanticChanges(source.draft, next.draft);
    setSource(next); setDirty(true); setWarningAck(false); setPublishConfirmed(false);
  };
  const save = async () => {
    if (!source || candidateLocked) return;
    setBusy('保存候选修订'); setError('');
    try { accept(await saveModelingSource(source)); } catch (err) { setError(message(err)); } finally { setBusy(''); }
  };
  const operate = async (operation: 'generate' | 'review' | 'validate' | 'publish' | 'sync' | 'sync-check' | 'data-repair' | 'data-repair-confirm', extra: Record<string, unknown> = {}) => {
    if (!source || locked) return;
    setPublishError('');
    setBusy(({ generate: '生成候选模型', review: '语义审查', validate: '校验并准备发布方案', publish: '发布原生模型', sync: '提交数据同步', 'sync-check': '检查本次数据', 'data-repair':'AI 分析数据', 'data-repair-confirm':'确认修复并重新检查' })[operation]); setError('');
    try {
      const saved = dirty ? await saveModelingSource(source) : source;
      if (dirty) accept(saved);
      const value = await runModelingOperation(saved, operation, operation === 'publish' ? { configHash: saved.plan?.configHash, acknowledgeWarnings: warningAck } : operation === 'sync' ? { background: true, ...extra } : extra);
      accept(value);
      if (operation === 'data-repair-confirm') accept(await runModelingOperation(value, 'sync-check'));
      if (operation === 'publish') setTypes(await listObjectTypes());
      if (operation === 'validate') setStep(2);
      if (operation === 'publish') setStep(3);
      if (operation === 'sync' || operation === 'sync-check') setStep(4);
      return true;
    } catch (err) {
      if (operation === 'sync') {
        try { accept({ ...await getModelingSource(source.id), syncCheck: null }); } catch { setSource(current => current ? { ...current, syncCheck: null } : current); }
        setStep(4); setError(`同步请求或回读失败，请先刷新核实结果；已有写入不会回滚。${message(err)}`);
      } else if (operation === 'publish') setPublishError(message(err));
      else setError(message(err));
      return false;
    } finally { setBusy(''); }
  };
  const selectSource = (id: string) => {
    const go = () => { if (!id) { clearProgress(); setResume(null); } setDirty(false); setError(''); setParams(id ? { source: id } : {}); };
    if (dirty) Modal.confirm({ title: '放弃未保存的修改？', content: '切换来源后，当前未保存的候选修改将丢失。', okText: '放弃并切换', cancelText: '继续编辑', onOk: go }); else go();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) { setError('请选择 .xlsx 文件；公式请先转换为值。'); return; }
    setBusy('解析 Excel'); setError('');
    try { const value = await uploadModelingSource(file); accept(value); setParams({ source: value.id }); setStep(0); }
    catch (err) { setError(message(err)); } finally { setBusy(''); if (uploadInput.current) uploadInput.current.value = ''; }
  };
  const parentLabel = (classId: unknown) => {
    const parentId = source?.draft?.classes.find(cls => cls.id === classId)?.parentClassId;
    return parentId ? source?.draft?.classes.find(cls => cls.id === parentId)?.name ?? parentId : '独立类';
  };
  const ready = Boolean(source?.validation?.scope === 'ontology' && source.validation.canPublish && !dirty);
  const publishBlockers = source?.validation?.issues.filter(issue => issue.severity === 'error') ?? [];
  const published = !dirty && source?.publication?.configHash === source?.plan?.configHash && (source?.publication?.status === 'succeeded' || source?.publication?.status === 'completed');
  const completion = source?.draft && !publicationStarted ? <CompletionReview key={source.id} source={source} disabled={locked}
    onPrepare={async () => { const saved = dirty ? await saveModelingSource(source) : await getModelingSource(source.id); accept(saved); return saved; }}
    onEditClass={id => { setFocusClassId(`fd-class-${id}`); setStep(1); }}
    onApplied={value => { accept(value); setError(''); setCompletionFeedback('批量审批已完成。新建、复用或增加属性将在发布前选择。'); setStep(2); }} /> : null;

  return <div className="fd-page">
    <PageHeader title="逆向发现本体" desc="从 Excel 资料发现本体候选，与已有企业本体匹配确认后形成变更草稿，经确认发布。" actions={<>
      {source && <Button icon={<RefreshCw size={15} />} disabled={locked} onClick={() => {
        const refresh = async () => { setBusy('刷新'); try { accept(await getModelingSource(source.id)); setError(''); setPublishError(''); } catch (err) { setError(message(err)); } finally { setBusy(''); } };
        if (dirty) Modal.confirm({ title: '重新读取来源？', content: '未保存的修改将丢失。', okText: '重新读取', onOk: refresh }); else void refresh();
      }}>刷新</Button>}
      {source && <Button theme="solid" icon={<Save size={15} />} disabled={!dirty || locked || candidateLocked} title={!dirty ? '当前没有未保存的修改；修改候选或确认定义后即可保存' : undefined} onClick={() => void save()}>{dirty ? '保存修改' : '已保存'}</Button>}
    </>} />
    <div className="fd-source-bar"><FileSpreadsheet size={18} /><label><span>历史导入</span><select aria-label="选择历史导入" value={sourceId ?? ''} disabled={locked || sources.length === 0} onChange={e => selectSource(e.target.value)}><option value="">{sources.length === 0 ? '暂无导入记录' : '选择历史导入记录'}</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{source && <Tag>修订 {source.revision}{dirty ? ' · 未保存' : ''}</Tag>}
      <input ref={uploadInput} className="fd-file-input" type="file" aria-label="上传 Excel 文件" accept=".xlsx" disabled={locked} onChange={e => {
        const file = e.target.files?.[0];
        if (dirty && file) Modal.confirm({ title: '导入新的数据来源？', content: '当前未保存的修改将丢失。', okText: '继续导入', onOk: () => upload(file) }); else void upload(file);
      }} /><Button icon={<Upload size={15} />} disabled={locked} onClick={() => uploadInput.current?.click()}>导入 Excel</Button></div>
    <nav className="fd-steps" aria-label="逆向发现本体流程">{steps.map((label, i) => <button key={label} type="button" aria-current={step === i ? 'step' : undefined} disabled={!source || (i > 0 && !source.draft)} onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button>)}</nav>
    {error && step !== 4 && source?.job?.kind !== 'generate' && <Banner type="danger" description={error} closeIcon={null} />}
    {(busy || running) && step !== 4 && !generating && busy !== '发布原生模型' && <div role="status" className="fd-status"><Spin size="small" /><span>{busy || (syncing ? '正在同步业务数据，可在第五步查看结果。' : '正在处理候选，请稍候。')}</span></div>}
    {step !== 0 && step !== 4 && source?.job?.kind === 'generate' && (source.job.status !== 'succeeded' || error || generating) && <GenerationProgress job={source.job} submitting={busy === '生成候选模型'} error={error} sheetCount={source.profile.sheets.length} hasDraft={Boolean(source.draft)} onRetry={confirmGenerate} />}
    {dirty && (source?.validation || source?.review || source?.plan) && <Banner type="warning" description="候选内容已修改，已有校验结果已过期。点击校验并预览会先保存修改，再重新校验。" closeIcon={null} />}
    {!source && !busy && <section className="fd-card"><EmptyState
      title="暂无数据来源"
      desc="支持 .xlsx 多工作表，公式请先转换为值。"
      actions={<Button theme="solid" icon={<Upload size={15} />} onClick={() => uploadInput.current?.click()}>选择 Excel 文件</Button>}
    /></section>}
    {source && <fieldset className="fd-fieldset" disabled={locked}>
      {step === 0 && <>
        <section className="fd-card"><div className="fd-section-head"><div><h2>数据画像</h2><p>{source.name} · {source.profile.sheets.length} 张工作表 · {source.profile.rowCount.toLocaleString()} 条有效记录</p></div><Tag color="blue">来源快照</Tag></div>
          {source.profile.sheets.map(sheet => <details className="fd-sheet" key={sheet.name} open={source.profile.sheets.length === 1}><summary>{sheet.name}<span>{sheet.rows.toLocaleString()} 条记录 · {sheet.columns.length} 列</span></summary><div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>字段</th><th>识别类型</th><th>空值</th><th>不同值</th><th>样例</th></tr></thead><tbody>{sheet.columns.map(column => <tr key={column.name}><td>{column.name}</td><td>{{ text: '文本', number: '数值', date: '日期' }[column.dataType] ?? column.dataType}</td><td>{sheet.rows - column.nonNull}</td><td>{column.uniqueCount}{column.unique && <Tag size="small">样本唯一</Tag>}</td><td>{column.samples.join(' / ')}</td></tr>)}</tbody></table></div></details>)}
          <p className="mp-onto-muted">样本唯一仅是候选身份的证据，不代表长期业务唯一性。</p>
        </section>
        <section className="fd-card"><h2>业务背景</h2><p className="mp-onto-muted">先说明业务场景及核心概念，再从资料中发现补充候选。已有本体作为对齐依据，资料不直接写入正式本体。</p>
          <label>业务背景<textarea disabled={candidateLocked} rows={4} maxLength={2000} placeholder="例如：分析工单物料需求与可用库存；库存按工厂、物料、批次区分，不同单位不能直接相加。" value={source.context} onChange={e => edit(next => { next.context = e.target.value; })} /></label>
          <div className="fd-actions"><Button theme="solid" loading={generating} icon={<Sparkles size={15} />} disabled={locked || candidateLocked || !source.context.trim()} onClick={confirmGenerate}>{generating ? '正在生成建议…' : source.draft ? '重新发现候选' : '发现本体候选'}</Button></div>
          <GenerationProgress job={source.job} submitting={busy === '生成候选模型'} error={error} sheetCount={source.profile.sheets.length} hasDraft={Boolean(source.draft)} onRetry={confirmGenerate} />
        </section>
      </>}
      {step === 1 && source.draft && <>
        <section className="fd-card"><div className="fd-section-head"><div><h2>完整处理方案</h2><p className="mp-onto-muted">有依据的统一补全；不完整的类可选择本次不发布，其子类、关系和实例一起暂缓。确认一次后自动重新校验。</p></div>{completion}</div></section>
        <ReviewWorkspace draft={source.draft} profile={source.profile} types={types} catalogStatus={catalogStatus} resolutions={source.resolutions} disabled={locked || candidateLocked} focusClassId={focusClassId} identityLocked={publicationStarted} onChange={draft => edit(next => { next.draft = draft; })} onResolve={(classId, resolution) => edit(next => { next.resolutions[classId] = resolution;
          if (next.draft) {
            const cls = next.draft.classes.find(c => c.id === classId);
            if (cls) cls.accepted = false;
            next.draft.relationships.filter(r => r.source === classId || r.target === classId).forEach(r => { r.accepted = false; });
          } })} onRename={(draft, resolutions) => edit(next => { next.draft = draft; next.resolutions = resolutions; })} />
        <div className="fd-review-footer"><span>{dirty ? '有未保存的修改，校验时将先保存。' : '当前修改已保存。'}确认表示已核对业务规则与依据。</span><div className="fd-inline">{publicationStarted ? <Button theme="solid" icon={<ArrowRight size={15} />} onClick={() => setStep(3)}>查看发布结果</Button> : <Button theme="solid" icon={<ArrowRight size={15} />} onClick={() => void operate('validate')}>校验并预览</Button>}</div></div>

      </>}
      {step === 2 && <>
        {completionFeedback && !dirty && <Banner type={source.validation?.canPublish ? 'success' : 'warning'} description={completionFeedback} closeIcon={null} />}
        {completion && <section className="fd-card"><div className="fd-section-head"><div><h3>统一处理剩余问题</h3><p className="mp-onto-muted">集中核对补全与暂缓范围，无需逐项往返审核。</p></div>{completion}</div></section>}
        {source.draft && [...source.draft.classes, ...source.draft.relationships].some(item => !included(item)) && <section className="fd-card" aria-label="暂缓候选"><h3>暂缓候选（不进入本次发布）</h3><p>{[...source.draft.classes, ...source.draft.relationships].filter(item => !included(item)).map(item => item.name).join('、')}</p><p className="mp-onto-muted">候选保留在草稿，对应业务问题可能尚未覆盖。可返回审核恢复。</p></section>}
        {source.draft && <CandidateGraph draft={selectedDraft(source.draft)} layoutKey={source.id} />}
        <div className="fd-section-head"><div><h2>本体结构校验与接入预览</h2><p>检查概念、属性、继承和关系定义，再预检平台接入；数据质量独立限制可选同步。</p></div><Button onClick={() => void operate('validate')}>重新校验</Button></div>
        {(!source.validation || source.validation.scope !== 'ontology' || dirty) ? <Banner type="info" description="请保存当前候选并重新执行本体校验。旧版数据报告不能作为本体发布许可。" closeIcon={null} /> : <>
          <div className="fd-metrics"><section className="fd-card"><small>阻断问题</small><strong>{source.validation.errors}</strong></section><section className="fd-card"><small>警告</small><strong>{source.validation.warnings}</strong></section><section className="fd-card"><small>对象类型</small><strong>{source.draft?.classes.filter(included).length ?? 0}</strong></section><section className="fd-card"><small>关系定义</small><strong>{source.draft?.relationships.filter(included).length ?? 0}</strong></section></div>
          <section className="fd-card"><h3>校验结果</h3><p className="mp-onto-muted">下方仅校验本次发布范围。阻断项可在下方直接定位处理。</p>{!source.validation.issues.length && <p><Check size={15} /> 当前校验没有发现问题。</p>}<ul className="fd-issues">{source.validation.issues.map((issue, i) => <li key={i}><Tag color={issue.severity === 'error' ? 'red' : 'orange'}>{issue.severity === 'error' ? '阻断' : '警告'}</Tag><code>{issue.item}</code><span>{issue.message}</span>{source.draft && (() => {
            const owner = semanticOwner(source.draft, issue.item)
              ?? (source.draft.classes.some(c => c.id === issue.item) ? { kind: 'classes' as const, id: issue.item }
                : source.draft.relationships.some(r => r.id === issue.item) ? { kind: 'relationships' as const, id: issue.item } : undefined);
            return owner && <Button size="small" disabled={locked} onClick={() => setInlineSelection(owner)}>查看并处理</Button>;
          })()}</li>)}</ul></section>
          <section className="fd-card"><h3>本体结构预览</h3><p className="mp-onto-muted">业务身份是待核实的建模规则；当前文件是否具备相应值，请查看独立的数据接入检查。</p><div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>业务概念</th><th>父类</th><th>属性数</th><th>业务身份定义</th></tr></thead><tbody>{source.draft?.classes.filter(included).map(cls => <tr key={cls.id}><td>{cls.name}</td><td>{parentLabel(cls.id)}</td><td>{cls.properties.length}</td><td>{cls.identity.length ? cls.identity.map(id => cls.properties.find(p => p.id === id)?.name ?? id).join(' + ') : '尚未确定（平台使用来源记录技术身份）'}</td></tr>)}</tbody></table></div></section>
          <details><summary>可选：数据接入检查</summary><DataReadiness report={source.validation.dataValidation} draft={source.draft} /></details>
          {source.validation.dataValidation?.canSync && source.preview && <details><summary>可选：实例样本</summary><section className="fd-card"><h3>对象与关系预览</h3><p className="mp-onto-muted">最多展示 {source.preview.limit} 条样本；总对象 {source.preview.totalNodes}，总关系 {source.preview.totalEdges}。来源行用于追溯。</p><div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>对象类型</th><th>父类</th><th>标签</th><th>身份</th><th>来源</th><th>来源行</th></tr></thead><tbody>{source.preview.nodes.map((node, i) => <tr key={i}><td>{readable(node.objectType ?? node.kind ?? '')}</td><td>{parentLabel(node.objectType)}</td><td>{readable(node.label ?? '')}</td><td>{readable(node.identity ?? '')}</td><td>{readable(node.sheet ?? '')}</td><td>{readable(node.row ?? '')}</td></tr>)}</tbody></table></div><details><summary>关系样本（{source.preview.edges.length} 条）</summary><Findings value={source.preview.edges} /></details></section></details>}
          {!ready && <section className="fd-card" aria-label="发布阻断原因">
            <h3>请先处理候选结构问题</h3>
            {dirty ? <p>候选已修改，请重新点击「校验并预览」，系统会先保存修改。</p> : source.validation.scope !== 'ontology' ? <p>当前校验报告已过期，请重新执行本体校验。</p> : publishBlockers.length ? <>
              <p>候选结构有 {source.validation.errors} 项问题需要处理。正式本体中的重复标识将在发布前检查。</p>
              <ul className="fd-issues">{publishBlockers.map((issue, i) => {
                const cls = source.draft?.classes.find(item => item.id === issue.item);
                const relation = source.draft?.relationships.find(item => item.id === issue.item);
                const label = cls?.name ?? relation?.name ?? issue.item;
                const target = cls ? `fd-class-${cls.id}` : relation ? `fd-relation-${relation.id}` : null;
                return <li key={i}><strong>{label}</strong><span>{issue.message}</span>{target && <Button size="small" onClick={() => setInlineSelection({ kind: cls ? 'classes' : 'relationships', id: cls?.id ?? relation!.id })}>处理{label}</Button>}</li>;
              })}</ul>
            </> : <p>候选尚未通过结构校验，请重新校验。</p>}
            <Button onClick={() => void operate('validate')}>重新校验本体</Button>
          </section>}
          <div className="fd-actions"><Button onClick={() => setStep(1)}>返回修改模型</Button><Button theme="solid" disabled={!ready} onClick={() => setStep(3)}>查看发布方案</Button></div>
        </>}
      </>}
      {step === 3 && <>
        <section className="fd-card"><h2>本体变更草稿与发布确认</h2><p className="mp-onto-muted">核对复用、新增、扩展属性及关系后确认发布。当前草稿尚未生效；发布按对象、关系分步执行，失败可重试。</p>
          <p>这里只展示已审批候选。点击发布本体，在窗口中选择新建、复用或增加属性，再校验并确认。</p>
          <PublicationReview source={source} types={types} disabled={locked || Boolean(published)}
            onPrepare={async () => {
              const saved = dirty ? await saveModelingSource(source) : await getModelingSource(source.id); accept(saved);
              try { const current = await listObjectTypes(); setTypes(current); setCatalogStatus(''); }
              catch (err) { setTypes([]); const detail = `平台对象类型读取失败：${message(err)}`; setCatalogStatus(detail); throw new Error(detail); }
              return saved;
            }}
            onChanged={accept} onPublished={value => { accept(value); setPublishError(''); void listObjectTypes().then(setTypes).catch(err => setError(message(err))); }} />
          <div aria-label="发布操作反馈" aria-live="polite" aria-busy={busy === '发布原生模型'}>
            {busy === '发布原生模型' && <div role="status" className="fd-status"><Spin size="small" /><span>正在发布原生模型，请稍候。完成结果将在这里显示。</span></div>}
            {publishError && <Banner type="danger" description={publishError} closeIcon={null} />}
            {published && <div role="status"><Banner type="success" description="本次所选本体已发布" closeIcon={null} /><p className="mp-onto-muted">已接入平台原生本体，可查看下方类型。暂缓候选可后续完善；数据同步为可选操作。</p><Link to="/ontology/model/object-types">进入平台本体模型</Link></div>}
          </div>
          {source.publication && <div className="fd-result" role="status"><h3>发布结果 · {source.publication.status}</h3>{source.publication.error && <Banner type="danger" description={source.publication.error} closeIcon={null} />}<p>已完成 {source.publication.completed.length} 项。</p>{source.plan?.types.filter(type => source.publication?.completed.includes(type.rid)).map(type => <p key={type.classId}><Link to={`/ontology/model/object-types/${encodeURIComponent(type.rid)}`}>{type.name} · 查看原生类型</Link></p>)}<details><summary>逐项发布记录</summary><Findings value={source.publication.results} /></details></div>}
        </section>
        {source.publication && <PublicationAcceptance key={`${source.id}-${source.publication.configHash}`} sourceId={source.id} initial={source.publication.acceptance} />}
        {published && <div className="fd-actions"><Link to="/ontology/model/object-types">稍后同步</Link><Button theme="solid" onClick={() => setStep(4)}>同步本次数据 <ArrowRight size={14} /></Button></div>}
      </>}
      {step === 4 && <SyncWorkspace source={source} dirty={dirty} busy={Boolean(busy || running || repairing)} error={error} published={Boolean(published)} onCheck={() => void operate('sync-check')} onSync={options => void operate('sync', options)} onAnalyze={() => void operate('data-repair')} onConfirmRepairs={keys => void operate('data-repair-confirm', {proposalId:source.dataRepair?.proposal?.id, keys})} onExport={() => { void exportModelingQuarantine(source).catch(err => setError(message(err))); }} onLocate={id => { setFocusClassId(id); setStep(1); }} onBack={() => setStep(3)} onRefresh={() => { void getModelingSource(source.id).then(accept).catch(err => setError(message(err))); }} />}
    </fieldset>}
    <SheetDetail title="审核并处理校验问题" open={Boolean(inlineSelection)} onClose={() => { if (!locked) setInlineSelection(undefined); }} width={760} className="fd-review-sheet" footer={<div className="fd-review-sheet-footer"><span>修改后重新校验，保留当前步骤。</span><Button disabled={locked} onClick={async () => { if (await operate('validate')) setInlineSelection(undefined); }}>保存并重新校验</Button></div>}>
      {source?.draft && inlineSelection && <fieldset className="fd-fieldset fd-page" disabled={locked}><DraftEditorDetails draft={source.draft} profile={source.profile} types={types} resolutions={source.resolutions} selection={inlineSelection} identityLocked={Boolean(source.publication?.completed.length)} onOpenClass={id => setInlineSelection({ kind: 'classes', id })} onChange={draft => edit(next => { next.draft = draft; })} onRename={(draft, resolutions) => edit(next => { next.draft = draft; next.resolutions = resolutions; })} onResolve={(id, resolution) => edit(next => { next.resolutions[id] = resolution; })} /></fieldset>}
    </SheetDetail>
  </div>;
}
