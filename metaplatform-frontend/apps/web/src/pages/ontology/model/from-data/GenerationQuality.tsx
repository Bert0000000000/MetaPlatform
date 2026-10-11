import { Button, Tag } from '@douyinfe/semi-ui';
import type { ModelingSource } from '@/api/ont/modeling';

export default function GenerationQuality({ source, dirty, onLocate }: { source: ModelingSource; dirty: boolean; onLocate: (target: string) => void }) {
  const report = source.generation;
  if (!report) return null;
  const changed = dirty || report.stale;
  const locate = (item: string) => source.draft?.classes.some(c => c.id === item) ? `fd-class-${item}`
    : source.draft?.relationships.some(r => r.id === item) ? `fd-relation-${item}`
      : source.draft?.mappings.some(m => m.id === item) ? `fd-mapping-${item}` : null;
  return <section className="fd-card" aria-label="生成质量预检">
    <div className="fd-section-head"><h3>生成质量预检</h3><Tag color={report.origin === 'reused' ? 'blue' : 'grey'}>{report.origin === 'reused' ? '沿用相同输入的生成基线' : '已完成全量数据预检'}</Tag></div>
    <p>{report.structureErrors} 项结构问题 · {report.dataErrors} 项数据校验阻断 · 已调整 {report.changes.length} 项候选规则</p>
    <p className="mp-onto-muted">{changed ? '候选已修改，以下为生成时的检查记录；请重新校验当前修改。' : '规则调整仍需业务审核。数据阻断需处理后才能同步；生成预检不替代发布校验。'}</p>
    {!!report.findings.length && <details><summary>查看待处理项（{report.findings.length}）</summary><ul className="fd-findings">{report.findings.map((finding, i) => {
      const target = locate(finding.item);
      return <li key={i}><strong>{finding.name}</strong><p>{finding.message}</p>{target && <Button size="small" theme="borderless" onClick={() => onLocate(target)}>去核对</Button>}</li>;
    })}</ul></details>}
    {!!report.changes.length && <details><summary>查看候选调整依据（{report.changes.length}）</summary><ul>{report.changes.map((change, i) => <li key={i}>{source.draft?.classes.find(c => c.id === change.item)?.name ?? source.draft?.relationships.find(r => r.id === change.item)?.name ?? change.item}：{change.reason}</li>)}</ul></details>}
    {report.notices.map((notice, i) => <p key={i} role="status">{notice}</p>)}
    <details><summary>生成规则与平台能力范围</summary><p>相同数据、业务说明、问题和平台定义沿用同一生成基线。修改审核内容不会改写该基线；需要不同业务方案时请调整业务说明。</p><p>复用平台原生对象、属性、身份、关系、继承及发布版本规则。接口、动作、函数、复杂属性、时序和全局约束请在正向建模中补充，不会自动猜测生成。</p></details>
  </section>;
}
