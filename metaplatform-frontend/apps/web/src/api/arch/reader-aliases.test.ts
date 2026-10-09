import axios from 'axios';
import { afterEach, expect, it, vi } from 'vitest';

vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

function respondWith(responses: Record<string, unknown>) {
  const create = axios.create.bind(axios);
  vi.spyOn(axios, 'create').mockImplementation((config) => create({
    ...config,
    adapter: async (request) => {
      const response = responses[request.url ?? ''];
      if (response === undefined) throw new Error('Unexpected ARCH test route');
      return { status: 200, statusText: 'OK', config: request, headers: {}, data: response };
    },
  }));
}

it('preserves principle category fields and opaque metadata while aliasing only source sort_order', async () => {
  const category = { id: 'category-source', tenant_id: 'tenant-source', name: '源分类', code: 'CAT', sort_order: 3, metadata: { sort_order: 90, service_key: { category_id: 'opaque-key' } } };
  respondWith({ '/governance/principle-categories': { items: [category], total: 1 } });
  const api = await import('./governance');
  const result = await api.listPrincipleCategories();
  expect(result).toEqual([{ ...category, sortOrder: 3 }]);
  expect(result[0]).toHaveProperty('metadata', category.metadata);
  expect(result[0]).not.toHaveProperty('status');
}, 60_000);

it('aliases the supplied principle category identity without rewriting content or payload keys', async () => {
  const principle = { id: 'principle-source', tenant_id: 'tenant-source', name: '源原则', code: 'PR', description: '源说明', category_id: 'category-source', standards: '["source_standard"]', content: { category_id: 'business-key', inner_value: { sort_order: 7 } }, payload: { custom_field: { rule_id: 'opaque-id' } }, metadata: '{"custom_field":"literal-json"}' };
  respondWith({ '/governance/principles': { items: [principle], total: 1 } });
  const api = await import('./governance');
  const result = await api.listPrinciples();
  expect(result).toEqual([{ ...principle, categoryId: 'category-source', standards: ['source_standard'] }]);
  expect(result[0]).toHaveProperty('content', principle.content);
  expect(result[0]).toHaveProperty('payload', principle.payload);
  expect(result[0]).not.toHaveProperty('content.categoryId');
  expect(result[0]).not.toHaveProperty('status');
}, 60_000);

it('aliases a technology stack application identity while retaining the actual unpaged response and opaque keys', async () => {
  const stack = { id: 'stack-source', tenant_id: 'tenant-source', name: '源技术栈', code: 'STACK', application_id: 'app-source', component_ids: ['component-source'], metadata: { application_id: 'business-key', custom_field: { component_ids: ['opaque-id'] } }, content: '{"application_id":"literal-json"}' };
  const response = { items: [stack], total: 1, metadata: { result_count: 1 } };
  respondWith({ '/technology-stacks': response });
  const api = await import('./technologyStacks');
  const result = await api.listTechnologyStacks();
  expect(result).toEqual({ ...response, items: [{ ...stack, applicationId: 'app-source' }] });
  expect(result).toHaveProperty('items.0.metadata', stack.metadata);
  expect(result).not.toHaveProperty('items.0.metadata.applicationId');
  expect(result).not.toHaveProperty('items.0.status');
  expect(result).not.toHaveProperty('pageSize');
  expect(result).not.toHaveProperty('totalPages');
}, 60_000);

it('aliases only source change_type and rule_id without manufacturing event state or mutating business payloads', async () => {
  const event = { id: 'event-source', tenant_id: 'tenant-source', rule_id: 'rule-source', change_type: 'updated', description: '源变更说明', payload: { rule_id: 'business-rule-key', custom_field: { change_type: 'literal-value' } }, metadata: { category_id: 'metadata-key' }, content: '{"rule_id":"literal-json"}' };
  const response = { items: [event], total: 1 };
  respondWith({ '/ontology-mappings/changes': response });
  const api = await import('./ontologyMapping');
  const result = await api.listPendingChanges();
  expect(result).toEqual({ ...response, items: [{ ...event, changeType: 'updated', ruleId: 'rule-source' }] });
  expect(result).toHaveProperty('items.0.payload', event.payload);
  expect(result).not.toHaveProperty('items.0.payload.ruleId');
  expect(result).not.toHaveProperty('items.0.status');
  expect(result).not.toHaveProperty('items.0.assetId');
  expect(result).not.toHaveProperty('items.0.conceptId');
  expect(result).not.toHaveProperty('pageSize');
  expect(result).not.toHaveProperty('totalPages');
}, 60_000);
