import { useRef, useState } from 'react';
import { Banner, Button, Modal, Spin } from '@douyinfe/semi-ui';
import type { KernelObjectType } from '@/api/ont/kernel';
import { runModelingOperation, saveModelingSource, type ModelingSource } from '@/api/ont/modeling';
import PublicationDecisions from './PublicationDecisions';
import { suggestResolution } from './candidateMatching';
import { hasPublicationStarted } from './publicationState';

export default function PublicationReview({ source, types, disabled, onPrepare, onChanged, onPublished }: {
  source: ModelingSource; types: KernelObjectType[]; disabled: boolean;
  onPrepare: () => Promise<ModelingSource>;
  onChanged: (source: ModelingSource) => void;
  onPublished: (source: ModelingSource) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [candidate, setCandidate] = useState<ModelingSource | null>(null);
  const [edited, setEdited] = useState(false);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const fail = (err: unknown) => {
    const value = err as { response?: { data?: { detail?: unknown } }; message?: string };
    const detail = value.response?.data?.detail;
    setError(typeof detail === 'string' ? detail : value.message || '操作失败，请重新校验发布方案。');
  };
  const open = async () => {
    if (pending.current) return;
    pending.current = true; setVisible(true); setCandidate(null); setWorking('读取当前候选…'); setError(''); setEdited(false);
    try {
      const current = await onPrepare();
      // Old plans must be rechecked against the current native baseline.
      const next = structuredClone(current);
      next.plan = null;
      if (!hasPublicationStarted(next.publication)) {
        next.draft?.classes.filter(cls => cls.included !== false).forEach(cls => {
          const resolution = next.resolutions[cls.id];
          if (!resolution) return;
          const target = types.find(type => type.rid === resolution.targetRid);
          if (target && resolution.mode !== 'new') {
            const suggested = suggestResolution(cls, target).propertyMap;
            resolution.propertyMap = { ...suggested, ...resolution.propertyMap };
          }
        });
        setEdited(JSON.stringify(next.resolutions) !== JSON.stringify(current.resolutions));
      }
      setCandidate(next);
    } catch (err) { fail(err); } finally { pending.current = false; setWorking(''); }
  };
  const check = async () => {
    if (!candidate || pending.current) return;
    pending.current = true; setWorking('校验发布操作…'); setError('');
    try {
      const saved = edited ? await saveModelingSource(candidate) : candidate;
      setCandidate(saved); setEdited(false); onChanged(saved);
      const checked = await runModelingOperation(saved, 'validate', { preparePublication: true });
      setCandidate(checked); onChanged(checked);
      return checked;
    } catch (err) { fail(err); } finally { pending.current = false; setWorking(''); }
  };
  const ready = Boolean(candidate?.plan && candidate.validation?.canPublish && !edited);
  const publish = async () => {
    if (!candidate || pending.current) return;
    const prepared = ready ? candidate : await check();
    if (!prepared?.plan || !prepared.validation?.canPublish) return;
    pending.current = true; setWorking('正在发布本体…'); setError('');
    try {
      const result = await runModelingOperation(prepared, 'publish', { configHash: prepared.plan.configHash, acknowledgeWarnings: true });
      setCandidate(result); onChanged(result);
      if (result.publication?.status === 'succeeded' || result.publication?.status === 'completed') {
        setVisible(false); onPublished(result);
      } else setError(result.publication?.error || '发布未全部完成，请核对结果后重试。');
    } catch (err) { setCandidate({ ...prepared, plan: null }); fail(err); }
    finally { pending.current = false; setWorking(''); }
  };
  return <>
    <Button theme="solid" disabled={disabled} onClick={() => void open()}>发布本体</Button>
    <Modal title="发布前确认" visible={visible} width="min(1100px, calc(100vw - 32px))" centered
      bodyStyle={{ maxHeight: 'calc(100dvh - 240px)', overflow: 'auto' }}
      footer={<div className="fd-publication-footer"><div role="status" aria-live="polite" className="fd-publication-feedback">
        {working || (error ? `操作未完成：${error}` : !edited && candidate?.validation?.issues.some(i => i.severity === 'error')
          ? `校验未通过：${candidate.validation.issues.filter(i => i.severity === 'error').map(i => i.message).join('；')}`
          : ready ? '方案已校验。确认发布将写入正式本体。' : '配置完成后可直接确认发布，系统会先校验；校验通过才写入正式本体。')}
      </div><div className="fd-inline"><Button disabled={Boolean(working)} onClick={() => setVisible(false)}>关闭</Button><Button disabled={!candidate || Boolean(working)} onClick={() => void check()}>校验发布方案</Button><Button theme="solid" disabled={!candidate || Boolean(working)} onClick={() => void publish()}>确认发布本体</Button></div></div>}
      closable={!working} maskClosable={!working} onCancel={() => setVisible(false)}>
      <p>候选审批已独立完成。现在选择本次如何写入正式本体；已有标识不能重复新建。</p>
      {working && <div role="status"><Spin size="small" />{working}</div>}
      {error && <Banner type="danger" description={error} closeIcon={null} />}
      {candidate && <PublicationDecisions source={candidate} types={types} disabled={Boolean(working)}
        issues={edited ? [] : candidate.validation?.issues}
        onResolve={(id, resolution) => {
          setCandidate({ ...candidate, resolutions: { ...candidate.resolutions, [id]: resolution }, plan: null, validation: null });
          setEdited(true); setError('');
        }} />}
      {ready && <Banner type="success" description="发布方案校验通过，请核对操作及属性对应后确认发布。" closeIcon={null} />}
      {!!candidate?.plan?.warnings.length && <ul>{candidate.plan.warnings.map((warning, i) => <li key={i}>{typeof warning === 'string' ? warning : JSON.stringify(warning)}</li>)}</ul>}
      <p className="mp-onto-muted">点击确认发布，表示已核对操作、属性对应及警告；分步发布失败可能保留已完成结果。</p>
    </Modal>
  </>;
}
