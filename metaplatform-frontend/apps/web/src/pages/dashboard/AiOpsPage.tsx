import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Form,
  Tabs,
  Tag,
  Timeline,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Eye, Pencil, Play, Plus, RefreshCw, Stethoscope, Trash2 } from 'lucide-react';
import {
  analyzeAnomaly,
  createAnomalyRule,
  deleteAnomalyRule,
  getAnomalies,
  getAnomalyRules,
  remediateAnomaly,
  updateAnomalyRule,
} from '@/api/anomaly';
import type {
  AnomalyDetectionRule,
  AnomalyEvent,
  AnomalySeverity,
  AnomalyStatus,
  RemediationResult,
  RootCauseAnalysisResult,
} from '@/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  type DataTableProProps,
} from '@/components/skeleton';
import { useSettings } from '@/contexts/SettingsContext';
import { formatRelative } from '@/utils/datetime';
import './home.css';

/**
 * 工作台 · 智能运维（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 分页）。
 *
 * API 调用保持不变（@/api/anomaly：列表 / 规则 CRUD / 根因分析 / 自愈），
 * 只把旧的 Table + StateContainer + 手绘 Stat/Row/Col 换成共享骨架：
 *  - 列表 → DataTablePro（受控分页，点行 → 右侧非模态详情浮层）
 *  - 详情 → SheetDetail（原 SideSheet）
 *  - 新建 / 编辑规则 → SheetDetail 内的 Semi Form（原 Modal，改为右侧抽屉）
 *  - 错误 → EmptyState(illustration="failure")，动作失败一律 Toast.error
 */

const PAGE_SIZE = 10;

const SEVERITY_LABEL: Record<AnomalySeverity, { label: string; color: TagColor }> = {
  INFO: { label: '提示', color: 'blue' },
  WARNING: { label: '警告', color: 'orange' },
  CRITICAL: { label: '严重', color: 'red' },
};

const STATUS_LABEL: Record<AnomalyStatus, { label: string; color: TagColor }> = {
  OPEN: { label: '待处理', color: 'red' },
  ANALYZING: { label: '分析中', color: 'blue' },
  RESOLVED: { label: '已修复', color: 'green' },
};

const ACTION_LABEL: Record<string, string> = {
  serviceRestart: '重启服务',
  cacheClear: '清理缓存',
  configRollback: '回滚配置',
};

const METRIC_TYPE_LABEL: Record<string, string> = {
  ERROR_RATE: '错误率',
  P99_LATENCY: 'P99 延迟',
  ERROR_CODE: '错误码',
};

const METRIC_TYPE_OPTIONS = [
  { label: '错误率', value: 'ERROR_RATE' },
  { label: 'P99 延迟', value: 'P99_LATENCY' },
  { label: '错误码', value: 'ERROR_CODE' },
];

const CONDITION_OPTIONS = [
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GTE' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LTE' },
  { label: '等于', value: 'EQ' },
];

const AGGREGATION_OPTIONS = [
  { label: 'AVG', value: 'AVG' },
  { label: 'SUM', value: 'SUM' },
  { label: 'COUNT', value: 'COUNT' },
  { label: 'MAX', value: 'MAX' },
  { label: 'MIN', value: 'MIN' },
];

const SEVERITY_OPTIONS = [
  { label: '提示', value: 'INFO' },
  { label: '警告', value: 'WARNING' },
  { label: '严重', value: 'CRITICAL' },
];

export default function AiOpsPage() {
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState('events');
  const [query, setQuery] = useState('');

  const [events, setEvents] = useState<AnomalyEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');
  const [eventsPage, setEventsPage] = useState(1);

  const [rules, setRules] = useState<AnomalyDetectionRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState('');
  const [rulesPage, setRulesPage] = useState(1);

  const [selectedEvent, setSelectedEvent] = useState<AnomalyEvent | null>(null);
  const [analysis, setAnalysis] = useState<RootCauseAnalysisResult | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [remediation, setRemediation] = useState<RemediationResult | null>(null);
  const [remediatingId, setRemediatingId] = useState<string | null>(null);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<AnomalyDetectionRule | null>(null);
  const [ruleForm] = Form.useForm<RuleFormValues>();

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError('');
    try {
      setEvents(await getAnomalies());
    } catch (e) {
      setEventsError(e instanceof Error ? e.message : String(e));
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError('');
    try {
      setRules(await getAnomalyRules());
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : String(e));
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    void loadRules();
  }, [loadEvents, loadRules]);

  const handleAnalyze = useCallback(
    async (event: AnomalyEvent) => {
      setAnalyzingId(event.id);
      try {
        const result = await analyzeAnomaly(event.id);
        setAnalysis(result);
        Toast.success('根因分析完成');
        void loadEvents();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setAnalyzingId(null);
      }
    },
    [loadEvents],
  );

  const handleRemediate = useCallback(
    async (event: AnomalyEvent, mode: 'ADVISE' | 'AUTO') => {
      setRemediatingId(event.id);
      try {
        const result = await remediateAnomaly(event.id, mode, event.remediationAction);
        setRemediation(result);
        Toast.info(result.executed ? '修复 Action 已执行' : '已生成修复建议');
        if (result.executed) void loadEvents();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setRemediatingId(null);
      }
    },
    [loadEvents],
  );

  const openDetail = (event: AnomalyEvent) => {
    setSelectedEvent(event);
    setAnalysis(null);
    setRemediation(null);
  };

  const openCreateRule = () => {
    setEditingRule(null);
    ruleForm.reset();
    ruleForm.setValues({
      metricType: 'ERROR_RATE',
      conditionOperator: 'GT',
      threshold: 5,
      timeWindowSeconds: 300,
      aggregationFunction: 'AVG',
      severity: 'WARNING',
      enabled: true,
    });
    setRuleOpen(true);
  };

  const openEditRule = (rule: AnomalyDetectionRule) => {
    setEditingRule(rule);
    ruleForm.setValues({
      name: rule.name,
      metricType: rule.metricType,
      conditionOperator: rule.conditionOperator,
      threshold: rule.threshold,
      timeWindowSeconds: rule.timeWindowSeconds,
      aggregationFunction: rule.aggregationFunction,
      severity: rule.severity,
      enabled: rule.enabled,
    });
    setRuleOpen(true);
  };

  const handleSaveRule = useCallback(
    async (values: RuleFormValues) => {
      setSavingRule(true);
      try {
        if (editingRule) {
          await updateAnomalyRule(editingRule.id, values);
          Toast.success('规则已更新');
        } else {
          await createAnomalyRule(values);
          Toast.success('规则已创建');
        }
        setRuleOpen(false);
        void loadRules();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setSavingRule(false);
      }
    },
    [editingRule, loadRules],
  );

  const submitRule = async () => {
    const values = await ruleForm.validate().catch(() => null);
    if (!values) return; // 校验失败，Semi Form 已就地提示
    await handleSaveRule(values);
  };

  const handleDeleteRule = useCallback(
    async (id: string) => {
      try {
        await deleteAnomalyRule(id);
        Toast.success('规则已删除');
        void loadRules();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [loadRules],
  );

  const handleQuery = (value: string) => {
    setQuery(value);
    setEventsPage(1);
    setRulesPage(1);
  };

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return events;
    return events.filter(
      (e) =>
        e.serviceName.toLowerCase().includes(q) ||
        (METRIC_TYPE_LABEL[e.anomalyType] ?? e.anomalyType).toLowerCase().includes(q),
    );
  }, [events, query]);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return rules;
    return rules.filter((r) => r.name.toLowerCase().includes(q));
  }, [rules, query]);

  const pagedEvents = useMemo(
    () => filteredEvents.slice((eventsPage - 1) * PAGE_SIZE, eventsPage * PAGE_SIZE),
    [filteredEvents, eventsPage],
  );

  const pagedRules = useMemo(
    () => filteredRules.slice((rulesPage - 1) * PAGE_SIZE, rulesPage * PAGE_SIZE),
    [filteredRules, rulesPage],
  );

  const eventColumns: DataTableProProps<AnomalyEvent>['columns'] = [
    {
      title: '异常类型',
      dataIndex: 'anomalyType',
      render: (v: string) => METRIC_TYPE_LABEL[v] ?? v,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      render: (v: AnomalySeverity) => (
        <Tag color={SEVERITY_LABEL[v]?.color ?? 'grey'}>{SEVERITY_LABEL[v]?.label ?? v}</Tag>
      ),
    },
    { title: '服务', dataIndex: 'serviceName' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: AnomalyStatus) => (
        <Tag color={STATUS_LABEL[v]?.color ?? 'grey'}>{STATUS_LABEL[v]?.label ?? v}</Tag>
      ),
    },
    {
      title: '当前值',
      dataIndex: 'metricValue',
      render: (v: number, record: AnomalyEvent) =>
        `${v}${
          record.anomalyType === 'ERROR_RATE'
            ? '%'
            : record.anomalyType === 'P99_LATENCY'
              ? 'ms'
              : ''
        }`,
    },
    {
      title: '发生时间',
      dataIndex: 'detectedAt',
      render: (v: string) => formatRelative(v, settings),
    },
    {
      title: '操作',
      render: (_: unknown, record: AnomalyEvent) => (
        <>
          <Button
            theme="borderless"
            size="small"
            icon={<Eye size={15} strokeWidth={1.5} />}
            onClick={(e) => {
              e.stopPropagation();
              openDetail(record);
            }}
          >
            详情
          </Button>
          <Button
            theme="borderless"
            size="small"
            icon={<Stethoscope size={15} strokeWidth={1.5} />}
            loading={analyzingId === record.id}
            onClick={(e) => {
              e.stopPropagation();
              void handleAnalyze(record);
            }}
          >
            根因分析
          </Button>
          {record.status !== 'RESOLVED' ? (
            <Button
              theme="borderless"
              size="small"
              icon={<Play size={15} strokeWidth={1.5} />}
              loading={remediatingId === record.id}
              onClick={(e) => {
                e.stopPropagation();
                void handleRemediate(record, 'AUTO');
              }}
            >
              自动修复
            </Button>
          ) : null}
        </>
      ),
    },
  ];

  const ruleColumns: DataTableProProps<AnomalyDetectionRule>['columns'] = [
    { title: '规则名称', dataIndex: 'name' },
    {
      title: '指标类型',
      dataIndex: 'metricType',
      render: (v: string) => METRIC_TYPE_LABEL[v] ?? v,
    },
    { title: '条件', dataIndex: 'conditionOperator' },
    { title: '阈值', dataIndex: 'threshold' },
    { title: '聚合', dataIndex: 'aggregationFunction' },
    {
      title: '严重级别',
      dataIndex: 'severity',
      render: (v: AnomalySeverity) => (
        <Tag color={SEVERITY_LABEL[v]?.color ?? 'grey'}>{SEVERITY_LABEL[v]?.label ?? v}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'grey'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '操作',
      render: (_: unknown, record: AnomalyDetectionRule) => (
        <>
          <Button
            theme="borderless"
            size="small"
            icon={<Pencil size={15} strokeWidth={1.5} />}
            onClick={() => openEditRule(record)}
          >
            编辑
          </Button>
          <Button
            theme="borderless"
            type="danger"
            size="small"
            icon={<Trash2 size={15} strokeWidth={1.5} />}
            onClick={() => void handleDeleteRule(record.id)}
          >
            删除
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="智能运维"
        desc="异常自动检测、根因分析与自愈"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={eventsLoading || rulesLoading}
            onClick={() => {
              void loadEvents();
              void loadRules();
            }}
          >
            刷新
          </Button>
        }
      />

      <FilterBar
        search={{
          value: query,
          onChange: handleQuery,
          placeholder: activeTab === 'events' ? '搜索服务名或异常类型' : '搜索规则名称',
        }}
        right={
          activeTab === 'rules' ? (
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={openCreateRule}
            >
              新建规则
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(String(k))}>
          <Tabs.TabPane tab="异常事件" itemKey="events">
            {eventsError ? (
              <EmptyState
                illustration="failure"
                title="异常事件加载失败"
                desc={eventsError}
                actions={
                  <Button theme="solid" type="primary" onClick={() => void loadEvents()}>
                    重试
                  </Button>
                }
              />
            ) : (
              <DataTablePro<AnomalyEvent>
                columns={eventColumns}
                dataSource={pagedEvents}
                rowKey="id"
                loading={eventsLoading}
                pagination={{
                  currentPage: eventsPage,
                  pageSize: PAGE_SIZE,
                  total: filteredEvents.length,
                  onChange: setEventsPage,
                }}
                onRow={(record) => ({ onClick: () => openDetail(record) })}
                empty={
                  <EmptyState
                    illustration="no-content"
                    title="暂无异常事件"
                    desc="检测规则命中后，事件会在这里生成。"
                  />
                }
              />
            )}
          </Tabs.TabPane>

          <Tabs.TabPane tab="检测规则" itemKey="rules">
            {rulesError ? (
              <EmptyState
                illustration="failure"
                title="检测规则加载失败"
                desc={rulesError}
                actions={
                  <Button theme="solid" type="primary" onClick={() => void loadRules()}>
                    重试
                  </Button>
                }
              />
            ) : (
              <DataTablePro<AnomalyDetectionRule>
                columns={ruleColumns}
                dataSource={pagedRules}
                rowKey="id"
                loading={rulesLoading}
                pagination={{
                  currentPage: rulesPage,
                  pageSize: PAGE_SIZE,
                  total: filteredRules.length,
                  onChange: setRulesPage,
                }}
                empty={
                  <EmptyState
                    illustration="no-content"
                    title="暂无检测规则"
                    desc="新建规则后，指标异常会被自动检测。"
                  />
                }
              />
            )}
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <SheetDetail
        title="异常详情"
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        footer={
          selectedEvent && selectedEvent.status !== 'RESOLVED' ? (
            <>
              <Button
                onClick={() => void handleRemediate(selectedEvent, 'ADVISE')}
                loading={remediatingId === selectedEvent.id}
              >
                生成修复建议
              </Button>
              <Button
                theme="solid"
                type="primary"
                onClick={() => void handleRemediate(selectedEvent, 'AUTO')}
                loading={remediatingId === selectedEvent.id}
              >
                执行自动修复
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedEvent ? (
          <>
            <Descriptions
              row
              column={1}
              data={[
                { key: '服务', value: selectedEvent.serviceName },
                {
                  key: '严重级别',
                  value: (
                    <Tag color={SEVERITY_LABEL[selectedEvent.severity]?.color ?? 'grey'}>
                      {SEVERITY_LABEL[selectedEvent.severity]?.label ?? selectedEvent.severity}
                    </Tag>
                  ),
                },
                {
                  key: '状态',
                  value: (
                    <Tag color={STATUS_LABEL[selectedEvent.status]?.color ?? 'grey'}>
                      {STATUS_LABEL[selectedEvent.status]?.label ?? selectedEvent.status}
                    </Tag>
                  ),
                },
                {
                  key: 'Trace ID',
                  value: <Typography.Text copyable>{selectedEvent.traceId || '-'}</Typography.Text>,
                },
              ]}
            />

            {analysis ? (
              <>
                <Typography.Text strong>根因分析结论</Typography.Text>
                <Typography.Paragraph>{analysis.conclusion}</Typography.Paragraph>
                <Typography.Text strong>修复建议</Typography.Text>
                <Typography.Paragraph>
                  {ACTION_LABEL[analysis.suggestedAction] ?? analysis.suggestedAction}
                </Typography.Paragraph>
                {analysis.relatedLogs.length > 0 ? (
                  <>
                    <Typography.Text strong>关联日志</Typography.Text>
                    <Timeline
                      dataSource={analysis.relatedLogs.map((log) => ({
                        content: (
                          <>
                            <Tag color={log.level === 'ERROR' ? 'red' : 'grey'}>{log.level}</Tag>
                            <Typography.Text type="secondary">{log.serviceName}</Typography.Text>
                            <div>{log.message}</div>
                          </>
                        ),
                      }))}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {remediation ? (
              <>
                <Typography.Text strong>修复结果</Typography.Text>
                <Typography.Paragraph>
                  {remediation.executed ? '已执行' : '建议'}：
                  {remediation.actionName ||
                    ACTION_LABEL[remediation.actionCode] ||
                    remediation.actionCode}
                </Typography.Paragraph>
                <Typography.Paragraph>{remediation.message}</Typography.Paragraph>
                {remediation.executionId ? (
                  <Typography.Text type="secondary">
                    执行 ID: {remediation.executionId}
                  </Typography.Text>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editingRule ? '编辑检测规则' : '新建检测规则'}
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        footer={
          <>
            <Button onClick={() => setRuleOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={savingRule} onClick={() => void submitRule()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={ruleForm} labelPosition="top">
          <Form.Input
            field="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
            placeholder="例如：高错误率检测"
          />
          <Form.Select
            field="metricType"
            label="指标类型"
            rules={[{ required: true }]}
            optionList={METRIC_TYPE_OPTIONS}
          />
          <Form.Select
            field="conditionOperator"
            label="比较运算符"
            rules={[{ required: true }]}
            optionList={CONDITION_OPTIONS}
          />
          <Form.InputNumber
            field="threshold"
            label="阈值"
            rules={[{ required: true, message: '请输入阈值' }]}
          />
          <Form.Select
            field="aggregationFunction"
            label="聚合函数"
            rules={[{ required: true }]}
            optionList={AGGREGATION_OPTIONS}
          />
          <Form.InputNumber
            field="timeWindowSeconds"
            label="时间窗口（秒）"
            rules={[{ required: true }]}
            min={60}
          />
          <Form.Select
            field="severity"
            label="严重级别"
            rules={[{ required: true }]}
            optionList={SEVERITY_OPTIONS}
          />
          <Form.Switch field="enabled" label="启用" />
        </Form>
      </SheetDetail>
    </>
  );
}

interface RuleFormValues {
  name: string;
  metricType: string;
  conditionOperator: string;
  threshold: number;
  timeWindowSeconds: number;
  aggregationFunction: string;
  severity: string;
  enabled: boolean;
}
