import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Timeline, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listReviews, createReview, submitReviewAction } from '@/api/governance';
import type { ReviewItem } from '@/types';

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待评审' },
  approved: { color: 'green', label: '已通过' },
  rejected: { color: 'red', label: '已驳回' },
  revision: { color: 'blue', label: '需修改' },
};

export default function ReviewPage() {
  const [list, setList] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<ReviewItem | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');
  const [form] = Form.useForm<Partial<ReviewItem>>();

  const load = async () => {
    setLoading(true);
    try { setList(await listReviews()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    await createReview(values);
    message.success('提交成功');
    setModalOpen(false); form.resetFields(); load();
  };

  const handleAction = async () => {
    if (!detail) return;
    await submitReviewAction(detail.id, actionType, comment);
    message.success(actionType === 'approve' ? '已通过' : '已驳回');
    setActionModalOpen(false); setComment('');
    load();
    setDetail(null);
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (v: string, r: ReviewItem) => <Typography.Link onClick={() => setDetail(r)}>{v}</Typography.Link> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag>{t}</Tag> },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
  ];

  return (
    <Card title="架构评审" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>提交评审</Button>}>
      <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" />

      <Modal title="评审详情" open={!!detail} onCancel={() => setDetail(null)} footer={detail?.status === 'pending' ? <Space><Button onClick={() => { setActionType('reject'); setActionModalOpen(true); }} danger>驳回</Button><Button type="primary" onClick={() => { setActionType('approve'); setActionModalOpen(true); }}>通过</Button></Space> : null} width={560}>
        {detail && (
          <div>
            <Typography.Title level={5}>{detail.title}</Typography.Title>
            <Typography.Paragraph type="secondary">{detail.description}</Typography.Paragraph>
            <Typography.Text strong>评审记录</Typography.Text>
            <Timeline items={detail.comments?.map((c) => ({ color: c.type === 'approve' ? 'green' : c.type === 'reject' ? 'red' : 'gray', children: <div><Typography.Text strong>{c.author}</Typography.Text> <Tag>{c.type}</Tag><br />{c.content}<br /><Typography.Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString('zh-CN')}</Typography.Text></div> })) || [{ children: '暂无评审记录' }]} />
          </div>
        )}
      </Modal>

      <Modal title="提交评审" open={modalOpen} onOk={handleCreate} onCancel={() => { setModalOpen(false); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="architecture"><Select><Select.Option value="architecture">架构评审</Select.Option><Select.Option value="design">设计评审</Select.Option><Select.Option value="change">变更评审</Select.Option></Select></Form.Item>
          <Form.Item name="applicant" label="申请人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={actionType === 'approve' ? '通过评审' : '驳回评审'} open={actionModalOpen} onOk={handleAction} onCancel={() => setActionModalOpen(false)}>
        <Input.TextArea rows={3} placeholder="评审意见" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </Card>
  );
}
