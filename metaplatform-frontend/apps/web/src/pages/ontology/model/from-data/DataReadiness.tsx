import { Button, Tag } from '@douyinfe/semi-ui';
import type { ModelingDraft, ModelingValidation } from '@/api/ont/modeling';

export default function DataReadiness({ report, draft, onLocate }: { report?: ModelingValidation; draft: ModelingDraft | null; onLocate?: (id: string) => void }) {
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
  return <section className="fd-card" aria-label="数据接入检查">
    <h3>数据接入检查 · {report.canSync ? '可同步' : '待处理'}</h3>
    <p className="mp-onto-muted">数据问题不影响已发布的本体。问题记录可先修复，或在数据同步步骤确认暂缓范围后，仅同步通过身份、类型及冲突校验的合格数据。</p>
    <p>数据阻断 {report.errors.toLocaleString()} 项，警告 {report.warnings.toLocaleString()} 项。</p>
    {groups.length > 0 && <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>级别</th><th>位置</th><th>原因</th><th>次数</th>{onLocate && <th>处理</th>}</tr></thead><tbody>{groups.map((issue, i) => <tr key={i}><td><Tag color={issue.severity === 'error' ? 'red' : 'orange'}>{issue.severity === 'error' ? '待处理' : '警告'}</Tag></td><td>{location(issue.item)}</td><td>{issue.message}<details><summary>查看示例</summary>{issue.examples.map((example, n) => <p key={n}>{example}</p>)}</details></td><td>{issue.count.toLocaleString()}</td>{onLocate && <td>{target(issue.item) ? <Button size="small" theme="borderless" onClick={() => onLocate(target(issue.item)!)}>去核对</Button> : '核对来源数据'}</td>}</tr>)}</tbody></table></div>}
    {report.issueGroupsTruncated && <p className="fd-warning">问题种类较多，仅展示前 500 组；总问题数未截断。</p>}
    {!report.canSync && <p>可返回候选审核，核对身份和映射；原始值缺失请补齐源文件后另建来源并选择复用已发布类型。涉及正式主键变更，请使用平台原生迁移流程。</p>}
  </section>;
}
