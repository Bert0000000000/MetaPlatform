import { type KernelObjectType } from '@/api/ont/kernel';

/** Resource selection only; the parent owns the DTOs, filter and URL. */
export default function ModelResourceTree({ types, selectedRid, query, incomplete, onQuery, onSelect, onOpen }: {
  types: KernelObjectType[];
  selectedRid: string;
  query: string;
  incomplete: boolean;
  onQuery: (query: string) => void;
  onSelect: (rid: string) => void;
  onOpen: (rid: string) => void;
}) {
  const groups = new Map<string, KernelObjectType[]>();
  for (const type of types) {
    const group = type.type_group?.trim() || '未分组';
    const resources = groups.get(group);
    if (resources) resources.push(type);
    else groups.set(group, [type]);
  }
  return (
    <aside className="mw-resource-list mw-tree" aria-label="模型资源树">
      <strong>模型资源 · {incomplete ? '计数未完成' : types.length}</strong>
      <input aria-label="筛选资源树" placeholder="搜索模型" value={query} onChange={(e) => onQuery(e.target.value)} />
      {[...groups].map(([group, resources]) => (
        <section key={group} aria-label={group}>
          <h3><span>{group}</span><small>{resources.length}</small></h3>
          {resources.map((type) => (
            <button key={type.rid} aria-label={`选择资源 ${type.display_name || type.rid}`}
              aria-pressed={selectedRid === type.rid} title={type.rid}
              onClick={() => onSelect(type.rid)} onDoubleClick={() => onOpen(type.rid)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault();
                  onOpen(type.rid);
                }
              }}>
              <span>{type.display_name || type.rid}</span>
              <small>{type.rid.match(/\.v\d+$/)?.[0].slice(1) || '版本未提供'}</small>
            </button>
          ))}
        </section>
      ))}
      {!types.length && <p className="mw-hint">{incomplete ? '资源读取未完成' : '没有匹配的资源'}</p>}
    </aside>
  );
}
