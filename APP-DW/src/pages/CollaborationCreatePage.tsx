import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { listEmployees } from '@/api/employees';
import { createCollaboration } from '@/api/collaborations';
import type { SplitStrategy } from '@/api/collaborations';
import type { Employee } from '@/types';

const SPLIT_OPTIONS: { value: SplitStrategy; label: string; hint: string }[] = [
  { value: 'hybrid', label: '混合', hint: '按模板声明的依赖执行（推荐）' },
  { value: 'sequential', label: '顺序执行', hint: '子任务链式依赖' },
  { value: 'parallel', label: '并行执行', hint: '子任务无依赖' },
];

export default function CollaborationCreatePage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{
    title?: string;
    goal: string;
    description?: string;
    employeeIds: string[];
    splitStrategy: SplitStrategy;
  }>();

  useEffect(() => {
    listEmployees({}).then((r) => setEmployees(r.items ?? []));
  }, []);

  const handleSave = async () => {
    let values: {
      title?: string;
      goal: string;
      description?: string;
      employeeIds: string[];
      splitStrategy: SplitStrategy;
    };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCollaboration({
        title: values.title,
        goal: values.goal,
        description: values.description,
        employeeIds: values.employeeIds,
        splitStrategy: values.splitStrategy,
      });
      message.success('协作任务已创建，系统已根据员工能力自动分工');
      navigate(`/dw/collaborations/${created.collaborationId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw/collaborations')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          创建协作任务
        </Typography.Title>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={handleSave}
        >
          创建并自动分工
        </Button>
      </Space>

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ splitStrategy: 'hybrid' }}
        >
          <Form.Item
            name="goal"
            label="任务目标"
            rules={[
              { required: true, message: '请输入任务目标' },
              { min: 4, message: '目标至少 4 个字符' },
              { max: 512, message: '目标最多 512 个字符' },
            ]}
            extra="系统会根据目标关键词自动分解子任务（如分析/报告/邮件等）"
          >
            <Input.TextArea
              rows={3}
              placeholder="例：分析 2025 Q3 销售数据并生成报告，发送至客户邮箱"
              showCount
              maxLength={512}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="任务标题（可选）"
            rules={[{ max: 256, message: '标题最多 256 个字符' }]}
          >
            <Input placeholder="留空时系统按目标关键词自动生成" maxLength={256} />
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述（可选）"
            rules={[{ max: 1024, message: '描述最多 1024 个字符' }]}
          >
            <Input.TextArea rows={2} placeholder="任务补充说明" maxLength={1024} />
          </Form.Item>

          <Form.Item
            name="employeeIds"
            label="参与员工"
            rules={[{ required: true, message: '请至少选择 1 名员工' }]}
            extra="系统会按员工技能匹配度自动分配子任务"
          >
            <Select
              mode="multiple"
              placeholder="选择参与协作的数字员工"
              optionFilterProp="label"
              options={employees.map((e) => ({
                label: `${e.name}（${e.roleIdentity}）`,
                value: e.employeeId,
              }))}
              optionRender={(option) => {
                const emp = employees.find((e) => e.employeeId === option.value);
                return (
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>{option.label}</Typography.Text>
                    {emp?.capability?.tools && emp.capability.tools.length > 0 && (
                      <Space size={4} wrap>
                        {emp.capability.tools.slice(0, 5).map((t) => (
                          <Tag key={t} style={{ fontSize: 11 }}>
                            {t}
                          </Tag>
                        ))}
                      </Space>
                    )}
                  </Space>
                );
              }}
            />
          </Form.Item>

          <Form.Item
            name="splitStrategy"
            label="拆分策略"
            rules={[{ required: true, message: '请选择拆分策略' }]}
          >
            <Select
              options={SPLIT_OPTIONS.map((o) => ({
                value: o.value,
                label: `${o.label} — ${o.hint}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
