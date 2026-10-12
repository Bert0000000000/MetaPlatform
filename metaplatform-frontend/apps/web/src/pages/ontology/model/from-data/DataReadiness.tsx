import { Button, Tag } from '@douyinfe/semi-ui';
import type { ModelingDraft, ModelingValidation } from '@/api/ont/modeling';

export default function DataReadiness({ report, draft, onLocate, partialAvailable = false }: { report?: ModelingValidation; draft: ModelingDraft | null; onLocate?: (id: string) => void; partialAvailable?: boolean }) {
  if (!report) return <p className="mp-onto-muted">请重新校验，获取独立的数据接入检查结果。</p>;
  const grouped = new Map<string, { severity: string; item: string; message: string; count: number; examples: string[] }>();
  for (const issue of report.issueGroups ?? report.issues.map(issue => ({ ...issue, count: 1 }))) {
    const item = issue.item.startsWith('entity:') ? issue.item.split(':')[1] : issue.item;
    const summary = issue.message.split('；')[0];
    const key = JSON.stringify([issue.severity, item, summary]);
    const group = grouped.get(key) ?? { severity: issue.severity, item, message: summary, count: 0, examples: [] };
    group.count += issue.count;
    if (group.examples.length < 3 && !group.examples.includes(issue.message)) group.examples.push(issue.message);
    grouped.set(key, group);
  }
  const groups = [...grouped.values()].sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error') || b.count - a.count);
  const target = (id: string) => draft?.mappings.some(m => m.id === id) ? `fd-mapping-${id}` : draft?.classes.some(c => c.id === id.replace(/^class:/, '')) ? `fd-class-${id.replace(/^class:/, '')}` : draft?.relationships.some(r => r.id === id) ? `fd-relation-${id}` : null;
  const location = (id: string) => {
    const mapping = draft?.mappings.find(item => item.id === id);
    if (mapping) return `${mapping.sheet} → ${draft?.classes.find(cls => cls.id === mapping.classId)?.name ?? mapping.classId}`;
    return draft?.classes.find(cls => cls.id === id.replace(/^class:/, ''))?.name ?? id;
  };
  const handling = (issue: { severity: string; item: string }) => {
    if (issue.severity !== 'error') return <span className="fd-issue-resolution is-info">无需处理</span>;
    if (partialAvailable) return <span className="fd-issue-resolution is-deferred">同步时自动暂缓</span>;
    return target(issue.item) ? <Button size="small" theme="borderless" onClick={() => onLocate?.(target(issue.item)!)}>去处理</Button> : '需修正来源数据';
  };
  return <section className="fd-card" aria-label="数据接入检查">
    <h3>数据接入检查 · {report.canSync ? '全部可同步' : partialAvailable ? '合格数据可同步' : '存在阻断'}</h3>
    <p className="mp-onto-muted">{partialAvailable ? '无需逐条处理。同步时系统会自动隔离问题来源行和无法建立的关系，只写入通过校验的数据。' : '警告仅供了解，不影响同步；只有待处理项会阻断相应实例或关系。'}</p>
    <p><strong>{report.errors.toLocaleString()}</strong> 项待处理，<strong>{report.warnings.toLocaleString()}</strong> 项提示。</p>
    {groups.length > 0 && <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>级别</th><th>位置</th><th>原因</th><th>次数</th>{onLocate && <th>处理方式</th>}</tr></thead><tbody>{groups.map((issue, i) => <tr key={i}><td><Tag color={issue.severity === 'error' ? 'red' : 'orange'}>{issue.severity === 'error' ? '待处理' : '提示'}</Tag></td><td>{location(issue.item)}</td><td>{issue.message}<details><summary>查看示例</summary>{issue.examples.map((example, n) => <p key={n}>{example}</p>)}</details></td><td>{issue.count.toLocaleString()}</td>{onLocate && <td>{handling(issue)}</td>}</tr>)}</tbody></table></div>}
    {report.issueGroupsTruncated && <p className="fd-warning">问题种类较多，仅展示前 500 组；总问题数未截断。</p>}
    {!report.canSync && !partialAvailable && <p>当前没有可安全写入的子集。可先使用 AI 生成批量修复方案；仍无法解决时，再返回候选审核调整身份或映射。</p>}
  </section>;
}
