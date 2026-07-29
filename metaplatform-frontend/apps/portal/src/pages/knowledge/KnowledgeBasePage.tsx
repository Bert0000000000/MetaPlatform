/**
 * KnowledgeBasePage - 知识库列表
 * --------------------------------------------------
 * 路由: /knowledge
 * Phase 1: 從 apps/kb 的 KbListPage 迁入,改为真实 API(后端 TECH-KB),
 *          保留 4-tab 导航壳。
 */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message } from 'antd';
import { Plus, RefreshCw, Database } from 'lucide-react';
import { SubTabs, type SubTabItem, useAsync, useLoadingState } from '@mate/shared';
import { listKb, createKb, type KbEntity } from '@/api/kb';

const KB_TABS: SubTabItem[] = [
  { label: '知识库列表', path: '/knowledge' },
  { label: '文档管理', path: '/knowledge/docs' },
  { label: '检索测试', path: '/knowledge/test' },
  { label: '检索配置', path: '/knowledge/config' },
];

const KB_KIND_OPTIONS = [
  { value: 'GENERAL', label: '通用' },
  { value: 'DOMAIN',  label: '领域' },
  { value: 'FAQ',     label: '问答' },
  { value: 'POLICY',  label: '制度' },
];

export default function KnowledgeBasePage() {
  const location = useLocation();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const submit = useLoadingState();
  const [reloadTick, setReloadTick] = useState(0);

  const { data: kbs, loading, error, reload } = useAsync<KbEntity[]>(
    () => listKb().catch((e: Error) => {
      message.error(`加载知识库失败: ${e.message}`);
      return [];
    }),
    [reloadTick],
    { initialData: [] },
  );

  const onCreate = async () => {
    const values = await form.validateFields();
    await submit.wrap(createKb(values));
    setOpen(false);
    form.resetFields();
    message.success('已创建知识库');
    setReloadTick((t) => t + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={KB_TABS} activePath={location.pathname} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <Database size={16} />
              知识库列表
            </Space>
          }
          extra={
            <Space>
              <Button
                icon={<RefreshCw size={14} />}
                onClick={reload}
                loading={loading}
              >
                刷新
              </Button>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
                新建知识库
              </Button>
            </Space>
          }
        >
          {error && (
            <div style={{ marginBottom: 12, color: 'var(--destructive, #dc2626)' }}>
              加载失败: {error.message}
            </div>
          )}
          <Table
            rowKey="id"
            dataSource={kbs ?? []}
            loading={loading}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: '编码', dataIndex: 'kbCode', width: 200 },
              { title: '名称', dataIndex: 'displayName', width: 200 },
              { title: '类型', dataIndex: 'kbKind', width: 100, render: (k: string) => <Tag>{k}</Tag> },
              { title: '切片数', dataIndex: 'chunkCount', width: 100 },
              {
                title: '状态', dataIndex: 'enabled', width: 100,
                render: (e: boolean) => <Tag color={e ? 'green' : 'red'}>{e ? '启用' : '禁用'}</Tag>,
              },
              { title: '描述', dataIndex: 'description', ellipsis: true },
            ]}
          />
        </Card>

        <Modal
          title="新建知识库"
          open={open}
          onCancel={() => setOpen(false)}
          onOk={onCreate}
          confirmLoading={submit.loading}
          destroyOnClose
        >
          <Form form={form} layout="vertical" preserve={false}>
            <Form.Item name="kbCode" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
              <Input placeholder="如：customer-policy-v1" />
            </Form.Item>
            <Form.Item name="displayName" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="如：客户政策知识库" />
            </Form.Item>
            <Form.Item name="kbKind" label="类型" initialValue="GENERAL">
              <Select options={KB_KIND_OPTIONS} />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
