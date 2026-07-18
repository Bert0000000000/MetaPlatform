import { useState } from 'react';
import { Button, Form, Input, Modal, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { cloneEmployee } from '@/api/employees';
import type { Employee } from '@/types';

interface EmployeeCloneButtonProps {
  source: Employee;
  onCloned?: (newEmployee: Employee) => void;
  /** Render as a menu item label instead of a standalone button. */
  asMenuItem?: boolean;
  onMenuClick?: () => void;
}

export default function EmployeeCloneButton({
  source,
  onCloned,
  asMenuItem = false,
  onMenuClick,
}: EmployeeCloneButtonProps) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    onMenuClick?.();
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
      const created = await cloneEmployee(source, v.name, v.code);
      message.success(`已克隆为「${created.name}」`);
      onCloned?.(created);
      setOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '克隆失败');
    } finally {
      setLoading(false);
    }
  };

  const trigger = asMenuItem ? (
    <span onClick={handleOpen}>
      <CopyOutlined /> 克隆员工
    </span>
  ) : (
    <Button icon={<CopyOutlined />} onClick={handleOpen}>
      克隆员工
    </Button>
  );

  return (
    <>
      {trigger}
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
            <Input placeholder="请输入新员工名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="新员工编码"
            rules={[{ required: true }, { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母开头，仅含字母数字下划线' }]}
          >
            <Input placeholder="请输入新员工编码" />
          </Form.Item>
          <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, margin: 0 }}>
            将复制「{source.name}」的角色分类、能力配置、知识库绑定等全部设置。
          </p>
        </Form>
      </Modal>
    </>
  );
}
