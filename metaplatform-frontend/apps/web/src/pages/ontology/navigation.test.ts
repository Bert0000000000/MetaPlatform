import { describe, expect, it } from 'vitest';
import { DOMAINS } from '@/components/shell/domains';
import { ontologyBreadcrumb, ontologyPaletteEntries, resolveOntologyNav } from './navigation';

describe('本体导航路径解析', () => {
  it('对象深链匹配最具体入口，映射面包屑可定位所属域', () => {
    expect(resolveOntologyNav('/ontology/model/object-types/ont.t.obj.customer.v1/properties')?.item?.key)
      .toBe('object-types');
    expect(ontologyBreadcrumb('/ontology/data/mappings').map(c => c.name)).toEqual(['数据映射', '对象映射']);
  });
  it('总览仅匹配其正式路径和别名，未知页面不伪装为总览', () => {
    expect(resolveOntologyNav('/ontology')?.group.key).toBe('overview');
    expect(resolveOntologyNav('/ontology/overview')?.group.key).toBe('overview');
    expect(resolveOntologyNav('/ontology/not-implemented')).toBeUndefined();
    expect(resolveOntologyNav('/ontology/model/object-types-extra')).toBeUndefined();
  });
  it('兼容 tab 元数据包含真实资源入口，模型工作台作为本体入口', () => {
    const ontology = DOMAINS.find(d => d.key === 'ontology');
    expect(ontology?.path).toBe('/ontology/model/graph');
    expect(ontology?.tabs.find(t => t.key === 'model')?.children?.[0]).toMatchObject({
      label: '模型工作台', path: '/ontology/model/graph',
    });
    expect(ontology?.tabs.find(t => t.key === 'explore')?.children?.map(c => c.path))
      .toContain('/ontology/explore/objectset');
    const entries = ontologyPaletteEntries();
    expect(entries.find(e => e.key === 'ontology:model:graph')?.label).toBe('本体 · 模型工作台');
    expect(entries.some(e => e.key.endsWith('saved-queries') || e.key.endsWith('approvals'))).toBe(false);
  });
});
