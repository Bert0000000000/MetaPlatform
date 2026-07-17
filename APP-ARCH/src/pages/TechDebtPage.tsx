import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Progress, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { listTechDebt, createTechDebt, updateTechDebt, deleteTechDebt, runComplianceCheck } from '@/api/governance';
import type { TechDebt } from '@/types';

const SEVERITY_TAG: Record<string, string> = { critical: 'red', high: 'volcano', medium: 'orange', low: 'blue' };
const STATUS_TAG: Record<string, { color: string; label: string }> = { open: { color: 'orange', label: '待处理' }, in_progress: { color: 'blue', label: '处理中' }, resolved: { color: 'green', label: '已解决' } };

export default function TechDebtPage() {
  const [list, setList] = useState<TechDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TechDebt | null>(null);
  const [complianceResult, setComplianceResult] = useState<{ id: string; score: number; issues: string[] } | null>(null);
  const [form] = Form.useForm<Partial<TechDebt>>();

  const load = async () => {
    setLoading(true);
    try { setList(await listTechDebt()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) { await updateTechDebt(editing.id, values); message.success('更新成功'); }
    else { await createTechDebt(values); message.success('创建成功'); }
    setModalOpen(false); setEditing(null); form.resetFields(); load();
  };

  const handleCompliance = async (debt: TechDebt) => {
    const result = await runComplianceCheck(debt.id);
    setComplianceResult({ id: debt.id, score: result.score, issues: result.issues });
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category', render: (c: string) => <Tag>{c}</Tag> },
    { title: '严重度', dataIndex: 'severity', key: 'severity', render: (s: string) => <Tag color={SEVERITY_TAG[s]}>{s}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    { title: '负责人', dataIndex: 'owner', key: 'owner' },
    { title: '截止日期', dataIndex: 'dueDate', key: 'dueDate' },
    { title: '合规分', dataIndex: 'complianceScore', key: 'complianceScore', render: (v?: number) => v ? <Progress percent={v} size="small" status={v < 70 ? 'exception' : 'normal'} /> : '-' },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: TechDebt) => (
        <Space>
          <Button type="link" size="small" icon={<SafetyCertificateOutlined />} onClick={() => handleCompliance(r)}>合规检查</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteTechDebt(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="技术债务与合规" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增</Button>}>
      <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" />

      <Modal title={editing ? '编辑技术债务' : '新增技术债务'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="分类" initialValue="code"><Select><Select.Option value="code">代码</Select.Option><Select.Option value="architecture">架构</Select.Option><Select.Option value="infrastructure">基础设施</Select.Option><Select.Option value="dependency">依赖</Select.Option></Select></Form.Item>
          <Form.Item name="severity" label="严重度" initialValue="medium"><Select><Select.Option value="critical">严重</Select.Option><Select.Option value="high">高</Select.Option><Select.Option value="medium">中</Select.Option><Select.Option value="low">低</Select.Option></Select></Form.Item>
          <Form.Item name="status" label="状态" initialValue="open"><Select><Select.Option value="open">待处理</Select.Option><Select.Option value="in_progress">处理中</Select.Option><Select.Option value="resolved">已解决</Select.Option></Select></Form.Item>
          <Form.Item name="owner" label="负责人"><Input /></Form.Item>
          <Form.Item name="dueDate" label="截止日期"><Input placeholder="YYYY-MM-DD" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="合规检查结果" open={!!complianceResult} onCancel={() => setComplianceResult(null)} footer={<Button type="primary" onClick={() => setComplianceResult(null)}>关闭</Button>}>
        {complianceResult && (
          <div>
            <Progress percent={complianceResult.score} status={complianceResult.score < 70 ? 'exception' : 'normal'} format={(p) => `${p} 分`} />
            {complianceResult.issues.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <Typography.Text strong>发现的问题：</Typography.Text>
                {complianceResult.issues.map((issue, i) => <div key={i}><Typography.Text type="danger">• {issue}</Typography.Text></div>)}
              </div>
            ) : <Typography.Text type="success" style={{ display: 'block', marginTop: 16 }}>✓ 未发现合规问题</Typography.Text>}
          </div>
        )}
      </Modal>
    </Card>
  );
}
