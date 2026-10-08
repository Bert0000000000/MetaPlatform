import { describe, expect, it } from 'vitest';
import { buildNavigationIndex, DOMAINS, resolveDomain } from '@/components/shell/domains';
import { ontologyBreadcrumb, ontologyPaletteEntries, resolveOntologyNav } from './navigation';

describe('本体导航路径解析', () => {
  it('对象深链匹配最具体入口，映射面包屑可定位所属域', () => {
    expect(resolveOntologyNav('/ontology/model/object-types/ont.t.obj.customer.v1/properties')?.item?.key)
      .toBe('object-types');
    expect(ontologyBreadcrumb('/ontology/data/mappings').map(c => c.name)).toEqual(['数据接入', '对象映射']);
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
    expect(DOMAINS.find(d => d.key === 'explore')?.tabs.map(c => c.path))
      .toContain('/ontology/explore/objectset');
    const entries = ontologyPaletteEntries();
    expect(entries.find(e => e.key === 'ontology:model:graph')?.label).toBe('本体工作室 · 模型工作台');
    expect(entries.some(e => e.key.endsWith('saved-queries') || e.key.endsWith('approvals'))).toBe(false);
  });
});

describe('七入口产品归属与现有能力发现', () => {
  it.each([
    ['/home/todos', '工作台'], ['/apps/order-review', '业务应用'],
    ['/ontology/explore/objects/ont.t.obj.customer.1', '对象探索'],
    ['/ontology/explore/objectset', '对象探索'], ['/ontology/explore/analysis', '对象探索'],
    ['/ontology/explore/map', '对象探索'], ['/ontology/model/object-types/x/properties', '本体工作室'],
    ['/ontology/data/mappings', '本体工作室'], ['/ontology/logic/actions', '本体工作室'],
    ['/agents/tasks', '数字员工'], ['/ki/mcp/permissions', '连接与知识'],
    ['/admin/org/users', '治理与管理'], ['/gov/tech/components', '治理与管理'],
    ['/ontology/governance/security', '治理与管理'], ['/superai/chat/copilot', 'SuperAI'],
    ['/superai/plans/exec/x', 'SuperAI'], ['/superai/schedules', 'SuperAI'],
    ['/superai/cost', 'SuperAI'], ['/superai/templates', 'SuperAI'],
  ])('路径 %s 归属 %s', (path, label) => {
    expect(resolveDomain(path)?.label).toBe(label);
  });
  it('建设菜单没有对象探索/权限事实重复项，运行能力归组并收口模型检查', () => {
    const studio = DOMAINS.find(d => d.key === 'ontology');
    expect(studio?.tabs.map(t => t.label)).toEqual(['概览', '业务模型', '数据接入', '业务动作', '变更发布', '运行与质量']);
    expect(studio?.tabs.flatMap(t => t.children ?? []).some(t => t.path.startsWith('/ontology/explore'))).toBe(false);
    expect(studio?.tabs.flatMap(t => t.children ?? []).some(t => t.path === '/ontology/governance/security')).toBe(false);
    expect(studio?.tabs.find(t => t.label === '运行与质量')?.children?.map(t => t.path)).toEqual([
      '/ontology/data/sync', '/ontology/model/validation', '/ontology/logic/runs',
      '/ontology/governance/audit', '/ontology/governance/usage',
    ]);
    expect(resolveOntologyNav('/ontology/governance/lint')?.item?.path).toBe('/ontology/model/validation');
  });
  it('同源搜索保留 SuperAI 会话、对象探索及治理管理的全部分组', () => {
    const entries = buildNavigationIndex();
    expect(entries.find(e => e.path === '/superai/chat')).toBeDefined();
    expect(entries.find(e => e.path === '/ontology/explore/objectset')?.meta).toBe('对象探索');
    expect(entries.find(e => e.path === '/admin/org/users')?.meta).toBe('治理与管理');
    expect(entries.find(e => e.path === '/ontology/model/validation')?.meta).toBe('本体工作室');
    expect(entries.filter(e => e.path === '/ontology/model/validation')).toHaveLength(1);
    expect(resolveDomain('/ontology/explore-extra')?.label).toBe('本体工作室');
    expect(resolveDomain('/administration')).toBeUndefined();
  });
});
