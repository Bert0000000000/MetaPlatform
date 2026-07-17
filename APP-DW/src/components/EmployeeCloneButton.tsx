import { useState } from 'react';
import { Button, Form, Input, Modal, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { createEmployee } from '@/api/employees';
import type { Employee } from '@/types';

interface EmployeeCloneButtonProps {
  source: Employee;
  onCloned?: (newEmployee: Employee) => void;
}

export default function EmployeeCloneButton({ source, onCloned }: EmployeeCloneButtonProps) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    form.setFieldsValue({
      name: `${source.name} - 副本`,
      code: `${source.code}_copy`,
    });
    setOpen(true);
  };

  const handleOk = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      const created = await createEmployee({
        ...source,
        name: v.name,
        code: v.code,
      });
      message.success('已克隆');
      onCloned?.(created);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button icon={<CopyOutlined />} onClick={handleOpen}>
        克隆员工
      </Button>
      <Modal
        title="克隆数字员工"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleOk}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="新员工名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="新员工编码"
            rules={[{ required: true }, { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母数字下划线' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
