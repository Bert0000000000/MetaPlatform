import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select } from 'antd';
import { PlusOutlined, FileSearchOutlined } from '@ant-design/icons';
import { listKb, createKb, KbEntity } from '../api/kb';

/**
 * KB 列表页面（P2.3.2）。
 */
export default function KbListPage() {
  const [kbs, setKbs] = useState<KbEntity[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    listKb().then(setKbs).catch(() => setKbs([]));
  }, []);

  const onCreate = async () => {
    const values = await form.validateFields();
    await createKb(values);
    setOpen(false);
    form.resetFields();
    listKb().then(setKbs);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="知识库列表（P2.3.2）"
        extra={
          <Space>
            <Button icon={<FileSearchOutlined />} onClick={() => window.location.href = '/search'}>
              检索测试
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              新建知识库
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={kbs}
          columns={[
            { title: '编码', dataIndex: 'kbCode' },
            { title: '名称', dataIndex: 'displayName' },
            { title: '类型', dataIndex: 'kbKind', render: (k: string) => <Tag>{k}</Tag> },
            { title: '切片数', dataIndex: 'chunkCount' },
            { title: '状态', dataIndex: 'enabled', render: (e: boolean) => <Tag color={e ? 'green' : 'red'}>{e ? '启用' : '禁用'}</Tag> },
          ]}
        />
      </Card>

      <Modal
        title="新建知识库"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onCreate}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="kbCode" label="编码" rules={[{ required: true }]}>
            <Input placeholder="如：customer-policy-v1" />
          </Form.Item>
          <Form.Item name="displayName" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：客户政策知识库" />
          </Form.Item>
          <Form.Item name="kbKind" label="类型" initialValue="GENERAL">
            <Select options={[
              { value: 'GENERAL', label: '通用' },
              { value: 'DOMAIN',  label: '领域' },
              { value: 'FAQ',     label: '问答' },
              { value: 'POLICY',  label: '制度' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
