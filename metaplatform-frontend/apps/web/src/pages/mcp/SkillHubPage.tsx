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
  Toast,
} from '@douyinfe/semi-ui';
import {
  CloudDownloadOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import {
  deleteSkill,
  downloadSkill,
  installSkill,
  listInstalledSkills,
  listSkills,
  updateSkill,
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
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const page = await listSkills(keyword ? { q: keyword } : undefined);
      setSkills(page.items ?? []);
    } catch {
      Toast.error('加载 SKILL 失败（需后端 marketplace 服务）');
    } finally {
      setLoading(false);
    }
  };

  const loadInstalled = async () => {
    try {
      const page = await listInstalledSkills();
      setInstalled(page.items ?? []);
    } catch {
      Toast.error('加载已安装 SKILL 失败');
    }
  };

  useEffect(() => {
    void load();
    void loadInstalled();
  }, []);

  /** 已安装 skill 的 id 集合（用于公开市场标「已安装」）。 */
  const installedIds = new Set(installed.map((s) => s.id));

  const openUpload = () => {
    setEditingSkill(null);
    form.reset();
    setUploadOpen(true);
  };

  const doEdit = (skill: Skill) => {
    setEditingSkill(skill);
    form.setValues({
      name: skill.name,
      description: skill.description,
      version: skill.version,
      visibility: skill.visibility,
      content: skill.content,
    });
    setUploadOpen(true);
  };

  const doSubmit = async () => {
    try {
      const values = await form.validate();
      setSubmitting(true);
      const payload = {
        name: values.name,
        description: values.description ?? '',
        version: values.version ?? 'v1',
        visibility: values.visibility ?? 'public',
        content: values.content,
      };
      if (editingSkill) {
        await updateSkill(editingSkill.id, payload);
        Toast.success('SKILL 更新成功');
      } else {
        await uploadSkill(payload);
        Toast.success('SKILL 上传成功');
      }
      setUploadOpen(false);
      form.reset();
      setEditingSkill(null);
      void load();
      void loadInstalled();
    } catch (e) {
      // Semi Form.validate() 校验失败时 reject 的是按 field 聚合的普通对象（非 Error），静默返回，不弹错误 Toast
      if (e && typeof e === 'object' && !(e instanceof Error)) return;
      Toast.error(editingSkill ? '更新失败' : '上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  const doInstall = async (id: string, name: string) => {
    try {
      await installSkill(id);
      Toast.success(`SKILL「${name}」已安装`);
      void load();
      void loadInstalled(); // 安装后同步刷新「已安装」清单
    } catch {
      Toast.error('安装失败');
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
      Toast.error('下载失败');
    }
  };

  const doDelete = async (id: string, name: string) => {
    try {
      await deleteSkill(id);
      Toast.success(`SKILL「${name}」已删除`);
      void load();
    } catch {
      Toast.error('删除失败（仅作者可删）');
    }
  };

  const columns: ColumnProps<Skill>[] = [
    { title: 'SKILL', dataIndex: 'name', render: (v, r) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>{v}</Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>{r.description}</Typography.Text>
        </Space>
      ) },
    { title: '版本', dataIndex: 'version', width: 80 },
    { title: '可见性', dataIndex: 'visibility', width: 90, render: (v) => (
        <Tag color={v === 'public' ? 'green' : 'orange'}>{v === 'public' ? '公开' : '私有'}</Tag>
      ) },
    { title: '作者租户', dataIndex: 'author_tenant', width: 140 },
    { title: '安装数', dataIndex: 'installs', width: 80 },
    { title: '状态', key: 'status', width: 90, render: (_, r) => (
        installedIds.has(r.id) ? <Tag color="blue">已安装</Tag> : <Tag>未安装</Tag>
      ) },
    { title: '操作', key: 'actions', width: 260, render: (_, r) => (
        <Space>
          <Button size="small" theme="borderless" icon={<CloudDownloadOutlined />} onClick={() => void doDownload(r)}>下载</Button>
          {installedIds.has(r.id) ? (
            <Button size="small" disabled>已安装</Button>
          ) : (
            <Button size="small" theme="solid" type="primary" onClick={() => void doInstall(r.id, r.name)}>安装</Button>
          )}
          {r.is_owner && (
            <Button size="small" theme="borderless" icon={<EditOutlined />} onClick={() => doEdit(r)}>编辑</Button>
          )}
          <Popconfirm title={`删除「${r.name}」？`} onConfirm={() => void doDelete(r.id, r.name)}>
            <Button size="small" type="danger" theme="borderless">删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <Card
      title="SKILL HUB"
      headerExtraContent={
        <Space>
          <Input
            placeholder="搜索 SKILL"
            showClear
            style={{ width: 220 }}
            onEnterPress={(e) => {
              setKeyword((e.target as HTMLInputElement).value);
              void load();
            }}
          />
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openUpload}>上传 SKILL</Button>
        </Space>
      }
    >
      <Tabs
        tabList={[
          { itemKey: 'market', tab: '公开市场' },
          { itemKey: 'installed', tab: `已安装 (${installed.length})` },
        ]}
      >
        <Tabs.TabPane itemKey="market">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={skills}
            loading={loading}
            empty={<Empty description="还没有 SKILL，点击右上角上传" />}
            pagination={{ pageSize: 10 }}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="installed">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={installed}
            loading={loading}
            empty={<Empty description="还没有已安装的 SKILL" />}
            pagination={{ pageSize: 10 }}
          />
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={editingSkill ? `编辑 SKILL「${editingSkill.name}」` : '上传 SKILL'}
        visible={uploadOpen}
        onOk={() => void doSubmit()}
        confirmLoading={submitting}
        onCancel={() => { setUploadOpen(false); setEditingSkill(null); }}
      >
        <Form form={form}>
          <Form.Input field="name" label="SKILL 名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="如：kb-extractor" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="简短描述这个 SKILL 的能力" />
          <Form.Input field="version" label="版本" initValue="v1" placeholder="v1" />
          <Form.RadioGroup field="visibility" label="可见性" initValue="public">
            <Radio value="public">公开</Radio>
            <Radio value="private">私有</Radio>
          </Form.RadioGroup>
          <Form.TextArea field="content" label="SKILL 内容（SKILL.md / YAML）" rules={[{ required: true, message: '请输入内容' }]} rows={6} placeholder={'---\nname: my-skill\ndescription: ...\n---\n# Skill 内容'} />
        </Form>
      </Modal>
    </Card>
  );
}
