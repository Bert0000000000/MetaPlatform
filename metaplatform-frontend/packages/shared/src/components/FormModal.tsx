import { Modal, Space, Button } from 'antd';
import type { ReactNode } from 'react';

interface FormModalProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onCancel: () => void;
  onOk?: () => void;
  onSubmit?: () => void;
  okText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  submitting?: boolean;
  footer?: ReactNode;
  width?: number | string;
  form?: unknown;
}

export default function FormModal({
  open,
  title,
  children,
  onCancel,
  onOk,
  onSubmit,
  okText = '确认',
  cancelText = '取消',
  confirmLoading,
  submitting,
  footer,
  width = 640,
  form: _form,
}: FormModalProps) {
  const handleOk = onSubmit ?? onOk;
  const loading = submitting ?? confirmLoading;
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={width}
      footer={
        footer ?? (
          <Space>
            <Button className="v-btn" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button className="v-btn-primary" loading={loading} onClick={handleOk}>
              {okText}
            </Button>
          </Space>
        )
      }
    >
      {children}
    </Modal>
  );
}
