import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  List,
  Select,
  Spin,
  Tabs,
  TabPane,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { History, Play, RefreshCw, Route } from 'lucide-react';
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
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';

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
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

function renderPlan(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <Text type="secondary">null</Text>;
  if (typeof value !== 'object') return <Text>{String(value)}</Text>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <Text type="secondary">[]</Text>;
    return (
      <div>
        {value.map((item, idx) => (
          <div key={idx}>
            <Tag type="light">[{idx}]</Tag> {renderPlan(item)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k}>
          <Text strong>{k}:</Text> {typeof v === 'object' ? renderPlan(v) : String(v)}
        </div>
      ))}
    </div>
  );
}

/**
 * SuperAI · 数据分析。
 *
 * 数据面沿用 src/api/superai/data：listDataSources / executeQuery / getExecutionPlan /
 * exportQueryResult / listQueryHistory。SQL 编辑器走 Monaco；结果与执行计划分 tab；
 * 右侧分析历史可恢复。页级加载失败 → EmptyState failure，执行/导出等动作失败 → Toast.error。
 */
export default function DataAnalysisPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 100');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<QueryExecuteResult | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [activeTab, setActiveTab] = useState('result');
  const [dsLoading, setDsLoading] = useState(true);
  const [dsError, setDsError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadDataSources = useCallback(async () => {
    setDsLoading(true);
    setDsError('');
    try {
      const items = await listDataSources();
      setDataSources(items);
      setSelectedDataSource((prev) => prev || items[0]?.id || '');
    } catch (e) {
      setDataSources([]);
      setDsError(e instanceof Error ? e.message : String(e));
    } finally {
      setDsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      setHistory(await listQueryHistory());
    } catch (e) {
      setHistory([]);
      setHistoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDataSources();
    void loadHistory();
  }, [loadDataSources, loadHistory]);

  const handleExecute = useCallback(async () => {
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
      setPage(1);
      void loadHistory();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '查询执行失败');
    } finally {
      setExecuting(false);
    }
  }, [selectedDataSource, sql, loadHistory]);

  const handleShowPlan = useCallback(async () => {
    if (!result?.queryId) {
      Toast.warning('请先执行查询');
      return;
    }
    setPlanLoading(true);
    try {
      setPlan(await getExecutionPlan(result.queryId));
      setActiveTab('plan');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '执行计划获取失败');
    } finally {
      setPlanLoading(false);
    }
  }, [result]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!result?.queryId) {
        Toast.warning('请先执行查询');
        return;
      }
      try {
        const blob = await exportQueryResult(result.queryId, format);
        const ext = format === 'excel' ? 'xlsx' : format;
        downloadBlob(blob, `query-${result.queryId}.${ext}`);
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : '导出失败');
      }
    },
    [result],
  );

  const handleRestoreHistory = useCallback((item: QueryHistoryItem) => {
    setSelectedDataSource(item.dataSourceId);
    setSql(item.sql);
    setResult(null);
    setPlan(null);
  }, []);

  const resultColumns: ColumnProps<Record<string, unknown>>[] = useMemo(() => {
    if (!result) return [];
    return result.columns.map((col) => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
    }));
  }, [result]);

  const resultRows = useMemo(() => {
    if (!result) return [];
    return result.rows.map((r, i) => ({ ...r, __rowKey: String(i) }));
  }, [result]);

  const pagedRows = useMemo(
    () => resultRows.slice((page - 1) * pageSize, page * pageSize),
    [resultRows, page, pageSize],
  );

  return (
    <>
      <PageHeader
        title="数据分析"
        desc="选择数据源执行 SQL，查看结果、执行计划与历史"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={dsLoading}
            onClick={() => void loadDataSources()}
          >
            刷新数据源
          </Button>
        }
      />

      {dsError ? (
        <EmptyState
          illustration="failure"
          title="数据源加载失败"
          desc={dsError}
          actions={
            <Button theme="solid" type="primary" onClick={() => void loadDataSources()}>
              重试
            </Button>
          }
        />
      ) : dsLoading && dataSources.length === 0 ? (
        <div className="mp-exec-loading">
          <Spin size="middle" />
        </div>
      ) : (
        <>
          <FilterBar
            filters={
              <Select
                value={selectedDataSource || undefined}
                onChange={(v) => setSelectedDataSource(v as string)}
                placeholder="选择数据源"
                optionList={dataSources.map((ds) => ({
                  label: ds.sourceType ? `${ds.name} (${ds.sourceType})` : ds.name,
                  value: ds.id,
                }))}
              />
            }
            right={
              <>
                <Button
                  theme="solid"
                  type="primary"
                  icon={<Play size={15} strokeWidth={1.5} />}
                  loading={executing}
                  onClick={() => void handleExecute()}
                >
                  执行 SQL
                </Button>
                <Button
                  icon={<Route size={15} strokeWidth={1.5} />}
                  loading={planLoading}
                  onClick={() => void handleShowPlan()}
                >
                  执行计划
                </Button>
              </>
            }
          />

          <div className="mp-exec-grid">
            <div className="mp-exec-col">
              <Card>
                <div className="mp-exec-col">
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

                  <span className="mp-exec-chips">
                    <Text type="secondary">导出结果：</Text>
                  <Button size="small" onClick={() => void handleExport('csv')}>
                    CSV
                  </Button>
                  <Button size="small" onClick={() => void handleExport('excel')}>
                    Excel
                  </Button>
                  <Button size="small" onClick={() => void handleExport('json')}>
                    JSON
                  </Button>
                </span>
              </div>
            </Card>

            <Card
              headerExtraContent={executing ? <Spin size="small" /> : null}
            >
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
                    <div className="mp-exec-col">
                      <span className="mp-exec-chips">
                        <Tag type="light" color="blue">
                          {result.rowCount} 行
                        </Tag>
                        <Tag type="light">{result.executionTime} ms</Tag>
                      </span>
                      <DataTablePro<Record<string, unknown>>
                        columns={resultColumns}
                        dataSource={pagedRows}
                        rowKey="__rowKey"
                        empty={<EmptyState illustration="no-content" title="查询无结果" />}
                        pagination={{
                          currentPage: page,
                          pageSize,
                          total: resultRows.length,
                          onChange: setPage,
                          onPageSizeChange: (size) => {
                            setPageSize(size);
                            setPage(1);
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <EmptyState
                      illustration="idle"
                      title="执行 SQL 后查看结果"
                      desc="在上方编辑器写好 SQL，点击「执行 SQL」。"
                    />
                  )}
                </TabPane>
                <TabPane itemKey="plan">
                  {plan ? (
                    <div className="mp-exec-col">{renderPlan(plan.plan)}</div>
                  ) : (
                    <EmptyState
                      illustration="idle"
                      title="执行查询后查看执行计划"
                      desc="先执行一次查询，再点击「执行计划」。"
                    />
                  )}
                </TabPane>
              </Tabs>
            </Card>
          </div>

          <div className="mp-exec-col">
            <Card
              title={
                <span className="mp-exec-step-head">
                  <History size={15} strokeWidth={1.5} />
                  <span className="mp-exec-step-title">分析历史</span>
                </span>
              }
              headerExtraContent={
                <Button
                  theme="borderless"
                  type="primary"
                  size="small"
                  loading={historyLoading}
                  onClick={() => void loadHistory()}
                >
                  刷新
                </Button>
              }
            >
              {historyError ? (
                <EmptyState
                  illustration="failure"
                  title="分析历史加载失败"
                  desc={historyError}
                  actions={
                    <Button theme="solid" type="primary" onClick={() => void loadHistory()}>
                      重试
                    </Button>
                  }
                />
              ) : historyLoading && history.length === 0 ? (
                <div className="mp-exec-loading">
                  <Spin size="small" />
                </div>
              ) : (
                <List
                  dataSource={history}
                  emptyContent={<EmptyState illustration="no-content" title="暂无分析历史" />}
                  renderItem={(item: QueryHistoryItem) => (
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
                        <Typography.Paragraph ellipsis={{ rows: 2 }}>
                          {item.sql}
                        </Typography.Paragraph>
                        <span className="mp-exec-chips">
                          <Tag type="light" color={item.status === 'success' ? 'green' : 'red'}>
                            {item.status === 'success' ? '成功' : '失败'}
                          </Tag>
                          <Text type="secondary">
                            {item.rowCount} 行 · {formatTime(item.createdAt)}
                          </Text>
                        </span>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card title="数据源">
              <List
                dataSource={dataSources}
                emptyContent={<EmptyState illustration="no-content" title="暂无数据源" />}
                renderItem={(ds: DataSource) => (
                  <List.Item
                    main={
                      <span className="mp-exec-line">
                        <span>{ds.name}</span>
                        {ds.sourceType ? <Tag type="light">{ds.sourceType}</Tag> : null}
                      </span>
                    }
                  />
                )}
              />
            </Card>
          </div>
          </div>
        </>
      )}
    </>
  );
}
