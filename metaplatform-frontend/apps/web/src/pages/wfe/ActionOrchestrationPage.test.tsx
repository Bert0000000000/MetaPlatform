import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionOrchestrationPage from './ActionOrchestrationPage';

const {
  getNodeRegistry,
  getWorkflowDefinition,
  publishWorkflowDefinition,
  saveWorkflowDefinition,
  startWorkflowRun,
} = vi.hoisted(() => ({
  getNodeRegistry: vi.fn(),
  getWorkflowDefinition: vi.fn(),
  publishWorkflowDefinition: vi.fn(),
  saveWorkflowDefinition: vi.fn(),
  startWorkflowRun: vi.fn(),
}));

vi.mock('@/api/wfe/workflowDefinitions', () => ({
  getNodeRegistry,
  getWorkflowDefinition,
  publishWorkflowDefinition,
  saveWorkflowDefinition,
  startWorkflowRun,
}));

vi.mock('@douyinfe/semi-ui', () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading} {...props}>{children}</button>
  ),
  Card: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => <section>{title}{children}</section>,
  Checkbox: ({ children, checked, onChange, disabled }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />{children}</label>
  ),
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (value: string) => void }) => (
    <input value={value || ''} onChange={(event) => onChange?.(event.target.value)} {...props} />
  ),
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Select: ({ value, onChange, optionList }: { value?: string; onChange?: (value: string) => void; optionList?: Array<{ label: string; value: string }> }) => (
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      {optionList?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Toast: { success: vi.fn() },
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  },
}));

const definition = {
  id: 'order-review',
  name: '订单复核行动编排',
  version: 3,
  status: 'draft',
  published_version: null,
  published_at: '',
  published_by: '',
  draft_plan: {
    nodes: [
      { id: 'start', type: 'start' as const },
      { id: 'review', type: 'action' as const, action_type: 'order.review', input: { order_id: 'O-42' }, requires_confirmation: true },
      { id: 'end', type: 'end' as const },
    ],
    edges: [{ source: 'start', target: 'review' }, { source: 'review', target: 'end' }],
  },
  validation: { valid: true, issues: [] },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/wfe/action-orchestration/order-review']}>
      <Routes>
        <Route path="/wfe/action-orchestration/:definitionId" element={<ActionOrchestrationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ActionOrchestrationPage', () => {
  it('loads the server-owned definition and does not read browser storage for business state', async () => {
    const storage = vi.spyOn(Storage.prototype, 'getItem');
    getWorkflowDefinition.mockResolvedValue(definition);
    getNodeRegistry.mockResolvedValue([{ type: 'action', label: 'Action', editable_fields: [], action_types: [{ action_type: 'order.review', required_inputs: ['order_id'], requires_confirmation: true }] }]);

    renderPage();

    expect(await screen.findByText('草稿 v3')).toBeInTheDocument();
    expect(screen.getAllByText('order.review')).toHaveLength(2);
    expect(storage).not.toHaveBeenCalled();
  });

  it('saves the edited draft with the authoritative version', async () => {
    getWorkflowDefinition.mockResolvedValue(definition);
    getNodeRegistry.mockResolvedValue([]);
    saveWorkflowDefinition.mockResolvedValue({ ...definition, version: 4, name: '已更新的订单复核' });

    renderPage();
    const nameInput = await screen.findByDisplayValue('订单复核行动编排');
    fireEvent.change(nameInput, { target: { value: '已更新的订单复核' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => expect(saveWorkflowDefinition).toHaveBeenCalledWith('order-review', expect.objectContaining({
      name: '已更新的订单复核', version: 3,
    })));
    expect(await screen.findByText('草稿 v4')).toBeInTheDocument();
  });

  it('shows a conflict recovery action instead of overwriting a newer draft', async () => {
    getWorkflowDefinition.mockResolvedValue(definition);
    getNodeRegistry.mockResolvedValue([]);
    saveWorkflowDefinition.mockRejectedValue({ response: { data: { detail: { code: 'version_conflict' } } } });

    renderPage();
    await screen.findByText('草稿 v3');
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    expect(await screen.findByText('草稿已在另一处更新，请重新加载后再保存。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });
});
