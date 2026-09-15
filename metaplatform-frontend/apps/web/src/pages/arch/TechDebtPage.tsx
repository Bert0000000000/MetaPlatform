import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Descriptions,
  Form,
  Popconfirm,
  Progress,
  Select,
  Tag,
  Timeline,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { FileText, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { createTechDebt, deleteTechDebt, listTechDebt, updateTechDebt } from '@/api/arch/governance';
import type { TechDebt, RepaymentMilestone } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

const SEVERITY_TAG: Record<string, { color: TagColor; label: string }> = {
  CRITICAL: { color: 'red', label: '严重' },
  HIGH: { color: 'orange', label: '高' },
  MEDIUM: { color: 'orange', label: '中' },
  LOW: { color: 'blue', label: '低' },
};

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  OPEN: { color: 'orange', label: '待处理' },
  IN_PROGRESS: { color: 'blue', label: '处理中' },
  RESOLVED: { color: 'green', label: '已解决' },
  WONT_FIX: { color: 'grey', label: '暂不修复' },
};

const LEVEL_TAG: Record<string, { color: TagColor; label: string }> = {
  FATAL: { color: 'red', label: '致命' },
  SERIOUS: { color: 'orange', label: '严重' },
  GENERAL: { color: 'orange', label: '一般' },
  MINOR: { color: 'blue', label: '轻微' },
};

const planToText = (milestones?: RepaymentMilestone[]): string =>
  (milestones || [])
    .map((m) => `${m.name}${m.targetDate ? `,${m.targetDate}` : ''}${m.status ? `,${m.status}` : ''}`)
    .join('\n');

const parseMilestones = (text: string): RepaymentMilestone[] =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0],
        targetDate: parts[1],
        status: (parts[2] as RepaymentMilestone['status']) || 'PENDING',
      };
    });

const completionRate = (debt: TechDebt): number => {
  const milestones = debt.repaymentPlan?.milestones || [];
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.status === 'DONE').length;
  return Math.round((done / milestones.length) * 100);
};

/**
 * 治理 · 技术债务分级与清偿计划（/governance/tech-debts）。
 * 顶部指标取全量返回数据统计；行内编辑与详情走右侧非模态浮层。
 */
export default function TechDebtPage() {
  const [list, setList] = useState<TechDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editing, setEditing] = useState<TechDebt | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<TechDebt | null>(null);
  const [form] = Form.useForm<Partial<TechDebt>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listTechDebt(level, status);
      setList(res ?? []);
    } catch (e) {
      setList([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [level, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, level, status]);

  const filtered = useMemo(
    () =>
      list.filter((d) =>
        keyword ? `${d.title} ${d.code} ${d.owner ?? ''}`.toLowerCase().includes(keyword.toLowerCase()) : true,
      ),
    [list, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const summary = useMemo(
    () => ({
      total: list.length,
      fatal: list.filter((d) => d.debtLevel === 'FATAL').length,
      serious: list.filter((d) => d.debtLevel === 'SERIOUS').length,
      resolved: list.filter((d) => d.status === 'RESOLVED').length,
    }),
    [list],
  );

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (debt: TechDebt) => {
    setEditing(debt);
    const plan = debt.repaymentPlan || {};
    form.setValues({
      ...debt,
      repaymentPlan: { ...plan, milestones: planToText(plan.milestones) },
    } as unknown as Partial<TechDebt>);
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      const plan = values.repaymentPlan || {};
      const payload: Partial<TechDebt> = {
        ...values,
        repaymentPlan: {
          targetDate: plan.targetDate,
          owner: plan.owner,
          budget: plan.budget,
          notes: plan.notes,
          milestones: parseMilestones(plan.milestones as unknown as string),
        },
      };
      if (editing) {
        await updateTechDebt(editing.id, payload);
        Toast.success('已更新');
      } else {
        await createTechDebt(payload);
        Toast.success('已创建');
      }
      setDraftOpen(false);
      setEditing(null);
      form.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTechDebt(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 220, ellipsis: true },
    { title: '编码', dataIndex: 'code', key: 'code', width: 140, ellipsis: true },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      ellipsis: true,
      render: (c?: string) => (c ? <Tag type="light">{c}</Tag> : '—'),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: string) => (
        <Tag color={SEVERITY_TAG[s]?.color ?? 'grey'} type="light">
          {SEVERITY_TAG[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '债务等级',
      dataIndex: 'debtLevel',
      key: 'debtLevel',
      width: 110,
      render: (l: string) => (
        <Tag color={LEVEL_TAG[l]?.color ?? 'grey'} type="light">
          {LEVEL_TAG[l]?.label ?? l}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={STATUS_TAG[s]?.color ?? 'grey'} type="light">
          {STATUS_TAG[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      render: (v?: string) => v || '—',
    },
    {
      title: '清偿进度',
      dataIndex: '__progress__',
      key: '__progress__',
      width: 140,
      render: (_: unknown, row: TechDebt) => <Progress percent={completionRate(row)} size="small" />,
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 230,
      render: (_: unknown, row: TechDebt) => (
        <>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<FileText size={14} strokeWidth={1.5} />}
            onClick={() => setDetail(row)}
          >
            详情
          </Button>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Pencil size={14} strokeWidth={1.5} />}
            onClick={() => openEdit(row)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该债务？"
            content="删除操作会写入审计日志。"
            onConfirm={() => void remove(row.id)}
          >
            <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={14} strokeWidth={1.5} />}>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="技术债务"
        desc={`${summary.total} 项债务 · ${summary.fatal} 项致命级 · ${summary.resolved} 项已解决`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增债务
            </Button>
          </>
        }
      />

      <Descriptions
        row
        data={[
          { key: '债务总数', value: summary.total },
          { key: '致命级', value: summary.fatal },
          { key: '严重级', value: summary.serious },
          { key: '已解决', value: summary.resolved },
        ]}
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索标题、编码、负责人…' }}
        filters={
          <>
            <Select value={level ?? ''} onChange={(v) => setLevel(v ? String(v) : undefined)} placeholder="全部等级">
              <Select.Option value="">全部等级</Select.Option>
              {(Object.keys(LEVEL_TAG) as string[]).map((l) => (
                <Select.Option key={l} value={l}>
                  {LEVEL_TAG[l].label}
                </Select.Option>
              ))}
            </Select>
            <Select value={status ?? ''} onChange={(v) => setStatus(v ? String(v) : undefined)} placeholder="全部状态">
              <Select.Option value="">全部状态</Select.Option>
              {(Object.keys(STATUS_TAG) as string[]).map((s) => (
                <Select.Option key={s} value={s}>
                  {STATUS_TAG[s].label}
                </Select.Option>
              ))}
            </Select>
          </>
        }
      />

      <DataTablePro<TechDebt>
        columns={columns}
        dataSource={paged}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="技术债务加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无技术债务"
              desc="登记技术债务并制定清偿计划。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增债务
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={detail ? `债务详情 · ${detail.title}` : '债务详情'}
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail ? (
          <div>
            <Descriptions
              row
              data={[
                { key: '编码', value: detail.code },
                { key: '描述', value: detail.description || '—' },
                { key: '等级', value: LEVEL_TAG[detail.debtLevel]?.label ?? detail.debtLevel },
                { key: '状态', value: STATUS_TAG[detail.status]?.label ?? detail.status },
                { key: '负责人', value: detail.owner || '—' },
                { key: '清偿进度', value: `${completionRate(detail)}%` },
              ]}
            />

            {detail.repaymentPlan ? (
              <div>
                <Typography.Text strong>清偿计划</Typography.Text>
                {(detail.repaymentPlan.milestones ?? []).length === 0 ? (
                  <Typography.Text type="tertiary">暂未排期里程碑。</Typography.Text>
                ) : (
                  <Timeline
                    dataSource={(detail.repaymentPlan.milestones ?? []).map((m) => ({
                      color: m.status === 'DONE' ? 'green' : 'blue',
                      content: (
                        <div>
                          <Typography.Text strong>{m.name}</Typography.Text>{' '}
                          <Tag color={m.status === 'DONE' ? 'green' : 'grey'} type="light">
                            {m.status || 'PENDING'}
                          </Tag>
                          <Typography.Paragraph type="tertiary">{m.targetDate || '未排期'}</Typography.Paragraph>
                        </div>
                      ),
                    }))}
                  />
                )}
                {detail.repaymentPlan.notes ? (
                  <Typography.Paragraph type="tertiary">备注：{detail.repaymentPlan.notes}</Typography.Paragraph>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editing ? `编辑技术债务 · ${editing.title}` : '新增技术债务'}
        open={draftOpen}
        onClose={() => {
          setDraftOpen(false);
          setEditing(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setDraftOpen(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={form} labelPosition="left" labelWidth={110}>
          <Form.Input field="title" label="标题" rules={[{ required: true, message: '请输入标题' }]} placeholder="订单服务单体拆分" />
          <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} placeholder="TD-2026-001" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.Input field="category" label="分类" initValue="TECH_UPGRADE" />
          <Form.Select
            field="severity"
            label="严重度"
            initValue="MEDIUM"
            optionList={[
              { value: 'CRITICAL', label: '严重' },
              { value: 'HIGH', label: '高' },
              { value: 'MEDIUM', label: '中' },
              { value: 'LOW', label: '低' },
            ]}
          />
          <Form.Select
            field="debtLevel"
            label="债务等级"
            initValue="GENERAL"
            optionList={[
              { value: 'FATAL', label: '致命' },
              { value: 'SERIOUS', label: '严重' },
              { value: 'GENERAL', label: '一般' },
              { value: 'MINOR', label: '轻微' },
            ]}
          />
          <Form.Select
            field="status"
            label="状态"
            initValue="OPEN"
            optionList={[
              { value: 'OPEN', label: '待处理' },
              { value: 'IN_PROGRESS', label: '处理中' },
              { value: 'RESOLVED', label: '已解决' },
              { value: 'WONT_FIX', label: '暂不修复' },
            ]}
          />
          <Form.Select
            field="scopeType"
            label="影响范围"
            showClear
            placeholder="APPLICATION / TECH_STACK / INFRASTRUCTURE / DATA_ENTITY"
            optionList={[
              { value: 'APPLICATION', label: '应用' },
              { value: 'TECH_STACK', label: '技术栈' },
              { value: 'INFRASTRUCTURE', label: '基础设施' },
              { value: 'DATA_ENTITY', label: '数据实体' },
            ]}
          />
          <Form.Input field="scopeId" label="范围 ID" placeholder="选填" />
          <Form.InputNumber field="impactScore" label="影响分" />
          <Form.TextArea field="remediation" label="修复方案" rows={2} placeholder="选填" />
          <Form.Input field="estimatedEffort" label="预估投入" placeholder="人天 / 工时" />
          <Form.Input field="owner" label="负责人" placeholder="选填" />
          <Typography.Text strong>清偿计划</Typography.Text>
          <Form.Input field="repaymentPlan.targetDate" label="目标日期" placeholder="YYYY-MM-DD" />
          <Form.Input field="repaymentPlan.owner" label="清偿负责人" placeholder="选填" />
          <Form.Input field="repaymentPlan.budget" label="预算" placeholder="选填" />
          <Form.TextArea
            field="repaymentPlan.milestones"
            label="里程碑"
            rows={3}
            placeholder={'每行：名称,目标日期,状态\n方案设计,2026-08-01,PENDING\n落地实施,2026-09-01,PENDING'}
          />
          <Form.TextArea field="repaymentPlan.notes" label="备注" rows={2} placeholder="选填" />
        </Form>
      </SheetDetail>
    </>
  );
}
