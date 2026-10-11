import { useEffect, useRef, useState } from 'react';
import { getOrderRuntimeData } from '@/api/apphub/runtime';

type ClientTarget = 'dsh' | 'workbuddy';
function safeEndpoint(endpoint: string): string {
  const u = new URL(endpoint);
  if (u.username || u.password || u.search || u.hash || (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))) throw new Error('端点需要 HTTPS（本机可用 HTTP），且不能包含凭据或查询参数');
  return u.href;
}
export function exportClientConfig(target: ClientTarget, endpoint: string, tenant: string): string {
  const url = safeEndpoint(endpoint);
  if (target === 'dsh') return [
    '- id: mcp-metaplatform', "  name: '@deepseek-ai/dsh-mcp-client'", '  config:',
    '    serverName: metaplatform', '    transport: streamable-http', `    url: ${JSON.stringify(url)}`,
    '    headers:', '      Authorization: !!js \'`Bearer ${process.env.METAPLATFORM_API_KEY}`\'',
    `      X-Tenant-Id: ${JSON.stringify(tenant)}`, '',
  ].join('\n');
  return JSON.stringify({ mcpServers: { metaplatform: { type: 'streamableHttp', url,
    headers: { Authorization: 'Bearer ${METAPLATFORM_API_KEY}', 'X-Tenant-Id': tenant }, timeout: 30000 } } }, null, 2);
}

export default function IdeConfigPage() {
  const [endpoint, setEndpoint] = useState(() => new URL('/api/v1/mcp/protocol/mcp', window.location.origin).href);
  const [tenant, setTenant] = useState('');
  const [key, setKey] = useState('');
  const [capability, setCapability] = useState('read');
  const [target, setTarget] = useState<ClientTarget>('dsh');
  const [appId, setAppId] = useState('');
  const [pageId, setPageId] = useState('');
  const [config, setConfig] = useState('');
  const [status, setStatus] = useState('未测试');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    generation.current += 1; active.current?.abort(); setStatus('未测试'); setBusy(false); setConfig('');
    return () => { generation.current += 1; active.current?.abort(); };
  }, [endpoint, tenant, key, capability, appId, pageId, target]);
  const generate = () => {
    try { setConfig(exportClientConfig(target, endpoint, tenant)); }
    catch (e) { setStatus((e as Error).message); }
  };
  const probe = async () => {
    const run = ++generation.current;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    let step = 'initialize'; let session = ''; let probeUrl = ''; let version = '2025-03-26';
    const timer = window.setTimeout(() => controller.abort(), 20000);
    setBusy(true); setStatus('initialize 验证中');
    try {
      if (!tenant || !key || !appId || !pageId) throw new Error('请填写工作区、Key 和已发布应用/页面');
      const url = safeEndpoint(endpoint); probeUrl = url;
      let id = 0;
      const rpc = async (method: string, params: unknown, notification = false): Promise<any> => {
        const response = await fetch(url, { method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${key}`, 'X-Tenant-Id': tenant, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
            ...(session ? { 'Mcp-Session-Id': session, 'MCP-Protocol-Version': version } : {}) },
          body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id: ++id }), method, params }) });
        if (!response.ok) throw new Error(`${step} 失败（HTTP ${response.status}）`);
        session = response.headers.get('Mcp-Session-Id') || session;
        if (notification) return;
        const body = await response.text();
        const text = response.headers.get('content-type')?.includes('text/event-stream')
          ? body.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).find(line => { try { return JSON.parse(line).id === id; } catch { return false; } }) : body;
        if (!text) throw new Error(`${step} 返回无效协议响应`);
        const packet = JSON.parse(text);
        if (packet.error || !packet.result) throw new Error(`${step} 被服务端拒绝`);
        return packet.result;
      };
      const initialized = await rpc('initialize', {protocolVersion: version, capabilities: {}, clientInfo: {name:'metaplatform-connection-check',version:'1.1.0'}});
      if (!initialized.protocolVersion) throw new Error('initialize 未返回协议版本');
      version = initialized.protocolVersion;
      await rpc('notifications/initialized', {}, true);
      step = 'tools/list'; setStatus('tools/list 验证中');
      const listing = await rpc('tools/list', {});
      if (!listing.tools?.some((t: {name: string}) => t.name === 'ont_object_query')) throw new Error('tools/list 缺少授权查询工具（需要 ont.read + platform.read）');
      if (capability === 'propose' && !listing.tools.some((t: {name: string}) => t.name === 'ont_propose_instance')) throw new Error('tools/list 缺少提议权限（需要 ont.write + platform.write）');
      step = '已发布对象'; setStatus('读取已发布对象');
      const published = await getOrderRuntimeData(appId, pageId);
      if (generation.current !== run) return;
      const iid = published.orders[0]?.rid;
      if (!published.version || !published.binding.object_type || !iid) throw new Error('已发布页面没有可核验对象，请选择有记录的页面');
      step = 'query'; setStatus('query 验证中');
      const result = await rpc('tools/call', {name:'ont_object_query', arguments:{source:published.binding.object_type, paging_limit:200}});
      if (result.isError) throw new Error('query 被服务端拒绝');
      const data = result.structuredContent ?? JSON.parse(result.content?.find((c: {type: string}) => c.type === 'text')?.text || '{}');
      if (!Array.isArray(data.rows) || !data.rows.some((row: {__rid__?: string; rid?: string; iid?: string}) => row.__rid__ === iid || row.rid === iid || row.iid === iid)) throw new Error('query 未返回同一已发布对象，不能确认连接');
      if (generation.current === run) setStatus('已连接');
    } catch (e) {
      if (generation.current === run) setStatus((e as Error).name === 'AbortError' ? `${step} 超时，请重试` : (e as Error).message.startsWith(step) ? (e as Error).message : `${step} 失败，请检查授权和已发布页面后重试`);
    } finally {
      window.clearTimeout(timer);
      if (session && probeUrl) {
        // The probe is complete; release its HTTP session without changing the result.
        void fetch(probeUrl, { method: 'DELETE', signal: AbortSignal.timeout(3000),
          headers: { Authorization: `Bearer ${key}`, 'X-Tenant-Id': tenant,
            'Mcp-Session-Id': session, 'MCP-Protocol-Version': version } }).catch(() => undefined);
      }
      if (generation.current === run) setBusy(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([config], {type: target === 'dsh' ? 'text/yaml' : 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = target === 'dsh' ? 'metaplatform-cordis.yaml' : 'mcp.json'; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="mp-p-6"><h1>Agent 配置与连接验证</h1>
    <p>dsh 原生 Cordis / WorkBuddy 官方连接器。配置仅引用 METAPLATFORM_API_KEY 环境变量；Key 仅用于本次探测。</p>
    <div className="mp-flex mp-flex-col mp-gap-3">
      <label>工作区<input aria-label="工作区" value={tenant} onChange={e => setTenant(e.target.value)} /></label>
      <label>协议端点<input aria-label="协议端点" value={endpoint} onChange={e => setEndpoint(e.target.value)} /></label>
      <label>权限<select aria-label="权限" value={capability} onChange={e => setCapability(e.target.value)}><option value="read">只读 ont.read + platform.read</option><option value="propose">查询与提议（ont.read、ont.write、platform.read、platform.write）</option></select></label>
      <label>API Key<input aria-label="API Key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
      <label>已发布应用 ID<input aria-label="已发布应用 ID" value={appId} onChange={e => setAppId(e.target.value)} /></label>
      <label>已发布页面 ID<input aria-label="已发布页面 ID" value={pageId} onChange={e => setPageId(e.target.value)} /></label>
      <label>导出目标<select value={target} onChange={e => setTarget(e.target.value as ClientTarget)}><option value="dsh">dsh Cordis 配置条目</option><option value="workbuddy">WorkBuddy 连接器 mcp.json</option></select></label>
      <div><button onClick={generate}>生成配置</button> <button disabled={busy} onClick={() => void probe()}>发现并查询</button></div>
      <p role="status">{status}</p>
      <p>提议仍需有权限的人类批准并在有效期内执行。动态/联邦工具尚无可信授权声明，外部调用不开放。真实 dsh/WorkBuddy 启动登录验收属于 1.1.1；stdio 桥尚未实现。</p>
      {config && <div><pre>{config}</pre><button onClick={download}>下载配置</button></div>}
    </div>
  </div>;
}
