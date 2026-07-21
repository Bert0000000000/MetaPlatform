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
  Timeline,
  Typography,
  Tabs,
} from 'antd';
import { PlusOutlined, PlayCircleOutlined, CheckOutlined, CloseOutlined, CommentOutlined } from '@ant-design/icons';
import {
  listReviewTickets,
  createReviewTicket,
  startReviewTicket,
  approveReviewTicket,
  rejectReviewTicket,
  addReviewTicketComment,
  listReviewTemplates,
} from '@/api/governance';
import type { ReviewTicket, ReviewTemplate, ReviewScoreItem } from '@/types';

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  CREATED: { color: 'default', label: '已创建' },
  REVIEWING: { color: 'orange', label: '评审中' },
  APPROVED: { color: 'green', label: '已通过' },
  REJECTED: { color: 'red', label: '已驳回' },
};

export default function ReviewPage() {
  const [tickets, setTickets] = useState<ReviewTicket[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detail, setDetail] = useState<ReviewTicket | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'comment'>('comment');
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [ticketForm] = Form.useForm<Partial<ReviewTicket>>();
  const [actionForm] = Form.useForm<{ reviewer: string; comment: string; decision: string; scores: string }>();

  const load = async () => {
    setLoading(true);
    try {
      const [t, tpl] = await Promise.all([listReviewTickets(), listReviewTemplates()]);
      setTickets(t);
      setTemplates(tpl);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const values = await ticketForm.validateFields();
    await createReviewTicket(values);
    message.success('提交成功');
    setCreateModalOpen(false);
    ticketForm.resetFields();
    load();
  };

  const handleStart = async (ticket: ReviewTicket) => {
    await startReviewTicket(ticket.id, ticket.reviewer || 'system');
    message.success('评审已启动');
    load();
  };

  const openAction = (ticket: ReviewTicket, type: 'approve' | 'reject' | 'comment') => {
    setDetail(ticket);
    setActionType(type);
    actionForm.resetFields();
    setActionModalOpen(true);
  };

  const parseScores = (text: string, template: ReviewTemplate | undefined): ReviewScoreItem[] => {
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const dimensions = template?.dimensions || [];
    return lines.map((line, index) => {
      const [dimPart, scorePart] = line.split(':');
      const dimension = dimPart?.trim() || dimensions[index]?.name || line;
      const score = scorePart ? Number.parseInt(scorePart.trim(), 10) : undefined;
      return { dimension, score };
    });
  };

  const handleAction = async () => {
    if (!detail) return;
    const values = await actionForm.validateFields();
    const template = templates.find((t) => t.id === detail.templateId);
    const scores = parseScores(values.scores || '', template);

    if (actionType === 'comment') {
      await addReviewTicketComment(detail.id, values.reviewer, values.comment);
      message.success('评论已添加');
    } else if (actionType === 'approve') {
      await approveReviewTicket(detail.id, values.reviewer, scores, values.comment, values.decision);
      message.success('已通过');
    } else {
      await rejectReviewTicket(detail.id, values.reviewer, scores, values.comment, values.decision);
      message.success('已驳回');
    }
    setActionModalOpen(false);
    setDetail(null);
    actionForm.resetFields();
    load();
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r: ReviewTicket) => <Typography.Link onClick={() => setDetail(r)}>{v}</Typography.Link>,
    },
    { title: '模板', key: 'template', render: (_: unknown, r: ReviewTicket) => r.templateName || '-' },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    { title: '评审人', dataIndex: 'reviewer', key: 'reviewer' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: ReviewTicket) => (
        <Space>
          {r.status === 'CREATED' && (
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(r)}>启动</Button>
          )}
          {r.status === 'REVIEWING' && (
            <>
              <Button type="link" size="small" icon={<CommentOutlined />} onClick={() => openAction(r, 'comment')}>评论</Button>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openAction(r, 'approve')}>通过</Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => openAction(r, 'reject')}>驳回</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const scoreColumns = [
    { title: '维度', dataIndex: 'dimension', key: 'dimension' },
    { title: '得分', dataIndex: 'score', key: 'score', render: (v?: number) => v ?? '-' },
  ];

  return (
    <Card title="架构评审" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>提交评审</Button>}>
      <Table rowKey="id" columns={columns} dataSource={tickets} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />

      <Modal title="评审详情" open={!!detail && !actionModalOpen} onCancel={() => setDetail(null)} footer={null} width={640}>
        {detail && (
          <Tabs defaultActiveKey="info">
            <Tabs.TabPane tab="基本信息" key="info">
              <Typography.Title level={5}>{detail.title}</Typography.Title>
              <Typography.Paragraph type="secondary">模板：{detail.templateName || '-'}</Typography.Paragraph>
              <Typography.Paragraph type="secondary">申请人：{detail.applicant || '-'}</Typography.Paragraph>
              <Typography.Paragraph type="secondary">评审人：{detail.reviewer || '-'}</Typography.Paragraph>
              <Typography.Paragraph type="secondary">状态：<Tag color={STATUS_TAG[detail.status]?.color}>{STATUS_TAG[detail.status]?.label}</Tag></Typography.Paragraph>
              {detail.decision && <Typography.Paragraph type="secondary">决议：{detail.decision}</Typography.Paragraph>}
              {detail.scores.length > 0 && (
                <>
                  <Typography.Text strong>评分</Typography.Text>
                  <Table rowKey="dimension" columns={scoreColumns} dataSource={detail.scores} size="small" pagination={false} scroll={{ x: 'max-content' }} />
                </>
              )}
            </Tabs.TabPane>
            <Tabs.TabPane tab="评审记录" key="comments">
              <Timeline
                items={detail.comments?.map((c) => ({
                  color: c.action === 'APPROVE' ? 'green' : c.action === 'REJECT' ? 'red' : 'gray',
                  children: (
                    <div>
                      <Typography.Text strong>{c.author || '匿名'}</Typography.Text> <Tag>{c.action}</Tag>
                      <br />{c.content}
                      <br />
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(c.createdAt).toLocaleString('zh-CN')}
                      </Typography.Text>
                    </div>
                  ),
                })) || [{ children: '暂无评审记录' }]}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>

      <Modal title="提交评审" open={createModalOpen} onOk={handleCreate} onCancel={() => { setCreateModalOpen(false); ticketForm.resetFields(); }}>
        <Form form={ticketForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="templateId" label="评审模板">
            <Select allowClear placeholder="选择模板">
              {templates.map((t) => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="targetType" label="评审对象类型"><Input placeholder="APPLICATION / TECH_STACK" /></Form.Item>
          <Form.Item name="targetId" label="评审对象 ID"><Input /></Form.Item>
          <Form.Item name="applicant" label="申请人"><Input /></Form.Item>
          <Form.Item name="reviewer" label="指定评审人"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionType === 'approve' ? '通过评审' : actionType === 'reject' ? '驳回评审' : '添加评论'}
        open={actionModalOpen}
        onOk={handleAction}
        onCancel={() => { setActionModalOpen(false); actionForm.resetFields(); }}
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item name="reviewer" label="评审人" rules={[{ required: true }]} initialValue={detail?.reviewer || ''}><Input /></Form.Item>
          {actionType !== 'comment' && (
            <Form.Item name="scores" label="评分（每行：维度:得分）">
              <Input.TextArea rows={3} placeholder="可扩展性:90\n安全性:85" />
            </Form.Item>
          )}
          {actionType !== 'comment' && (
            <Form.Item name="decision" label="决议"><Input placeholder="通过 / 有条件通过" /></Form.Item>
          )}
          <Form.Item name="comment" label={actionType === 'comment' ? '评论' : '评审意见'} rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
