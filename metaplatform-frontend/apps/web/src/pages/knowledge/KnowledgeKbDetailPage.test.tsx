import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Toast } from '@douyinfe/semi-ui';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import KnowledgeKbDetailPage from './KnowledgeKbDetailPage';

const boundary = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), kbRead: vi.fn(), docsRead: vi.fn(), chunkRead: vi.fn() }));
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
Range.prototype.getBoundingClientRect = () => new DOMRect();
URL.createObjectURL = vi.fn(() => 'blob:kb-upload-test');
URL.revokeObjectURL = vi.fn();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@mate/shared', async () => ({
  useAsync: (await import('../../../../../packages/shared/src/hooks/useAsync')).useAsync,
  useApiErrorBoundary: (await import('../../../../../packages/shared/src/hooks/useApiErrorBoundary')).useApiErrorBoundary,
}));
vi.mock('@mate/shared/api', () => ({
  apiPath: (domain: string) => `/api/v1/${domain}`,
  createApiClient: () => ({ get: boundary.get, post: boundary.post }),
}));

const rawKb = { id: 'kb-real', name: '实际知识库', description: '后台说明', document_count: 1, status: 'active', config: { kind: 'DOMAIN' } };
const rawDocument = { id: 'doc-real', collection_id: 'kb-real', filename: '真实文档.md', status: 'indexed', chunk_count: 3, size_bytes: 128 };
const rawSecondDocument = { ...rawDocument, id: 'doc-second', filename: '第二文档.md' };
const rawChunk = { chunk_id: 'chunk-real', document_id: 'doc-real', text: '实际切片内容', metadata: {} };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  boundary.kbRead.mockReset().mockResolvedValue({ data: rawKb });
  boundary.docsRead.mockReset().mockResolvedValue({ data: [rawDocument] });
  boundary.chunkRead.mockReset().mockResolvedValue({ data: [] });
  boundary.get.mockReset().mockImplementation((url: string, options?: { params?: { collection_id?: string } }) => {
    if (url.startsWith('/collections/')) return boundary.kbRead(url.slice('/collections/'.length));
    if (url === '/documents') return boundary.docsRead(options?.params?.collection_id);
    if (url.endsWith('/chunks')) return boundary.chunkRead(url);
    throw new Error(`Unexpected GET ${url}`);
  });
  boundary.post.mockReset().mockResolvedValue({ data: { document_id: 'new-doc', filename: 'new.md', size_bytes: 10, chunk_count: 1, indexed_in: ['rag'] } });
  vi.spyOn(Toast, 'success').mockReturnValue('');
  vi.spyOn(Toast, 'error').mockReturnValue('');
});
afterEach(async () => { cleanup(); await act(async () => Toast.destroyAll()); vi.restoreAllMocks(); });

function renderPage() {
  return render(<MemoryRouter initialEntries={['/ki/kb/kb-real']}><SwitchKnowledgeBase /><Routes><Route path="/ki/kb/:kbId" element={<KnowledgeKbDetailPage />} /></Routes></MemoryRouter>);
}

function SwitchKnowledgeBase() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/ki/kb/kb-next')}>切换知识库</button><button onClick={() => navigate('/ki/kb/kb-real')}>返回当前知识库</button></>;
}

function viewChunks(filename: string) {
  fireEvent.click(within(screen.getByRole('row', { name: new RegExp(filename) })).getByRole('button', { name: '查看切片' }));
}

function fileInput() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

function uploadButton() {
  return screen.getAllByRole('button', { name: '上传文档' }).find((node) => node instanceof HTMLButtonElement)!;
}

it('shows a failed KB detail read persistently and retries it without rereading successful documents', async () => {
  boundary.kbRead.mockRejectedValueOnce(new Error('知识库详情服务不可用'));
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('知识库信息读取失败');
  expect(screen.getByRole('alert')).toHaveTextContent('知识库详情服务不可用');
  expect(screen.queryByText('禁用')).toBeNull();
  expect(screen.getAllByText('未提供').length).toBeGreaterThan(0);
  expect(uploadButton()).toBeDisabled();
  await act(async () => fireEvent.change(fileInput(), { target: { files: [new File(['blocked'], 'blocked.md', { type: 'text/markdown' })] } }));
  expect(boundary.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重试知识库' }));
  expect(await screen.findByRole('heading', { name: /实际知识库/, level: 1 })).toBeVisible();
  await waitFor(() => expect(uploadButton()).toBeEnabled());
  expect(boundary.kbRead).toHaveBeenCalledTimes(2);
  expect(boundary.docsRead).toHaveBeenCalledTimes(1);
});

it('shows a document read failure instead of an empty list and retries the actual collection query', async () => {
  boundary.docsRead.mockRejectedValueOnce(new Error('文档服务不可用'));
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('文档列表读取失败');
  expect(screen.getByRole('alert')).toHaveTextContent('文档服务不可用');
  expect(screen.queryByText('暂无文档')).toBeNull();
  expect(screen.queryByText('文档列表（0）')).toBeNull();
  expect(screen.getAllByText('未提供').length).toBeGreaterThanOrEqual(2);
  const upload = uploadButton();
  expect(upload).toBeDisabled();
  await act(async () => fireEvent.change(fileInput(), { target: { files: [new File(['blocked'], 'blocked.md', { type: 'text/markdown' })] } }));
  expect(boundary.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重试文档列表' }));
  expect(await screen.findByText(rawDocument.filename)).toBeVisible();
  await waitFor(() => expect(upload).toBeEnabled());
  expect(boundary.get).toHaveBeenCalledWith('/documents', { params: { collection_id: 'kb-real' } });
  expect(boundary.docsRead).toHaveBeenCalledTimes(2);
  expect(boundary.kbRead).toHaveBeenCalledTimes(1);
});

it.each(['kb', 'documents'] as const)('blocks uploads while the initial %s read is pending and enables them after it succeeds', async (stage) => {
  const pendingKb = deferred<{ data: typeof rawKb }>();
  const pendingDocs = deferred<{ data: Array<typeof rawDocument> }>();
  if (stage === 'kb') boundary.kbRead.mockReturnValueOnce(pendingKb.promise);
  else boundary.docsRead.mockReturnValueOnce(pendingDocs.promise);
  renderPage();
  await waitFor(() => expect(boundary.get).toHaveBeenCalledTimes(2));
  expect(uploadButton()).toBeDisabled();
  if (stage === 'kb') {
    expect(screen.queryByText('禁用')).toBeNull();
    expect(screen.getAllByText('未提供').length).toBeGreaterThan(0);
  } else expect(screen.queryByText('暂无文档')).toBeNull();
  await act(async () => fireEvent.change(fileInput(), { target: { files: [new File(['blocked'], 'blocked.md', { type: 'text/markdown' })] } }));
  expect(boundary.post).not.toHaveBeenCalled();
  await act(async () => {
    if (stage === 'kb') pendingKb.resolve({ data: rawKb });
    else pendingDocs.resolve({ data: [rawDocument] });
  });
  expect(uploadButton()).toBeEnabled();
  expect(screen.getByText(rawDocument.filename)).toBeVisible();
});

it('retains the real multipart upload after both reads succeed', async () => {
  renderPage();
  await screen.findByText(rawDocument.filename);
  await waitFor(() => expect(uploadButton()).toBeEnabled());
  const file = new File(['# source'], 'new.md', { type: 'text/markdown' });
  await act(async () => fireEvent.change(fileInput(), { target: { files: [file] } }));
  await waitFor(() => expect(boundary.post).toHaveBeenCalledTimes(1));
  const [url, form, options] = boundary.post.mock.calls[0];
  expect(url).toBe('/upload');
  expect(form).toBeInstanceOf(FormData);
  expect((form.get('file') as File).name).toBe(file.name);
  expect(options.params).toEqual({ collection_id: 'kb-real' });
  await waitFor(() => expect(boundary.docsRead).toHaveBeenCalledTimes(2));
});

it('shows an empty document list only after a successful empty backend read', async () => {
  boundary.docsRead.mockResolvedValue({ data: [] });
  renderPage();
  expect(await screen.findByText('暂无文档')).toBeVisible();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('文档列表（0）')).toBeVisible();
  expect(uploadButton()).toBeEnabled();
});

it('retains a document chunk read error and explicitly retries the same document instead of caching a false empty result', async () => {
  boundary.chunkRead.mockRejectedValueOnce(new Error('切片服务不可用')).mockResolvedValueOnce({ data: [rawChunk] });
  renderPage();
  await screen.findByText(rawDocument.filename);
  viewChunks(rawDocument.filename);
  expect(await screen.findByRole('alert')).toHaveTextContent('文档切片读取失败');
  expect(screen.getByRole('alert')).toHaveTextContent('切片服务不可用');
  expect(screen.queryByText('暂无切片内容')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试文档切片' }));
  expect(await screen.findByText(rawChunk.text)).toBeVisible();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(boundary.chunkRead).toHaveBeenCalledTimes(2);
  expect(boundary.get).toHaveBeenCalledWith('/documents/doc-real/chunks', { params: { limit: 100 } });
});

it('shows an empty chunk state after the document reader successfully returns an empty array', async () => {
  renderPage();
  await screen.findByText(rawDocument.filename);
  viewChunks(rawDocument.filename);
  expect(await screen.findByText('暂无切片内容')).toBeVisible();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(boundary.chunkRead).toHaveBeenCalledTimes(1);
});

it.each(['resolve', 'reject'] as const)('keeps the selected document chunks when an obsolete document read %ss last', async (settlement) => {
  const older = deferred<{ data: Array<typeof rawChunk> }>();
  boundary.docsRead.mockResolvedValue({ data: [rawDocument, rawSecondDocument] });
  boundary.chunkRead.mockImplementation((url: string) => url.includes('/doc-real/') ? older.promise : Promise.resolve({ data: [{ ...rawChunk, chunk_id: 'chunk-second', document_id: 'doc-second', text: '第二文档的实际切片' }] }));
  renderPage();
  await screen.findByText(rawDocument.filename);
  viewChunks(rawDocument.filename);
  await waitFor(() => expect(boundary.chunkRead).toHaveBeenCalledWith('/documents/doc-real/chunks'));
  viewChunks(rawSecondDocument.filename);
  expect(await screen.findByText('第二文档的实际切片')).toBeVisible();
  await act(async () => {
    if (settlement === 'resolve') older.resolve({ data: [rawChunk] });
    else older.reject(new Error('旧文档切片失败'));
  });
  expect(screen.getByText('第二文档的实际切片')).toBeVisible();
  expect(screen.queryByText(rawChunk.text)).toBeNull();
  expect(screen.queryByText('旧文档切片失败')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('clears the active document and rejects an obsolete chunk response across knowledge base switches', async () => {
  const older = deferred<{ data: Array<typeof rawChunk> }>();
  boundary.kbRead.mockImplementation((id: string) => Promise.resolve({ data: { ...rawKb, id, name: id === 'kb-real' ? rawKb.name : '第二知识库' } }));
  boundary.docsRead.mockImplementation((id: string) => Promise.resolve({ data: id === 'kb-real' ? [rawDocument] : [{ ...rawSecondDocument, collection_id: id }] }));
  boundary.chunkRead.mockReturnValueOnce(older.promise).mockResolvedValue({ data: [{ ...rawChunk, text: '重新读取的实际切片' }] });
  renderPage();
  await screen.findByText(rawDocument.filename);
  viewChunks(rawDocument.filename);
  await waitFor(() => expect(boundary.chunkRead).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '切换知识库' }));
  await screen.findByText(rawSecondDocument.filename);
  await act(async () => older.resolve({ data: [rawChunk] }));
  expect(screen.queryByText(rawChunk.text)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回当前知识库' }));
  await screen.findByText(rawDocument.filename);
  expect(screen.queryByText(rawChunk.text)).toBeNull();
  expect(screen.queryByRole('button', { name: '收起切片' })).toBeNull();
  viewChunks(rawDocument.filename);
  expect(await screen.findByText('重新读取的实际切片')).toBeVisible();
  expect(boundary.chunkRead).toHaveBeenCalledTimes(2);
});
