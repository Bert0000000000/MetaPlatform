import type { ModelingDefinition } from '@/api/ont/modeling';

export const semanticFields = ['definition', 'scope', 'grain', 'unit', 'constraints', 'basis'] as const;
export const semanticLabels = ['定义', '适用范围', '业务粒度', '单位', '约束口径', '依据'];

export default function SemanticSummary({ definitions }: { definitions: ModelingDefinition[] }) {
  if (!definitions.length) return null;
  return <div aria-label="一并审核的业务语义">{definitions.map(d => <section key={d.target}>
    <strong>{d.target}</strong>
    {semanticFields.map((key, i) => d[key] && <p key={key}>{semanticLabels[i]}：{d[key]}</p>)}
    {!!d.aliases.length && <p>别名：{d.aliases.join('、')}</p>}
  </section>)}</div>;
}
