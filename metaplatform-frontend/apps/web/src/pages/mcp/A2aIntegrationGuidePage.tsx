import { useEffect, useState } from 'react';
import { Card, Space, Tag, Typography, Table } from '@douyinfe/semi-ui';
import { createApiClient, apiPath } from '@mate/shared/api';
import { searchAgentCards, type ExternalAgent as A2ACard } from '@/api/dw/a2a';
import { listExternalAgents as listMcpExternalAgents } from '@/api/mcphub/external-agents';

const GATEWAY = 'http://localhost:8100';

/** A2A 注册中心 — 接入说明：外部 Agent / MCP / CLI 的注册与服务发现指南。 */
export default function A2aIntegrationGuidePage() {
  const [internalCount, setInternalCount] = useState<number | null>(null);
  const [externalCount, setExternalCount] = useState<number | null>(null);
  const [roleCount, setRoleCount] = useState<number | null>(null);
  const [roles, setRoles] = useState<Array<{ role: string; name: string; worker: string }>>([]);

  useEffect(() => {
    searchAgentCards()
      .then((cards) => {
        const list = cards as A2ACard[];
        setInternalCount(list.filter((c) => c.source === 'internal').length);
        setExternalCount(list.filter((c) => c.source === 'external').length);
      })
      .catch(() => undefined);
    listMcpExternalAgents({ page: 1, size: 1 })
      .then((res) => {
        if (res && typeof res.total === 'number') setExternalCount((prev) => prev ?? res.total);
      })
      .catch(() => undefined);
    createApiClient({ baseURL: apiPath('orchestrator', '') })
      .get('/roles')
      .then((resp) => {
        const items = resp.data?.items ?? [];
        setRoleCount(items.length);
        setRoles(
          items.map((r: { role: string; name?: string; capabilities?: Array<{ name: string; worker_kind: string }> }) => ({
            role: r.role,
            name: r.name || r.role,
            worker: (r.capabilities ?? []).map((c) => c.worker_kind).join(', ') || '-',
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const roleColumns = [
    { title: '角色 slug', dataIndex: 'role', width: 160, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: 'Worker 类型', dataIndex: 'worker' },
  ];

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          A2A 接入说明
        </Typography.Title>
        <Typography.Text type="tertiary">外部 Agent / MCP / CLI 的注册与服务发现指南</Typography.Text>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Stat label="内部数字员工" value={internalCount} />
        <Stat label="外部 Agent" value={externalCount} />
        <Stat label="编排角色" value={roleCount} />
      </Space>

      <Card title="1 · 服务发现（Service Discovery）" style={{ marginBottom: 16 }}>
        <Typography.Paragraph>
          任何外部 Agent / MCP 客户端 / CLI 先通过 A2A 注册中心的发现端点查询可协作的 Agent 卡片（内部数字员工 + 外部联邦 Agent 合并返回）。
        </Typography.Paragraph>        <EndpointRow method="GET" path="/api/v1/a2a/agent-cards/search" desc="发现 Agent 卡片（含 source: internal/external、role、capabilities）" />
        <CodeBlock lang="bash" code={`curl -s "${GATEWAY}/api/v1/a2a/agent-cards/search" \\
  -H "Authorization: Bearer $TOKEN"
# → {"items":[{"id":"agent-recon","name":"Finance Recon Bot","source":"internal","role":"","capabilities":[]}, ...],"total":N}`} />
        <EndpointRow method="GET" path="/api/v1/orchestrator/roles" desc="列出可被 SuperAI 调度的数字员工角色" />
      </Card>

      <Card title="2 · 外部 Agent 注册（A2A / MCP / BOTH）" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Tag color="green">A2A</Tag> 外部 Agent 直接注册到 A2A 注册中心；<Tag color="purple">MCP</Tag>{' '}
          走 MCP 服务中心目录；两者都要可在 SuperAI 调度里被发现，建议同时在编排层注册角色。
        </div>
        <EndpointRow method="POST" path="/api/v1/a2a/register" desc="注册外部 A2A Agent（name / endpoint / capabilities）" />
        <CodeBlock lang="bash" code={`curl -s -X POST "${GATEWAY}/api/v1/a2a/register" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"name":"外部对账 Agent","endpoint":"https://agent.example.com/a2a","capabilities":["reconcile","report"]}'
# → {"agent_id":"ext-xxxxx"}`} />
        <EndpointRow method="POST" path="/api/v1/mcp/external-agents" desc="注册到 MCP 服务中心目录（protocolType: MCP / A2A / BOTH）" />
        <EndpointRow method="POST" path="/api/v1/orchestrator/roles" desc="把数字员工角色绑定到 worker（a2a→agent id / mcp→tool / local）" />
        <CodeBlock lang="bash" code={`curl -s -X POST "${GATEWAY}/api/v1/orchestrator/roles" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"role":"workflow","name":"Workflow Employee","capabilities":[{"name":"delegate_run","worker_kind":"a2a","ref":"agent-recon"}]}'`} />
        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>当前编排角色：</Typography.Text>
        </div>
        <Table rowKey="role" columns={roleColumns} dataSource={roles} pagination={false} size="small" style={{ marginTop: 8 }} />
      </Card>

      <Card title="3 · 委派与任务（Delegation）" style={{ marginBottom: 16 }}>
        <Typography.Paragraph>
          SuperAI 对话调度走 <code>/api/v1/copilot/chat/agent/stream</code>（LLM 自主决策 → orchestrator dispatch）。
          外部系统也可直接委派：W3C 消息异步建任务（<code>/messages</code>）或同步执行（<code>/execute</code>）。
        </Typography.Paragraph>
        <EndpointRow method="POST" path="/api/v1/copilot/chat/agent/stream" desc="SuperAI 对话调度数字员工（SSE 事件流）" />
        <EndpointRow method="POST" path="/api/v1/a2a/execute" desc="同步委派并返回真实结果（completed/failed/timeout + result）" />
        <CodeBlock lang="bash" code={`curl -s -N -X POST "${GATEWAY}/api/v1/copilot/chat/agent/stream" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"请调度 workflow 员工处理对账单"}]}'
# → data: {"type":"reasoning","text":"正在分析任务并选择数字员工…"}
# → data: {"type":"tool_call","callId":"...","tool":"dispatch_employee","args":{...}}
# → data: {"type":"tool_result","callId":"...","status":"success","result":{"status":"completed",...}}
# → data: {"choices":[{"delta":{"content":"已调度 workflow..."}}]}  data: [DONE]`} />
        <EndpointRow method="POST" path="/api/v1/a2a/messages" desc="W3C A2A 消息（异步建任务）" />
        <EndpointRow method="GET" path="/api/v1/a2a/tasks/{task_id}" desc="查询任务状态（含 result artifacts）" />
      </Card>

      <Card title="4 · CLI 快速接入" style={{ marginBottom: 16 }}>
        <CodeBlock lang="bash" code={`# 1. 获取 token（管理员）
TOKEN=$(curl -s -X POST "${GATEWAY}/api/v1/iam/auth/login" -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

# 2. 发现可协作的 Agent
curl -s "${GATEWAY}/api/v1/a2a/agent-cards/search" -H "Authorization: Bearer $TOKEN"

# 3. 注册一个外部 Agent
curl -s -X POST "${GATEWAY}/api/v1/a2a/register" -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" -d '{"name":"CLI Agent","endpoint":"https://...","capabilities":["run"]}'

# 4. 通过 SuperAI 对话调度（SSE）
curl -s -N -X POST "${GATEWAY}/api/v1/copilot/chat/agent/stream" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"请调度 ... 完成 ..."}]}'`} />
      </Card>

      <Card title="5 · 接入清单">
        <div>
          <Space vertical align="start" spacing="medium">
            <span>☐ 在 A2A 注册中心注册外部 Agent（<code>POST /a2a/register</code>）</span>
            <span>☐ 在编排层注册数字员工角色（<code>POST /orchestrator/roles</code>，a2a→agent id / mcp→tool / local）</span>
            <span>☐ 用 <code>GET /a2a/agent-cards/search</code> 确认被发现</span>
            <span>☐ 用 <code>POST /a2a/execute</code> 或 SuperAI 对话验证委派链路</span>
            <span>☐ 用 <code>GET /a2a/tasks/&#123;id&#125;</code> 确认任务结果</span>
          </Space>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <Card bodyStyle={{ padding: '8px 20px' }}>
      <Space vertical spacing={0} align="center">
        <Typography.Text type="tertiary" style={{ fontSize: 12 }}>{label}</Typography.Text>
        <Typography.Text strong style={{ fontSize: 22 }}>{value ?? '—'}</Typography.Text>
      </Space>
    </Card>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === 'GET' ? 'green' : method === 'POST' ? 'blue' : 'orange';
  return (
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
      <Tag color={color}>{method}</Tag>
      <code>{path}</code>
      <Typography.Text type="tertiary">{desc}</Typography.Text>
    </div>
  );
}

function CodeBlock({ code }: { code: string; lang?: string }) {
  return (
    <pre style={codeStyle}>
      <code>{code}</code>
    </pre>
  );
}

const codeStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 320,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};
