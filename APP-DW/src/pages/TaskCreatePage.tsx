import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Select, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { listEmployees } from '@/api/employees';
import type { Employee } from '@/types';

export default function TaskCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listEmployees({}).then((r) => setEmployees(r.items));
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const v = await form.validateFields();
      message.success(`任务已创建并分配给数字员工`);
      navigate('/dw/tasks');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw/tasks')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          创建任务
        </Typography.Title>
      </Space>

      <Card>
        <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
          <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
            <Input placeholder="例如：汇总本季度销售数据" />
          </Form.Item>
          <Form.Item name="description" label="详细描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="任务目标与期望产出..." />
          </Form.Item>
          <Form.Item name="employeeId" label="分配给" rules={[{ required: true }]}>
            <Select
              placeholder="选择数字员工"
              options={employees.map((e) => ({
                label: `${e.name} - ${e.roleIdentity}`,
                value: e.employeeId,
              }))}
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
