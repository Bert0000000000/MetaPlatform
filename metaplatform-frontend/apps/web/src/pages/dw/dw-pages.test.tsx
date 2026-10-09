import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { SelectProps } from '@douyinfe/semi-ui/lib/es/select';
import { HttpError } from '../../../../../packages/shared/src/api/types';
import ExtractionPage from './ExtractionPage';
import CollaborationsPage from './CollaborationsPage';
import LearningPage from './LearningPage';
import ObsPage from './ObsPage';
import * as extraction from '@/api/dw/extraction';
import * as collaborations from '@/api/dw/collaborations';
import * as learning from '@/api/dw/learning';
import * as employees from '@/api/dw/employees';
import * as obs from '@/api/dw/obs';

vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
// jsdom does not lay out SemiUI popup motion; use a native select for input events.
vi.mock('@douyinfe/semi-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@douyinfe/semi-ui')>();
  return {
    ...actual,
    Select: ({ value, optionList = [], onChange, disabled, 'aria-labelledby': labelId }: SelectProps) => (
      <select aria-labelledby={labelId} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange?.(event.currentTarget.value)}>
        <option value="">选择数字员工</option>
        {optionList.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
      </select>
    ),
  };
});
vi.mock('@/api/dw/extraction', () => ({ getExtractionsByEmployee: vi.fn() }));
vi.mock('@/api/dw/collaborations', () => ({ listCollaborations: vi.fn(), listCollaborationSessions: vi.fn() }));
vi.mock('@/api/dw/learning', () => ({ listKnowledge: vi.fn(), promoteFeedback: vi.fn() }));
vi.mock('@/api/dw/employees', () => ({ listEmployees: vi.fn() }));
vi.mock('@/api/dw/obs', () => ({ getTraceSpans: vi.fn(), listTraces: vi.fn() }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

// Fixtures reflect DW's current serialized records after the shared camelCase aliases.
it('shows extraction record source, employee and fact count without inventing reviewed concept fields', async () => {
  vi.mocked(extraction.getExtractionsByEmployee).mockResolvedValue([
    { id: 'extract-1', tenantId: 'tenant-default', employeeId: 'employee-source', source: 'document', sourceId: 'source-document', extractedFacts: 12, extractedAt: '2026-07-30T12:00:00Z' },
  ] as never);
  render(<ExtractionPage />);
  expect(await screen.findByText('source-document')).toBeVisible();
  expect(screen.getByText('employee-source')).toBeVisible();
  expect(screen.getByText('12')).toBeVisible();
  expect(screen.queryByText('待审核')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: '置信度' })).toBeNull();
});

it('shows the source collaboration session rather than treating it as a split task', async () => {
  const page = { items: [{ id: 'collab-1', tenantId: 'tenant-default', employeeId: 'employee-one', peerEmployeeId: 'employee-two', sessionId: 'source-session', startedAt: '2026-07-30T12:00:00Z', durationMs: 1200 }], total: 1, page: 1, pageSize: 20, totalPages: 1 };
  vi.mocked(collaborations.listCollaborations).mockResolvedValue(page as never);
  vi.mocked(collaborations.listCollaborationSessions).mockResolvedValue(page);
  render(<CollaborationsPage />);
  expect(await screen.findByText('source-session')).toBeVisible();
  expect(screen.getByText('employee-one')).toBeVisible();
  expect(screen.getByText('employee-two')).toBeVisible();
  expect(screen.queryByRole('columnheader', { name: '拆分策略' })).toBeNull();
});

it('reads the declared trace overview endpoint instead of fabricating a latest span identifier', async () => {
  vi.mocked(obs.getTraceSpans).mockResolvedValue([]);
  vi.mocked(obs.listTraces).mockResolvedValue({ items: [{ id: 'trace-row-1', tenantId: 'tenant-default', employeeId: 'employee-one', traceId: 'source-trace', spanCount: 4, status: 'ok', durationMs: 125, startedAt: '2026-07-30T12:00:00Z' }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
  render(<ObsPage />);
  expect(await screen.findByText('source-trace')).toBeVisible();
  expect(screen.getByText('employee-one')).toBeVisible();
  expect(screen.getByText('4')).toBeVisible();
  expect(obs.getTraceSpans).not.toHaveBeenCalled();
});

const employee = { employeeId: 'employee-selected', name: '可选员工', code: 'EMP-1', roleCategory: 'CUSTOM', roleIdentity: 'custom', description: '', status: 'ACTIVE', capability: { model: '', temperature: 0.7, maxTokens: 4096, topP: 0.9, systemPrompt: '', tools: [], actionRids: [], ragKnowledgeBaseIds: [], retrievalMethod: 'hybrid', topK: 5, rerank: true } };

async function selectEmployee(id: string, name: string) {
  await screen.findByRole('option', { name });
  fireEvent.change(screen.getByRole('combobox', { name: '数字员工' }), { target: { value: id } });
}

it('waits for an employee selection before reading employee-scoped knowledge', async () => {
  vi.mocked(employees.listEmployees).mockResolvedValue({ items: [employee], total: 1, page: 1, pageSize: 20, totalPages: 1 } as never);
  vi.mocked(learning.listKnowledge).mockResolvedValue({ items: [] });
  render(<MemoryRouter><LearningPage /></MemoryRouter>);
  expect(await screen.findByText('请选择数字员工')).toBeVisible();
  expect(learning.listKnowledge).not.toHaveBeenCalled();
  await selectEmployee(employee.employeeId, employee.name);
  await waitFor(() => expect(learning.listKnowledge).toHaveBeenCalledWith('employee-selected'));
  expect(await screen.findByText('暂无学习沉淀')).toBeVisible();
});

it('keeps a real knowledge request failure visible after employee selection', async () => {
  vi.mocked(employees.listEmployees).mockResolvedValue({ items: [employee], total: 1, page: 1, pageSize: 20, totalPages: 1 } as never);
  vi.mocked(learning.listKnowledge).mockRejectedValue(new Error('员工知识请求失败'));
  render(<MemoryRouter><LearningPage /></MemoryRouter>);
  await screen.findByText('请选择数字员工');
  await selectEmployee(employee.employeeId, employee.name);
  expect(await screen.findByText('员工知识请求失败')).toBeVisible();
  expect(screen.queryByText('暂无学习沉淀')).toBeNull();
});

it('keeps knowledge scoped to the selected employee when an earlier request finishes late', async () => {
  const secondEmployee = { ...employee, employeeId: 'employee-second', name: '第二员工' };
  const firstKnowledge = { knowledgeId: 'knowledge-first', employeeId: employee.employeeId, knowledgeType: 'prompt_fragment', title: '第一员工知识', content: '源知识片段', sourceFeedbackIds: [], taskPattern: '', tags: [], confidence: 0.9, syncedToKb: false, createdAt: '2026-07-30T12:00:00Z', updatedAt: '2026-07-30T12:00:00Z' };
  const secondKnowledge = { ...firstKnowledge, knowledgeId: 'knowledge-second', employeeId: secondEmployee.employeeId, title: '第二员工知识' };
  vi.mocked(employees.listEmployees).mockResolvedValue({ items: [employee, secondEmployee], total: 2, page: 1, pageSize: 20, totalPages: 1 } as never);
  let finishFirst!: (value: Awaited<ReturnType<typeof learning.listKnowledge>>) => void;
  vi.mocked(learning.listKnowledge).mockImplementation((id) => id === employee.employeeId
    ? new Promise((resolve) => { finishFirst = resolve; })
    : Promise.resolve({ items: [secondKnowledge] } as never));
  render(<MemoryRouter><LearningPage /></MemoryRouter>);
  await screen.findByText('请选择数字员工');
  await selectEmployee(employee.employeeId, employee.name);
  await waitFor(() => expect(learning.listKnowledge).toHaveBeenCalledWith(employee.employeeId));
  await selectEmployee(secondEmployee.employeeId, secondEmployee.name);
  expect(await screen.findByText('第二员工知识')).toBeVisible();
  await act(async () => { finishFirst({ items: [firstKnowledge] } as never); });
  expect(screen.queryByText('第一员工知识')).toBeNull();
  expect(screen.getByText('第二员工知识')).toBeVisible();
});

const allEmployees = Array.from({ length: 21 }, (_, index) => ({
  ...employee, employeeId: `employee-${index + 1}`, name: `第${index + 1}名员工`,
}));

it('loads all employee pages and lets the twenty-first employee read their own knowledge', async () => {
  vi.mocked(employees.listEmployees)
    .mockResolvedValueOnce({ items: allEmployees.slice(0, 20), total: 21, page: 1, pageSize: 20, totalPages: 2 } as never)
    .mockResolvedValueOnce({ items: allEmployees.slice(20), total: 21, page: 2, pageSize: 20, totalPages: 2 } as never);
  const lastEmployee = allEmployees[20];
  vi.mocked(learning.listKnowledge).mockResolvedValue({ items: [{
    knowledgeId: 'knowledge-page-two', employeeId: lastEmployee.employeeId,
    knowledgeType: 'experience', title: '后页员工知识', content: '来源片段', sourceFeedbackIds: [],
    taskPattern: '', tags: [], confidence: 0.9, syncedToKb: false,
    createdAt: '2026-07-30T12:00:00Z', updatedAt: '2026-07-30T12:00:00Z',
  }] });
  render(<MemoryRouter><LearningPage /></MemoryRouter>);

  await selectEmployee(lastEmployee.employeeId, lastEmployee.name);

  expect(await screen.findByText('后页员工知识')).toBeVisible();
  expect(employees.listEmployees).toHaveBeenNthCalledWith(1, { page: 1, size: 20 });
  expect(employees.listEmployees).toHaveBeenNthCalledWith(2, { page: 2, size: 20 });
  expect(learning.listKnowledge).toHaveBeenCalledExactlyOnceWith(lastEmployee.employeeId);
  expect(screen.getAllByRole('option')).toHaveLength(22);
  expect(screen.getByRole('button', { name: '提升至知识库' })).toBeDisabled();
});

it('does not publish a partial employee selector when a later page is denied, and retries the full read', async () => {
  const firstPage = { items: allEmployees.slice(0, 20), total: 21, page: 1, pageSize: 20, totalPages: 2 };
  const secondPage = { items: allEmployees.slice(20), total: 21, page: 2, pageSize: 20, totalPages: 2 };
  vi.mocked(employees.listEmployees).mockResolvedValueOnce(firstPage as never)
    .mockRejectedValueOnce(new HttpError(403, '后页员工无权读取'))
    .mockResolvedValueOnce(firstPage as never).mockResolvedValueOnce(secondPage as never);
  render(<MemoryRouter><LearningPage /></MemoryRouter>);

  expect(await screen.findByText('后页员工无权读取')).toBeVisible();
  expect(screen.getByRole('combobox', { name: '数字员工' })).toBeDisabled();
  expect(screen.queryByRole('option', { name: allEmployees[0].name })).not.toBeInTheDocument();
  expect(learning.listKnowledge).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试' })); });

  expect(await screen.findByRole('option', { name: allEmployees[20].name })).toBeVisible();
  expect(screen.getByRole('combobox', { name: '数字员工' })).toBeEnabled();
  expect(employees.listEmployees).toHaveBeenNthCalledWith(3, { page: 1, size: 20 });
  expect(employees.listEmployees).toHaveBeenNthCalledWith(4, { page: 2, size: 20 });
  expect(learning.listKnowledge).not.toHaveBeenCalled();
});

it('stops a pending multi-page employee read after unmount instead of starting the next page', async () => {
  let finishSecond!: (page: Awaited<ReturnType<typeof employees.listEmployees>>) => void;
  vi.mocked(employees.listEmployees)
    .mockResolvedValueOnce({ items: allEmployees.slice(0, 20), total: 41, page: 1, pageSize: 20, totalPages: 3 } as never)
    .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
  const page = render(<MemoryRouter><LearningPage /></MemoryRouter>);
  await waitFor(() => expect(employees.listEmployees).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('option', { name: allEmployees[0].name })).not.toBeInTheDocument();
  page.unmount();
  await act(async () => { finishSecond({
    items: allEmployees.slice(0, 20), total: 41, page: 2, pageSize: 20, totalPages: 3,
  } as never); });

  expect(employees.listEmployees).toHaveBeenCalledTimes(2);
  expect(learning.listKnowledge).not.toHaveBeenCalled();
});
