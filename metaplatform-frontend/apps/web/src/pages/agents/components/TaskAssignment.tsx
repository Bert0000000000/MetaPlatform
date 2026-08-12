import { useState } from 'react';
import { Form, Input, Select, Button, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { SendOutlined } from '@ant-design/icons';
import { listEmployees } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';

interface TaskAssignmentProps {
  employees: Employee[];
  onAssigned: () => void;
}

export default function TaskAssignment({ employees, onAssigned }: TaskAssignmentProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const v = await form.validate();
    setLoading(true);
    try {
      await listEmployees({});
      Toast.success(`已分配给 ${v.employeeId}`);
      form.reset();
      onAssigned();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form}>
      <Form.Select
        field="employeeId"
        label="数字员工"
        rules={[{ required: true }]}
        placeholder="选择员工"
        optionList={employees.map((e) => ({
          label: `${e.name} (${e.roleIdentity})`,
          value: e.employeeId,
        }))}
        filter
      />
      <Form.Input
        field="title"
        label="任务标题"
        rules={[{ required: true }]}
        placeholder="例如：整理本月报销单据"
      />
      <Form.TextArea
        field="description"
        label="详细描述"
        rows={3}
        placeholder="任务背景、目标、产出..."
      />
      <Space>
        <Button
          theme="solid"
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={handleSubmit}
        >
          分配
        </Button>
      </Space>
      <Typography.Paragraph type="tertiary" style={{ fontSize: 12, marginTop: 12 }}>
        分配后任务将出现在数字员工的任务列表中，并自动开始执行（取决于员工配置）。
      </Typography.Paragraph>
    </Form>
  );
}
