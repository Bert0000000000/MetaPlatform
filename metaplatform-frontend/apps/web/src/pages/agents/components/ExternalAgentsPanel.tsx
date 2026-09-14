import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Eye, RefreshCw, Send, Star } from 'lucide-react';
import {
  cancelDelegation,
  createDelegation,
  discoverAgents,
  getDelegation,
  listDelegations,
  streamDelegation,
} from '@/api/dw/a2a';
import type {
  Delegation,
  DelegationStatus,
  ExternalAgent,
  StatusHistoryEntry,
} from '@/api/dw/a2a';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import '../agents.css';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

const STATUS_LABEL: Record<string, { label: string; color: TagColor }> = {
  SUBMITTED: { label: '已提交', color: 'grey' },
  WORKING: { label: '执行中', color: 'blue' },
  INPUT_REQUIRED: { label: '需输入', color: 'orange' },
  COMPLETED: { label: '已完成', color: 'green' },
  FAILED: { label: '失败', color: 'red' },
  CANCELED: { label: '已取消', color: 'grey' },
  PENDING: { label: '待处理', color: 'grey' },
  SENT: { label: '已发送', color: 'blue' },
  IN_PROGRESS: { label: '进行中', color: 'blue' },
  CANCELLED: { label: '已取消', color: 'grey' },
};

const AGENT_STATUS: Record<ExternalAgent['status'], { label: string; color: TagColor }> = {
  online: { label: '在线', color: 'green' },
  offline: { label: '离线', color: 'grey' },
  error: { label: '异常', color: 'red' },
};

// Timeline 圆点色（Semi Timeline.Item color 直接作为 CSS backgroundColor）
const TAG_TO_DOT: Record<string, string> = {
  grey: 'var(--semi-color-tertiary)',
  blue: 'var(--semi-color-primary)',
  green: 'var(--semi-color-success)',
  red: 'var(--semi-color-danger)',
  orange: 'var(--semi-color-warning)',
};

const STATUS_FLOW: DelegationStatus[] = ['SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'COMPLETED'];

function isTerminal(status: string): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(status);
}

/** 委托详情（SheetDetail + 3s 轮询 + SSE 实时事件）。 */
function DelegationDetailSheet({
  delegationId,
  onClose,
  onChange,
}: {
  delegationId: string | null;
  onClose: () => void;
  onChange: (d: Delegation) => void;
}) {
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [liveEvents, setLiveEvents] = useState<StatusHistoryEntry[]>([]);

  const load = useCallback(
    async (id: string) => {
      try {
        const d = await getDelegation(id);
        setDelegation(d);
        setError('');
        onChange(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (!delegationId) {
      setDelegation(null);
      setLiveEvents([]);
      setError('');
      return;
    }
    setLoading(true);
    void load(delegationId).finally(() => setLoading(false));

    const interval = setInterval(() => {
      void load(delegationId);
    }, 3000);
    const stopStream = streamDelegation(delegationId, {
      onProgress: (entry) => setLiveEvents((prev) => [...prev, entry]),
      onCompleted: () => void load(delegationId),
      onFailed: () => void load(delegationId),
      onCanceled: () => void load(delegationId),
    });

    return () => {
      clearInterval(interval);
      stopStream();
    };
  }, [delegationId, load]);

  const currentStep = useMemo(() => {
    if (!delegation) return -1;
    if (isTerminal(delegation.status)) return STATUS_FLOW.length;
    const idx = STATUS_FLOW.indexOf(delegation.status);
    return idx >= 0 ? idx : 0;
  }, [delegation]);

  const mergedHistory = useMemo(
    () => [...(delegation?.statusHistory ?? []), ...liveEvents],
    [delegation, liveEvents],
  );

  const handleCancel = async () => {
    if (!delegationId) return;
    setCanceling(true);
    try {
      const d = await cancelDelegation(delegationId);
      setDelegation(d);
      onChange(d);
      Toast.success('委托已取消');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCanceling(false);
    }
  };

  return (
    <SheetDetail
      title="委托详情"
      open={!!delegationId}
      onClose={onClose}
      footer={
        delegation && !isTerminal(delegation.status) ? (
          <Button type="danger" loading={canceling} onClick={() => void handleCancel()}>
            取消委托
          </Button>
        ) : (
          <Button onClick={onClose}>关闭</Button>
        )
      }
    >
      {error ? (
        <EmptyState
          illustration="failure"
          title="委托详情加载失败"
          desc={error}
          actions={
            <Button
              theme="solid"
              type="primary"
              onClick={() => delegationId && void load(delegationId)}
            >
              重试
            </Button>
          }
        />
      ) : loading && !delegation ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : delegation ? (
        <>
          <Descriptions
            row
            data={[
              { key: '目标 Agent', value: delegation.targetAgentId },
              { key: '任务类型', value: delegation.taskType },
              {
                key: '当前状态',
                value: (
                  <Tag color={STATUS_LABEL[delegation.status]?.color ?? 'grey'} type="light">
                    {STATUS_LABEL[delegation.status]?.label ?? delegation.status}
                  </Tag>
                ),
              },
              { key: '创建时间', value: new Date(delegation.createdAt).toLocaleString() },
              {
                key: '完成时间',
                value: delegation.completedAt
                  ? new Date(delegation.completedAt).toLocaleString()
                  : '—',
              },
            ]}
          />

          <Steps current={currentStep} status={isTerminal(delegation.status) ? 'error' : 'process'}>
            <Steps.Step title="已提交" />
            <Steps.Step title="执行中" />
            <Steps.Step title="需输入" />
            <Steps.Step title="已完成" />
          </Steps>

          <div>
            <Typography.Text strong>状态时间线</Typography.Text>
            {mergedHistory.length === 0 ? (
              <Typography.Paragraph type="tertiary">暂无状态变更记录</Typography.Paragraph>
            ) : (
              <Timeline>
                {mergedHistory.map((h, idx) => (
                  <Timeline.Item
                    key={`${h.timestamp}-${idx}`}
                    color={TAG_TO_DOT[STATUS_LABEL[h.status]?.color ?? 'blue']}
                  >
                    <span className="mp-agent-line">
                      <Tag color={STATUS_LABEL[h.status]?.color ?? 'grey'} type="light">
                        {STATUS_LABEL[h.status]?.label ?? h.status}
                      </Tag>
                      <Typography.Text type="tertiary" size="small">
                        {new Date(h.timestamp).toLocaleString()}
                      </Typography.Text>
                    </span>
                    {h.detail ? <Typography.Paragraph>{h.detail}</Typography.Paragraph> : null}
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </div>

          {delegation.status === 'COMPLETED' && delegation.result ? (
            <div>
              <Typography.Text strong>执行结果</Typography.Text>
              <pre>{JSON.stringify(delegation.result, null, 2)}</pre>
            </div>
          ) : null}

          {isTerminal(delegation.status) && delegation.error ? (
            <div>
              <Typography.Text strong type="danger">
                错误信息
              </Typography.Text>
              <Typography.Paragraph type="danger">{delegation.error}</Typography.Paragraph>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState illustration="no-content" title="未找到委托" />
      )}
    </SheetDetail>
  );
}

/** 委托任务表单（Modal + Form → createDelegation）。 */
function DelegateModal({
  agent,
  onCancel,
  onSuccess,
}: {
  agent: ExternalAgent | null;
  onCancel: () => void;
  onSuccess: (d: Delegation) => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!agent) return;
    let v: { task?: string; payload?: string };
    try {
      v = await form.validate();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { task: v.task };
      if (v.payload) {
        try {
          payload['data'] = JSON.parse(v.payload);
        } catch {
          Toast.warning('附加数据不是合法 JSON');
          return;
        }
      }
      const res = await createDelegation({
        sourceAgentId: 'app-dw',
        targetAgentId: agent.agentId,
        taskType: 'a2a-delegation',
        payload,
      });
      Toast.success('外部委托已提交');
      form.reset();
      onSuccess(res);
      onCancel();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={agent ? `委托任务 · ${agent.name}` : '委托任务'}
      visible={agent !== null}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      confirmLoading={submitting}
      okText="提交委托"
      cancelText="取消"
      keepDOM={false}
      width={640}
    >
      <Form form={form}>
        <Form.Slot label="外部 Agent 能力">
          <div className="mp-agent-chips">
            {(agent?.capabilities ?? []).length === 0 ? (
              <Typography.Text type="tertiary">该 Agent 未声明能力</Typography.Text>
            ) : (
              agent?.capabilities.map((c) => (
                <Tag key={c} color="blue" type="light">
                  {c}
                </Tag>
              ))
            )}
          </div>
        </Form.Slot>
        <Form.TextArea
          field="task"
          label="任务目标"
          rules={[{ required: true, message: '请描述任务目标' }]}
          rows={3}
          placeholder="详细描述要外部 Agent 完成的任务…"
        />
        <Form.TextArea
          field="payload"
          label="附加数据 (JSON)"
          extraText="提供给外部 Agent 的初始数据"
          rows={4}
          placeholder='{"key": "value"}'
        />
      </Form>
    </Modal>
  );
}

/**
 * 外部员工 · A2A（DESIGN-SPEC §5：页头 + 筛选栏 + 卡片网格 + 委托表格）。
 *
 * 数据面沿用 src/api/dw/a2a：discoverAgents / listDelegations / createDelegation /
 * getDelegation / streamDelegation / cancelDelegation。无任何示例数据或 mock 兜底。
 */
export default function ExternalAgentsPanel() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [agentStatus, setAgentStatus] = useState<ExternalAgent['status'] | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [delegating, setDelegating] = useState<ExternalAgent | null>(null);
  const [viewing, setViewing] = useState<ExternalAgent | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, d] = await Promise.all([discoverAgents(), listDelegations({ pageSize: 100 })]);
      setAgents(a ?? []);
      setDelegations(d.items ?? []);
    } catch (e) {
      setAgents([]);
      setDelegations([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDiscover = async () => {
    setLoading(true);
    setError('');
    try {
      await discoverAgents();
      Toast.success('已重新发现外部 Agent');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return agents.filter((a) => {
      if (agentStatus && a.status !== agentStatus) return false;
      if (!kw) return true;
      return (
        a.name.toLowerCase().includes(kw) ||
        (a.description ?? '').toLowerCase().includes(kw) ||
        (a.endpoint ?? '').toLowerCase().includes(kw)
      );
    });
  }, [agents, keyword, agentStatus]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const handleDelegationSuccess = (d: Delegation) => {
    setDelegations((prev) => [d, ...prev]);
    setDetailId(d.taskId);
  };

  const handleDelegationChange = (d: Delegation) => {
    setDelegations((prev) => prev.map((item) => (item.taskId === d.taskId ? d : item)));
  };

  const delegationColumns: SemiColumns<Delegation> = [
    {
      title: '委托任务',
      key: 'task',
      render: (_: unknown, d: Delegation) => (
        <span className="mp-agent-line">
          <Typography.Text strong>
            {typeof d.payload?.task === 'string' ? d.payload.task : d.taskType}
          </Typography.Text>
          <Typography.Text type="tertiary" size="small">
            目标：{d.targetAgentId}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: DelegationStatus) => (
        <Tag color={STATUS_LABEL[v]?.color ?? 'grey'} type="light">
          {STATUS_LABEL[v]?.label ?? v}
        </Tag>
      ),
    },
    {
      title: '结果摘要',
      dataIndex: 'result',
      ellipsis: true,
      render: (v?: Record<string, unknown>) => (v ? JSON.stringify(v) : '—'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, d: Delegation) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          icon={<Eye size={14} strokeWidth={1.5} />}
          onClick={() => setDetailId(d.taskId)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="外部员工 · A2A"
        desc={`基于 A2A 协议注册：共 ${agents.length} 个外部 Agent · ${delegations.length} 条委托记录`}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Send size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void handleDiscover()}
            >
              发现外部 Agent
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称、描述或 Endpoint…' }}
        filters={
          <Select
            value={agentStatus}
            onChange={(v) => setAgentStatus(v as ExternalAgent['status'] | '')}
            placeholder="全部状态"
          >
            <Select.Option value="">全部状态</Select.Option>
            <Select.Option value="online">在线</Select.Option>
            <Select.Option value="offline">离线</Select.Option>
            <Select.Option value="error">异常</Select.Option>
          </Select>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="外部 Agent 加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : (
        <Row gutter={[0, 16]}>
          <Col span={24}>
            {loading && agents.length === 0 ? (
              <div className="mp-agent-loading">
                <Spin size="middle" />
              </div>
            ) : agents.length === 0 ? (
              <EmptyState
                illustration="no-content"
                title="尚未发现外部 Agent"
                desc="外部 Agent 通过 A2A 协议注册后，这里会列出它们的卡片。"
                actions={
                  <Button theme="solid" type="primary" onClick={() => void handleDiscover()}>
                    开始发现
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                illustration="no-result"
                title="没有匹配的外部 Agent"
                desc="调整关键词或状态筛选。"
              />
            ) : (
              <div className="mp-agents-grid">
                {paged.map((a) => {
                  const status = AGENT_STATUS[a.status];
                  return (
                    <Card
                      key={a.agentId}
                      className="mp-agent-card-wrap"
                      shadows="hover"
                      actions={[
                        <Button
                          key="delegate"
                          theme="borderless"
                          type="primary"
                          size="small"
                          onClick={() => setDelegating(a)}
                        >
                          委托任务
                        </Button>,
                        <Button
                          key="detail"
                          theme="borderless"
                          type="tertiary"
                          size="small"
                          onClick={() => setViewing(a)}
                        >
                          详情
                        </Button>,
                      ]}
                    >
                      <div className="mp-agent-head">
                        <span className="mp-agent-avatar">{(a.name || 'A').slice(0, 1)}</span>
                        <div className="mp-agent-head-main">
                          <div className="mp-agent-name-row">
                            <span className="mp-agent-name">{a.name || a.agentId}</span>
                          </div>
                          <div className="mp-agent-sub">
                            <span className="mp-agent-sub-role">{a.endpoint || a.agentId}</span>
                          </div>
                        </div>
                        <Tag color={status.color} type="light">
                          {status.label}
                        </Tag>
                      </div>

                      <p className="mp-agent-desc">{a.description || '暂无描述'}</p>

                      <div className="mp-agent-chips">
                        {a.capabilities.length === 0 ? (
                          <Typography.Text type="tertiary" size="small">
                            未声明能力
                          </Typography.Text>
                        ) : (
                          <>
                            {a.capabilities.slice(0, 4).map((c) => (
                              <Tag key={c} type="light">
                                {c}
                              </Tag>
                            ))}
                            {a.capabilities.length > 4 ? (
                              <Tag type="light">+{a.capabilities.length - 4}</Tag>
                            ) : null}
                          </>
                        )}
                      </div>

                      <div className="mp-agent-stats">
                        <span className="mp-agent-stat">
                          <Star size={13} strokeWidth={1.5} />
                          {a.rating ? a.rating.toFixed(1) : '未评分'}
                        </span>
                        <span className="mp-agent-stat">{a.totalDelegations} 次委托</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Col>

          {filtered.length > pageSize ? (
            <Col span={24}>
              <Row type="flex" justify="end">
                <Space>
                  <Typography.Text type="tertiary" size="small">
                    第 {page} / {Math.ceil(filtered.length / pageSize)} 页 · 共 {filtered.length} 个
                  </Typography.Text>
                  <Select
                    value={pageSize}
                    onChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                    }}
                    optionList={[
                      { label: '12 / 页', value: 12 },
                      { label: '24 / 页', value: 24 },
                      { label: '48 / 页', value: 48 },
                    ]}
                  />
                  <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    上一页
                  </Button>
                  <Button
                    disabled={page >= Math.ceil(filtered.length / pageSize)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </Space>
              </Row>
            </Col>
          ) : null}

          <Col span={24}>
            <Card title="委托历史">
              {!loading && delegations.length === 0 ? (
                <EmptyState
                  illustration="no-content"
                  title="暂无委托记录"
                  desc="向外部 Agent 发起委托后，执行进度会出现在这里。"
                />
              ) : (
                <DataTablePro<Delegation>
                  rowKey="taskId"
                  dataSource={delegations}
                  columns={delegationColumns}
                  loading={loading}
                  empty={<EmptyState illustration="no-content" title="暂无委托记录" />}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      <DelegateModal
        agent={delegating}
        onCancel={() => setDelegating(null)}
        onSuccess={handleDelegationSuccess}
      />

      <SheetDetail
        title={viewing ? `外部 Agent 详情 · ${viewing.name}` : '外部 Agent 详情'}
        open={viewing !== null}
        onClose={() => setViewing(null)}
        footer={
          <>
            <Button onClick={() => setViewing(null)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => {
                if (viewing) {
                  setDelegating(viewing);
                  setViewing(null);
                }
              }}
            >
              委托任务
            </Button>
          </>
        }
      >
        {viewing ? (
          <>
            <Descriptions
              row
              data={[
                { key: 'Agent ID', value: viewing.agentId },
                { key: 'Endpoint', value: viewing.endpoint || '—' },
                { key: '认证方式', value: viewing.authType },
                {
                  key: '状态',
                  value: (
                    <Tag color={AGENT_STATUS[viewing.status].color} type="light">
                      {AGENT_STATUS[viewing.status].label}
                    </Tag>
                  ),
                },
                { key: '评分', value: viewing.rating ? viewing.rating.toFixed(1) : '未评分' },
                { key: '委托次数', value: String(viewing.totalDelegations) },
                { key: '描述', value: viewing.description || '暂无描述' },
              ]}
            />
            <div className="mp-agent-chips">
              {viewing.capabilities.length === 0 ? (
                <Typography.Text type="tertiary">未声明能力</Typography.Text>
              ) : (
                viewing.capabilities.map((c) => (
                  <Tag key={c} color="blue" type="light">
                    {c}
                  </Tag>
                ))
              )}
            </div>
          </>
        ) : null}
      </SheetDetail>

      <DelegationDetailSheet
        delegationId={detailId}
        onClose={() => setDetailId(null)}
        onChange={handleDelegationChange}
      />
    </>
  );
}
