import { useEffect } from 'react';
import { Form, Modal, Radio } from '@douyinfe/semi-ui';
import type { ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, ModuleType } from '@/api/apphub/types';
import { MODULE_TYPE_LABELS, MODULE_ICONS } from './componentRegistry';

interface ModuleFormProps {
  open: boolean;
  title: string;
  initial?: ModuleItem | null;
  onOk: (values: ModuleCreateRequest | ModuleUpdateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const MODULE_TYPES: ModuleType[] = ['FORM', 'FLOW', 'BOARD', 'PAGE'];

export default function ModuleForm({ open, title, initial, onOk, onCancel, confirmLoading }: ModuleFormProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setValues({
          name: initial.name,
          code: initial.code,
          type: initial.type,
          description: initial.description,
          icon: initial.icon,
        });
      } else {
        form.reset();
        form.setValues({ type: 'FORM', icon: MODULE_ICONS.FORM });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validate();
    onOk(values);
  };

  const iconOptions = Object.entries(MODULE_ICONS).map(([type, icon]) => ({
    label: `${icon} (${MODULE_TYPE_LABELS[type as ModuleType]})`,
    value: icon,
  }));

  return (
    <Modal
      title={title}
      visible={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
    >
      <Form form={form}>
        <Form.Input
          field="name"
          label="模块名称"
          rules={[
            { required: true, message: '请输入模块名称' },
            { min: 1, max: 30, message: '长度 1-30 个字符' },
            { pattern: /\S+/, message: '不能纯空格' },
          ]}
          placeholder="例如：采购申请"
        />
        <Form.Input
          field="code"
          label="模块编码"
          rules={[
            { required: true, message: '请输入模块编码' },
            { min: 2, max: 30, message: '长度 2-30 个字符' },
            { pattern: CODE_PATTERN, message: '以字母开头，可包含字母、数字、下划线' },
          ]}
          placeholder="例如：purchase_apply"
          disabled={!!initial}
        />
        <Form.RadioGroup
          field="type"
          label="模块类型"
          rules={[{ required: true, message: '请选择模块类型' }]}
          disabled={!!initial}
          mode="advanced"
        >
          {MODULE_TYPES.map((t) => (
            <Radio key={t} value={t}>
              {MODULE_TYPE_LABELS[t]}
            </Radio>
          ))}
        </Form.RadioGroup>
        <Form.TextArea
          field="description"
          label="模块描述"
          rules={[{ max: 200, message: '最多 200 个字符' }]}
          rows={2}
          placeholder="描述模块功能"
        />
        <Form.Select field="icon" label="模块图标" optionList={iconOptions} placeholder="选择图标" />
      </Form>
    </Modal>
  );
}
