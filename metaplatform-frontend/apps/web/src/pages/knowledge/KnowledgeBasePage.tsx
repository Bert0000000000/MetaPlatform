/**
 * KnowledgeBasePage - 知识库列表
 * --------------------------------------------------
 * 路由: /knowledge
 * Phase 1: 從 apps/kb 的 KbListPage 迁入,改为真实 API(后端 TECH-KB),
 *          保留 4-tab 导航壳。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Modal, Form, Toast } from '@douyinfe/semi-ui';
import { Plus, RefreshCw, Database } from 'lucide-react';
import { PageRoot, useAsync, useLoadingState, useApiErrorBoundary } from '@mate/shared';
import { listKb, createKb, type KbEntity } from '@/api/kb';


const KB_KIND_OPTIONS = [
  { value: 'GENERAL', label: '通用' },
  { value: 'DOMAIN',  label: '领域' },
  { value: 'FAQ',     label: '问答' },
  { value: 'POLICY',  label: '制度' },
];

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { report } = useApiErrorBoundary();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const submit = useLoadingState();
  const [reloadTick, setReloadTick] = useState(0);

  const { data: kbs, loading, error, reload } = useAsync<KbEntity[]>(
    () => listKb().catch((e: Error) => {
      report(e);
      return [];
    }),
    [reloadTick],
    { initialData: [] },
  );

  const onCreate = async () => {
    const values = await form.validate();
    await submit.wrap(createKb(values));
    setOpen(false);
    form.reset();
    Toast.success('已创建知识库');
    setReloadTick((t) => t + 1);
  };

  return (
    <PageRoot>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <Database size={16} />
              知识库列表
            </Space>
          }
          headerExtraContent={
            <Space>
              <Button
                icon={<RefreshCw size={14} />}
                onClick={reload}
                loading={loading}
              >
                刷新
              </Button>
              <Button theme="solid" type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
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
              {
                title: '操作',
                width: 110,
                render: (_: unknown, record: { id: string }) => (
                  <Button
                    size="small"
                    theme="borderless"
                    onClick={() => navigate(`/knowledge/kb/${encodeURIComponent(record.id)}`)}
                  >
                    查看详情
                  </Button>
                ),
              },
            ]}
          />
        </Card>

        <Modal
          title="新建知识库"
          visible={open}
          onCancel={() => setOpen(false)}
          onOk={onCreate}
          confirmLoading={submit.loading}
        >
          <Form form={form}>
            <Form.Input field="kbCode" label="编码" rules={[{ required: true, message: '请输入编码' }]} placeholder="如：customer-policy-v1" />
            <Form.Input field="displayName" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="如：客户政策知识库" />
            <Form.Select field="kbKind" label="类型" initValue="GENERAL" optionList={KB_KIND_OPTIONS} />
            <Form.TextArea field="description" label="描述" rows={3} />
          </Form>
        </Modal>
      </div>
    </PageRoot>
  );
}
