import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Banner, Button, Checkbox, Modal, Spin, Tag } from '@douyinfe/semi-ui';
import { ArrowRight, Check, FileSpreadsheet, RefreshCw, Save, Sparkles, Upload } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { listObjectTypes, type KernelObjectType } from '@/api/ont/kernel';
import { exportModelingQuarantine, getModelingSource, listModelingSources, runModelingOperation, saveModelingSource, uploadModelingSource, type ModelingSource } from '@/api/ont/modeling';
import { uniqueId } from './DraftEditor';
import DataReadiness from './DataReadiness';
import PublicationAcceptance from './PublicationAcceptance';
import CandidateGraph from './CandidateGraph';
import GenerationProgress from './GenerationProgress';
import GenerationQuality from './GenerationQuality';
import ReviewWorkspace from './ReviewWorkspace';
import SyncWorkspace from './SyncWorkspace';
import { included, selectedDraft } from './review';
import './from-data.css';

const steps = ['数据与建模范围', '候选本体审核', '本体校验与接入预览', '本体发布与验收', '数据同步（可选）'];
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
  const sourceId = params.get('source');
  const [sources, setSources] = useState<ModelingSource[]>([]);
  const [source, setSource] = useState<ModelingSource | null>(null);
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [publishError, setPublishError] = useState('');
  const [warningAck, setWarningAck] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [focusClassId, setFocusClassId] = useState<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step !== 1 || !focusClassId) return;
    const element = document.getElementById(focusClassId);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [step, focusClassId]);
  const running = source?.job?.status === 'running';
  const syncing = source?.sync?.status === 'running';
  const repairing = source?.dataRepair?.status === 'running';
  const locked = Boolean(busy || running || syncing || repairing);
  const generating = busy === '生成候选模型' || (running && source?.job?.kind === 'generate');
  const confirmGenerate = () => {
    if (locked) return;
    if (source?.draft) Modal.confirm({ title: '重新生成候选模型？', content: '相同数据、业务说明、问题和平台定义将沿用同一生成基线，并替换当前人工修改及审核状态。输入变化时重新生成并执行全量预检；失败时保留原草稿。已有发布结果请另建来源候选。', okText: '重新生成', onOk: () => operate('generate') });
    else void operate('generate');
  };

  useEffect(() => {
    let active = true;
    void Promise.allSettled([listModelingSources(), listObjectTypes()]).then(([listed, native]) => {
      if (!active) return;
      if (listed.status === 'fulfilled') setSources(listed.value); else setError(message(listed.reason));
      if (native.status === 'fulfilled') setTypes(native.value); else setError(`平台对象类型读取失败：${message(native.reason)}`);
    });
    return () => { active = false; };
  }, []);

  const accept = useCallback((value: ModelingSource) => {
    setSource(value); setDirty(false); setWarningAck(false); setPublishConfirmed(false);
    setSources(items => [value, ...items.filter(item => item.id !== value.id)]);
  }, []);

  useEffect(() => {
    if (!sourceId) { setSource(null); return; }
    let active = true; setBusy('读取来源'); setError(''); setPublishError('');
    void getModelingSource(sourceId).then(value => { if (active) { accept(value); setStep(value.sync || params.get('step') === 'sync' ? 4 : value.publication?.status === 'succeeded' ? 3 : value.draft ? 1 : 0); if (value.job?.status === 'failed' || value.job?.status === 'interrupted') setError(value.job.error || '任务已中断，可重新发起。'); } })
      .catch(err => { if (active) setError(message(err)); }).finally(() => { if (active) setBusy(''); });
    return () => { active = false; };
  }, [sourceId, accept]);

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
    if (!source) return;
    const next = structuredClone(source); fn(next);
    // New business intent invalidates previous human approvals, as well as reports.
    if (next.draft && (next.context !== source.context || JSON.stringify(next.questions) !== JSON.stringify(source.questions))) {
      next.draft.classes.forEach(item => { item.accepted = false; });
      next.draft.mappings.forEach(item => { item.accepted = false; });
      next.draft.relationships.forEach(item => { item.accepted = false; });
      next.draft.semantics.definitions.forEach(item => { item.confirmed = false; });
      next.draft.semantics.context = next.context; next.draft.semantics.questions = structuredClone(next.questions);
    }
    setSource(next); setDirty(true); setWarningAck(false); setPublishConfirmed(false);
  };
  const save = async () => {
    if (!source) return;
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
    } catch (err) {
      if (operation === 'sync') {
        try { accept({ ...await getModelingSource(source.id), syncCheck: null }); } catch { setSource(current => current ? { ...current, syncCheck: null } : current); }
        setStep(4); setError(`同步请求或回读失败，请先刷新核实结果；已有写入不会回滚。${message(err)}`);
      } else if (operation === 'publish') setPublishError(message(err));
      else setError(message(err));
    } finally { setBusy(''); }
  };
  const selectSource = (id: string) => {
    const go = () => { setDirty(false); setError(''); setParams(id ? { source: id } : {}); };
    if (dirty) Modal.confirm({ title: '放弃未保存的修改？', content: '切换来源后，当前未保存的候选修改将丢失。', okText: '放弃并切换', cancelText: '继续编辑', onOk: go }); else go();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) { setError('请选择 .xlsx 文件；公式请先转换为值。'); return; }
    setBusy('解析 Excel'); setError('');
    try { const value = await uploadModelingSource(file); accept(value); setParams({ source: value.id }); setStep(0); }
    catch (err) { setError(message(err)); } finally { setBusy(''); if (uploadInput.current) uploadInput.current.value = ''; }
  };
  const sampleName = source?.name === 'manufacturing.xlsx' ? 'manufacturing' : source?.name === 'sales.xlsx' ? 'sales' : source?.name === 'equipment.xlsx' ? 'equipment' : null;
  const applySample = async () => {
    if (!sampleName) return;
    try {
      const response = await fetch(`/modeling-samples/${sampleName}.json`);
      if (!response.ok) throw new Error('示例说明读取失败');
      const sample = await response.json();
      edit(next => { next.context = sample.context; next.questions = sample.questions; });
    } catch (err) { setError(message(err)); }
  };
  const parentLabel = (classId: unknown) => {
    const parentId = source?.draft?.classes.find(cls => cls.id === classId)?.parentClassId;
    return parentId ? source?.draft?.classes.find(cls => cls.id === parentId)?.name ?? parentId : '独立类';
  };
  const ready = Boolean(source?.validation?.scope === 'ontology' && source.validation.canPublish && source.plan && !dirty);
  const publishBlockers = source?.validation?.issues.filter(issue => issue.severity === 'error') ?? [];
  const published = !dirty && source?.publication?.configHash === source?.plan?.configHash && (source?.publication?.status === 'succeeded' || source?.publication?.status === 'completed');

  return <div className="fd-page">
    <PageHeader title="从数据建模" desc="从业务数据生成候选本体，审核后发布。" actions={<>
      {source && <Button icon={<RefreshCw size={15} />} disabled={locked} onClick={() => {
        const refresh = async () => { setBusy('刷新'); try { accept(await getModelingSource(source.id)); setError(''); setPublishError(''); } catch (err) { setError(message(err)); } finally { setBusy(''); } };
        if (dirty) Modal.confirm({ title: '重新读取来源？', content: '未保存的修改将丢失。', okText: '重新读取', onOk: refresh }); else void refresh();
      }}>刷新</Button>}
      {source && <Button theme="solid" icon={<Save size={15} />} disabled={!dirty || locked} title={!dirty ? '当前没有未保存的修改；修改候选或确认定义后即可保存' : undefined} onClick={() => void save()}>{dirty ? '保存修改' : '已保存'}</Button>}
    </>} />
    <div className="fd-source-bar"><FileSpreadsheet size={18} /><label><span>历史导入</span><select aria-label="选择历史导入" value={sourceId ?? ''} disabled={locked || sources.length === 0} onChange={e => selectSource(e.target.value)}><option value="">{sources.length === 0 ? '暂无导入记录' : '选择历史导入记录'}</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{source && <Tag>修订 {source.revision}{dirty ? ' · 未保存' : ''}</Tag>}
      <input ref={uploadInput} className="fd-file-input" type="file" aria-label="上传 Excel 文件" accept=".xlsx" disabled={locked} onChange={e => {
        const file = e.target.files?.[0];
        if (dirty && file) Modal.confirm({ title: '导入新的数据来源？', content: '当前未保存的修改将丢失。', okText: '继续导入', onOk: () => upload(file) }); else void upload(file);
      }} /><Button icon={<Upload size={15} />} disabled={locked} onClick={() => uploadInput.current?.click()}>导入 Excel</Button></div>
    <nav className="fd-steps" aria-label="从数据建模流程">{steps.map((label, i) => <button key={label} type="button" aria-current={step === i ? 'step' : undefined} disabled={!source || (i > 0 && !source.draft)} onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button>)}</nav>
    {error && step !== 4 && source?.job?.kind !== 'generate' && <Banner type="danger" description={error} closeIcon={null} />}
    {(busy || running) && step !== 4 && !generating && busy !== '发布原生模型' && <div role="status" className="fd-status"><Spin size="small" /><span>{busy || (syncing ? '正在同步业务数据，可在第五步查看结果。' : '正在审查业务语义，审查不会修改候选模型。')}</span></div>}
    {step !== 0 && step !== 4 && source?.job?.kind === 'generate' && (source.job.status !== 'succeeded' || error || generating) && <GenerationProgress job={source.job} submitting={busy === '生成候选模型'} error={error} sheetCount={source.profile.sheets.length} hasDraft={Boolean(source.draft)} onRetry={confirmGenerate} />}
    {dirty && (source?.validation || source?.review || source?.plan) && <Banner type="warning" description="候选内容已修改，已有审查与校验结果已过期。点击校验并预览会先保存修改，再重新校验；AI 审查可跳过。" closeIcon={null} />}
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
        <section className="fd-card"><h2>业务背景与问题</h2><p className="mp-onto-muted">告诉系统这些数据代表什么，以及你希望通过模型回答的问题。缺少数据的问题也应保留。</p>
          {sampleName && <div className="fd-actions"><Button onClick={() => {
            if (source.context || source.questions.length) Modal.confirm({ title: '填入示例业务问题？', content: '将替换当前业务背景和问题，候选定义仍需重新生成或审核。', okText: '填入示例', onOk: applySample }); else void applySample();
          }}>填入该示例的业务问题</Button></div>}
          <label>业务背景<textarea rows={4} maxLength={2000} placeholder="例如：分析工单物料需求与可用库存；库存按工厂、物料、批次区分，不同单位不能直接相加。" value={source.context} onChange={e => edit(next => { next.context = e.target.value; })} /></label>
          {source.questions.map((question, i) => <div className="fd-question" key={question.id}><label>业务问题 {i + 1}<input maxLength={500} value={question.question} placeholder="希望模型回答什么？" onChange={e => edit(next => { next.questions[i].question = e.target.value; })} /></label><label>预期答案与判断口径<textarea rows={2} maxLength={1000} value={question.expected} onChange={e => edit(next => { next.questions[i].expected = e.target.value; })} /></label><Button aria-label={`删除业务问题 ${i + 1}`} theme="borderless" onClick={() => edit(next => { next.questions.splice(i, 1); })}>删除</Button></div>)}
          <div className="fd-actions"><Button disabled={locked || source.questions.length >= 20} onClick={() => edit(next => { next.questions.push({ id: uniqueId('question', next.questions.map(q => q.id)), question: '', expected: '' }); })}>添加业务问题</Button><Button theme="solid" loading={generating} icon={<Sparkles size={15} />} disabled={locked || !source.context.trim() || source.questions.some(q => !q.question.trim())} onClick={confirmGenerate}>{generating ? '正在生成建议…' : source.draft ? '重新生成建议' : '生成模型建议'}</Button></div>
          <GenerationProgress job={source.job} submitting={busy === '生成候选模型'} error={error} sheetCount={source.profile.sheets.length} hasDraft={Boolean(source.draft)} onRetry={confirmGenerate} />
        </section>
      </>}
      {step === 1 && source.draft && <>
        <GenerationQuality source={source} dirty={dirty} onLocate={target => setFocusClassId(target)} />
        <ReviewWorkspace draft={source.draft} profile={source.profile} types={types} resolutions={source.resolutions} disabled={locked} focusClassId={focusClassId} identityLocked={Boolean(source.publication?.completed.length)} onChange={draft => edit(next => { next.draft = draft; })} onResolve={(classId, resolution) => edit(next => { next.resolutions[classId] = resolution; })} onRename={(draft, resolutions) => edit(next => { next.draft = draft; next.resolutions = resolutions; })} />
        <div className="fd-review-footer"><span>{dirty ? '有未保存的修改，校验时将先保存。' : '当前修改已保存。'}确认表示已核对业务规则与依据。</span><div className="fd-inline"><Button theme="borderless" icon={<Sparkles size={15} />} onClick={() => void operate('review')}>AI 语义审查（可选）</Button>{source.publication?.completed.length ? <Button theme="solid" icon={<ArrowRight size={15} />} onClick={() => setStep(3)}>查看发布结果</Button> : <Button theme="solid" icon={<ArrowRight size={15} />} onClick={() => void operate('validate')}>校验并预览</Button>}</div></div>
        {source.review && !dirty && <section className="fd-card"><h2>AI 语义审查</h2><p className="mp-onto-muted">审查是辅助建议，不能替代业务确认与数据校验。</p><Findings value={source.review} /></section>}
      </>}
      {step === 2 && <>
        {source.draft && [...source.draft.classes, ...source.draft.relationships].some(item => !included(item)) && <section className="fd-card" aria-label="暂缓候选"><h3>暂缓候选（不进入本次发布）</h3><p>{[...source.draft.classes, ...source.draft.relationships].filter(item => !included(item)).map(item => item.name).join('、')}</p><p className="mp-onto-muted">候选保留在草稿，对应业务问题可能尚未覆盖。可返回审核恢复。</p></section>}
        {source.draft && <CandidateGraph draft={selectedDraft(source.draft)} />}
        <div className="fd-section-head"><div><h2>本体结构校验与接入预览</h2><p>检查概念、属性、继承和关系定义，再预检平台接入；数据质量独立限制可选同步。</p></div><Button onClick={() => void operate('validate')}>重新校验</Button></div>
        {(!source.validation || source.validation.scope !== 'ontology' || dirty) ? <Banner type="info" description="请保存当前候选并重新执行本体校验。旧版数据报告不能作为本体发布许可。" closeIcon={null} /> : <>
          <div className="fd-metrics"><section className="fd-card"><small>阻断问题</small><strong>{source.validation.errors}</strong></section><section className="fd-card"><small>警告</small><strong>{source.validation.warnings}</strong></section><section className="fd-card"><small>对象类型</small><strong>{source.draft?.classes.filter(included).length ?? 0}</strong></section><section className="fd-card"><small>关系定义</small><strong>{source.draft?.relationships.filter(included).length ?? 0}</strong></section></div>
          <section className="fd-card"><h3>校验结果</h3><p className="mp-onto-muted">下方仅校验本次发布范围。阻断项可在下方直接定位处理。</p>{!source.validation.issues.length && <p><Check size={15} /> 当前校验没有发现问题。</p>}<ul className="fd-issues">{source.validation.issues.map((issue, i) => <li key={i}><Tag color={issue.severity === 'error' ? 'red' : 'orange'}>{issue.severity === 'error' ? '阻断' : '警告'}</Tag><code>{issue.item}</code><span>{issue.message}</span></li>)}</ul></section>
          <section className="fd-card"><h3>本体结构预览</h3><p className="mp-onto-muted">业务身份是待核实的建模规则；当前文件是否具备相应值，请查看独立的数据接入检查。</p><div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>业务概念</th><th>父类</th><th>属性数</th><th>业务身份定义</th></tr></thead><tbody>{source.draft?.classes.filter(included).map(cls => <tr key={cls.id}><td>{cls.name}</td><td>{parentLabel(cls.id)}</td><td>{cls.properties.length}</td><td>{cls.identity.length ? cls.identity.map(id => cls.properties.find(p => p.id === id)?.name ?? id).join(' + ') : '尚未确定（平台使用来源记录技术身份）'}</td></tr>)}</tbody></table></div></section>
          <details><summary>可选：数据接入检查</summary><DataReadiness report={source.validation.dataValidation} draft={source.draft} /></details>
          {source.validation.dataValidation?.canSync && source.preview && <details><summary>可选：实例样本</summary><section className="fd-card"><h3>对象与关系预览</h3><p className="mp-onto-muted">最多展示 {source.preview.limit} 条样本；总对象 {source.preview.totalNodes}，总关系 {source.preview.totalEdges}。来源行用于追溯。</p><div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>对象类型</th><th>父类</th><th>标签</th><th>身份</th><th>来源</th><th>来源行</th></tr></thead><tbody>{source.preview.nodes.map((node, i) => <tr key={i}><td>{readable(node.objectType ?? node.kind ?? '')}</td><td>{parentLabel(node.objectType)}</td><td>{readable(node.label ?? '')}</td><td>{readable(node.identity ?? '')}</td><td>{readable(node.sheet ?? '')}</td><td>{readable(node.row ?? '')}</td></tr>)}</tbody></table></div><details><summary>关系样本（{source.preview.edges.length} 条）</summary><Findings value={source.preview.edges} /></details></section></details>}
          {!ready && <section className="fd-card" aria-label="发布阻断原因">
            <h3>暂不能查看发布方案</h3>
            {dirty ? <p>候选已修改，请重新点击「校验并预览」，系统会先保存修改。</p> : source.validation.scope !== 'ontology' ? <p>当前校验报告已过期，请重新执行本体校验。</p> : publishBlockers.length ? <>
              <p>本体校验有 {source.validation.errors} 项阻断。以下问题需要处理；AI 审查不是发布条件，数据接入问题不会阻止本体发布。</p>
              <ul className="fd-issues">{publishBlockers.map((issue, i) => {
                const cls = source.draft?.classes.find(item => item.id === issue.item);
                const relation = source.draft?.relationships.find(item => item.id === issue.item);
                const label = cls?.name ?? relation?.name ?? issue.item;
                const target = cls ? `fd-class-${cls.id}` : relation ? `fd-relation-${relation.id}` : null;
                return <li key={i}><strong>{label}</strong><span>{issue.message}</span>{target && <Button size="small" onClick={() => { setFocusClassId(target); setStep(1); }}>处理{label}</Button>}</li>;
              })}</ul>
            </> : <p>发布方案尚未生成，请重新执行本体校验。</p>}
            <Button onClick={() => void operate('validate')}>重新校验本体</Button>
          </section>}
          <div className="fd-actions"><Button onClick={() => setStep(1)}>返回修改模型</Button><Button theme="solid" disabled={!ready} onClick={() => setStep(3)}>查看发布方案</Button></div>
        </>}
      </>}
      {step === 3 && <>
        <section className="fd-card"><h2>原生本体发布</h2><p className="mp-onto-muted">先发布对象类型，再发布关系。中途失败会保留已完成结果，可按当前方案重试。</p>
          {!source.plan || dirty ? <Banner type="warning" description="发布方案不存在或已经过期，请先重新校验。" closeIcon={null} /> : <>
            <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>候选对象</th><th>操作</th><th>原生类型</th><th>父类型</th></tr></thead><tbody>{source.plan.types.map(type => <tr key={type.classId}><td>{type.name}</td><td>{{ new: '新建', reuse: '复用', extend: '扩展' }[type.mode] ?? type.mode}</td><td><code>{type.rid}</code></td><td>{type.parentClassId ? source.plan?.types.find(parent => parent.classId === type.parentClassId)?.name ?? type.parentClassId : type.payload?.parent_class || '独立类'}</td></tr>)}</tbody></table></div>
            {!!source.plan.warnings.length && <Findings value={source.plan.warnings} />}
            <details><summary>发布影响与关系规则</summary>
              {source.plan.types.map(type => <p key={type.classId}>{type.name}：{type.changes ? `新增属性 ${type.changes.addedProperties.length}，保留属性 ${type.changes.retainedProperties.length}；身份${type.changes.identityChanged ? '变更' : '保持'}，继承${type.changes.parentChanged ? '变更' : '保持'}` : '旧版方案，请重新校验以查看影响'}</p>)}
              {source.plan.relationships.map((relation, index) => <p key={relation.rid ?? index}>{source.draft?.relationships.find(item => item.id === relation.relationId)?.name ?? relation.relationId}：{relation.payload?.cardinality ?? 'N:N'} · {relation.cardinalityStatus === 'confirmed' ? '已确认业务基数' : '未记录业务基数确认'} · {relation.targetSelection === 'entity' ? '实体定位' : relation.targetSelection === 'group' ? '集合匹配' : '旧版匹配规则'}</p>)}
            </details>
            <Checkbox checked={warningAck} onChange={e => setWarningAck(Boolean(e.target.checked))}>我已核对校验警告，理解分步发布可能保留部分已完成结果</Checkbox>
            <div className="fd-confirm"><Checkbox checked={publishConfirmed} onChange={e => setPublishConfirmed(Boolean(e.target.checked))}>我确认业务定义和身份规则，发布到平台原生本体</Checkbox></div>
            <Button theme="solid" loading={busy === '发布原生模型'} disabled={locked || !ready || !publishConfirmed || !warningAck || published} onClick={() => void operate('publish')}>{busy === '发布原生模型' ? '正在发布…' : published ? '原生模型已发布' : source.publication ? '重试发布' : '确认发布原生模型'}</Button>
          </>}
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
  </div>;
}
