import {
  propSlug,
  type KernelObjectType,
  type KernelLinkType,
} from '@/api/ont/kernel';
export default function ModelInspector({
  type,
  links,
  onOpen,
  onBinding,
  onExplore,
}: {
  type: KernelObjectType | null;
  links: KernelLinkType[];
  onOpen: () => void;
  onBinding: () => void;
  onExplore: () => void;
}) {
  return (
    <aside className="mw-inspector" aria-label="资源属性">
      <small>资源属性 INSPECTOR</small>
      {type ? (
        <>
          <h2>{type.display_name || propSlug(type.rid)}</h2>
          <code>{propSlug(type.rid)}</code>
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
                    propSlug(r),
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
                {p.title || propSlug(p.rid)} <code>{p.format}</code>
              </li>
            ))}
          </ul>
          <h3>关联模型 · {links.length}</h3>
          <ul>
            {links.map((l) => (
              <li key={l.rid}>
                {propSlug(l.rid)} · {l.cardinality}
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
        <p>选择模型查看属性与关系</p>
      )}
    </aside>
  );
}
