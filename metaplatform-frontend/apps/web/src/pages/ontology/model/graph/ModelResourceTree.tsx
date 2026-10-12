import type { ReactNode } from 'react';
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
  const resourceButton = (type: KernelObjectType, depth = 0) => (
    <button key={type.rid} className={depth ? 'mw-tree-child' : undefined}
      data-depth={depth} aria-label={`选择资源 ${type.display_name || type.rid}`}
      style={{ paddingInlineStart: 8 + depth * 16 }}
      aria-pressed={selectedRid === type.rid} title={type.rid}
      onClick={() => onSelect(type.rid)} onDoubleClick={() => onOpen(type.rid)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          onOpen(type.rid);
        }
      }}>
      <span>{type.display_name || type.rid}{depth > 0 && <small className="mw-tree-kind">是一种</small>}</span>
      <small>{type.rid.match(/\.v\d+$/)?.[0].slice(1) || '版本未提供'}</small>
    </button>
  );
  return (
    <aside className="mw-resource-list mw-tree" aria-label="模型资源树">
      <strong>模型资源 · {incomplete ? '计数未完成' : types.length}</strong>
      <input aria-label="筛选资源树" placeholder="搜索模型" value={query} onChange={(e) => onQuery(e.target.value)} />
      {[...groups].map(([group, resources]) => (
        <section key={group} aria-label={group}>
          <h3><span>{group}</span><small>{resources.length}</small></h3>
          {(() => {
            const ids = new Set(resources.map(type => type.rid));
            const children = new Map<string, KernelObjectType[]>();
            resources.forEach(type => {
              if (type.parent_class && ids.has(type.parent_class)) {
                const rows = children.get(type.parent_class) ?? [];
                rows.push(type);
                children.set(type.parent_class, rows);
              }
            });
            const roots = resources.filter(type => !type.parent_class || !ids.has(type.parent_class));
            const renderBranch = (type: KernelObjectType, depth = 0): ReactNode[] => [
              resourceButton(type, depth),
              ...(children.get(type.rid) ?? []).flatMap(child => renderBranch(child, depth + 1)),
            ];
            return roots.flatMap(type => renderBranch(type));
          })()}
        </section>
      ))}
      {!types.length && <p className="mw-hint">{incomplete ? '资源读取未完成' : '没有匹配的资源'}</p>}
    </aside>
  );
}
