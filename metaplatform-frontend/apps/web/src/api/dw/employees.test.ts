import axios from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });
it('preserves activation enums through wrapped list, detail and status mutation HTTP responses', async () => {
  const create = axios.create.bind(axios);
  const requests: string[] = [];
  vi.spyOn(axios, 'create').mockImplementation((config) => create({ ...config, adapter: async (request) => {
    requests.push(`${request.method} ${request.url}`);
    const employee = { employeeId: 'employee-1', status: request.data?.includes('INACTIVE') ? 'INACTIVE' : 'ACTIVE' };
    return { status: 200, statusText: 'OK', config: request, headers: {}, data: { code: 0, data: request.url === '/dw/employees' ? { items: [employee] } : employee } };
  } }));
  const api = await import('./employees');
  expect((await api.listEmployees()).items[0].status).toBe('ACTIVE');
  expect((await api.getEmployee('employee-1')).status).toBe('ACTIVE');
  expect((await api.activateEmployee('employee-1')).status).toBe('ACTIVE');
  expect((await api.deactivateEmployee('employee-1')).status).toBe('INACTIVE');
  expect(requests).toEqual(['get /dw/employees', 'get /dw/employees/employee-1', 'put /dw/employees/employee-1/status', 'put /dw/employees/employee-1/status']);
}, 20_000);
