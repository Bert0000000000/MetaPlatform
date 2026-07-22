import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Row,
  Col,
  Tabs,
  List,
  Checkbox,
  Badge,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { listTools } from '@/api/tools';
import { listServers } from '@/api/servers';
import {
  executeDebug,
  listDebugHistory,
  replayDebugSession,
  compareDebugSessions,
} from '@/api/debug';
import ParameterForm from '@/components/ParameterForm';
import type { McpDebugSession, McpServer, McpTool, McpDebugCompareResult } from '@/types';

const METHOD_OPTIONS = [
  { label: 'tools/call', value: 'tools/call' },
  { label: 'tools/list', value: 'tools/list' },
  { label: 'resources/list', value: 'resources/list' },
  { label: 'resources/read', value: 'resources/read' },
  { label: 'prompts/list', value: 'prompts/list' },
  { label: 'initialize', value: 'initialize' },
];

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'success',
  FAILED: 'error',
  BREAKPOINT: 'warning',
};

export default function DebuggerPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  const [selectedServerId, setSelectedServerId] = useState<string>();
  const [selectedToolId, setSelectedToolId] = useState<string>();
  const [method, setMethod] = useState('tools/call');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [requestText, setRequestText] = useState('');
  const [breakpoint, setBreakpoint] = useState(false);

  const [executing, setExecuting] = useState(false);
  const [currentSession, setCurrentSession] = useState<McpDebugSession>();

  const [history, setHistory] = useState<McpDebugSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<McpDebugCompareResult>();

  const [activeTab, setActiveTab] = useState('result');

  useEffect(() => {
    setLoadingResources(true);
    Promise.all([listServers(), listTools()])
      .then(([s, t]) => {
        setServers(s.items);
        setTools(t.items);
      })
      .finally(() => setLoadingResources(false));
    loadHistory();
  }, []);

  const selectedServer = useMemo(
    () => servers.find((s) => s.id === selectedServerId),
    [servers, selectedServerId],
  );
  const selectedTool = useMemo(
    () => tools.find((t) => t.id === selectedToolId),
    [tools, selectedToolId],
  );

  const displayedTools = useMemo(() => {
    if (!selectedServerId) return tools;
    return tools.filter((t) => t.serverId === selectedServerId);
  }, [tools, selectedServerId]);

  useEffect(() => {
    setRequestText(JSON.stringify(buildRequestPayload(method, selectedTool, params), null, 2));
  }, [method, selectedTool, params]);

  const loadHistory = () => {
    setHistoryLoading(true);
    listDebugHistory({ page: 1, size: 50 })
      .then((res) => setHistory(res.items))
      .finally(() => setHistoryLoading(false));
  };

  const buildRequestPayload = (
    m: string,
    tool: McpTool | undefined,
    p: Record<string, unknown>,
  ): Record<string, unknown> => {
    const base = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: m,
    };
    switch (m) {
      case 'tools/call':
        return {
          ...base,
          params: {
            name: tool?.code ?? '',
            arguments: p,
          },
        };
      case 'resources/read':
        return { ...base, params: { uri: '' } };
      case 'initialize':
        return {
          ...base,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'mcphub-debugger', version: '0.1.0' },
          },
        };
      default:
        return { ...base, params: {} };
    }
  };

  const handleServerClick = (server: McpServer) => {
    setSelectedServerId(server.id);
    setSelectedToolId(undefined);
    setMethod('tools/list');
    setParams({});
  };

  const handleToolClick = (tool: McpTool) => {
    setSelectedToolId(tool.id);
    setSelectedServerId(tool.serverId);
    setMethod('tools/call');
    setParams({});
  };

  const handleParamsChange = (next: Record<string, unknown>) => {
    setParams(next);
  };

  const handleEditorChange = (value?: string) => {
    const text = value ?? '';
    setRequestText(text);
    try {
      const parsed = JSON.parse(text);
      if (method === 'tools/call' && parsed.params?.arguments) {
        setParams(parsed.params.arguments as Record<string, unknown>);
      }
    } catch {
      // ignore partial edits
    }
  };

  const handleExecute = async () => {
    let requestPayload: Record<string, unknown>;
    try {
      requestPayload = JSON.parse(requestText);
    } catch {
      message.warning('请求 JSON 格式不正确');
      return;
    }
    if (method === 'tools/call' && !selectedTool) {
      message.warning('请先选择工具');
      return;
    }
    setExecuting(true);
    try {
      const session = await executeDebug({
        serverId: selectedServerId,
        toolId: selectedToolId,
        requestPayload,
        breakpoint,
      });
      setCurrentSession(session);
      setActiveTab(session.status === 'BREAKPOINT' ? 'info' : 'result');
      loadHistory();
    } finally {
      setExecuting(false);
    }
  };

  const handleReplay = async (id: string) => {
    setExecuting(true);
    try {
      const session = await replayDebugSession(id);
      setCurrentSession(session);
      setActiveTab('result');
      loadHistory();
    } finally {
      setExecuting(false);
    }
  };

  const handleHistorySelect = (id: string, checked: boolean) => {
    const next = checked
      ? [...selectedHistoryIds, id].slice(-2)
      : selectedHistoryIds.filter((x) => x !== id);
    setSelectedHistoryIds(next);
    if (next.length === 2) {
      compareDebugSessions(next[0], next[1]).then((res) => {
        setCompareResult(res);
        setActiveTab('compare');
      });
    } else {
      setCompareResult(undefined);
    }
  };

  const formatJson = (value: unknown) => JSON.stringify(value, null, 2) ?? '';

  const tabItems = [
    {
      key: 'result',
      label: (
        <span>
          <CodeOutlined /> 结果
        </span>
      ),
      children: currentSession ? (
        <Editor
          height="calc(100vh - 320px)"
          defaultLanguage="json"
          value={formatJson(currentSession.responsePayload)}
          options={{ readOnly: true, minimap: { enabled: false } }}
        />
      ) : (
        <Empty description="尚未执行调用" />
      ),
    },
    {
      key: 'raw',
      label: (
        <span>
          <FileTextOutlined /> 原始报文
        </span>
      ),
      children: currentSession ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small" title="请求报文">
            <Editor
              height="180px"
              defaultLanguage="json"
              value={currentSession.rawRequest ?? formatJson(currentSession.requestPayload)}
              options={{ readOnly: true, minimap: { enabled: false } }}
            />
          </Card>
          <Card size="small" title="响应报文">
            <Editor
              height="180px"
              defaultLanguage="json"
              value={currentSession.rawResponse ?? formatJson(currentSession.responsePayload)}
              options={{ readOnly: true, minimap: { enabled: false } }}
            />
          </Card>
        </Space>
      ) : (
        <Empty description="尚未执行调用" />
      ),
    },
    {
      key: 'info',
      label: (
        <span>
          <InfoCircleOutlined /> 调用信息
        </span>
      ),
      children: currentSession ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">状态</Typography.Text>
                <div>
                  <Tag color={STATUS_COLOR[currentSession.status] ?? 'default'}>
                    {currentSession.status}
                  </Tag>
                </div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">耗时</Typography.Text>
                <div>{currentSession.durationMs ?? '-'} ms</div>
              </Col>
            </Row>
          </Card>
          <Card size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">Server</Typography.Text>
                <div>{selectedServer?.name ?? currentSession.serverId ?? '-'}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">Tool</Typography.Text>
                <div>{selectedTool?.name ?? currentSession.toolId ?? '-'}</div>
              </Col>
            </Row>
          </Card>
          <Card size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">Method</Typography.Text>
                <div>{currentSession.method ?? '-'}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">Trace ID</Typography.Text>
                <div>{currentSession.traceId ?? '-'}</div>
              </Col>
            </Row>
          </Card>
          {currentSession.errorMessage && (
            <Card size="small">
              <Typography.Text type="danger">{currentSession.errorMessage}</Typography.Text>
            </Card>
          )}
          {currentSession.breakpoint && (
            <Card size="small">
              <Badge status="warning" text="断点调试：请求已暂停，可点击历史记录中的回放继续执行" />
            </Card>
          )}
        </Space>
      ) : (
        <Empty description="尚未执行调用" />
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined /> 历史记录
        </span>
      ),
      children: (
        <List
          loading={historyLoading}
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="replay"
                  type="link"
                  size="small"
                  onClick={() => handleReplay(item.id)}
                >
                  回放
                </Button>,
                <Checkbox
                  key="select"
                  checked={selectedHistoryIds.includes(item.id)}
                  onChange={(e) => handleHistorySelect(item.id, e.target.checked)}
                >
                  对比
                </Checkbox>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={STATUS_COLOR[item.status] ?? 'default'}>{item.status}</Tag>
                    <Typography.Text>{item.method}</Typography.Text>
                  </Space>
                }
                description={`${item.createdAt ?? ''} · ${item.durationMs ?? '-'} ms · ${item.traceId ?? ''}`}
              />
            </List.Item>
          )}
        />
      ),
    },
  ];

  if (compareResult) {
    tabItems.push({
      key: 'compare',
      label: (
        <span>
          <DiffOutlined /> 请求对比
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small" title="差异字段">
            {compareResult.differences.length > 0 ? (
              compareResult.differences.map((d) => <Tag key={d}>{d}</Tag>)
            ) : (
              <Typography.Text type="secondary">无差异</Typography.Text>
            )}
          </Card>
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="请求 A">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={formatJson(compareResult.left.requestPayload)}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="请求 B">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={formatJson(compareResult.right.requestPayload)}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="响应 A">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={formatJson(compareResult.left.responsePayload)}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="响应 B">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={formatJson(compareResult.right.responsePayload)}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </Card>
            </Col>
          </Row>
        </Space>
      ),
    });
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          <ThunderboltOutlined /> MCP 调试器
        </Typography.Title>
      </div>

      <Row gutter={16} style={{ flex: 1, minHeight: 0, marginTop: 16 }}>
        <Col span={5} style={{ height: '100%' }}>
          <Card
            size="small"
            title="Server / 工具"
            style={{ height: '100%', overflow: 'auto' }}
          >
            {loadingResources ? (
              <Spin />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    MCP Server
                  </Typography.Text>
                  <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
                    {servers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleServerClick(s)}
                        style={{
                          padding: 8,
                          borderRadius: 4,
                          cursor: 'pointer',
                          background: selectedServerId === s.id ? '#e6f4ff' : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <Typography.Text strong>{s.name}</Typography.Text>
                        <div>
                          <Tag color={s.status === 'online' ? 'success' : 'default'}>
                            {s.status}
                          </Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    工具
                  </Typography.Text>
                  <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 8 }}>
                    {displayedTools.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => handleToolClick(t)}
                        style={{
                          padding: 8,
                          borderRadius: 4,
                          cursor: 'pointer',
                          background: selectedToolId === t.id ? '#e6f4ff' : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <Typography.Text strong>{t.name}</Typography.Text>
                        <div>
                          <Tag color="blue">{t.category}</Tag>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            <CodeOutlined /> {t.code}
                          </Typography.Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Space>
            )}
          </Card>
        </Col>

        <Col span={10} style={{ height: '100%' }}>
          <Card size="small" title="请求编辑器" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Select
                value={method}
                onChange={(m) => {
                  setMethod(m);
                  if (m === 'tools/call' && !selectedTool) {
                    setSelectedToolId(undefined);
                  }
                }}
                style={{ width: 180 }}
                options={METHOD_OPTIONS}
              />
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleExecute}
                loading={executing}
              >
                {breakpoint ? '设置断点' : '执行'}
              </Button>
              <Switch
                checked={breakpoint}
                onChange={setBreakpoint}
                checkedChildren="断点调试"
                unCheckedChildren="断点调试"
              />
            </Space>

            <div style={{ flex: 1, minHeight: 0, marginBottom: 12 }}>
              <Editor
                height="calc(100vh - 420px)"
                defaultLanguage="json"
                value={requestText}
                onChange={handleEditorChange}
                options={{ minimap: { enabled: false }, formatOnPaste: true }}
              />
            </div>

            {method === 'tools/call' && selectedTool && (
              <ParameterForm tool={selectedTool} value={params} onChange={handleParamsChange} />
            )}
            {method === 'tools/call' && !selectedTool && (
              <Empty description="请选择左侧工具" />
            )}
          </Card>
        </Col>

        <Col span={9} style={{ height: '100%' }}>
          <Card size="small" style={{ height: '100%' }}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
