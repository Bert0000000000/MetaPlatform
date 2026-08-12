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
  Timeline,
  Typography,
  Tabs,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, PlayCircleOutlined, CheckOutlined, CloseOutlined, CommentOutlined } from '@ant-design/icons';
import {
  listReviewTickets,
  createReviewTicket,
  startReviewTicket,
  approveReviewTicket,
  rejectReviewTicket,
  addReviewTicketComment,
  listReviewTemplates,
} from '@/api/arch/governance';
import type { ReviewTicket, ReviewTemplate, ReviewScoreItem } from '@/api/arch/types';

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  CREATED: { color: 'grey', label: '已创建' },
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
      setTickets(Array.isArray(t) ? t : ((t as { items?: ReviewTicket[] }).items ?? []));
      setTemplates(Array.isArray(tpl) ? tpl : ((tpl as { items?: ReviewTemplate[] }).items ?? []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const values = await ticketForm.validate();
    await createReviewTicket(values);
    Toast.success('提交成功');
    setCreateModalOpen(false);
    ticketForm.reset();
    load();
  };

  const handleStart = async (ticket: ReviewTicket) => {
    await startReviewTicket(ticket.id, ticket.reviewer || 'system');
    Toast.success('评审已启动');
    load();
  };

  const openAction = (ticket: ReviewTicket, type: 'approve' | 'reject' | 'comment') => {
    setDetail(ticket);
    setActionType(type);
    actionForm.reset();
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
    const values = await actionForm.validate();
    const template = templates.find((t) => t.id === detail.templateId);
    const scores = parseScores(values.scores || '', template);

    if (actionType === 'comment') {
      await addReviewTicketComment(detail.id, values.reviewer, values.comment);
      Toast.success('评论已添加');
    } else if (actionType === 'approve') {
      await approveReviewTicket(detail.id, values.reviewer, scores, values.comment, values.decision);
      Toast.success('已通过');
    } else {
      await rejectReviewTicket(detail.id, values.reviewer, scores, values.comment, values.decision);
      Toast.success('已驳回');
    }
    setActionModalOpen(false);
    setDetail(null);
    actionForm.reset();
    load();
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r: ReviewTicket) => <Typography.Text link onClick={() => setDetail(r)}>{v}</Typography.Text>,
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
            <Button theme="borderless" type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(r)}>启动</Button>
          )}
          {r.status === 'REVIEWING' && (
            <>
              <Button theme="borderless" type="primary" size="small" icon={<CommentOutlined />} onClick={() => openAction(r, 'comment')}>评论</Button>
              <Button theme="borderless" type="primary" size="small" icon={<CheckOutlined />} onClick={() => openAction(r, 'approve')}>通过</Button>
              <Button theme="borderless" type="danger" size="small" icon={<CloseOutlined />} onClick={() => openAction(r, 'reject')}>驳回</Button>
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
    <Card title="架构评审" headerExtraContent={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>提交评审</Button>}>
      <Table rowKey="id" columns={columns} dataSource={tickets ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />

      <Modal title="评审详情" visible={!!detail && !actionModalOpen} onCancel={() => setDetail(null)} footer={null} width={640}>
        {detail && (
          <Tabs defaultActiveKey="info">
            <Tabs.TabPane tab="基本信息" itemKey="info">
              <Typography.Title heading={5}>{detail.title}</Typography.Title>
              <Typography.Paragraph type="tertiary">模板：{detail.templateName || '-'}</Typography.Paragraph>
              <Typography.Paragraph type="tertiary">申请人：{detail.applicant || '-'}</Typography.Paragraph>
              <Typography.Paragraph type="tertiary">评审人：{detail.reviewer || '-'}</Typography.Paragraph>
              <Typography.Paragraph type="tertiary">状态：<Tag color={STATUS_TAG[detail.status]?.color}>{STATUS_TAG[detail.status]?.label}</Tag></Typography.Paragraph>
              {detail.decision && <Typography.Paragraph type="tertiary">决议：{detail.decision}</Typography.Paragraph>}
              {detail.scores.length > 0 && (
                <>
                  <Typography.Text strong>评分</Typography.Text>
                  <Table rowKey="dimension" columns={scoreColumns} dataSource={detail.scores ?? []} size="small" pagination={false} scroll={{ x: 'max-content' }} />
                </>
              )}
            </Tabs.TabPane>
            <Tabs.TabPane tab="评审记录" itemKey="comments">
              <Timeline
                dataSource={detail.comments?.map((c) => ({
                  color: c.action === 'APPROVE' ? 'green' : c.action === 'REJECT' ? 'red' : 'grey',
                  content: (
                    <div>
                      <Typography.Text strong>{c.author || '匿名'}</Typography.Text> <Tag>{c.action}</Tag>
                      <br />{c.content}
                      <br />
                      <Typography.Text type="tertiary" style={{ fontSize: 11 }}>
                        {new Date(c.createdAt).toLocaleString('zh-CN')}
                      </Typography.Text>
                    </div>
                  ),
                })) || [{ content: '暂无评审记录' }]}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>

      <Modal title="提交评审" visible={createModalOpen} onOk={handleCreate} onCancel={() => { setCreateModalOpen(false); ticketForm.reset(); }}>
        <Form form={ticketForm}>
          <Form.Input field="title" label="标题" rules={[{ required: true }]} />
          <Form.Select field="templateId" label="评审模板" showClear placeholder="选择模板" optionList={templates.map((t) => ({ value: t.id, label: t.name }))} />
          <Form.Input field="targetType" label="评审对象类型" placeholder="APPLICATION / TECH_STACK" />
          <Form.Input field="targetId" label="评审对象 ID" />
          <Form.Input field="applicant" label="申请人" />
          <Form.Input field="reviewer" label="指定评审人" />
        </Form>
      </Modal>

      <Modal
        title={actionType === 'approve' ? '通过评审' : actionType === 'reject' ? '驳回评审' : '添加评论'}
        visible={actionModalOpen}
        onOk={handleAction}
        onCancel={() => { setActionModalOpen(false); actionForm.reset(); }}
      >
        <Form form={actionForm}>
          <Form.Input field="reviewer" label="评审人" rules={[{ required: true }]} initValue={detail?.reviewer || ''} />
          {actionType !== 'comment' && (
            <Form.TextArea field="scores" label="评分（每行：维度:得分）" rows={3} placeholder="可扩展性:90\n安全性:85" />
          )}
          {actionType !== 'comment' && (
            <Form.Input field="decision" label="决议" placeholder="通过 / 有条件通过" />
          )}
          <Form.TextArea field="comment" label={actionType === 'comment' ? '评论' : '评审意见'} rules={[{ required: true }]} rows={3} />
        </Form>
      </Modal>
    </Card>
  );
}
