import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CloudDownloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  deleteSkill,
  downloadSkill,
  installSkill,
  listInstalledSkills,
  listSkills,
  uploadSkill,
  type Skill,
} from '@/api/mcphub/skills';

/** SKILL HUB — 公开 SKILL 的浏览 / 上传 / 下载 / 安装（marketplace kind="skill"）。 */
export default function SkillHubPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installed, setInstalled] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const page = await listSkills(keyword ? { q: keyword } : undefined);
      setSkills(page.items ?? []);
    } catch {
      message.error('加载 SKILL 失败（需后端 marketplace 服务）');
    } finally {
      setLoading(false);
    }
  };

  const loadInstalled = async () => {
    try {
      const page = await listInstalledSkills();
      setInstalled(page.items ?? []);
    } catch {
      message.error('加载已安装 SKILL 失败');
    }
  };

  useEffect(() => {
    void load();
    void loadInstalled();
  }, []);

  const doUpload = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await uploadSkill({
        name: values.name,
        description: values.description ?? '',
        version: values.version ?? 'v1',
        visibility: values.visibility ?? 'public',
        content: values.content,
      });
      message.success('SKILL 上传成功');
      setUploadOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error('上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  const doInstall = async (id: string, name: string) => {
    try {
      await installSkill(id);
      message.success(`SKILL「${name}」已安装`);
      void load();
    } catch {
      message.error('安装失败');
    }
  };

  const doDownload = async (skill: Skill) => {
    try {
      const dl = await downloadSkill(skill.id);
      const blob = new Blob([dl.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dl.name}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  const doDelete = async (id: string, name: string) => {
    try {
      await deleteSkill(id);
      message.success(`SKILL「${name}」已删除`);
      void load();
    } catch {
      message.error('删除失败（仅作者可删）');
    }
  };

  const columns: ColumnsType<Skill> = [
    { title: 'SKILL', dataIndex: 'name', render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{v}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Typography.Text>
        </Space>
      ) },
    { title: '版本', dataIndex: 'version', width: 80 },
    { title: '可见性', dataIndex: 'visibility', width: 90, render: (v) => (
        <Tag color={v === 'public' ? 'green' : 'orange'}>{v === 'public' ? '公开' : '私有'}</Tag>
      ) },
    { title: '作者租户', dataIndex: 'author_tenant', width: 140 },
    { title: '安装数', dataIndex: 'installs', width: 80 },
    { title: '操作', key: 'actions', width: 220, render: (_, r) => (
        <Space>
          <Button size="small" icon={<CloudDownloadOutlined />} onClick={() => void doDownload(r)}>下载</Button>
          <Button size="small" type="primary" onClick={() => void doInstall(r.id, r.name)}>安装</Button>
          <Popconfirm title={`删除「${r.name}」？`} onConfirm={() => void doDelete(r.id, r.name)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <Card
      title="SKILL HUB"
      extra={
        <Space>
          <Input.Search placeholder="搜索 SKILL" allowClear style={{ width: 220 }} onSearch={(v) => { setKeyword(v); void load(); }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadOpen(true)}>上传 SKILL</Button>
        </Space>
      }
    >
      <Tabs
        items={[
          {
            key: 'market',
            label: '公开市场',
            children: (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={skills}
                loading={loading}
                locale={{ emptyText: <Empty description="还没有 SKILL，点击右上角上传" /> }}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'installed',
            label: `已安装 (${installed.length})`,
            children: (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={installed}
                loading={loading}
                locale={{ emptyText: <Empty description="还没有已安装的 SKILL" /> }}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      <Modal
        title="上传 SKILL"
        open={uploadOpen}
        onOk={() => void doUpload()}
        confirmLoading={submitting}
        onCancel={() => setUploadOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ version: 'v1', visibility: 'public' }}>
          <Form.Item name="name" label="SKILL 名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：kb-extractor" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="简短描述这个 SKILL 的能力" />
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="v1" />
          </Form.Item>
          <Form.Item name="visibility" label="可见性">
            <Radio.Group>
              <Radio value="public">公开</Radio>
              <Radio value="private">私有</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="content" label="SKILL 内容（SKILL.md / YAML）" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder={'---\nname: my-skill\ndescription: ...\n---\n# Skill 内容'} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
