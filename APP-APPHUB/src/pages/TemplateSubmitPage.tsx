import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  Upload,
  message,
  type UploadFile,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined, InboxOutlined } from '@ant-design/icons';
import {
  TEMPLATE_CATEGORIES,
  addCreatedTemplate,
  type TemplateCategory,
  type TemplateField,
  type TemplateFlow,
  type TemplateFlowNode,
} from '@/data/templates';
import { getUser } from '@/utils/auth';

const { TextArea } = Input;
const { Dragger } = Upload;

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

export default function TemplateSubmitPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<SubmitFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<UploadFile[]>([]);

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

      addCreatedTemplate({
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

      message.success('模板投稿成功，可在"我的模板"中查看');
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
        <Typography.Title level={4} style={{ margin: 0 }}>
          投稿新模板
        </Typography.Title>
      </Space>

      <Form<SubmitFormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          icon: 'AppstoreOutlined',
          fields: [{ fieldKey: '', label: '', type: 'text', required: false }],
          flows: [],
        }}
      >
        <Card title="基础信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }, { max: 50 }]}
              >
                <Input placeholder="如：客户管理、报销审批" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="category"
                label="模板分类"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select placeholder="选择分类" options={TEMPLATE_CATEGORIES} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="icon" label="模板图标">
                <Select
                  showSearch
                  options={ICON_OPTIONS.map((i) => ({ label: i, value: i }))}
                  placeholder="选择图标"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="tags" label="标签（逗号分隔）">
                <Input placeholder="如：销售,客户,CRM" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="description"
                label="模板描述"
                rules={[{ required: true, message: '请输入描述' }, { max: 500 }]}
              >
                <TextArea rows={3} placeholder="模板的功能、适用场景、包含的核心模块等" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="模板截图" style={{ marginBottom: 16 }}>
          <Dragger
            listType="picture-card"
            fileList={screenshots}
            onRemove={(file) => {
              setScreenshots((prev) => prev.filter((f) => f.uid !== file.uid));
            }}
            beforeUpload={(file) => {
              setScreenshots((prev) => [
                ...prev,
                {
                  uid: `${Date.now()}-${file.name}`,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  originFileObj: file,
                },
              ]);
              return false; // 阻止自动上传
            }}
            multiple
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传模板截图</p>
            <p className="ant-upload-hint">支持多张，mock 模式仅保存文件名</p>
          </Dragger>
        </Card>

        <Card title="字段定义" style={{ marginBottom: 16 }}>
          <Form.List name="fields">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Row key={field.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'fieldKey']}
                        rules={[{ required: true, message: '字段 Key' }]}
                      >
                        <Input placeholder="字段 Key（如 customerName）" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'label']}
                        rules={[{ required: true, message: '字段标签' }]}
                      >
                        <Input placeholder="字段标签" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item {...field} name={[field.name, 'type']}>
                        <Select options={FIELD_TYPES} placeholder="类型" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Item {...field} name={[field.name, 'options']}>
                        <Input placeholder="下拉选项（逗号分隔）" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={3}>
                      <Form.Item {...field} name={[field.name, 'required']} valuePropName="checked">
                        <Switch checkedChildren="必填" unCheckedChildren="选填" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={1}>
                      <MinusCircleOutlined
                        onClick={() => remove(field.name)}
                        style={{ color: '#ff4d4f', fontSize: 18 }}
                      />
                    </Col>
                  </Row>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    添加字段
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Card>

        <Card title="流程定义" style={{ marginBottom: 16 }}>
          <Form.List name="flows">
            {(flows, { add, remove }) => (
              <>
                {flows.map((flow) => (
                  <Card
                    key={flow.key}
                    type="inner"
                    title={`流程 ${flow.name + 1}`}
                    extra={
                      <MinusCircleOutlined
                        onClick={() => remove(flow.name)}
                        style={{ color: '#ff4d4f', fontSize: 18 }}
                      />
                    }
                    style={{ marginBottom: 12 }}
                  >
                    <Row gutter={8}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          {...flow}
                          name={[flow.name, 'name']}
                          label="流程名称"
                          rules={[{ required: true, message: '请输入流程名称' }]}
                        >
                          <Input placeholder="如：报销审批" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={16}>
                        <Form.Item {...flow} name={[flow.name, 'description']} label="流程描述">
                          <Input placeholder="如：员工提交 → 经理审批 → 财务付款" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.List name={[flow.name, 'nodes']}>
                      {(nodes, { add: addNode, remove: removeNode }) => (
                        <>
                          {nodes.map((node) => (
                            <Row key={node.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  {...node}
                                  name={[node.name, 'name']}
                                  rules={[{ required: true, message: '节点名称' }]}
                                >
                                  <Input placeholder="节点名称" />
                                </Form.Item>
                              </Col>
                              <Col xs={12} md={6}>
                                <Form.Item
                                  {...node}
                                  name={[node.name, 'type']}
                                  rules={[{ required: true, message: '节点类型' }]}
                                >
                                  <Select options={NODE_TYPES} placeholder="节点类型" />
                                </Form.Item>
                              </Col>
                              <Col xs={12} md={8}>
                                <Form.Item {...node} name={[node.name, 'assignee']}>
                                  <Input placeholder="处理人/角色（可选）" />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={2}>
                                <MinusCircleOutlined
                                  onClick={() => removeNode(node.name)}
                                  style={{ color: '#ff4d4f', fontSize: 18 }}
                                />
                              </Col>
                            </Row>
                          ))}
                          <Form.Item>
                            <Button
                              type="dashed"
                              onClick={() => addNode()}
                              icon={<PlusOutlined />}
                              block
                            >
                              添加流程节点
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Card>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    添加流程
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Card>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>
              提交投稿
            </Button>
            <Button onClick={() => navigate('/my-templates')}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
