/**
 * DesignFlowPage - 创建应用设计流
 * --------------------------------------------------
 * 全屏 Layout（官方侧边栏布局风格，3 步向导）：
 * ┌──────────────────────────────────────────────┐
 * │ Header: 应用设计 / 步骤指示器（1-2-3）     │
 * │ ──────────────────────────────────────── │
 * │ 主内容区（当前步骤的表单 / 列表）          │
 * │ ──────────────────────────────────────── │
 * │ Footer: 上一步 / 下一步（草稿）/ 发布  │
 * └──────────────────────────────────────────────┘
 *
 * 3 步流程：
 *  1. 基本信息：名称、编码、描述、类型、可见范围
 *  2. 业务设计：业务对象 / 设计菜单 / 设计表单 / 设计业务流程 / 设计应用权限
 *  3. 发布配置：版本号、发布范围、定时发布、确认发布
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Layout,
  Radio,
  Select,
  Space,
  Steps,
  Switch,
  Tabs,
  Tag,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import { FormDrawer } from '@mate/shared';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  MenuOutlined,
  ApartmentOutlined,
  SafetyOutlined,
  CodeOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { createApp, getApp } from '@/api/apphub/apps';
import type { AppCreateRequest } from '@/api/apphub/types';

interface BusinessObject {
  id: string;
  name: string;
  description: string;
}
interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: string;
}
interface FormDef {
  id: string;
  name: string;
  fields: string;
}
interface FlowNode {
  id: string;
  name: string;
  type: string;
}
interface Permission {
  id: string;
  role: string;
  resource: string;
  actions: string[];
}

const APP_TYPES = [
  { value: 'business', label: '业务应用', icon: <AppstoreOutlined /> },
  { value: 'tool', label: '工具应用', icon: <CodeOutlined /> },
  { value: 'data', label: '数据分析', icon: <FileTextOutlined /> },
  { value: 'ai', label: 'AI 助手', icon: <ApartmentOutlined /> },
];

const ICON_OPTIONS = [
  { value: 'app', label: '📦 应用' },
  { value: 'chart', label: '📊 图表' },
  { value: 'bot', label: '🤖 机器人' },
  { value: 'db', label: '🗄️ 数据库' },
  { value: 'doc', label: '📄 文档' },
];

const VISIBLE_OPTIONS = [
  { value: 'all', label: '全公司' },
  { value: 'org', label: '指定组织' },
];

const FLOW_TYPES = [
  { value: 'bpmn', label: 'BPMN 流程' },
  { value: 'approval', label: '审批流' },
  { value: 'dataflow', label: '数据流' },
];

const PERMISSION_ACTIONS = ['查看', '编辑', '删除', '导出', '管理'];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function DesignFlowPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('from');

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [basicForm] = Form.useForm();
  const [businessObjects, setBusinessObjects] = useState<BusinessObject[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [forms, setForms] = useState<FormDef[]>([]);
  const [flows, setFlows] = useState<FlowNode[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [publishForm] = Form.useForm();

  useEffect(() => {
    if (!editingId) return;
    getApp(editingId)
      .then((app) => {
        basicForm.setValues({
          name: app.name,
          code: app.code,
          type: app.icon === 'FileTextOutlined' ? 'tool' : 'business',
          icon: app.icon || 'app',
          description: app.description,
          visibility: 'all',
        });
        Toast.success(`已加载应用「${app.name}」`);
      })
      .catch(() => Toast.error('加载应用失败'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = async () => {
    if (currentStep === 1) {
      try {
        await basicForm.validate();
        setCurrentStep(2);
      } catch {
        Toast.error('请补全必填字段');
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else {
      try {
        const values = await basicForm.validate();
        await publishForm.validate();
        setSaving(true);
        const payload: AppCreateRequest = {
          name: values.name,
          code: values.code,
          description: values.description,
          icon: values.icon,
        };
        const app = await createApp(payload);
        Toast.success(`应用「${app.name}」创建成功`);
        navigate(`/apps/${app.appId}`);
      } catch (error) {
        if (error instanceof Error && error.message) {
          Toast.error(`创建失败：${error.message}`);
        }
      } finally {
        setSaving(false);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStep1 = () => (
    <Card style={{ maxWidth: 720, margin: '0 auto' }} title="基本信息">
      <Form
        form={basicForm}
        labelPosition="left"
        labelWidth={120}
        initValues={{ type: 'business', icon: 'app', visibility: 'all' }}
      >
        <Form.Input
          field="name"
          label="应用名称"
          rules={[{ required: true, message: '请输入应用名称' }]}
          placeholder="如：客户管理系统"
        />
        <Form.Input
          field="code"
          label="应用编码"
          rules={[
            { required: true, message: '请输入应用编码' },
            { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和横线' },
          ]}
          placeholder="如：app-customer-mgmt"
        />
        <Form.Select field="type" label="应用类型" optionList={APP_TYPES.map((t) => ({ value: t.value, label: t.label }))} style={{ width: '100%' }} />
        <Form.Select
          field="icon"
          label="应用图标"
          optionList={ICON_OPTIONS}
        />
        <Form.TextArea
          field="description"
          label="应用描述"
          placeholder="简要描述该应用的核心功能"
          rows={3}
        />
        <Form.Select field="visibility" label="可见范围" optionList={VISIBLE_OPTIONS} style={{ width: '100%' }} />
      </Form>
    </Card>
  );

  const renderStep2 = () => (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Tabs defaultActiveKey="objects" type="card">
        <Tabs.TabPane tab={<span><FileTextOutlined /> 业务对象 ({businessObjects.length})</span>} itemKey="objects">
          <Card
            title="业务对象"
            headerExtraContent={
              <Button
                theme="solid"
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setBusinessObjects([...businessObjects, { id: generateId(), name: '新对象', description: '' }])}
              >
                添加业务对象
              </Button>
            }
          >
            {businessObjects.length === 0 ? (
              <Empty description="暂无业务对象，点击右上角添加" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {businessObjects.map((obj, i) => (
                  <Card
                    key={obj.id}
                    headerExtraContent={
                      <Button
                        type="danger"
                        theme="borderless"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setBusinessObjects(businessObjects.filter((_, j) => j !== i))}
                      />
                    }
                  >
                    <Space spacing={12} style={{ width: '100%' }}>
                      <Typography.Text type="tertiary">名称</Typography.Text>
                      <Input
                        value={obj.name}
                        onChange={(v) => {
                          const next = [...businessObjects];
                          next[i] = { ...obj, name: v };
                          setBusinessObjects(next);
                        }}
                        style={{ width: 200 }}
                      />
                      <Typography.Text type="tertiary">描述</Typography.Text>
                      <Input
                        value={obj.description}
                        onChange={(v) => {
                          const next = [...businessObjects];
                          next[i] = { ...obj, description: v };
                          setBusinessObjects(next);
                        }}
                        placeholder="描述字段、关联等"
                        style={{ flex: 1 }}
                      />
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><MenuOutlined /> 设计菜单 ({menus.length})</span>} itemKey="menus">
          <Card
            title="应用菜单"
            headerExtraContent={
              <Button
                theme="solid"
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setMenus([...menus, { id: generateId(), name: '新菜单', path: '/page', icon: 'app' }])}
              >
                添加菜单
              </Button>
            }
          >
            {menus.length === 0 ? (
              <Empty description="暂无菜单，菜单对应应用内导航" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menus.map((m, i) => (
                  <Card key={m.id}>
                    <Space spacing={12} wrap>
                      <Input
                        value={m.name}
                        onChange={(v) => {
                          const next = [...menus];
                          next[i] = { ...m, name: v };
                          setMenus(next);
                        }}
                        placeholder="菜单名称"
                        style={{ width: 160 }}
                      />
                      <Input
                        value={m.path}
                        onChange={(v) => {
                          const next = [...menus];
                          next[i] = { ...m, path: v };
                          setMenus(next);
                        }}
                        placeholder="/path"
                        style={{ width: 160 }}
                      />
                      <Select
                        value={m.icon}
                        onChange={(v) => {
                          const next = [...menus];
                          next[i] = { ...m, icon: v as string };
                          setMenus(next);
                        }}
                        optionList={ICON_OPTIONS}
                        style={{ width: 140 }}
                      />
                      <Button
                        type="danger"
                        theme="borderless"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setMenus(menus.filter((_, j) => j !== i))}
                      />
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><FileTextOutlined /> 设计表单 ({forms.length})</span>} itemKey="forms">
          <Card
            title="表单设计"
            headerExtraContent={
              <Button
                theme="solid"
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setForms([...forms, { id: generateId(), name: '新表单', fields: '字段1, 字段2' }])}
              >
                添加表单
              </Button>
            }
          >
            {forms.length === 0 ? (
              <Empty description="暂无表单" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {forms.map((f, i) => (
                  <Card key={f.id}>
                    <Space spacing={12} wrap style={{ width: '100%' }}>
                      <Input
                        value={f.name}
                        onChange={(v) => {
                          const next = [...forms];
                          next[i] = { ...f, name: v };
                          setForms(next);
                        }}
                        placeholder="表单名称"
                        style={{ width: 200 }}
                      />
                      <Input
                        value={f.fields}
                        onChange={(v) => {
                          const next = [...forms];
                          next[i] = { ...f, fields: v };
                          setForms(next);
                        }}
                        placeholder="字段列表（逗号分隔）"
                        style={{ flex: 1, minWidth: 240 }}
                      />
                      <Button
                        type="danger"
                        theme="borderless"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setForms(forms.filter((_, j) => j !== i))}
                      />
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><ApartmentOutlined /> 业务流程 ({flows.length})</span>} itemKey="flows">
          <Card
            title="业务流程（审批流 / BPMN）"
            headerExtraContent={
              <Button
                theme="solid"
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setFlows([...flows, { id: generateId(), name: '新流程', type: 'bpmn' }])}
              >
                添加流程
              </Button>
            }
          >
            {flows.length === 0 ? (
              <Empty description="暂无流程，引用 Flowable / BPMN 引擎" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {flows.map((f, i) => (
                  <Card key={f.id}>
                    <Space spacing={12} wrap>
                      <Input
                        value={f.name}
                        onChange={(v) => {
                          const next = [...flows];
                          next[i] = { ...f, name: v };
                          setFlows(next);
                        }}
                        placeholder="流程名称"
                        style={{ width: 200 }}
                      />
                      <Select
                        value={f.type}
                        onChange={(v) => {
                          const next = [...flows];
                          next[i] = { ...f, type: v as string };
                          setFlows(next);
                        }}
                        optionList={FLOW_TYPES}
                        style={{ width: 160 }}
                      />
                      <Button
                        type="danger"
                        theme="borderless"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setFlows(flows.filter((_, j) => j !== i))}
                      />
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><SafetyOutlined /> 应用权限 ({permissions.length})</span>} itemKey="permissions">
          <Card
            title="角色权限"
            headerExtraContent={
              <Button
                theme="solid"
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setPermissions([...permissions, { id: generateId(), role: '新角色', resource: '*', actions: ['查看'] }])}
              >
                添加角色
              </Button>
            }
          >
            {permissions.length === 0 ? (
              <Empty description="暂无角色权限" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {permissions.map((p, i) => (
                  <Card key={p.id}>
                    <Space spacing={12} wrap>
                      <Input
                        value={p.role}
                        onChange={(v) => {
                          const next = [...permissions];
                          next[i] = { ...p, role: v };
                          setPermissions(next);
                        }}
                        placeholder="角色名"
                        style={{ width: 140 }}
                      />
                      <Input
                        value={p.resource}
                        onChange={(v) => {
                          const next = [...permissions];
                          next[i] = { ...p, resource: v };
                          setPermissions(next);
                        }}
                        placeholder="资源（* 表示所有）"
                        style={{ width: 200 }}
                      />
                      <Select
                        multiple
                        value={p.actions}
                        onChange={(v) => {
                          const next = [...permissions];
                          next[i] = { ...p, actions: v as string[] };
                          setPermissions(next);
                        }}
                        optionList={PERMISSION_ACTIONS.map((a) => ({ value: a, label: a }))}
                        style={{ minWidth: 240 }}
                      />
                      <Button
                        type="danger"
                        theme="borderless"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setPermissions(permissions.filter((_, j) => j !== i))}
                      />
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Card style={{ marginBottom: 16 }} title="应用摘要">
        <Form form={basicForm} labelPosition="left" labelWidth={120} disabled>
          <Form.Input field="name" label="应用名称" />
          <Form.Input field="code" label="应用编码" />
          <Form.Input field="description" label="应用描述" />
        </Form>
      </Card>
      <Card title="业务设计摘要">
        <Space spacing={16} wrap>
          <Tag color="blue">业务对象 {businessObjects.length}</Tag>
          <Tag color="green">菜单 {menus.length}</Tag>
          <Tag color="purple">表单 {forms.length}</Tag>
          <Tag color="orange">流程 {flows.length}</Tag>
          <Tag color="red">角色 {permissions.length}</Tag>
        </Space>
      </Card>
    </div>
  );

  const steps = [
    { title: '基本信息', desc: '名称、编码、类型' },
    { title: '业务设计', desc: '对象/菜单/表单/流程/权限' },
    { title: '应用确认', desc: '保存与创建' },
  ];

  return (
    <Layout style={{ height: '100vh', background: 'var(--background)' }}>
      <Layout.Header
        style={{
          height: 56,
          padding: '0 24px',
          background: 'var(--background)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space spacing={16}>
          <Button theme="borderless" icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps')}>
            返回应用中心
          </Button>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {editingId ? '重新设计应用' : '创建应用'}
          </Typography.Title>
          <Tag color="blue">当前步骤 {currentStep}/3</Tag>
        </Space>
      </Layout.Header>

      <Layout.Content
        style={{
          padding: '24px 32px',
          background: 'var(--background)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Steps current={currentStep} status="process" style={{ maxWidth: 720, margin: '0 auto 16px' }}>
          {steps.map((s) => (
            <Steps.Step key={s.title} title={s.title} description={s.desc} />
          ))}
        </Steps>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>
      </Layout.Content>

      <Layout.Footer
        style={{
          height: 64,
          padding: '0 24px',
          background: 'var(--background)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography.Text type="tertiary">
          {currentStep === 1 && '填写应用的基本信息'}
          {currentStep === 2 && '设计业务对象、菜单、表单、流程和权限'}
          {currentStep === 3 && '确认应用设计并保存'}
        </Typography.Text>
        <Space>
          <Button
            disabled={currentStep === 1}
            onClick={handlePrev}
            icon={<ArrowLeftOutlined />}
          >
            上一步
          </Button>
          <Button
            theme="solid"
            type="primary"
            onClick={handleNext}
            loading={saving}
            icon={currentStep === 3 ? <CheckOutlined /> : <ArrowRightOutlined />}
          >
            {currentStep === 3 ? '保存并创建' : '下一步'}
          </Button>
        </Space>
      </Layout.Footer>
    </Layout>
  );
}
