import { useState } from 'react';
import { Banner, Button } from '@douyinfe/semi-ui';
import { getModelingAcceptance, type ModelingAcceptance } from '@/api/ont/modeling';

export default function PublicationAcceptance({ sourceId, initial }: { sourceId: string; initial?: ModelingAcceptance }) {
  const [report, setReport] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const verify = async () => {
    setBusy(true); setError('');
    try { setReport(await getModelingAcceptance(sourceId)); }
    catch { setError('原生定义核验失败，请稍后重试。'); }
    finally { setBusy(false); }
  };
  return <section className="fd-card" aria-label="发布验收">
    <h3>发布验收</h3>
    <p>重新读取平台原生定义，核对类型、继承、属性、身份和关系基数。</p>
    <Button loading={busy} onClick={() => void verify()}>重新核验原生定义</Button>
    {error && <Banner type="danger" description={error} closeIcon={null} />}
    {report && <>
      <Banner type={report.status === 'passed' ? 'success' : 'warning'} description={report.status === 'passed' ? '原生定义与已审核发布方案一致' : report.status === 'drifted' ? '原生定义已发生变化，请核对差异后决定后续处理' : '本次任务尚未完成发布'} closeIcon={null} />
      <p>类型 {report.counts.types} · 关系 {report.counts.relationships} · 差异 {report.counts.drifted} · 核验时间 {report.checkedAt}</p>
      {report.types.filter(item => item.status !== 'matched').map(item => <p key={item.rid}>{item.name}：{item.status === 'missing' ? '原生类型缺失' : '原生定义已修改'}</p>)}
      {report.relationships.filter(item => item.status !== 'matched').map(item => <p key={item.rid}>{item.relationId}：{item.status === 'missing' ? '原生关系缺失' : '原生关系已修改'}；方案基数 {item.expectedCardinality}，当前 {item.actualCardinality || '无'}</p>)}
      {report.limitations.map(note => <p className="mp-onto-muted" key={note}>{note}</p>)}
    </>}
  </section>;
}
