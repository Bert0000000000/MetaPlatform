import type { KernelObjectType } from '@/api/ont/kernel';
import type { ModelingResolution, ModelingSource } from '@/api/ont/modeling';
import { localMatches, suggestResolution } from './candidateMatching';
import { included } from './review';

export default function PublicationDecisions({ source, types, disabled = false, issues = [], onResolve, onEditClass }: {
  source: ModelingSource; types: KernelObjectType[]; disabled?: boolean;
  issues?: Array<{ item: string; message: string }>;
  onResolve: (id: string, resolution: ModelingResolution) => void;
  onEditClass?: (id: string) => void;
}) {
  const locked = disabled || Boolean(source.publication?.completed.length);
  return <section className="fd-publication-decisions" aria-label="本体候选发布处理">
    <p className="fd-publication-intro">已自动匹配已有对象，缺少的属性将新增。核对本次操作后即可确认发布。</p>
    <div className="fd-publication-summary"><span>复用 {source.draft?.classes.filter(c => included(c) && source.resolutions[c.id]?.mode === 'reuse').length ?? 0}</span><span>新增属性 {source.draft?.classes.filter(c => included(c) && source.resolutions[c.id]?.mode === 'extend').length ?? 0}</span><span>新建对象 {source.draft?.classes.filter(c => included(c) && (!source.resolutions[c.id] || source.resolutions[c.id].mode === 'new')).length ?? 0}</span></div>
    {source.publication?.completed.length ? <p>本方案已有部分发布结果，目标已锁定。后续增量请另建候选并复用已发布类型。</p> : null}
    <div className="fd-table-scroll"><table className="fd-table"><colgroup><col style={{width:'18%'}} /><col style={{width:'18%'}} /><col style={{width:'30%'}} /><col style={{width:'34%'}} /></colgroup><thead><tr><th>候选对象</th><th>本次操作</th><th>对应已有对象</th><th>变更说明</th></tr></thead><tbody>
      {source.draft?.classes.filter(included).map(cls => {
        const resolution = source.resolutions[cls.id];
        const mode = resolution?.mode;
        const target = types.find(t => t.rid === resolution?.targetRid);
        const map = resolution?.propertyMap ?? {};
        const matches = localMatches(cls, types);
        const problems = issues.filter(issue => issue.item === cls.id);
        const unresolved = mode === 'reuse' ? cls.properties.filter(p => !target?.properties.some(np => np.rid === map[p.id])) : [];
        const added = mode === 'extend' ? cls.properties.filter(p => !map[p.id]) : [];
        const identityMismatch = target && cls.identity && (mode === 'reuse' || mode === 'extend') &&
          JSON.stringify(cls.identity.map(id => map[id])) !== JSON.stringify(target.primary_key);
        return <tr key={cls.id}>
          <td><strong>{cls.name}</strong><small>{cls.id}</small></td>
          <td><select aria-label={`${cls.name} 发布操作`} disabled={locked} value={mode ?? ''} onChange={e => {
            const nextMode = e.target.value as ModelingResolution['mode'];
            onResolve(cls.id, nextMode === 'new' ? { mode: 'new', propertyMap: {} } : { ...resolution, mode: nextMode, propertyMap: map });
          }}><option value="" disabled>请选择处理方式</option><option value="new">新建对象</option><option value="reuse">复用已有对象</option><option value="extend">新增属性</option></select></td>
          <td>{mode === 'new' ? <span>新对象，发布时生成 RID</span> : <>
            <select aria-label={`${cls.name} 已有对象`} disabled={locked || !mode} value={resolution?.targetRid ?? ''} onChange={e => {
              const selected = types.find(t => t.rid === e.target.value);
              onResolve(cls.id, { mode: mode || 'reuse', targetRid: selected?.rid ?? '', propertyMap: selected ? suggestResolution(cls, selected).propertyMap : {} });
            }}><option value="">请选择已有对象</option>{types.map(t => <option key={t.rid} value={t.rid}>{t.display_name || t.rid}{matches.includes(t) ? '（匹配）' : ''}</option>)}</select>
            {resolution?.targetRid && <details><summary>查看对象标识</summary><code aria-label={`${cls.name} 目标 RID`}>{resolution.targetRid}</code>{target?.description && <p>{target.description}</p>}</details>}
          </>}</td>
          <td>
            {!mode && <p>请先选择本次操作。</p>}
            {(mode === 'reuse' || mode === 'extend') && !target && <p role="status">请选择已有对象类型。</p>}
            {mode === 'reuse' && target && <p>{unresolved.length ? `${unresolved.length} 个属性需要对应` : '属性已对应，沿用已有定义'}。</p>}
            {mode === 'extend' && target && <p>新增 {added.length} 个属性：{added.map(p => p.name).join('、') || '无'}。已有实例保留。</p>}
            {identityMismatch && <p role="alert">业务身份与已有对象主键不一致，需要核对身份；新增属性不会改变已有主键。</p>}
            {target && mode !== 'new' && <details open={unresolved.length > 0}><summary>核对属性对应</summary>{cls.properties.map(prop => <label key={prop.id} className="mp-onto-field">{prop.name}<select aria-label={`${cls.name} 发布属性 ${prop.name}`} disabled={locked} value={map[prop.id] ?? ''} onChange={e => onResolve(cls.id, { ...resolution!, propertyMap: { ...map, [prop.id]: e.target.value } })}><option value="">{mode === 'extend' ? '新增属性' : '请选择已有属性'}</option>{target.properties.map(p => <option key={p.rid} value={p.rid}>{p.title || p.rid}</option>)}</select></label>)}</details>}
            {problems.map((issue, i) => <p key={i} role="alert">{issue.message}</p>)}
            {problems.length > 0 && onEditClass && <button type="button" disabled={locked} onClick={() => onEditClass(cls.id)}>修改{cls.name}定义</button>}
          </td>
        </tr>;
      })}
    </tbody></table></div>
    {issues.filter(issue => !source.draft?.classes.some(c => c.id === issue.item)).map((issue, i) => <p key={i} role="alert">{issue.message}</p>)}
  </section>;
}
