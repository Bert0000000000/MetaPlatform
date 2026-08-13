/**
 * DesignFlowPage - 创建应用设计流（**作为 SideSheet 内容**）
 * --------------------------------------------------
 * 父组件 AppListPage 通过 visible prop 控制 SideSheet 显示；
 * 该文件只导出主组件 AppDesignSheet，
 * 接受 visible / onClose / onCreated / editingId props 渲染侧边栏。
 *
 * 3 步流程：
 *  1. 基本信息：名称、编码、描述、类型、可见范围
 *  2. 业务设计：业务对象 / 设计菜单 / 设计表单 / 设计业务流程 / 设计应用权限
 *  3. 应用确认：保存创建
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Steps,
  Tabs,
  Tag,
  Typography,
  Toast,
  SideSheet,
} from '@douyinfe/semi-ui';
import {
  AppstoreOutlined,
  FileTextOutlined,
  MenuOutlined,
  ApartmentOutlined,
  SafetyOutlined,
  CodeOutlined,
  DeleteOutlined,
  PlusOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import {
  IconAppCenter,
  IconFile,
  IconHistogram,
  IconServer,
  IconUserCircle,
} from '@douyinfe/semi-icons';
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
  { value: 'app', label: '应用', icon: <IconAppCenter /> },
  { value: 'chart', label: '图表', icon: <IconHistogram /> },
  { value: 'bot', label: '机器人', icon: <IconUserCircle /> },
  { value: 'db', label: '数据库', icon: <IconServer /> },
  { value: 'doc', label: '文档', icon: <IconFile /> },
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

export interface AppDesignSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (appId: string) => void;
  editingId?: string;
}

/**
 * 应用设计 SideSheet（官方侧边栏布局：右侧大尺寸抽屉，mask 阻塞外部操作）
 * 步骤指示器（Steps type="basic"）+ 三步表单 + 顶/底栏操作。
 */
export default function AppDesignSheet({ visible, onClose, onCreated, editingId }: AppDesignSheetProps) {
  const [searchParams] = useSearchParams();
  const targetId = editingId ?? searchParams.get('from') ?? undefined;

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [basicForm] = Form.useForm();
  const [businessObjects, setBusinessObjects] = useState<BusinessObject[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [forms, setForms] = useState<FormDef[]>([]);
  const [flows, setFlows] = useState<FlowNode[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    if (!visible || !targetId) return;
    getApp(targetId)
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
  }, [visible, targetId]);

  // 关闭时重置 step
  useEffect(() => {
    if (visible) return;
    setCurrentStep(1);
    basicForm.setValues({});
  }, [visible, basicForm]);

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
        setSaving(true);
        const payload: AppCreateRequest = {
          name: values.name,
          code: values.code,
          description: values.description,
          icon: values.icon,
        };
        const app = await createApp(payload);
        Toast.success(`应用「${app.name}」创建成功`);
        onCreated?.(app.appId);
        onClose();
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
    <Card style={{ marginBottom: 16 }} title="基本信息">
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
        <Form.Radio field="type" label="应用类型" options={APP_TYPES.map((opt) => ({ value: opt.value, label: opt.label }))} />
        <Form.Select field="icon" label="应用图标" optionList={ICON_OPTIONS} />
        <Form.TextArea
          field="description"
          label="应用描述"
          placeholder="简要描述该应用的核心功能"
          rows={3}
        />
        <Form.Radio field="visibility" label="可见范围" options={VISIBLE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))} />
      </Form>
    </Card>
  );

  const renderStep2 = () => (
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
  );

  const renderStep3 = () => (
    <>
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
    </>
  );

  const steps = [
    { title: '基本信息', desc: '名称、编码、类型' },
    { title: '业务设计', desc: '对象/菜单/表单/流程/权限' },
    { title: '应用确认', desc: '保存与创建' },
  ];

  return (
    <SideSheet
      visible={visible}
      onCancel={onClose}
      width="large"
      placement="right"
      keepDOM={false}
      title={
        <Space spacing={12}>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {targetId ? '重新设计应用' : '创建应用'}
          </Typography.Title>
          <Tag color="blue">步骤 {currentStep}/3</Tag>
        </Space>
      }
      headerStyle={{ borderBottom: '1px solid var(--border)' }}
      bodyStyle={{ padding: '24px 32px' }}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <Typography.Text type="tertiary">
            {currentStep === 1 && '填写应用的基本信息'}
            {currentStep === 2 && '设计业务对象、菜单、表单、流程和权限'}
            {currentStep === 3 && '确认应用设计并保存'}
          </Typography.Text>
          <Space>
            <Button disabled={currentStep === 1} onClick={handlePrev} icon={<ArrowLeftOutlined />}>
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
        </div>
      }
    >
      <Steps type="basic" current={currentStep} size="default" style={{ marginBottom: 24 }}>
        {steps.map((s) => (
          <Steps.Step key={s.title} title={s.title} description={s.desc} />
        ))}
      </Steps>

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </SideSheet>
  );
}
