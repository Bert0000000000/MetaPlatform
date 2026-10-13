import { cleanup, act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IdeConfigPage, { exportClientConfig } from './IdeConfigPage';
vi.mock('@/api/apphub/runtime', () => ({ getOrderRuntimeData: vi.fn().mockResolvedValue({ version: 'published-v1', binding: { object_type: 'ont.t.obj.order' }, orders: [{ rid: 'ont.t.ind.order.1' }] }) }));
import { getOrderRuntimeData } from '@/api/apphub/runtime';
afterEach(cleanup);
beforeEach(() => { vi.restoreAllMocks(); vi.mocked(getOrderRuntimeData).mockResolvedValue({ version: 'published-v1', binding: { object_type: 'ont.t.obj.order' }, orders: [{ rid: 'ont.t.ind.order.1' }] } as any); });
describe('Agent client preparation', () => {
  it('exports native transports with environment credentials only', () => {
    const dsh = exportClientConfig('dsh', 'https://example.test/api/v1/mcp/protocol/mcp', 't');
    expect(dsh).toContain('@deepseek-ai/dsh-mcp-client');
    expect(dsh).toContain('transport: streamable-http');
    expect(dsh).toContain('process.env.METAPLATFORM_API_KEY');
    const buddy = JSON.parse(exportClientConfig('workbuddy', 'https://example.test/api/v1/mcp/protocol/mcp', 't'));
    expect(buddy.mcpServers.metaplatform.type).toBe('streamableHttp');
    expect(buddy.mcpServers.metaplatform.headers.Authorization).toBe('Bearer ${METAPLATFORM_API_KEY}');
  });
  it('rejects credential-bearing endpoints from export', () => {
    expect(() => exportClientConfig('dsh', 'https://u:p@example.test/mcp', 't')).toThrow();
    expect(() => exportClientConfig('workbuddy', 'https://example.test/mcp?token=secret', 't')).toThrow();
  });
  it('requires actual initialize/list/query; resets on workspace change and retries failures', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const response = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', result }), { headers: { 'content-type': 'application/json' } });
    fetcher.mockResolvedValueOnce(new Response('', { status: 401 }));
    render(<IdeConfigPage />);
    for (const [label,value] of [['工作区','t'],['API Key','local-test-key'],['已发布应用 ID','app'],['已发布页面 ID','page']]) fireEvent.change(screen.getByLabelText(label), {target:{value}});
    fireEvent.click(screen.getByRole('button', {name:'发现并查询'}));
    await screen.findByText('initialize 失败（HTTP 401）');
    expect(screen.queryByText('已连接')).toBeNull();
    fetcher.mockResolvedValueOnce(response({protocolVersion:'2025-03-26'})).mockResolvedValueOnce(new Response(null,{status:202})).mockResolvedValueOnce(response({tools:[{name:'ont_object_query'}]})).mockResolvedValueOnce(response({content:[{type:'text',text:JSON.stringify({rows:[{__rid__:'ont.t.ind.order.1'}]})}]}));
    fireEvent.click(screen.getByRole('button', {name:'发现并查询'}));
    await screen.findByText('已连接');
    fireEvent.change(screen.getByLabelText('工作区'), {target:{value:'other'}});
    await waitFor(() => expect(screen.queryByText('已连接')).toBeNull());
  });
});


it('does not restore stale progress after workspace changes during published-object loading', async () => {
  let finish!: (value: any) => void;
  vi.mocked(getOrderRuntimeData).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const response = (result: unknown) => new Response(JSON.stringify({jsonrpc:'2.0',result}), {headers:{'content-type':'application/json'}});
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response({protocolVersion:'2025-03-26'}))
    .mockResolvedValueOnce(new Response(null,{status:202}))
    .mockResolvedValueOnce(response({tools:[{name:'ont_object_query'}]}));
  render(<IdeConfigPage />);
  for (const [label,value] of [['工作区','t'],['API Key','local-test-key'],['已发布应用 ID','app'],['已发布页面 ID','page']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:'发现并查询'}));
  await screen.findByText('读取已发布对象');
  fireEvent.change(screen.getByLabelText('工作区'),{target:{value:'other'}});
  await act(async () => { finish({version:'v1',binding:{object_type:'ont.t.obj.order'},orders:[{rid:'ont.t.ind.order.1'}]}); });
  expect(screen.getByRole('status').textContent).toBe('未测试');
});
