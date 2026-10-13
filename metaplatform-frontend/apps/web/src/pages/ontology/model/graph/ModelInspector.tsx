import {
  type KernelObjectType,
  type KernelLinkType,
} from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import { applicableRelationships } from './relationshipInheritance';
export default function ModelInspector({
  type,
  link,
  objectTypes = [],
  onSelect,
  links,
  onOpen,
  onBinding,
  onExplore,
  unavailableSelection,
  linksUnavailable,
}: {
  type: KernelObjectType | null;
  link?: KernelLinkType | null;
  objectTypes?: KernelObjectType[];
  onSelect?: (rid: string) => void;
  links: KernelLinkType[];
  onOpen: () => void;
  onBinding: () => void;
  onExplore: () => void;
  unavailableSelection?: string;
  linksUnavailable?: boolean;
}) {
  const applicable = type ? applicableRelationships(type.rid,
    (objectTypes.length ? objectTypes : [type]).map(t => ({ id: t.rid, parentId: t.parent_class })),
    links.map(l => ({ ...l, id: l.rid, source: l.src, target: l.dst }))) : [];
  return (
    <aside className="mw-inspector" aria-label="资源属性">
      <small>资源属性 INSPECTOR</small>
      {link ? (
        <>
          <h2>{link.src_display_name?.trim() || link.dst_display_name?.trim() || ridTail(link.rid)}</h2>
          <code>{link.rid}</code>
          <dl>
            <dt>源模型</dt><dd>{objectTypes.find(t => t.rid === link.src)?.display_name || link.src}</dd>
            <dt>目标模型</dt><dd>{objectTypes.find(t => t.rid === link.dst)?.display_name || link.dst}</dd>
            <dt>关系基数</dt><dd>{link.cardinality}</dd>
          </dl>
          <h3>关系属性 · {link.link_properties.length}</h3>
          <ul>{link.link_properties.map(p => <li key={p.rid}>{p.title || p.rid} <code>{p.format}</code></li>)}</ul>
          {onSelect && <>
            <button onClick={() => onSelect(link.src)}>查看源模型 {objectTypes.find(t => t.rid === link.src)?.display_name || link.src}</button>
            <button onClick={() => onSelect(link.dst)}>查看目标模型 {objectTypes.find(t => t.rid === link.dst)?.display_name || link.dst}</button>
          </>}
        </>
      ) : type ? (
        <>
          <h2>{type.display_name || type.rid}</h2>
          <code>{type.rid}</code>
          <p>{type.description || '暂无描述'}</p>
          <dl>
            <dt>标识</dt>
            <dd>{type.rid}</dd>
            <dt>定义状态</dt>
            <dd>{type.status || '未提供'}</dd>
            <dt>主键</dt>
            <dd>
              {type.primary_key
                .map(
                  (r) =>
                    type.properties.find((p) => p.rid === r)?.title ||
                    r,
                )
                .join(' + ')}
            </dd>
            <dt>属性数量</dt>
            <dd>{type.properties.length}</dd>
          </dl>
          <h3>属性</h3>
          <ul>
            {type.properties.map((p) => (
              <li key={p.rid}>
                {p.title || p.rid} <code>{p.format}</code>
              </li>
            ))}
          </ul>
          <h3>关联模型 · {linksUnavailable ? '未完成' : new Set(applicable.map(item => item.relation.rid)).size}</h3>
          {linksUnavailable && <p>关系读取未完成，请重试模型读取。</p>}
          <ul>
            {applicable.map(({ relation: l, side, inherited, declaredOn }) => (
              <li key={`${l.rid}:${side}`}>
                {(side === 'source' ? l.src_display_name : l.dst_display_name)?.trim()
                  || l.src_display_name?.trim() || l.dst_display_name?.trim() || ridTail(l.rid)} · {l.cardinality}
                <span> · {inherited ? '继承适用' : '直接关系'}</span>
                {inherited && <small>关系声明于：{objectTypes.find(t => t.rid === declaredOn)?.display_name || declaredOn}</small>}
              </li>
            ))}
          </ul>
          <button className="mw-primary" onClick={onOpen}>
            打开模型编辑器
          </button>
          <button onClick={onBinding}>查看来源绑定</button>
          <button onClick={onExplore}>查询对象实例</button>
        </>
      ) : (
        <p>{unavailableSelection || '选择模型查看属性与关系'}</p>
      )}
    </aside>
  );
}
