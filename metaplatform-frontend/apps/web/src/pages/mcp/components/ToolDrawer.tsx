import { useEffect, useState } from 'react';
import { Button, Form, SideSheet, Spin, Toast, ArrayField } from '@douyinfe/semi-ui';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { createTool, getTool, listCategories, updateTool } from '@/api/mcphub/tools';
import type { McpToolCreateRequest, ToolParam } from '@/api/mcphub/types';
import { EmptyState } from '@/components/skeleton';
import '../mcp.css';

/** 工具表单抽屉宽度：入参行是横向 5 列（名称/类型/必填/描述/删除），比单列表单要宽。 */
const DRAWER_W = 640;

const TYPE_OPTIONS = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '对象', value: 'object' },
  { label: '数组', value: 'array' },
];

const OUTPUT_OPTIONS = [
  { label: '文本', value: 'text' },
  { label: 'JSON', value: 'json' },
  { label: '表格', value: 'table' },
  { label: '文件', value: 'file' },
];

export interface ToolDrawerProps {
  open: boolean;
  /** null = 新建，否则为工具标识（后端以 name 作 id） */
  toolId: string | null;
  onClose: () => void;
  /** 保存成功后回调，父级据此刷新列表 */
  onSaved: () => void;
}

/**
 * 工具新建 / 编辑抽屉（DESIGN-SPEC §5 骨架 E：新建·编辑走右侧抽屉）。
 * 由列表页按路由（/ki/mcp/tools/new、/ki/mcp/tools/:id/edit）驱动开关，
 * 因此深链与浏览器后退都能正确落到抽屉的开 / 关。
 */
export default function ToolDrawer({ open, toolId, onClose, onSaved }: ToolDrawerProps) {
  const [form] = Form.useForm<McpToolCreateRequest>();
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    listCategories()
      .then((cs) => setCategories(cs.map((c) => c.name)))
      .catch(() => undefined);

    if (!toolId) {
      form.reset();
      setName('');
      setLoadError(null);
      form.setValues({ enabled: true, outputType: 'json', inputSchema: [] });
      return;
    }

    setLoading(true);
    setLoadError(null);
    getTool(toolId)
      .then((t) => {
        setName(t.name);
        form.setValues({
          name: t.name,
          code: t.code,
          category: t.category,
          description: t.description,
          outputType: t.outputType,
          enabled: t.enabled,
          tags: t.tags,
          inputSchema: t.inputSchema,
        });
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '工具加载失败'))
      .finally(() => setLoading(false));
  }, [open, toolId, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (toolId) {
        await updateTool(toolId, values);
        Toast.success('已更新');
      } else {
        await createTool(values);
        Toast.success('已创建');
      }
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideSheet
      visible={open}
      title={toolId ? (name ? `编辑工具：${name}` : '编辑工具') : '创建工具'}
      width={DRAWER_W}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            theme="solid"
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            disabled={loading || !!loadError}
            onClick={() => void handleSubmit()}
          >
            保存
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="mp-text-center mp-p-8">
          <Spin />
        </div>
      ) : loadError ? (
        <EmptyState
          illustration="failure"
          title="工具加载失败"
          desc={loadError}
          actions={<Button onClick={onClose}>关闭</Button>}
        />
      ) : null}

      {/*
        表单必须常驻挂载：Semi 的 form 实例在 <Form> 未挂载时 setValues 是空操作，
        把表单放进「加载中」分支会让回填值在表单挂载前丢失 —— 编辑态会永远显示空表单。
        因此 loading / error 一律用类名隐藏，不卸载。
      */}
      <div className={loading || loadError ? 'mp-mcp-hidden' : undefined}>
        <Form form={form}>
          <Form.Input
            field="name"
            label="工具名称"
            rules={[{ required: true, message: '请输入名称' }]}
            placeholder="例如：查询员工数据库"
          />
          <Form.Input
            field="code"
            label="工具编码"
            rules={[
              { required: true, message: '请输入编码' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母、数字、下划线' },
            ]}
            placeholder="例如：query_employees"
            disabled={!!toolId}
          />
          <Form.Select
            field="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
            multiple
            maxTagCount={1}
            optionList={categories.map((c) => ({ label: c, value: c }))}
            placeholder="选择或新建分类"
          />
          <Form.Select field="outputType" label="输出类型" optionList={OUTPUT_OPTIONS} />
          <Form.TextArea
            field="description"
            label="工具描述"
            rows={2}
            placeholder="工具作用说明，会展示给调用方"
          />

          <ArrayField field="inputSchema">
            {({ arrayFields, addWithInitValue }) => (
              <>
                <div className="mp-fw-600 mp-mb-2">输入参数</div>
                {arrayFields.map((f) => (
                  <div key={f.key} className="mp-mcp-param-row">
                    <Form.Input
                      field={`${f.field}[name]`}
                      noLabel
                      rules={[{ required: true, message: '名称' }]}
                      placeholder="参数名"
                    />
                    <Form.Select
                      field={`${f.field}[type]`}
                      noLabel
                      initValue="string"
                      optionList={TYPE_OPTIONS}
                    />
                    <Form.Checkbox field={`${f.field}[required]`} noLabel initValue={false}>
                      必填
                    </Form.Checkbox>
                    <Form.Input
                      field={`${f.field}[description]`}
                      noLabel
                      placeholder="描述（可选）"
                    />
                    <Button
                      type="danger"
                      theme="borderless"
                      icon={<DeleteOutlined />}
                      aria-label="删除参数"
                      onClick={f.remove}
                    />
                  </div>
                ))}
                <Button
                  theme="borderless"
                  type="primary"
                  onClick={() =>
                    addWithInitValue({ name: '', type: 'string', required: false } as ToolParam)
                  }
                  icon={<PlusOutlined />}
                  block
                >
                  添加参数
                </Button>
              </>
            )}
          </ArrayField>

          <Form.Select
            field="tags"
            label="标签"
            className="mp-mt-4"
            multiple
            placeholder="输入标签后回车"
            optionList={[]}
          />
        </Form>
      </div>
    </SideSheet>
  );
}
