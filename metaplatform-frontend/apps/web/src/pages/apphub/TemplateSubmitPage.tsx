import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrayField,
  Button,
  Card,
  Form,
  Space,
  Typography,
  Upload,
  Toast,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { FileItem as UploadFileItem } from '@douyinfe/semi-ui/lib/es/upload';
import { ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined, InboxOutlined } from '@ant-design/icons';
import {
  TEMPLATE_CATEGORIES,
  addCreatedTemplate,
  type TemplateCategory,
  type TemplateField,
  type TemplateFlow,
  type TemplateFlowNode,
} from './data/templates';
import { getUser } from '@mate/shared';

interface FieldFormValue {
  fieldKey: string;
  label: string;
  type: TemplateField['type'];
  required?: boolean;
  options?: string;
  placeholder?: string;
}

interface FlowNodeFormValue {
  name: string;
  type: TemplateFlowNode['type'];
  assignee?: string;
}

interface FlowFormValue {
  name: string;
  description?: string;
  nodes: FlowNodeFormValue[];
}

interface SubmitFormValues {
  name: string;
  category: TemplateCategory;
  description: string;
  tags?: string;
  icon?: string;
  fields: FieldFormValue[];
  flows: FlowFormValue[];
}

const FIELD_TYPES: Array<{ label: string; value: TemplateField['type'] }> = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '下拉', value: 'select' },
  { label: '长文本', value: 'textarea' },
  { label: '附件', value: 'file' },
];

const NODE_TYPES: Array<{ label: string; value: TemplateFlowNode['type'] }> = [
  { label: '开始', value: 'start' },
  { label: '审批', value: 'approval' },
  { label: '条件', value: 'condition' },
  { label: '结束', value: 'end' },
];

const ICON_OPTIONS = [
  'AppstoreOutlined',
  'TeamOutlined',
  'FileTextOutlined',
  'ScheduleOutlined',
  'RocketOutlined',
  'BookOutlined',
  'ShopOutlined',
  'CustomerServiceOutlined',
  'DollarOutlined',
  'AuditOutlined',
  'SolutionOutlined',
  'CheckSquareOutlined',
];

/** 模板投稿 — 本地暂存实现，后端 endpoint 接入后无缝切换为 API 调用 */
async function submitTemplate(
  payload: Parameters<typeof addCreatedTemplate>[0],
): Promise<{ templateId: string }> {
  const tpl = addCreatedTemplate(payload);
  return { templateId: tpl.templateId };
}

export default function TemplateSubmitPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<SubmitFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<UploadFileItem[]>([]);

  const handleSubmit = async (values: SubmitFormValues) => {
    setSubmitting(true);
    try {
      const user = getUser();
      const author = user?.username ?? '匿名用户';

      // 转换字段
      const fields: TemplateField[] = (values.fields ?? []).map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        options: f.options ? f.options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      }));

      // 转换流程
      const flows: TemplateFlow[] = (values.flows ?? []).map((fl) => ({
        name: fl.name,
        description: fl.description,
        nodes: (fl.nodes ?? []).map((n, idx) => ({
          id: `n${idx + 1}`,
          name: n.name,
          type: n.type,
          assignee: n.assignee,
        })),
      }));

      // 截图：mock，仅保存文件名
      const screenshotNames = screenshots.map((f) => f.name).filter(Boolean);

      await submitTemplate({
        name: values.name,
        category: values.category,
        description: values.description,
        icon: values.icon ?? 'AppstoreOutlined',
        tags: values.tags ? values.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        author,
        screenshots: screenshotNames,
        fields,
        flows,
        createdAt: new Date().toISOString(),
      });

      Toast.success('模板投稿成功，可在"我的模板"中查看');
      navigate('/my-templates');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-templates')}>
          返回我的模板
        </Button>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          投稿新模板
        </Typography.Title>
      </Space>

      <Form<SubmitFormValues>
        form={form}
        onSubmit={handleSubmit}
        initValues={{
          name: '',
          category: 'OA' as TemplateCategory,
          description: '',
          icon: 'AppstoreOutlined',
          fields: [{ fieldKey: '', label: '', type: 'text', required: false }],
          flows: [],
        }}
      >
        <Card title="基础信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Input
                field="name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }, { max: 50 }]}
                placeholder="如：客户管理、报销审批"
              />
            </Col>
            <Col xs={24} md={12}>
              <Form.Select
                field="category"
                label="模板分类"
                rules={[{ required: true, message: '请选择分类' }]}
                optionList={TEMPLATE_CATEGORIES}
                placeholder="选择分类"
              />
            </Col>
            <Col xs={24} md={12}>
              <Form.Select
                field="icon"
                label="模板图标"
                optionList={ICON_OPTIONS.map((i) => ({ label: i, value: i }))}
                placeholder="选择图标"
              />
            </Col>
            <Col xs={24} md={12}>
              <Form.Input field="tags" label="标签（逗号分隔）" placeholder="如：销售,客户,CRM" />
            </Col>
            <Col xs={24}>
              <Form.TextArea
                field="description"
                label="模板描述"
                rows={3}
                rules={[{ required: true, message: '请输入描述' }, { max: 500 }]}
                placeholder="模板的功能、适用场景、包含的核心模块等"
              />
            </Col>
          </Row>
        </Card>

        <Card title="模板截图" style={{ marginBottom: 16 }}>
          <Upload
            draggable
            listType="picture"
            fileList={screenshots}
            onRemove={(file) => {
              setScreenshots((prev) => prev.filter((f) => f.uid !== file.uid));
            }}
            beforeUpload={({ file }) => {
              const raw = file.fileInstance;
              setScreenshots((prev) => [
                ...prev,
                {
                  uid: `${Date.now()}-${file.name}`,
                  name: file.name,
                  size: String(file.size ?? ''),
                  type: raw?.type,
                  fileInstance: raw,
                  status: 'success',
                },
              ]);
              return false; // 阻止自动上传
            }}
            multiple
            dragIcon={<InboxOutlined />}
            dragMainText="点击或拖拽上传模板截图"
            dragSubText="支持多张，仅保存文件名"
          />
        </Card>

        <Card title="字段定义" style={{ marginBottom: 16 }}>
          <ArrayField field="fields">
            {({ arrayFields, add }) => (
              <>
                {arrayFields.map((item) => (
                  <Row key={item.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col xs={24} md={6}>
                      <Form.Input
                        field={`${item.field}[fieldKey]`}
                        rules={[{ required: true, message: '字段 Key' }]}
                        placeholder="字段 Key（如 customerName）"
                      />
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Input
                        field={`${item.field}[label]`}
                        rules={[{ required: true, message: '字段标签' }]}
                        placeholder="字段标签"
                      />
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Select field={`${item.field}[type]`} optionList={FIELD_TYPES} placeholder="类型" />
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Input field={`${item.field}[options]`} placeholder="下拉选项（逗号分隔）" />
                    </Col>
                    <Col xs={12} md={3}>
                      <Form.Switch
                        field={`${item.field}[required]`}
                        checkedText="必填"
                        uncheckedText="选填"
                      />
                    </Col>
                    <Col xs={12} md={1}>
                      <MinusCircleOutlined
                        onClick={() => item.remove()}
                        style={{ color: 'var(--semi-color-danger)', fontSize: 18 }}
                      />
                    </Col>
                  </Row>
                ))}
                <Button block onClick={() => add()} icon={<PlusOutlined />} style={{ borderStyle: 'dashed' }}>
                  添加字段
                </Button>
              </>
            )}
          </ArrayField>
        </Card>

        <Card title="流程定义" style={{ marginBottom: 16 }}>
          <ArrayField field="flows">
            {({ arrayFields, add }) => (
              <>
                {arrayFields.map((flowItem, idx) => (
                  <Card
                    key={flowItem.key}
                    title={`流程 ${idx + 1}`}
                    headerExtraContent={
                      <MinusCircleOutlined
                        onClick={() => flowItem.remove()}
                        style={{ color: 'var(--semi-color-danger)', fontSize: 18 }}
                      />
                    }
                    style={{ marginBottom: 12 }}
                  >
                    <Row gutter={8}>
                      <Col xs={24} md={8}>
                        <Form.Input
                          field={`${flowItem.field}[name]`}
                          label="流程名称"
                          rules={[{ required: true, message: '请输入流程名称' }]}
                          placeholder="如：报销审批"
                        />
                      </Col>
                      <Col xs={24} md={16}>
                        <Form.Input
                          field={`${flowItem.field}[description]`}
                          label="流程描述"
                          placeholder="如：员工提交 → 经理审批 → 财务付款"
                        />
                      </Col>
                    </Row>
                    <ArrayField field={`${flowItem.field}[nodes]`}>
                      {({ arrayFields: nodeFields, add: addNode }) => (
                        <>
                          {nodeFields.map((nodeItem) => (
                            <Row key={nodeItem.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                              <Col xs={24} md={8}>
                                <Form.Input
                                  field={`${nodeItem.field}[name]`}
                                  rules={[{ required: true, message: '节点名称' }]}
                                  placeholder="节点名称"
                                />
                              </Col>
                              <Col xs={12} md={6}>
                                <Form.Select
                                  field={`${nodeItem.field}[type]`}
                                  rules={[{ required: true, message: '节点类型' }]}
                                  optionList={NODE_TYPES}
                                  placeholder="节点类型"
                                />
                              </Col>
                              <Col xs={12} md={8}>
                                <Form.Input
                                  field={`${nodeItem.field}[assignee]`}
                                  placeholder="处理人/角色（可选）"
                                />
                              </Col>
                              <Col xs={24} md={2}>
                                <MinusCircleOutlined
                                  onClick={() => nodeItem.remove()}
                                  style={{ color: 'var(--semi-color-danger)', fontSize: 18 }}
                                />
                              </Col>
                            </Row>
                          ))}
                          <Button block onClick={() => addNode()} icon={<PlusOutlined />} style={{ borderStyle: 'dashed' }}>
                            添加流程节点
                          </Button>
                        </>
                      )}
                    </ArrayField>
                  </Card>
                ))}
                <Button block onClick={() => add()} icon={<PlusOutlined />} style={{ borderStyle: 'dashed' }}>
                  添加流程
                </Button>
              </>
            )}
          </ArrayField>
        </Card>

        <Space>
          <Button theme="solid" type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>
            提交投稿
          </Button>
          <Button onClick={() => navigate('/my-templates')}>取消</Button>
        </Space>
      </Form>
    </div>
  );
}
