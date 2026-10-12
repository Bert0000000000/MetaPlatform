import { useEffect, useRef, useState } from 'react';
import { Button, Spin } from '@douyinfe/semi-ui';
import { Check, Circle, CircleAlert } from 'lucide-react';
import type { ModelingSource } from '@/api/ont/modeling';

const stages = ['分析数据与业务背景', '生成对象类型和关系', '生成字段映射', '全量预检与候选修正'];
const stageIds = ['preparing', 'concepts', 'mapping', 'checking'];

export default function GenerationProgress({ job, submitting, error, sheetCount, hasDraft, onRetry }: {
  job: ModelingSource['job']; submitting: boolean; error: string; sheetCount: number; hasDraft: boolean; onRetry: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [submittedAt, setSubmittedAt] = useState(Date.now);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (submitting) panel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [submitting]);
  useEffect(() => { if (submitting) setSubmittedAt(Date.now()); }, [submitting]);
  const running = submitting || job?.status === 'running';
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!submitting && job?.kind !== 'generate') return null;
  const failed = !running && (Boolean(error) || job?.status === 'failed' || job?.status === 'interrupted');
  const succeeded = !running && !failed && job?.status === 'succeeded';
  const progress = submitting ? undefined : job?.progress;
  const active = stageIds.indexOf(progress?.stage ?? 'preparing');
  const start = submitting ? submittedAt : Date.parse(job?.startedAt ?? '');
  const end = running ? now : Date.parse(job?.finishedAt ?? '') || now;
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 1000)) : null;
  return <div ref={panel} className={`fd-generation${failed ? ' fd-generation-failed' : ''}`} aria-label="建议生成进度" aria-busy={running}>
    <div className="fd-generation-head" role="status" aria-live="polite">
      {running ? <Spin size="small" /> : failed ? <CircleAlert size={18} /> : <Check size={18} />}
      <strong>{running ? '正在生成模型建议' : failed ? '建议生成未完成' : '建议已生成，请审核'}</strong>
      {seconds !== null && <span className="fd-generation-time" aria-live="off">已用时 {Math.floor(seconds / 60)} 分 {seconds % 60} 秒</span>}
    </div>
    {!succeeded && (running || progress) && <ol className="fd-generation-steps">{stages.map((label, index) => {
      const done = index < active;
      const current = index === active;
      return <li key={label} className={done ? 'is-done' : current ? 'is-current' : ''} aria-current={current ? 'step' : undefined}>
        {done ? <Check size={16} /> : current && running ? <Spin size="small" /> : <Circle size={16} />}
        <span>{label}{current && progress?.stage === 'mapping' && progress.batch && progress.totalBatches ? ` · 第 ${progress.batch} / ${progress.totalBatches} 批${progress.retrying ? '（正在修正）' : ''}` : current && progress?.stage === 'checking' && progress.round ? ` · 第 ${progress.round} / 2 轮` : current && progress?.reused ? ' · 沿用生成基线' : ''}</span>
      </li>;
    })}</ol>}
    {running && <p>本次包含 {sheetCount} 张工作表，生成可能需要数分钟。可以离开页面，回来后继续查看。{hasDraft && '生成成功后更新候选；失败时保留原草稿。'}</p>}
    {failed && <><p role="alert">{error || job?.error || '任务已中断，请重试。'}</p><Button onClick={onRetry}>重试生成</Button></>}
  </div>;
}
