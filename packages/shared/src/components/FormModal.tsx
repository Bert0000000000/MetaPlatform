import { ReactNode } from 'react';
import { Modal, Form } from 'antd';
import type { FormInstance, FormProps } from 'antd';

interface FormModalProps<T = Record<string, unknown>> {
  /** 是否显示 */
  open: boolean;
  /** 标题 */
  title: ReactNode;
  /** 受控 Form 实例（必传，调用方持有以 setFieldsValue / resetFields） */
  form: FormInstance<T>;
  /** 提交回调，应使用 form.validateFields() 取值后再调用业务接口 */
  onSubmit: () => Promise<void> | void;
  /** 取消回调 */
  onCancel: () => void;
  /** 提交按钮 loading（由调用方控制） */
  submitting?: boolean;
  /** Modal 宽度，默认 560 */
  width?: number | string;
  /** 表单布局，默认 vertical */
  layout?: FormProps['layout'];
  /** 表单内容 */
  children?: ReactNode;
  /** 提交按钮文字，默认 "确定" */
  okText?: string;
  /** 取消按钮文字，默认 "取消" */
  cancelText?: string;
  /** 关闭时是否重置表单，默认 true */
  destroyOnClose?: boolean;
}

/**
 * 统一的表单弹窗：Modal + Form 的标准组合。
 *
 * 用于替代各 APP 中重复的 `<Modal><Form>...</Form></Modal>` 模板，
 * 统一提交逻辑（onOk 触发 form.submit → onFinish）、按钮 loading、布局。
 *
 * 调用方职责：
 * 1. 通过 `Form.useForm()` 持有 form 实例
 * 2. 在 onSubmit 中 `await form.validateFields()` 取值并调用 API
 * 3. 关闭时自行 `form.resetFields()`（如需要保留则传 destroyOnClose=false）
 *
 * @example
 * const [form] = Form.useForm();
 * <FormModal
 *   open={open}
 *   title="编辑员工"
 *   form={form}
 *   onSubmit={async () => {
 *     const values = await form.validateFields();
 *     await updateEmployee(id, values);
 *     setOpen(false);
 *   }}
 *   onCancel={() => setOpen(false)}
 * >
 *   <Form.Item name="name" label="名称" rules={[{ required: true }]}>
 *     <Input />
 *   </Form.Item>
 * </FormModal>
 */
export function FormModal<T = Record<string, unknown>>({
  open,
  title,
  form,
  onSubmit,
  onCancel,
  submitting = false,
  width = 560,
  layout = 'vertical',
  children,
  okText = '确定',
  cancelText = '取消',
  destroyOnClose = true,
}: FormModalProps<T>) {
  return (
    <Modal
      title={title}
      open={open}
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={submitting}
      okText={okText}
      cancelText={cancelText}
      width={width}
      destroyOnHidden={destroyOnClose}
      maskClosable={!submitting}
    >
      <Form<T> form={form} layout={layout} onFinish={onSubmit} preserve={!destroyOnClose}>
        {children}
      </Form>
    </Modal>
  );
}
