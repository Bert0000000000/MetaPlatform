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
  message,
  Popconfirm,
  Timeline,
  Typography,
  Progress,
  Row,
  Col,
  Statistic,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { listTechDebt, createTechDebt, updateTechDebt, deleteTechDebt } from '@/api/governance';
import type { TechDebt, RepaymentMilestone } from '@/types';

const SEVERITY_TAG: Record<string, string> = { CRITICAL: 'red', HIGH: 'volcano', MEDIUM: 'orange', LOW: 'blue' };
const STATUS_TAG: Record<string, { color: string; label: string }> = {
  OPEN: { color: 'orange', label: '待处理' },
  IN_PROGRESS: { color: 'blue', label: '处理中' },
  RESOLVED: { color: 'green', label: '已解决' },
  WONT_FIX: { color: 'default', label: '暂不修复' },
};
const LEVEL_TAG: Record<string, { color: string; label: string }> = {
  FATAL: { color: 'red', label: '致命' },
  SERIOUS: { color: 'volcano', label: '严重' },
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
    try { setList(await listTechDebt()); } finally { setLoading(false); }
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
    const values = await form.validateFields();
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
      message.success('更新成功');
    } else {
      await createTechDebt(payload);
      message.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const openEdit = (debt: TechDebt) => {
    setEditing(debt);
    const plan = debt.repaymentPlan || {};
    form.setFieldsValue({
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
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => setDetail(r)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteTechDebt(r.id); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
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
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增</Button>}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Statistic title="债务总数" value={summary.total} /></Col>
        <Col span={6}><Statistic title="致命级" value={summary.fatal} valueStyle={{ color: '#cf1322' }} /></Col>
        <Col span={6}><Statistic title="严重级" value={summary.serious} valueStyle={{ color: '#ff4d4f' }} /></Col>
        <Col span={6}><Statistic title="已解决" value={summary.resolved} valueStyle={{ color: '#3f8600' }} /></Col>
      </Row>

      <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />

      <Modal
        title={editing ? '编辑技术债务' : '新增技术债务'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="分类" initialValue="TECH_UPGRADE"><Input /></Form.Item>
          <Form.Item name="severity" label="严重度" initialValue="MEDIUM">
            <Select>
              <Select.Option value="CRITICAL">严重</Select.Option>
              <Select.Option value="HIGH">高</Select.Option>
              <Select.Option value="MEDIUM">中</Select.Option>
              <Select.Option value="LOW">低</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="debtLevel" label="债务等级" initialValue="GENERAL">
            <Select>
              <Select.Option value="FATAL">致命</Select.Option>
              <Select.Option value="SERIOUS">严重</Select.Option>
              <Select.Option value="GENERAL">一般</Select.Option>
              <Select.Option value="MINOR">轻微</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="OPEN">
            <Select>
              <Select.Option value="OPEN">待处理</Select.Option>
              <Select.Option value="IN_PROGRESS">处理中</Select.Option>
              <Select.Option value="RESOLVED">已解决</Select.Option>
              <Select.Option value="WONT_FIX">暂不修复</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="scopeType" label="影响范围类型">
            <Select allowClear placeholder="APPLICATION / TECH_STACK / INFRASTRUCTURE / DATA_ENTITY">
              <Select.Option value="APPLICATION">应用</Select.Option>
              <Select.Option value="TECH_STACK">技术栈</Select.Option>
              <Select.Option value="INFRASTRUCTURE">基础设施</Select.Option>
              <Select.Option value="DATA_ENTITY">数据实体</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="scopeId" label="影响范围 ID"><Input /></Form.Item>
          <Form.Item name="impactScore" label="影响分"><Input type="number" /></Form.Item>
          <Form.Item name="remediation" label="修复方案"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="estimatedEffort" label="预估投入"><Input placeholder="人天 / 工时" /></Form.Item>
          <Form.Item name="owner" label="负责人"><Input /></Form.Item>
          <Typography.Text strong>清偿计划</Typography.Text>
          <Form.Item name={['repaymentPlan', 'targetDate']} label="目标日期"><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name={['repaymentPlan', 'owner']} label="清偿负责人"><Input /></Form.Item>
          <Form.Item name={['repaymentPlan', 'budget']} label="预算"><Input /></Form.Item>
          <Form.Item name={['repaymentPlan', 'milestones']} label="里程碑（每行：名称,目标日期,状态）">
            <Input.TextArea rows={3} placeholder="方案设计,2026-08-01,PENDING\n落地实施,2026-09-01,PENDING" />
          </Form.Item>
          <Form.Item name={['repaymentPlan', 'notes']} label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="技术债务详情" open={!!detail} onCancel={() => setDetail(null)} footer={<Button type="primary" onClick={() => setDetail(null)}>关闭</Button>} width={640}>
        {detail && (
          <div>
            <Typography.Title level={5}>{detail.title}</Typography.Title>
            <Typography.Paragraph type="secondary">编码：{detail.code}</Typography.Paragraph>
            <Typography.Paragraph type="secondary">描述：{detail.description || '-'}</Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              等级：<Tag color={LEVEL_TAG[detail.debtLevel]?.color}>{LEVEL_TAG[detail.debtLevel]?.label}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              状态：<Tag color={STATUS_TAG[detail.status]?.color}>{STATUS_TAG[detail.status]?.label}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">负责人：{detail.owner || '-'}</Typography.Paragraph>
            {detail.repaymentPlan && (
              <>
                <Typography.Text strong>清偿计划</Typography.Text>
                <Timeline
                  items={(detail.repaymentPlan.milestones || []).map((m) => ({
                    color: m.status === 'DONE' ? 'green' : 'blue',
                    children: (
                      <div>
                        <Typography.Text strong>{m.name}</Typography.Text>
                        <Tag color={m.status === 'DONE' ? 'green' : 'default'} style={{ marginLeft: 8 }}>{m.status || 'PENDING'}</Tag>
                        <br />
                        <Typography.Text type="secondary">{m.targetDate || '未排期'}</Typography.Text>
                      </div>
                    ),
                  }))}
                />
                {detail.repaymentPlan.notes && <Typography.Paragraph type="secondary">备注：{detail.repaymentPlan.notes}</Typography.Paragraph>}
              </>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
