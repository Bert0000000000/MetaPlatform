import { useState } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Copy,
  MoreHorizontal,
  X,
  ChevronDown,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_MCP_TOOLS } from '@/mock'; // MOCK

// MOCK: 工具列表（基于 MOCK_MCP_TOOLS 扩展的展示数据，补充类型/来源/参数/成功率等设计稿字段）
interface McpTool {
  id: string;
  name: string;
  type: 'query' | 'action' | 'compute' | 'file';
  source: 'builtin' | 'custom' | 'thirdparty';
  desc: string;
  params: number;
  calls: string;
  successRate: string;
  status: 'enabled' | 'disabled' | 'draft';
}

const MOCK_TOOLS: McpTool[] = [
  { id: 't1', name: 'ont_query_concept', type: 'query', source: 'builtin', desc: '查询本体概念及其关联关系', params: 5, calls: '23,456', successRate: '99.8%', status: 'enabled' },
  { id: 't2', name: 'rag_search', type: 'query', source: 'builtin', desc: 'RAG 向量检索与重排序', params: 3, calls: '18,902', successRate: '99.5%', status: 'enabled' },
  { id: 't3', name: 'data_export', type: 'file', source: 'custom', desc: '数据集导出为 CSV/Excel/PDF', params: 4, calls: '8,234', successRate: '97.2%', status: 'enabled' },
  { id: 't4', name: 'action_execute', type: 'action', source: 'builtin', desc: '执行预定义 Action 工作流', params: 3, calls: '6,891', successRate: '98.7%', status: 'enabled' },
  { id: 't5', name: 'graph_traverse', type: 'query', source: 'builtin', desc: '知识图谱遍历与路径查询', params: 3, calls: '3,210', successRate: '99.1%', status: 'enabled' },
  { id: 't6', name: 'metric_compute', type: 'compute', source: 'custom', desc: '指标聚合计算与统计分析', params: 4, calls: '2,567', successRate: '96.8%', status: 'enabled' },
  { id: 't7', name: 'doc_generate', type: 'file', source: 'builtin', desc: '基于模板生成业务文档', params: 3, calls: '1,024', successRate: '94.3%', status: 'disabled' },
  { id: 't8', name: 'webhook_trigger', type: 'action', source: 'thirdparty', desc: '触发外部系统 Webhook', params: 2, calls: '567', successRate: '91.5%', status: 'draft' },
];

const TYPE_BADGE: Record<McpTool['type'], { cls: string; label: string }> = {
  query: { cls: 'v-badge-query', label: '查询' },
  action: { cls: 'v-badge-action', label: '操作' },
  compute: { cls: 'v-badge-compute', label: '计算' },
  file: { cls: 'v-badge-file', label: '文件' },
};

const SOURCE_BADGE: Record<McpTool['source'], { cls: string; label: string }> = {
  builtin: { cls: 'v-badge-info', label: '内置' },
  custom: { cls: 'v-badge-neutral', label: '自定义' },
  thirdparty: { cls: 'v-badge-warning', label: '第三方' },
};

const STATUS_BADGE: Record<McpTool['status'], { cls: string; label: string; dot: string }> = {
  enabled: { cls: 'v-badge-success', label: '启用', dot: 'var(--success)' },
  disabled: { cls: 'v-badge-destructive', label: '已禁用', dot: 'var(--destructive)' },
  draft: { cls: 'v-badge-neutral', label: '草稿', dot: 'var(--muted-foreground)' },
};

const MCP_TABS: SubTabItem[] = [
  { label: '工具注册', path: '/mcp' },
  { label: 'Server 管理', path: '/mcp/server' },
  { label: 'Client 管理', path: '/mcp/client' },
  { label: '调试器', path: '/mcp/debugger' },
  { label: '权限管理', path: '/mcp/permissions' },
  { label: '外部对接', path: '/mcp/external' },
  { label: '审计日志', path: '/mcp/audit' },
];

export default function McpToolsPage() {
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string>('t1');
  const [showDetail, setShowDetail] = useState(true);

  const selectedTool = MOCK_TOOLS.find((t) => t.id === selectedId) ?? MOCK_TOOLS[0];

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>工具注册</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
            管理平台暴露的 MCP 工具，包括注册、编辑、启用/禁用工具定义。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--success-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--success)',
              }}
            >
              AI
            </div>
            <span style={{ fontSize: 13 }}>AI 助手</span>
            <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="v-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>注册工具</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>67</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>较上月 +8</div>
        </div>
        <div className="v-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>已启用</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--success)' }}>54</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>占比 80.6%</div>
        </div>
        <div className="v-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>今日调用</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>12,345</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>较昨日 +18.2%</div>
        </div>
        <div className="v-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>平均响应</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
            86<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-foreground)' }}>ms</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>P99 312ms</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="v-input" style={{ height: 32, fontSize: 13, padding: '0 28px 0 12px', cursor: 'pointer' }}>
          <option>全部状态</option>
          <option>已启用</option>
          <option>已禁用</option>
          <option>草稿</option>
        </select>
        <select className="v-input" style={{ height: 32, fontSize: 13, padding: '0 28px 0 12px', cursor: 'pointer' }}>
          <option>全部类型</option>
          <option>查询</option>
          <option>操作</option>
          <option>计算</option>
          <option>文件</option>
        </select>
        <select className="v-input" style={{ height: 32, fontSize: 13, padding: '0 28px 0 12px', cursor: 'pointer' }}>
          <option>全部来源</option>
          <option>平台内置</option>
          <option>自定义</option>
          <option>第三方</option>
        </select>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Search style={{ position: 'absolute', left: 10, width: 14, height: 14, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
          <input
            className="v-input"
            style={{ height: 32, fontSize: 13, paddingLeft: 32, width: 220 }}
            placeholder="搜索工具名或标识符..."
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="v-btn-primary">
          <Plus style={{ width: 14, height: 14 }} />
          注册工具
        </button>
      </div>

      {/* Content: Table + Detail */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['工具名', '类型', '来源', '描述', '参数', '调用/成功率', '状态', '操作'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--muted-foreground)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_TOOLS.map((tool) => {
                const typeB = TYPE_BADGE[tool.type];
                const sourceB = SOURCE_BADGE[tool.source];
                const statusB = STATUS_BADGE[tool.status];
                const isSelected = tool.id === selectedId;
                return (
                  <tr
                    key={tool.id}
                    onClick={() => { setSelectedId(tool.id); setShowDetail(true); }}
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--muted)' : undefined }}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 6px', borderRadius: 3 }}>
                        {tool.name}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${typeB.cls}`}>{typeB.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${sourceB.cls}`}>{sourceB.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tool.desc}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'center' }}>{tool.params}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 500 }}>{tool.calls}</span>
                        <span style={{ color: 'var(--muted-foreground)', marginLeft: 4 }}>{tool.successRate}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${statusB.cls}`}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusB.dot }} />
                        {statusB.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="v-btn" style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', padding: 4, cursor: 'pointer' }} title="编辑"><Pencil style={{ width: 14, height: 14 }} /></button>
                        <button className="v-btn" style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', padding: 4, cursor: 'pointer' }} title="复制"><Copy style={{ width: 14, height: 14 }} /></button>
                        <button className="v-btn" style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', padding: 4, cursor: 'pointer' }} title="更多"><MoreHorizontal style={{ width: 14, height: 14 }} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {showDetail && (
          <div className="v-card" style={{ width: 320, minWidth: 320, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>工具详情</h3>
              <button onClick={() => setShowDetail(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 20, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {/* 基本信息 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>基本信息</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>名称</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>本体概念查询</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 3 }}>标识符</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--muted)', padding: '6px 10px', borderRadius: 3, wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {selectedTool.name}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 3 }}>描述</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    查询本体引擎中的概念定义，支持按深度遍历关联关系、筛选关系类型，返回概念属性与邻接节点。
                  </div>
                </div>
              </div>

              {/* 输入参数 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>输入参数</div>
                {[
                  { name: 'conceptId', type: 'string (必填)', desc: '本体概念唯一标识符' },
                  { name: 'depth', type: 'number (可选)', desc: '关联遍历深度，默认 1，最大 5' },
                  { name: 'relations', type: 'string[] (可选)', desc: '筛选的关系类型列表' },
                ].map((p) => (
                  <div key={p.name} style={{ marginBottom: 10 }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa', fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 6 }}>{p.type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{p.desc}</div>
                  </div>
                ))}
              </div>

              {/* 输出 Schema */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>输出 Schema</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--muted)', padding: '6px 10px', borderRadius: 3, lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {'{'}<br />
                  {'  "concept": { "id", "name", "properties" },'}<br />
                  {'  "relations": [{ "type", "target" }],'}<br />
                  {'  "meta": { "depth", "totalCount" }'}<br />
                  {'}'}
                </div>
              </div>

              {/* 调用统计 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>调用统计 (7 天)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                  {[45, 62, 38, 71, 55, 80, 100].map((h, i) => (
                    <div key={i} style={{ flex: 1, background: 'var(--primary)', borderRadius: '2px 2px 0 0', minHeight: 4, height: `${h}%` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {['07/16', '07/17', '07/18', '07/19', '07/20', '07/21', '07/22'].map((d) => (
                    <span key={d} style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{d}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>7 日总调用</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>23,456</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>平均延迟</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>42ms</span>
                </div>
              </div>

              {/* 最近调用 */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>最近调用</div>
                {[
                  { source: 'SuperAI-Chat', time: '07/22 14:32:18', status: '成功', statusColor: 'var(--success)', latency: '38ms' },
                  { source: 'OntStudio-Query', time: '07/22 14:28:05', status: '成功', statusColor: 'var(--success)', latency: '51ms' },
                  { source: 'DigitalWorker-003', time: '07/22 14:15:42', status: '失败', statusColor: 'var(--destructive)', latency: '120ms' },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12 }}>{c.source}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{c.time}</span>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: c.statusColor }}>{c.status}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{c.latency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
