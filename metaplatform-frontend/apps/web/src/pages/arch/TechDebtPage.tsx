import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Toast,
  Popconfirm,
  Timeline,
  Typography,
  Progress,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { listTechDebt, createTechDebt, updateTechDebt, deleteTechDebt } from '@/api/arch/governance';
import type { TechDebt, RepaymentMilestone } from '@/api/arch/types';

const SEVERITY_TAG: Record<string, TagColor> = { CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'orange', LOW: 'blue' };
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

export default function TechDebtPage() {
  const [list, setList] = useState<TechDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TechDebt | null>(null);
  const [detail, setDetail] = useState<TechDebt | null>(null);
  const [form] = Form.useForm<Partial<TechDebt>>();

  const load = async () => {
    setLoading(true);
    try { const res = await listTechDebt(); setList(Array.isArray(res) ? res : ((res as { items?: TechDebt[] }).items ?? [])); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const planToText = (milestones?: RepaymentMilestone[]): string =>
    (milestones || []).map((m) => `${m.name}${m.targetDate ? `,${m.targetDate}` : ''}${m.status ? `,${m.status}` : ''}`).join('\n');

  const parseMilestones = (text: string): RepaymentMilestone[] =>
    text.split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return { name: parts[0], targetDate: parts[1], status: (parts[2] as RepaymentMilestone['status']) || 'PENDING' };
    });

  const handleSubmit = async () => {
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
      Toast.success('更新成功');
    } else {
      await createTechDebt(payload);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.reset();
    load();
  };

  const openEdit = (debt: TechDebt) => {
    setEditing(debt);
    const plan = debt.repaymentPlan || {};
    form.setValues({
      ...debt,
      repaymentPlan: {
        ...plan,
        milestones: planToText(plan.milestones),
      },
    } as unknown as Partial<TechDebt>);
    setModalOpen(true);
  };

  const completionRate = (debt: TechDebt): number => {
    const milestones = debt.repaymentPlan?.milestones || [];
    if (milestones.length === 0) return 0;
    const done = milestones.filter((m) => m.status === 'DONE').length;
    return Math.round((done / milestones.length) * 100);
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '分类', dataIndex: 'category', key: 'category', render: (c?: string) => c ? <Tag>{c}</Tag> : '-' },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => <Tag color={SEVERITY_TAG[s]}>{s}</Tag>,
    },
    {
      title: '债务等级',
      dataIndex: 'debtLevel',
      key: 'debtLevel',
      render: (l: string) => <Tag color={LEVEL_TAG[l]?.color}>{LEVEL_TAG[l]?.label}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag>,
    },
    { title: '负责人', dataIndex: 'owner', key: 'owner' },
    {
      title: '清偿进度',
      key: 'progress',
      render: (_: unknown, r: TechDebt) => <Progress percent={completionRate(r)} size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: TechDebt) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<FileTextOutlined />} onClick={() => setDetail(r)}>详情</Button>
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteTechDebt(r.id); Toast.success('已删除'); load(); }}>
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const summary = {
    total: list.length,
    fatal: list.filter((d) => d.debtLevel === 'FATAL').length,
    serious: list.filter((d) => d.debtLevel === 'SERIOUS').length,
    resolved: list.filter((d) => d.status === 'RESOLVED').length,
  };

  return (
    <Card
      title="技术债务分级与清偿计划"
      headerExtraContent={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新增</Button>}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div>
            <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>债务总数</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{summary.total}</div>
          </div>
        </Col>
        <Col span={6}>
          <div>
            <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>致命级</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--semi-color-danger)' }}>{summary.fatal}</div>
          </div>
        </Col>
        <Col span={6}>
          <div>
            <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>严重级</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--semi-color-danger)' }}>{summary.serious}</div>
          </div>
        </Col>
        <Col span={6}>
          <div>
            <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>已解决</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--semi-color-success)' }}>{summary.resolved}</div>
          </div>
        </Col>
      </Row>

      <Table rowKey="id" columns={columns} dataSource={list ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />

      <Modal
        title={editing ? '编辑技术债务' : '新增技术债务'}
        visible={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}
        width={720}
      >
        <Form form={form}>
          <Form.Input field="title" label="标题" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Input field="category" label="分类" initValue="TECH_UPGRADE" />
          <Form.Select field="severity" label="严重度" initValue="MEDIUM" optionList={[
            { value: 'CRITICAL', label: '严重' },
            { value: 'HIGH', label: '高' },
            { value: 'MEDIUM', label: '中' },
            { value: 'LOW', label: '低' },
          ]} />
          <Form.Select field="debtLevel" label="债务等级" initValue="GENERAL" optionList={[
            { value: 'FATAL', label: '致命' },
            { value: 'SERIOUS', label: '严重' },
            { value: 'GENERAL', label: '一般' },
            { value: 'MINOR', label: '轻微' },
          ]} />
          <Form.Select field="status" label="状态" initValue="OPEN" optionList={[
            { value: 'OPEN', label: '待处理' },
            { value: 'IN_PROGRESS', label: '处理中' },
            { value: 'RESOLVED', label: '已解决' },
            { value: 'WONT_FIX', label: '暂不修复' },
          ]} />
          <Form.Select field="scopeType" label="影响范围类型" showClear placeholder="APPLICATION / TECH_STACK / INFRASTRUCTURE / DATA_ENTITY" optionList={[
            { value: 'APPLICATION', label: '应用' },
            { value: 'TECH_STACK', label: '技术栈' },
            { value: 'INFRASTRUCTURE', label: '基础设施' },
            { value: 'DATA_ENTITY', label: '数据实体' },
          ]} />
          <Form.Input field="scopeId" label="影响范围 ID" />
          <Form.InputNumber field="impactScore" label="影响分" />
          <Form.TextArea field="remediation" label="修复方案" rows={2} />
          <Form.Input field="estimatedEffort" label="预估投入" placeholder="人天 / 工时" />
          <Form.Input field="owner" label="负责人" />
          <Typography.Text strong>清偿计划</Typography.Text>
          <Form.Input field="repaymentPlan.targetDate" label="目标日期" placeholder="YYYY-MM-DD" />
          <Form.Input field="repaymentPlan.owner" label="清偿负责人" />
          <Form.Input field="repaymentPlan.budget" label="预算" />
          <Form.TextArea field="repaymentPlan.milestones" label="里程碑（每行：名称,目标日期,状态）" rows={3} placeholder="方案设计,2026-08-01,PENDING\n落地实施,2026-09-01,PENDING" />
          <Form.TextArea field="repaymentPlan.notes" label="备注" rows={2} />
        </Form>
      </Modal>

      <Modal title="技术债务详情" visible={!!detail} onCancel={() => setDetail(null)} footer={<Button theme="solid" type="primary" onClick={() => setDetail(null)}>关闭</Button>} width={640}>
        {detail && (
          <div>
            <Typography.Title heading={5}>{detail.title}</Typography.Title>
            <Typography.Paragraph type="tertiary">编码：{detail.code}</Typography.Paragraph>
            <Typography.Paragraph type="tertiary">描述：{detail.description || '-'}</Typography.Paragraph>
            <Typography.Paragraph type="tertiary">
              等级：<Tag color={LEVEL_TAG[detail.debtLevel]?.color}>{LEVEL_TAG[detail.debtLevel]?.label}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph type="tertiary">
              状态：<Tag color={STATUS_TAG[detail.status]?.color}>{STATUS_TAG[detail.status]?.label}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph type="tertiary">负责人：{detail.owner || '-'}</Typography.Paragraph>
            {detail.repaymentPlan && (
              <>
                <Typography.Text strong>清偿计划</Typography.Text>
                <Timeline
                  dataSource={(detail.repaymentPlan.milestones || []).map((m) => ({
                    color: m.status === 'DONE' ? 'green' : 'blue',
                    content: (
                      <div>
                        <Typography.Text strong>{m.name}</Typography.Text>
                        <Tag color={m.status === 'DONE' ? 'green' : 'grey'} style={{ marginLeft: 8 }}>{m.status || 'PENDING'}</Tag>
                        <br />
                        <Typography.Text type="tertiary">{m.targetDate || '未排期'}</Typography.Text>
                      </div>
                    ),
                  }))}
                />
                {detail.repaymentPlan.notes && <Typography.Paragraph type="tertiary">备注：{detail.repaymentPlan.notes}</Typography.Paragraph>}
              </>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
