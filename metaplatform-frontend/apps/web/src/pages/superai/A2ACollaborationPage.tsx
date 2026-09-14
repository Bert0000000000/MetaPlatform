import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Form, Modal, Spin, Tag, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { RefreshCw, Send } from 'lucide-react';
import { delegateA2A, listExternalAgents } from '@/api/superai/a2a';
import type { ExternalAgent } from '@/api/superai/a2a';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

/**
 * SuperAI · A2A 外部协作（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 详情 Sheet）。
 *
 * 数据面沿用 src/api/superai/a2a：listExternalAgents（/agent-cards/search）+
 * delegateA2A（W3C 消息委托，返回任务 id / 状态）。委托是真实动作，回显走 Toast + 结果文本。
 */
export default function A2ACollaborationPage() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<ExternalAgent | null>(null);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listExternalAgents();
      setAgents(Array.isArray(res) ? res : []);
    } catch (e) {
      setAgents([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(kw) ||
        a.endpoint.toLowerCase().includes(kw) ||
        a.capabilities.some((c) => c.toLowerCase().includes(kw)),
    );
  }, [agents, keyword]);

  const handleDelegate = useCallback(async () => {
    if (!selected) return;
    const values = (await form.validate()) as { task: string };
    setDelegating(true);
    try {
      const res = await delegateA2A(selected.agentId, values.task);
      Toast.success(res.success ? '委托已提交' : '委托未完成');
      if (res.output) Toast.info({ content: res.output, duration: 6 });
      setDelegateOpen(false);
      form.reset();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDelegating(false);
    }
  }, [selected, form]);

  const columns: ColumnProps<ExternalAgent>[] = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', width: 200, ellipsis: true },
      {
        title: '能力',
        dataIndex: 'capabilities',
        render: (v: string[]) => (
          <span className="mp-exec-chips">
            {(v ?? []).map((c) => (
              <Tag key={c} type="light" color="blue">
                {c}
              </Tag>
            ))}
          </span>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: string) => <Tag type="light">{v || 'unknown'}</Tag>,
      },
      { title: '端点', dataIndex: 'endpoint', ellipsis: true },
      {
        title: '操作',
        key: 'actions',
        width: 110,
        render: (_: unknown, row: ExternalAgent) => (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Send size={14} strokeWidth={1.5} />}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(row);
              setDelegateOpen(true);
            }}
          >
            委托
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="A2A 外部协作"
        desc={`${agents.length} 个外部 Agent · 通过 W3C A2A 消息协议委托任务`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称、能力或端点…' }}
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
      ) : loading && agents.length === 0 ? (
        <div className="mp-exec-loading">
          <Spin size="middle" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={agents.length === 0 ? 'no-content' : 'no-result'}
          title={agents.length === 0 ? '没有可用的外部 Agent' : '没有匹配的外部 Agent'}
          desc={agents.length === 0 ? 'A2A 中心注册 agent-card 后会出现在这里。' : '调整关键词再试。'}
        />
      ) : (
        <DataTablePro<ExternalAgent>
          columns={columns}
          dataSource={filtered}
          rowKey="agentId"
          loading={loading}
          onRow={(record) => ({ onClick: () => setSelected(record) })}
          empty={<EmptyState illustration="no-content" title="没有可用的外部 Agent" />}
        />
      )}

      <SheetDetail
        title={selected ? `外部 Agent · ${selected.name}` : '外部 Agent'}
        open={selected !== null}
        onClose={() => setSelected(null)}
        footer={
          <>
            <Button onClick={() => setSelected(null)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Send size={14} strokeWidth={1.5} />}
              onClick={() => setDelegateOpen(true)}
            >
              委托任务
            </Button>
          </>
        }
      >
        {selected ? (
          <Descriptions
            row
            data={[
              { key: '名称', value: selected.name },
              { key: 'Agent ID', value: selected.agentId || '—' },
              { key: '状态', value: selected.status || '—' },
              { key: '端点', value: selected.endpoint || '—' },
              {
                key: '能力',
                value: (
                  <span className="mp-exec-chips">
                    {(selected.capabilities ?? []).map((c) => (
                      <Tag key={c} type="light" color="blue">
                        {c}
                      </Tag>
                    ))}
                  </span>
                ),
              },
            ]}
          />
        ) : null}
      </SheetDetail>

      <Modal
        title={`委托任务给 ${selected?.name ?? ''}`}
        visible={delegateOpen}
        onCancel={() => setDelegateOpen(false)}
        onOk={() => void handleDelegate()}
        confirmLoading={delegating}
        okText="提交委托"
        cancelText="取消"
      >
        <Form form={form}>
          <Form.TextArea
            field="task"
            label="任务"
            rules={[{ required: true, message: '请填写任务描述' }]}
            rows={3}
            placeholder="详细任务描述…"
          />
        </Form>
      </Modal>
    </>
  );
}
