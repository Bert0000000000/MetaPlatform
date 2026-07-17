import { useState } from 'react';
import { Form, Input, Select, Button, Space, Typography, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { listEmployees } from '@/api/employees';
import type { Employee } from '@/types';

interface TaskAssignmentProps {
  employees: Employee[];
  onAssigned: () => void;
}

export default function TaskAssignment({ employees, onAssigned }: TaskAssignmentProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      await listEmployees({});
      message.success(`已分配给 ${v.employeeId}`);
      form.resetFields();
      onAssigned();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="employeeId" label="数字员工" rules={[{ required: true }]}>
        <Select
          placeholder="选择员工"
          options={employees.map((e) => ({
            label: `${e.name} (${e.roleIdentity})`,
            value: e.employeeId,
          }))}
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
        <Input placeholder="例如：整理本月报销单据" />
      </Form.Item>
      <Form.Item name="description" label="详细描述">
        <Input.TextArea rows={3} placeholder="任务背景、目标、产出..." />
      </Form.Item>
      <Space>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={handleSubmit}
        >
          分配
        </Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
        分配后任务将出现在数字员工的任务列表中，并自动开始执行（取决于员工配置）。
      </Typography.Paragraph>
    </Form>
  );
}
