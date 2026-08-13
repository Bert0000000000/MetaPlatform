import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
  List,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
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
import { listTools } from '@/api/mcphub/tools';
import { listServers } from '@/api/mcphub/servers';
import {
  executeDebug,
  listDebugHistory,
  replayDebugSession,
  compareDebugSessions,
} from '@/api/mcphub/debug';
import ParameterForm from './components/ParameterForm';
import type { McpDebugSession, McpServer, McpTool, McpDebugCompareResult } from '@/api/mcphub/types';

const METHOD_OPTIONS = [
  { label: 'tools/call', value: 'tools/call' },
  { label: 'tools/list', value: 'tools/list' },
  { label: 'resources/list', value: 'resources/list' },
  { label: 'resources/read', value: 'resources/read' },
  { label: 'prompts/list', value: 'prompts/list' },
  { label: 'initialize', value: 'initialize' },
];

const STATUS_COLOR: Record<string, TagColor> = {
  SUCCESS: 'green',
  FAILED: 'red',
  BREAKPOINT: 'orange',
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
      Toast.warning('请求 JSON 格式不正确');
      return;
    }
    if (method === 'tools/call' && !selectedTool) {
      Toast.warning('请先选择工具');
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

  const tabItems: { itemKey: string; tab: React.ReactNode; content: React.ReactNode }[] = [
    {
      itemKey: 'result',
      tab: (
        <span>
          <CodeOutlined /> 结果
        </span>
      ),
      content: currentSession ? (
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
      itemKey: 'raw',
      tab: (
        <span>
          <FileTextOutlined /> 原始报文
        </span>
      ),
      content: currentSession ? (
        <Space vertical style={{ width: '100%' }}>
          <Card title="请求报文">
            <Editor
              height="180px"
              defaultLanguage="json"
              value={currentSession.rawRequest ?? formatJson(currentSession.requestPayload)}
              options={{ readOnly: true, minimap: { enabled: false } }}
            />
          </Card>
          <Card title="响应报文">
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
      itemKey: 'info',
      tab: (
        <span>
          <InfoCircleOutlined /> 调用信息
        </span>
      ),
      content: currentSession ? (
        <Space vertical style={{ width: '100%' }}>
          <Card>
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="tertiary">状态</Typography.Text>
                <div>
                  <Tag color={STATUS_COLOR[currentSession.status] ?? 'grey'}>
                    {currentSession.status}
                  </Tag>
                </div>
              </Col>
              <Col span={12}>
                <Typography.Text type="tertiary">耗时</Typography.Text>
                <div>{currentSession.durationMs ?? '-'} ms</div>
              </Col>
            </Row>
          </Card>
          <Card>
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="tertiary">Server</Typography.Text>
                <div>{selectedServer?.name ?? currentSession.serverId ?? '-'}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="tertiary">Tool</Typography.Text>
                <div>{selectedTool?.name ?? currentSession.toolId ?? '-'}</div>
              </Col>
            </Row>
          </Card>
          <Card>
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="tertiary">Method</Typography.Text>
                <div>{currentSession.method ?? '-'}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="tertiary">Trace ID</Typography.Text>
                <div>{currentSession.traceId ?? '-'}</div>
              </Col>
            </Row>
          </Card>
          {currentSession.errorMessage && (
            <Card>
              <Typography.Text type="danger">{currentSession.errorMessage}</Typography.Text>
            </Card>
          )}
          {currentSession.breakpoint && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge type="warning" dot />
                <Typography.Text>断点调试：请求已暂停，可点击历史记录中的回放继续执行</Typography.Text>
              </div>
            </Card>
          )}
        </Space>
      ) : (
        <Empty description="尚未执行调用" />
      ),
    },
    {
      itemKey: 'history',
      tab: (
        <span>
          <HistoryOutlined /> 历史记录
        </span>
      ),
      content: (
        <List
          loading={historyLoading}
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              main={
                <div>
                  <Space vertical spacing={0}>
                    <Tag color={STATUS_COLOR[item.status] ?? 'grey'}>{item.status}</Tag>
                    <Typography.Text>{item.method}</Typography.Text>
                  </Space>
                  <div>
                    <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                      {`${item.createdAt ?? ''} · ${item.durationMs ?? '-'} ms · ${item.traceId ?? ''}`}
                    </Typography.Text>
                  </div>
                </div>
              }
              extra={
                <Space>
                  <Button theme="borderless" size="small" onClick={() => handleReplay(item.id)}>
                    回放
                  </Button>
                  <Checkbox
                    checked={selectedHistoryIds.includes(item.id)}
                    onChange={(e) => handleHistorySelect(item.id, e.target.checked ?? false)}
                  >
                    对比
                  </Checkbox>
                </Space>
              }
            />
          )}
        />
      ),
    },
  ];

  if (compareResult) {
    tabItems.push({
      itemKey: 'compare',
      tab: (
        <span>
          <DiffOutlined /> 请求对比
        </span>
      ),
      content: (
        <Space vertical style={{ width: '100%' }}>
          <Card title="差异字段">
            {compareResult.differences.length > 0 ? (
              compareResult.differences.map((d) => <Tag key={d}>{d}</Tag>)
            ) : (
              <Typography.Text type="tertiary">无差异</Typography.Text>
            )}
          </Card>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="请求 A">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={formatJson(compareResult.left.requestPayload)}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="请求 B">
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
              <Card title="响应 A">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={formatJson(compareResult.left.responsePayload)}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="响应 B">
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
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          <ThunderboltOutlined /> MCP 调试器
        </Typography.Title>
      </div>

      <Row gutter={16} style={{ flex: 1, minHeight: 0, marginTop: 16 }}>
        <Col span={5} style={{ height: '100%' }}>
          <Card
            title="Server / 工具"
            style={{ height: '100%', overflow: 'auto' }}
          >
            {loadingResources ? (
              <Spin />
            ) : (
              <Space vertical style={{ width: '100%' }}>
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
                          background:
                            selectedServerId === s.id
                              ? 'var(--semi-color-primary-light-default)'
                              : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <Typography.Text strong>{s.name}</Typography.Text>
                        <div>
                          <Tag color={s.status === 'online' ? 'green' : 'grey'}>
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
                          background:
                            selectedToolId === t.id
                              ? 'var(--semi-color-primary-light-default)'
                              : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <Typography.Text strong>{t.name}</Typography.Text>
                        <div>
                          <Tag color="blue">{t.category}</Tag>
                          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
          <Card title="请求编辑器" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Select
                value={method}
                onChange={(m) => {
                  const next = m as string;
                  setMethod(next);
                  if (next === 'tools/call' && !selectedTool) {
                    setSelectedToolId(undefined);
                  }
                }}
                style={{ width: 180 }}
                optionList={METHOD_OPTIONS}
              />
              <Button
                theme="solid"
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
                checkedText="断点调试"
                uncheckedText="断点调试"
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
          <Card style={{ height: '100%' }}>
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              {tabItems.map((t) => (
                <Tabs.TabPane itemKey={t.itemKey} tab={t.tab} key={t.itemKey}>
                  {t.content}
                </Tabs.TabPane>
              ))}
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
