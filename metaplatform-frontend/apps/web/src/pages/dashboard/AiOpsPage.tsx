import { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  SideSheet,
  Timeline,
  Typography,
  Tabs,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Toast,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import {
  SearchOutlined,
  MedicineBoxOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAsync, useApiErrorBoundary } from '@mate/shared';
// helper type used below; not exported from antd
import type { NormalizedError } from '@mate/shared';
import {
  getAnomalies,
  getAnomalyRules,
  analyzeAnomaly,
  remediateAnomaly,
  createAnomalyRule,
  updateAnomalyRule,
  deleteAnomalyRule,
} from '@/api/anomaly';
import type {
  AnomalyEvent,
  AnomalyDetectionRule,
  AnomalySeverity,
  AnomalyStatus,
  RemediationResult,
  RootCauseAnalysisResult,
} from '@/types';
import { PageHeader, StateContainer } from '@/components/common';
import { useSettings } from '@/contexts/SettingsContext';
import { formatRelative } from '@/utils/datetime';

const { Text, Paragraph } = Typography;

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

// 统计卡片（Statistic 无 Semi 等价物，自建 label + 大数字）
function Stat({ title, value, valueStyle }: { title: string; value: string | number; valueStyle?: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--foreground)', ...valueStyle }}>{value}</div>
    </div>
  );
}

export default function AiOpsPage() {
  const { report } = useApiErrorBoundary();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('events');

  const {
    data: events,
    loading: eventsLoading,
    error: eventsError,
    reload: reloadEvents,
  } = useAsync<AnomalyEvent[]>(() => getAnomalies(), []);

  const {
    data: rules,
    loading: rulesLoading,
    error: rulesError,
    reload: reloadRules,
  } = useAsync<AnomalyDetectionRule[]>(() => getAnomalyRules(), []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AnomalyEvent | null>(null);
  const [analysis, setAnalysis] = useState<RootCauseAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [remediation, setRemediation] = useState<RemediationResult | null>(null);
  const [remediating, setRemediating] = useState(false);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AnomalyDetectionRule | null>(null);
  const [ruleForm] = Form.useForm<RuleFormValues>();

  const handleAnalyze = async (event: AnomalyEvent) => {
    setAnalyzing(true);
    try {
      const result = await analyzeAnomaly(event.id);
      setAnalysis(result);
      Toast.success('根因分析完成');
      reloadEvents();
    } catch (e) {
      report(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemediate = async (event: AnomalyEvent, mode: 'ADVISE' | 'AUTO') => {
    setRemediating(true);
    try {
      const result = await remediateAnomaly(event.id, mode, event.remediationAction);
      setRemediation(result);
      Toast.info(result.executed ? '修复 Action 已执行' : '已生成修复建议');
      if (result.executed) {
        reloadEvents();
      }
    } catch (e) {
      report(e);
    } finally {
      setRemediating(false);
    }
  };

  const openDetail = (event: AnomalyEvent) => {
    setSelectedEvent(event);
    setAnalysis(null);
    setRemediation(null);
    setDrawerOpen(true);
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
    setRuleModalOpen(true);
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
    setRuleModalOpen(true);
  };

  const handleSaveRule = async (values: RuleFormValues) => {
    try {
      if (editingRule) {
        await updateAnomalyRule(editingRule.id, values);
        Toast.success('规则已更新');
      } else {
        await createAnomalyRule(values);
        Toast.success('规则已创建');
      }
      setRuleModalOpen(false);
      reloadRules();
    } catch (e) {
      report(e);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteAnomalyRule(id);
      Toast.success('规则已删除');
      reloadRules();
    } catch (e) {
      report(e);
    }
  };

  const eventColumns = [
    {
      title: '异常类型',
      dataIndex: 'anomalyType',
      key: 'anomalyType',
      render: (v: string) => METRIC_TYPE_LABEL[v] || v,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: AnomalySeverity) => <Tag color={SEVERITY_LABEL[v].color}>{SEVERITY_LABEL[v].label}</Tag>,
    },
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: AnomalyStatus) => <Tag color={STATUS_LABEL[v].color}>{STATUS_LABEL[v].label}</Tag>,
    },
    {
      title: '当前值',
      dataIndex: 'metricValue',
      key: 'metricValue',
      render: (v: number, record: AnomalyEvent) =>
        `${v}${record.anomalyType === 'ERROR_RATE' ? '%' : record.anomalyType === 'P99_LATENCY' ? 'ms' : ''}`,
    },
    {
      title: '发生时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      render: (v: string) => formatRelative(v, settings),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AnomalyEvent) => (
        <Space>
          <Button theme="borderless" icon={<SearchOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
          <Button theme="borderless" icon={<MedicineBoxOutlined />} onClick={() => handleAnalyze(record)} loading={analyzing}>
            根因分析
          </Button>
          {record.status !== 'RESOLVED' && (
            <Button
              theme="borderless"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRemediate(record, 'AUTO')}
              loading={remediating}
            >
              自动修复
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    {
      title: '指标类型',
      dataIndex: 'metricType',
      key: 'metricType',
      render: (v: string) => METRIC_TYPE_LABEL[v] || v,
    },
    { title: '条件', dataIndex: 'conditionOperator', key: 'conditionOperator' },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold' },
    { title: '聚合', dataIndex: 'aggregationFunction', key: 'aggregationFunction' },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: AnomalySeverity) => <Tag color={SEVERITY_LABEL[v].color}>{SEVERITY_LABEL[v].label}</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'grey'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AnomalyDetectionRule) => (
        <Space>
          <Button theme="borderless" icon={<EditOutlined />} onClick={() => openEditRule(record)}>
            编辑
          </Button>
          <Button theme="borderless" type="danger" icon={<DeleteOutlined />} onClick={() => handleDeleteRule(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>异常自动检测、根因分析与自愈</div>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="异常事件" itemKey="events">
            <StateContainer
              loading={eventsLoading}
              error={eventsError}
              isEmpty={!eventsLoading && !eventsError && (events ?? []).length === 0}
              emptyDescription="暂无异常事件"
              onRetry={reloadEvents}
            >
              <Table
                rowKey="id"
                dataSource={events ?? []}
                columns={eventColumns}
                pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
            </StateContainer>
          </Tabs.TabPane>
          <Tabs.TabPane tab="检测规则" itemKey="rules">
            <Space style={{ marginBottom: 16 }}>
              <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreateRule}>
                新建规则
              </Button>
            </Space>
            <StateContainer
              loading={rulesLoading}
              error={rulesError}
              isEmpty={!rulesLoading && !rulesError && (rules ?? []).length === 0}
              emptyDescription="暂无检测规则"
              onRetry={reloadRules}
            >
              <Table rowKey="id" dataSource={rules ?? []} columns={ruleColumns} pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
            </StateContainer>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <SideSheet
        title="异常详情"
        width={640}
        visible={drawerOpen}
        onCancel={() => setDrawerOpen(false)}
        footer={
          selectedEvent &&
          selectedEvent.status !== 'RESOLVED' && (
            <Space>
              <Button onClick={() => handleRemediate(selectedEvent, 'ADVISE')} loading={remediating}>
                生成修复建议
              </Button>
              <Button theme="solid" type="primary" onClick={() => handleRemediate(selectedEvent, 'AUTO')} loading={remediating}>
                执行自动修复
              </Button>
            </Space>
          )
        }
      >
        {selectedEvent && (
          <Space vertical style={{ width: '100%' }} spacing="loose">
            <Row gutter={16}>
              <Col span={8}>
                <Stat title="服务" value={selectedEvent.serviceName} />
              </Col>
              <Col span={8}>
                <Stat
                  title="严重级别"
                  value={SEVERITY_LABEL[selectedEvent.severity].label}
                  valueStyle={{ color: selectedEvent.severity === 'CRITICAL' ? 'var(--destructive)' : 'var(--warning)' }}
                />
              </Col>
              <Col span={8}>
                <Stat title="状态" value={STATUS_LABEL[selectedEvent.status].label} />
              </Col>
            </Row>

            <div>
              <Text strong>Trace ID</Text>
              <Paragraph copyable>{selectedEvent.traceId || '-'}</Paragraph>
            </div>

            {analysis && (
              <>
                <div>
                  <Text strong>根因分析结论</Text>
                  <Paragraph>{analysis.conclusion}</Paragraph>
                </div>
                <div>
                  <Text strong>修复建议</Text>
                  <Paragraph>
                    {ACTION_LABEL[analysis.suggestedAction] || analysis.suggestedAction}
                  </Paragraph>
                </div>
                {analysis.relatedLogs.length > 0 && (
                  <div>
                    <Text strong>关联日志</Text>
                    <Timeline
                      style={{ marginTop: 12 }}
                      dataSource={analysis.relatedLogs.map((log) => ({
                        content: (
                          <>
                            <Tag color={log.level === 'ERROR' ? 'red' : 'grey'}>{log.level}</Tag>
                            <Text type="secondary">{log.serviceName}</Text>
                            <div>{log.message}</div>
                          </>
                        ),
                      }))}
                    />
                  </div>
                )}
              </>
            )}

            {remediation && (
              <div>
                <Text strong>修复结果</Text>
                <Paragraph>
                  {remediation.executed ? '已执行' : '建议'}：
                  {remediation.actionName || ACTION_LABEL[remediation.actionCode] || remediation.actionCode}
                </Paragraph>
                <Paragraph>{remediation.message}</Paragraph>
                {remediation.executionId && <Text type="secondary">执行 ID: {remediation.executionId}</Text>}
              </div>
            )}
          </Space>
        )}
      </SideSheet>

      <Modal
        title={editingRule ? '编辑检测规则' : '新建检测规则'}
        visible={ruleModalOpen}
        onCancel={() => setRuleModalOpen(false)}
        onOk={() => ruleForm.submitForm()}
      >
        <Form form={ruleForm} onSubmit={handleSaveRule}>
          <Form.Input field="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]} placeholder="例如：高错误率检测" />
          <Form.Select
            field="metricType"
            label="指标类型"
            rules={[{ required: true }]}
            optionList={[
              { label: '错误率', value: 'ERROR_RATE' },
              { label: 'P99 延迟', value: 'P99_LATENCY' },
              { label: '错误码', value: 'ERROR_CODE' },
            ]}
          />
          <Form.Select
            field="conditionOperator"
            label="比较运算符"
            rules={[{ required: true }]}
            optionList={[
              { label: '大于', value: 'GT' },
              { label: '大于等于', value: 'GTE' },
              { label: '小于', value: 'LT' },
              { label: '小于等于', value: 'LTE' },
              { label: '等于', value: 'EQ' },
            ]}
          />
          <Form.InputNumber field="threshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]} style={{ width: '100%' }} />
          <Form.Select
            field="aggregationFunction"
            label="聚合函数"
            rules={[{ required: true }]}
            optionList={[
              { label: 'AVG', value: 'AVG' },
              { label: 'SUM', value: 'SUM' },
              { label: 'COUNT', value: 'COUNT' },
              { label: 'MAX', value: 'MAX' },
              { label: 'MIN', value: 'MIN' },
            ]}
          />
          <Form.InputNumber field="timeWindowSeconds" label="时间窗口（秒）" rules={[{ required: true }]} style={{ width: '100%' }} min={60} />
          <Form.Select
            field="severity"
            label="严重级别"
            rules={[{ required: true }]}
            optionList={[
              { label: '提示', value: 'INFO' },
              { label: '警告', value: 'WARNING' },
              { label: '严重', value: 'CRITICAL' },
            ]}
          />
          <Form.Switch field="enabled" label="启用" />
        </Form>
      </Modal>
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
