import { useRef, useState } from 'react';
import { Banner, Button, Modal, Spin, Tag } from '@douyinfe/semi-ui';
import { confirmModelingCompletion, prepareModelingCompletion, type ModelingCompletionPlan, type ModelingSource } from '@/api/ont/modeling';
import { hasPublicationStarted } from './publicationState';

const errorText = (error: unknown) => {
  const value = error as {response?: {data?: {detail?: unknown}};message?: string};
  return typeof value.response?.data?.detail === 'string' ? value.response.data.detail : value.message || '操作失败，请重新查看方案。';
};

export default function CompletionReview({ source, disabled, onPrepare, onApplied, onEditClass }: {
  source: ModelingSource; disabled: boolean;
  onPrepare: () => Promise<ModelingSource>; onApplied: (source: ModelingSource) => void;
  onEditClass?: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [plan, setPlan] = useState<ModelingCompletionPlan | null>(null);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const basis = useRef(source);
  const load = async (ids: string[], initial = false) => {
    setWorking('正在一次性检查对象、继承、关系和映射…'); setError(''); setPlan(null);
    try {
      if (initial) basis.current = await onPrepare();
      setPlan(await prepareModelingCompletion(basis.current, ids));
    } catch (err) { setError(errorText(err)); } finally { setWorking(''); }
  };
  const apply = async () => {
    if (!plan || working) return;
    setWorking('正在统一应用方案并重新校验…'); setError('');
    try {
      const result = await confirmModelingCompletion(basis.current, plan.hash, deferred);
      onApplied(result); setVisible(false);
    } catch (err) { setPlan(null); setError(errorText(err)); } finally { setWorking(''); }
  };
  return <>
    <Button disabled={disabled || hasPublicationStarted(source.publication)} onClick={() => {
      setDeferred([]); setVisible(true); void load([], true);
    }}>一次处理并确认</Button>
    <Modal title="一次处理候选本体" visible={visible} centered className="fd-batch-modal" width="min(1040px, calc(100vw - 32px))"
      bodyStyle={{maxHeight:'calc(100dvh - 240px)',overflow:'auto'}}
      okText="确认方案并重新校验" okButtonProps={{'aria-label':'确认方案并重新校验',disabled:!plan?.canApply || Boolean(working),loading:Boolean(working)}}
      cancelButtonProps={{disabled:Boolean(working)}} maskClosable={!working} closable={!working}
      onCancel={() => setVisible(false)} onOk={() => void apply()}>
      <div className="fd-page">
      <p>一次核对补全与暂缓范围。类不发布时，其子类、关系和实例一并排除；原始数据和候选保留。</p>
      {working && <div role="status" className="fd-status"><Spin size="small" />{working}</div>}
      {error && <Banner type="danger" description={error} closeIcon={null} />}
      {error && !working && <Button onClick={() => void load(deferred, true)}>重新查看最新方案</Button>}
      {plan && <>
        <p role="status">本次发布 <strong>{plan.counts.classes}</strong> 个类、<strong>{plan.counts.relationships}</strong> 条关系，暂缓 {plan.counts.deferred} 项。</p>
        <div className="fd-table-scroll" tabIndex={0} role="region" aria-label="对象补全与暂缓范围"><table className="fd-table fd-completion-table"><thead><tr><th>对象类型</th><th>身份规则及依据</th><th>本次处理</th><th>预计结果</th></tr></thead><tbody>{plan.candidates.map(cls => <tr key={cls.id}>
          <td><strong>{cls.name}</strong>{cls.parent && <p>父类：{plan.candidates.find(c => c.id === cls.parent)?.name ?? cls.parent}</p>}</td>
          <td>{cls.identity.join(' + ') || '来源记录身份'}<p className="mp-onto-muted">{cls.reason || '尚无业务身份依据'}</p></td>
          <td><select aria-label={`${cls.name} 本次处理`} disabled={Boolean(working) || !cls.originallyIncluded || Boolean(cls.parent && !plan.candidates.find(c => c.id === cls.parent)?.included)} value={cls.parent && !plan.candidates.find(c => c.id === cls.parent)?.included ? 'parent' : deferred.includes(cls.id) || !cls.originallyIncluded ? 'defer' : 'complete'} onChange={e => {
            const ids = e.target.value === 'defer' ? [...deferred, cls.id] : deferred.filter(id => id !== cls.id);
            setDeferred(ids); void load(ids);
          }}>{cls.parent && !plan.candidates.find(c => c.id === cls.parent)?.included && <option value="parent">随父类暂缓（含实例）</option>}<option value="complete">按现有依据补全并确认</option><option value="defer">本次不发布（含实例）</option></select></td>
          <td><Tag color={cls.included ? 'green' : 'orange'}>{cls.included ? '纳入发布' : '暂缓'}</Tag>{cls.problem && <p>{cls.problem}</p>}{cls.problem && onEditClass && !deferred.includes(cls.id) && <Button size="small" theme="borderless" aria-label={`补充${cls.name}信息`} onClick={() => {setVisible(false);onEditClass(cls.id);}}>补充缺失信息</Button>}</td>
        </tr>)}</tbody></table></div>
        <p className="mp-onto-muted">补全只采用已有定义和明确字段对应；依据不足时保持暂缓，不编造身份、基数或数据。</p>
        <details open={plan.changes.some(c => c.action === '暂缓')}><summary>全部修复与暂缓明细（{plan.changes.length}）</summary><ul>{plan.changes.map((change,i) => <li key={i}><strong>{change.name} · {change.action}</strong>：{change.reason}</li>)}</ul></details>
        <details><summary>关系规则与依据（{plan.relationships.filter(r => r.included).length} 条纳入发布）</summary><ul>{plan.relationships.filter(r => r.included).map(rel => <li key={rel.id}><strong>{rel.name} · {rel.cardinality}</strong>：{rel.reason || '沿用已有关系规则'}<p>{rel.joins.map(j => `${j.sourceProperty} → ${j.targetProperty}`).join('；')}</p></li>)}</ul></details>
        <p>预计合格数据：{plan.data.nodes.toLocaleString()} 个实例、{plan.data.edges.toLocaleString()} 条关系；另有 {plan.data.rows.toLocaleString()} 行因数据问题暂缓。未发布的类不生成实例。</p>
        {!plan.data.canSync && <Banner type="warning" description="本体可独立发布；当前数据仍需按第五步检查结果处理。此方案不会自动发布或写入实例。" closeIcon={null} />}
        {!!plan.remaining.length && <Banner type="danger" description={plan.remaining.map(i => i.message).join('；')} closeIcon={null} />}
      </>}
      </div>
    </Modal>
  </>;
}
