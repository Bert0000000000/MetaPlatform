import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@mate/shared';
import { useNavigate } from 'react-router-dom';
import { listApps, getApp } from '@/api/apphub/apps';
import { getAppRuntime } from '@/api/apphub/runtime';
import { listBigDataSources, type BigDataSource } from '@/api/ontology-bigdata';
import { listObjectTypes, listLinkTypes, listBackingDatasources, listIndividuals, listLinkInstances,
  type KernelObjectType, type KernelLinkType, type KernelBackingDatasource } from '@/api/ont/kernel';
import type { AppItem } from '@/api/apphub/types';
import type { OrderBinding } from '@/api/apphub/pages';

interface Selection {
  flow: 'sample' | 'data' | 'existing' | '';
  sourceId: string; modelRid: string; mappingRid: string; runId: string; linkRid: string; appId: string; position: number;
}
interface Evidence {
  sourceId?: string; modelRid?: string; modelStatus?: string; mappingRid?: string; mappingSourceId?: string;
  runs?: Array<{ run_id: string; status: string; ok: boolean; total_synced: number }>;
  dataCount?: number; linkRid?: string; relatedCount?: number; appId?: string; publishedVersionId?: string;
  boundModelRid?: string; boundLinkRid?: string;
}
const blank: Selection = { flow: '', sourceId: '', modelRid: '', mappingRid: '', runId: '', linkRid: '', appId: '', position: 0 };
const steps = ['导入数据', '发布对象模型', '建立客户关联', '创建应用', '发布并运行'];
export const onboardingKey = (tenant: string, user: string) => 'mp11:onboarding:' + JSON.stringify([tenant, user]);

export function deriveOnboardingEvidence(selected: Selection, evidence: Evidence): boolean[] {
  const imported = !!selected.sourceId && evidence.sourceId === selected.sourceId
    && evidence.mappingRid === selected.mappingRid && evidence.mappingSourceId === selected.sourceId
    && !!evidence.runs?.some(r => r.run_id === selected.runId && r.status === 'succeeded' && r.ok && r.total_synced > 0)
    && (evidence.dataCount ?? 0) > 0;
  const model = imported && evidence.modelRid === selected.modelRid && evidence.modelStatus === 'active';
  const relation = model && !!selected.linkRid && evidence.linkRid === selected.linkRid && (evidence.relatedCount ?? 0) > 0;
  const app = relation && !!selected.appId && evidence.appId === selected.appId;
  const published = app && !!evidence.publishedVersionId && evidence.boundModelRid === selected.modelRid && evidence.boundLinkRid === selected.linkRid;
  return [imported, model, relation, app, published];
}

export default function ProductOnboarding() {
  const { user } = useAuth();
  if (!user?.id || !user.tenantId) return null;
  return <OnboardingFlow key={onboardingKey(user.tenantId, user.id)} storageKey={onboardingKey(user.tenantId, user.id)} />;
}

function OnboardingFlow({ storageKey }: { storageKey: string }) {
  const navigate = useNavigate();
  const [selection, setSelection] = useState<Selection>(() => {
    try { return { ...blank, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { return blank; }
  });
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [models, setModels] = useState<KernelObjectType[]>([]);
  const [links, setLinks] = useState<KernelLinkType[]>([]);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [mappings, setMappings] = useState<KernelBackingDatasource[]>([]);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(selection)); }, [storageKey, selection]);
  const refresh = useCallback(async () => {
    if (!selection.flow) return;
    setLoading(true); setError(''); setEvidence(null);
    try {
      const [s, m, l, a] = await Promise.all([listBigDataSources(), listObjectTypes(), listLinkTypes(), listApps()]);
      setSources(s); setModels(m); setLinks(l); setApps(a.items);
      const selectedModel = m.find(x => x.rid === selection.modelRid);
      const mapped = selection.modelRid ? await listBackingDatasources(selection.modelRid) : [];
      setMappings(mapped);
      const mapping = mapped.find(x => x.rid === selection.mappingRid);
      const individuals = selection.modelRid ? await listIndividuals({ classRid: selection.modelRid }) : [];
      const related = selection.linkRid ? await listLinkInstances({ linkTypeRid: selection.linkRid }) : [];
      const app = selection.appId ? await getApp(selection.appId) : undefined;
      let binding: OrderBinding | undefined;
      if (app?.status === 'PUBLISHED') {
        const runtime = await getAppRuntime(app.appId);
        binding = runtime.render_tree.map(n => n.config?.binding as OrderBinding | undefined)
          .find(b => b && (selection.flow === 'existing' || b.object_type === selection.modelRid));
      }
      setEvidence({ sourceId: s.find(x => x.sourceId === selection.sourceId)?.sourceId,
        modelRid: selectedModel?.rid, modelStatus: selectedModel?.status,
        mappingRid: mapping?.rid, mappingSourceId: mapping?.source_id, runs: mapping?.run_history,
        dataCount: individuals.length, linkRid: l.find(x => x.rid === selection.linkRid)?.rid,
        relatedCount: related.filter(r => individuals.some(i => i.rid === r.src || i.rid === r.dst)).length,
        appId: app?.appId, publishedVersionId: app?.status === 'PUBLISHED' && binding ? app.publishedVersionId : undefined,
        boundModelRid: binding?.object_type, boundLinkRid: binding?.link_type,
      });
    } catch (e) { setError(e instanceof Error ? e.message : '产物状态未知，请重试'); }
    finally { setLoading(false); }
  }, [selection]);
  useEffect(() => { void refresh(); }, [refresh]);
  const update = (patch: Partial<Selection>) => setSelection(s => ({ ...s, ...patch }));
  const completed = evidence ? deriveOnboardingEvidence(selection, evidence) : null;
  const mapping = mappings.find(m => m.rid === selection.mappingRid);
  const targets = ['/gov/data/sources', '/ontology/model/object-types', '/ontology/model/link-types', '/apps/mine', '/apps/mine?app=' + encodeURIComponent(selection.appId)];
  return <section aria-label="开始使用平台" className="mp-p-4">
    <h2>开始使用平台</h2>
    <div className="mp-flex mp-gap-3">
      {([['sample', '从样例开始'], ['data', '接入真实数据'], ['existing', '打开已有应用']] as const).map(([flow, title]) =>
        <button key={flow} aria-pressed={selection.flow === flow} onClick={() => setSelection({ ...blank, flow })}>{title}</button>)}
    </div>
    {selection.flow && <>
      <p>{selection.flow === 'sample' ? '先导入所选样例源，再用实际数据完成对象、关系和应用。默认演示目录不会自动完成此流程。' : '选择本次流程的实际产物，返回首页后可从保存位置继续。'}</p>
      {error && <div role="alert">状态未知：{error}<button onClick={() => void refresh()}>重试检查</button></div>}
      {loading && <p role="status">正在核验实际产物…</p>}
      {selection.flow !== 'existing' && <>
        <label>本次数据源<select aria-label="本次数据源" value={selection.sourceId} onChange={e => update({ sourceId: e.target.value, mappingRid: '', runId: '' })}><option value="">选择数据源</option>{sources.map(s => <option key={s.sourceId} value={s.sourceId}>{s.name}</option>)}</select></label>
        <label>本次对象模型<select aria-label="本次对象模型" value={selection.modelRid} onChange={e => update({ modelRid: e.target.value, mappingRid: '', runId: '', linkRid: '' })}><option value="">选择模型</option>{models.map(m => <option key={m.rid} value={m.rid}>{m.display_name || m.rid}</option>)}</select></label>
        <label>本次映射<select aria-label="本次映射" value={selection.mappingRid} onChange={e => update({ mappingRid: e.target.value, runId: '' })}><option value="">选择源与对象映射</option>{mappings.filter(m => m.source_id === selection.sourceId).map(m => <option key={m.rid} value={m.rid}>{m.name}</option>)}</select></label>
        <label>本次导入运行<select aria-label="本次导入运行" value={selection.runId} onChange={e => update({ runId: e.target.value })}><option value="">选择导入回执</option>{mapping?.run_history?.map(r => <option key={r.run_id} value={r.run_id}>{r.run_id} · {r.status} · {r.total_synced} 条</option>)}</select></label>
        <label>本次客户关系<select aria-label="本次客户关系" value={selection.linkRid} onChange={e => update({ linkRid: e.target.value })}><option value="">选择关系</option>{links.filter(l => l.src === selection.modelRid || l.dst === selection.modelRid).map(l => <option key={l.rid} value={l.rid}>{l.rid}</option>)}</select></label>
      </>}
      <label>本次应用<select aria-label="本次应用" value={selection.appId} onChange={e => update({ appId: e.target.value })}><option value="">选择应用</option>{apps.map(a => <option key={a.appId} value={a.appId}>{a.name} · {a.status}</option>)}</select></label>
      {selection.flow === 'existing' ? <p>{!evidence ? '运行状态未知' : evidence.publishedVersionId ? '已核验发布绑定，可打开应用' : '应用尚无有效发布绑定'}</p>
        : <ol>{steps.map((step, index) => <li key={step}>{step}：{!completed ? '未知' : completed[index] ? '已验证' : '待完成'}<button aria-current={selection.position === index ? 'step' : undefined} onClick={() => { update({ position: index }); navigate(targets[index]); }}>前往{step}</button></li>)}</ol>}
      <button disabled={!selection.appId} onClick={() => navigate('/apps/mine?app=' + encodeURIComponent(selection.appId))}>继续所选应用</button>
      <button onClick={() => void refresh()}>重新核验产物</button>
    </>}
  </section>;
}
