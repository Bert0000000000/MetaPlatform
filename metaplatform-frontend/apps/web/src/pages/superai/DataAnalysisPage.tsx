import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  List,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tabs,
  TabPane,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import {
  PlayCircleOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  BranchesOutlined,
  HistoryOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import {
  executeQuery,
  exportQueryResult,
  getExecutionPlan,
  listDataSources,
  listQueryHistory,
} from '@/api/superai/data';
import type {
  DataSource,
  ExecutionPlan,
  ExportFormat,
  QueryExecuteResult,
  QueryHistoryItem,
} from '@/api/superai/types';
import { PageRoot } from '@mate/shared';

const { Text } = Typography;

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function formatTime(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

export default function DataAnalysisPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 100');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<QueryExecuteResult | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('result');

  const loadDataSources = async () => {
    try {
      const items = await listDataSources();
      setDataSources(items);
      if (items.length > 0 && !selectedDataSource) {
        setSelectedDataSource(items[0].id);
      }
    } catch (err) {
      Toast.error('加载数据源失败');
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const items = await listQueryHistory();
      setHistory(items);
    } catch (err) {
      Toast.error('加载分析历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadDataSources();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExecute = async () => {
    if (!selectedDataSource) {
      Toast.warning('请先选择数据源');
      return;
    }
    if (!sql.trim()) {
      Toast.warning('请输入 SQL');
      return;
    }
    setExecuting(true);
    setResult(null);
    setPlan(null);
    try {
      const res = await executeQuery({ dataSourceId: selectedDataSource, sql });
      setResult(res);
      setActiveTab('result');
      loadHistory();
    } catch (err) {
      // 错误已由 client 拦截器提示
    } finally {
      setExecuting(false);
    }
  };

  const handleShowPlan = async () => {
    if (!result?.queryId) {
      Toast.warning('请先执行查询');
      return;
    }
    setPlanLoading(true);
    try {
      const res = await getExecutionPlan(result.queryId);
      setPlan(res);
      setActiveTab('plan');
    } catch (err) {
      // 错误已由 client 拦截器提示
    } finally {
      setPlanLoading(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!result?.queryId) {
      Toast.warning('请先执行查询');
      return;
    }
    try {
      const blob = await exportQueryResult(result.queryId, format);
      const ext = format === 'excel' ? 'xlsx' : format;
      downloadBlob(blob, `query-${result.queryId}.${ext}`);
    } catch (err) {
      Toast.error('导出失败');
    }
  };

  const handleRestoreHistory = (item: QueryHistoryItem) => {
    setSelectedDataSource(item.dataSourceId);
    setSql(item.sql);
    setResult(null);
    setPlan(null);
  };

  const resultColumns = useMemo(() => {
    if (!result) return [];
    return result.columns.map((col) => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
    }));
  }, [result]);

  const renderPlan = (value: unknown, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <Text type="secondary">null</Text>;
    }
    if (typeof value !== 'object') {
      return <Text>{String(value)}</Text>;
    }
    if (Array.isArray(value)) {
      return (
        <div style={{ paddingLeft: depth * 12 }}>
          {value.length === 0 ? (
            <Text type="secondary">[]</Text>
          ) : (
            value.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 4 }}>
                <Tag>[{idx}]</Tag>
                {renderPlan(item, depth + 1)}
              </div>
            ))
          )}
        </div>
      );
    }
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 4 }}>
            <Text strong>{k}:</Text>{' '}
            {typeof v === 'object' ? renderPlan(v, depth + 1) : String(v)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <PageRoot>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card>
          <Space vertical spacing="medium" style={{ width: '100%' }}>
            <Row gutter={16} align="middle">
              <Col style={{ flex: 'auto' }}>
                <Space>
                  <DatabaseIcon />
                  <Text strong>数据源</Text>
                  <Select
                    style={{ minWidth: 240 }}
                    placeholder="选择数据源"
                    value={selectedDataSource || undefined}
                    onChange={(v) => setSelectedDataSource(v as string)}
                    optionList={dataSources.map((ds) => ({
                      label: `${ds.name} (${ds.sourceType})`,
                      value: ds.id,
                    }))}
                  />
                </Space>
              </Col>
              <Col style={{ flexShrink: 0 }}>
                <Space>
                  <Button
                    theme="solid"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={executing}
                    onClick={handleExecute}
                  >
                    执行 SQL
                  </Button>
                  <Button icon={<BranchesOutlined />} loading={planLoading} onClick={handleShowPlan}>
                    执行计划
                  </Button>
                </Space>
              </Col>
            </Row>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}
            >
              <Editor
                height={280}
                language="sql"
                value={sql}
                theme="vs"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
                onChange={(value) => setSql(value || '')}
              />
            </div>

            <Space>
              <Text type="secondary">导出结果：</Text>
              <Button icon={<FileTextOutlined />} size="small" onClick={() => handleExport('csv')}>
                CSV
              </Button>
              <Button icon={<FileExcelOutlined />} size="small" onClick={() => handleExport('excel')}>
                Excel
              </Button>
              <Button icon={<CloudDownloadOutlined />} size="small" onClick={() => handleExport('json')}>
                JSON
              </Button>
            </Space>
          </Space>
        </Card>

        <Card style={{ flex: 1, minHeight: 0 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            tabList={[
              { itemKey: 'result', tab: '查询结果' },
              { itemKey: 'plan', tab: '执行计划' },
            ]}
          >
            <TabPane itemKey="result">
              {result ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Space style={{ marginBottom: 8 }}>
                    <Tag color="blue">{result.rowCount} 行</Tag>
                    <Tag>{result.executionTime} ms</Tag>
                  </Space>
                  <Table
                    dataSource={result.rows.map((r, i) => ({ ...r, __rowKey: String(i) }))}
                    columns={resultColumns}
                    rowKey="__rowKey"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              ) : (
                <Empty description="执行 SQL 后查看结果" />
              )}
            </TabPane>
            <TabPane itemKey="plan">
              {plan ? (
                <div
                  style={{
                    maxHeight: 480,
                    overflow: 'auto',
                    background: 'var(--muted)',
                    padding: 12,
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {renderPlan(plan.plan)}
                </div>
              ) : (
                <Empty description="执行查询后查看执行计划" />
              )}
            </TabPane>
          </Tabs>
        </Card>
      </div>

      <Card
        title={
          <Space>
            <HistoryOutlined />
            <Text strong>分析历史</Text>
          </Space>
        }
        style={{ width: 320, flexShrink: 0 }}
      >
        <Spin spinning={historyLoading}>
          <List
            dataSource={history}
            emptyContent={<Empty description="暂无分析历史" />}
            renderItem={(item) => (
              <List.Item
                extra={
                  <Button
                    theme="borderless"
                    size="small"
                    onClick={() => handleRestoreHistory(item)}
                  >
                    恢复
                  </Button>
                }
              >
                <div>
                  <Typography.Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 0, fontSize: 12 }}
                  >
                    {item.sql}
                  </Typography.Paragraph>
                  <Space spacing="tight">
                    <Tag color={item.status === 'success' ? 'green' : 'red'}>
                      {item.status === 'success' ? '成功' : '失败'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.rowCount} 行 · {formatTime(item.createdAt)}
                    </Text>
                  </Space>
                </div>
              </List.Item>
            )}
          />
        </Spin>
      </Card>
    </div>
    </PageRoot>
  );
}

function DatabaseIcon() {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width="1em"
      height="1em"
      fill="currentColor"
      style={{ display: 'inline-block' }}
    >
      <path d="M832 192c0-88.4-201.6-160-448-160S64 103.6 64 192v640c0 88.4 201.6 160 448 160s448-71.6 448-160V192z m-64 0c0 35.2-148.8 96-384 96S0 227.2 0 192s148.8-96 384-96 384 60.8 384 96zM512 832c-235.2 0-384-60.8-384-96v-96c76.8 35.2 204.8 64 384 64s307.2-28.8 384-64v96c0 35.2-148.8 96-384 96z m0-224c-235.2 0-384-60.8-384-96v-96c76.8 35.2 204.8 64 384 64s307.2-28.8 384-64v96c0 35.2-148.8 96-384 96z" />
    </svg>
  );
}
