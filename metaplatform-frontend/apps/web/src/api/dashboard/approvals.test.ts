import axios from 'axios';
import { afterEach, expect, it, vi } from 'vitest';

vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.mock('@mate/shared', () => ({ getUser: () => ({ id: 'current-user' }) }));
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

it('preserves the canonical dashboard approval id and rejected status through pending and completed reads', async () => {
  const create = axios.create.bind(axios);
  const requests: string[] = [];
  const pending = { taskId: 'approval-source-1', title: '源审批', applicantId: 'applicant-source', applicant: '申请人', flowName: 'flow-source', priority: 'medium', status: 'pending', createdAt: '2026-07-30T12:00:00Z', completedAt: null };
  const rejected = { ...pending, taskId: 'approval-source-2', status: 'rejected', completedAt: '2026-07-30T13:00:00Z' };
  vi.spyOn(axios, 'create').mockImplementation((config) => create({ ...config, adapter: async (request) => {
    requests.push(`${request.method} ${request.url}`);
    const payload = request.url === '/todos/done' ? rejected : pending;
    return { status: 200, statusText: 'OK', config: request, headers: {}, data: { items: [payload], total: 1, page: 1, pageSize: 20, totalPages: 1 } };
  } }));
  const api = await import('./approvals');
  expect((await api.getPendingTasks()).items[0]).toEqual(pending);
  expect((await api.getCompletedTasks()).items[0]).toEqual(rejected);
  await api.completeTask('approval-source-1', 'approve', '通过');
  expect(requests).toEqual(['get /todos', 'get /todos/done', 'post /todos/approval-source-1/action']);
}, 20_000);
