import { Modal, Space, Button } from 'antd';
import type { ReactNode } from 'react';

interface FormModalProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onCancel: () => void;
  onOk?: () => void;
  okText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  footer?: ReactNode;
  width?: number | string;
}

export default function FormModal({
  open,
  title,
  children,
  onCancel,
  onOk,
  okText = '确认',
  cancelText = '取消',
  confirmLoading,
  footer,
  width = 640,
}: FormModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={confirmLoading}
      width={width}
      footer={
        footer ?? (
          <Space>
            <Button className="v-btn" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button className="v-btn-primary" loading={confirmLoading} onClick={onOk}>
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
