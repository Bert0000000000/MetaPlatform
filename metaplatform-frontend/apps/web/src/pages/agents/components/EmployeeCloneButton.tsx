import { useState } from 'react';
import { Button, Form, Modal, Toast } from '@douyinfe/semi-ui';
import { CopyOutlined } from '@ant-design/icons';
import { cloneEmployee } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';

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
    form.setValues({
      name: `${source.name} - 副本`,
      code: `${source.code}_copy`,
    });
    setOpen(true);
  };

  const handleOk = async () => {
    const v = await form.validate();
    setLoading(true);
    try {
      const created = await cloneEmployee(source, v.name);
      Toast.success(`已克隆为「${created.name}」`);
      onCloned?.(created);
      setOpen(false);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '克隆失败');
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
        visible={open}
        onCancel={() => setOpen(false)}
        onOk={handleOk}
        confirmLoading={loading}
      >
        <Form form={form}>
          <Form.Input field="name" label="新员工名称" rules={[{ required: true }]} placeholder="请输入新员工名称" />
          <Form.Input
            field="code"
            label="新员工编码"
            rules={[{ required: true }, { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母开头，仅含字母数字下划线' }]}
            placeholder="请输入新员工编码"
          />
          <p style={{ color: 'var(--semi-color-text-2)', fontSize: 12, margin: 0 }}>
            将复制「{source.name}」的角色分类、能力配置、知识库绑定等全部设置。
          </p>
        </Form>
      </Modal>
    </>
  );
}
