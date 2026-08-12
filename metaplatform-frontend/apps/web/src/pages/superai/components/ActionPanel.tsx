import { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Input,
  Card,
  Tag,
  Space,
  Typography,
  Form,
  Select,
  InputNumber,
  Switch,
  Banner,
  Modal,
  Descriptions,
  Table,
  Toast,
} from '@douyinfe/semi-ui';
import {
  ThunderboltOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { executeAction, matchAction } from '@/api/superai/actions';
import type { ActionItem, ActionMatchResult, ActionResult, ActionParam } from '@/api/superai/types';

/**
 * 对话内 Action 匹配卡（三大原理 #3）。
 *
 * 作为一条 assistant 消息内联渲染（不占用输入框上方的固定空间）：
 * 输入 query 后自动匹配 Action → 选择 → 参数表单 → 确认执行 → onResult
 * 把 kernel 落库结果交回消息流（由 ActionResultCard 渲染）。
 */
interface ActionMatchCardProps {
  query: string;
  onResult: (result: ActionResult) => void;
}

export default function ActionMatchCard({ query, onResult }: ActionMatchCardProps) {
  const [matches, setMatches] = useState<ActionMatchResult[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!query.trim()) return;
    matchAction(query)
      .then((results) => setMatches(results))
      .catch((error) => {
        console.warn('[ActionMatchCard] match failed', error);
        Toast.warning('Action 匹配失败');
      });
  }, [query]);

  const handleSelectAction = useCallback((action: ActionItem) => {
    setSelectedAction(action);
    const formValues: Record<string, unknown> = {};
    action.inputSchema.forEach((p) => {
      if (p.defaultValue !== undefined) {
        formValues[p.name] = p.defaultValue;
      }
    });
    form.setValues(formValues);
  }, [form]);

  const handleExecute = useCallback(async () => {
    if (!selectedAction) return;
    try {
      const values = await form.validate();
      setConfirmOpen(false);
      setExecuting(true);
      const res = await executeAction(selectedAction.id, values);
      onResult(res);
    } catch (error) {
      if (error instanceof Error && error.message.includes('validated')) return;
    } finally {
      setExecuting(false);
    }
  }, [selectedAction, form, onResult]);

  const renderParamField = (param: ActionParam) => {
    const fieldProps = {
      field: param.name,
      label: (
        <Space spacing={4}>
          <span>{param.label}</span>
          {param.required && <Tag color="red" style={{ fontSize: 10 }}>必填</Tag>}
        </Space>
      ),
      rules: param.required ? [{ required: true, message: `请输入${param.label}` }] : [],
    };
    switch (param.type) {
      case 'string':
        return <Form.Input {...fieldProps} placeholder={param.description || `请输入${param.label}`} size="small" />;
      case 'number':
        return <Form.InputNumber {...fieldProps} placeholder={param.description} size="small" style={{ width: '100%' }} />;
      case 'boolean':
        return <Form.Switch {...fieldProps} size="small" />;
      case 'select':
        return <Form.Select {...fieldProps} placeholder={`请选择${param.label}`} optionList={param.options} size="small" />;
      default:
        return <Form.Input {...fieldProps} size="small" />;
    }
  };

  return (
    <Card style={{ marginTop: 8, maxWidth: 480 }}>
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        <Space>
          <ThunderboltOutlined style={{ color: 'var(--primary)' }} />
          <Typography.Text strong>匹配「{query}」的 Action</Typography.Text>
        </Space>

        {matches.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>未匹配到可执行的 Action</Typography.Text>
        ) : (
          <Space wrap>
            {matches.map((m) => (
              <Card
                key={m.action.id}
                style={{
                  width: 220,
                  border: selectedAction?.id === m.action.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <div onClick={() => handleSelectAction(m.action)}>
                <Space vertical spacing="tight" style={{ width: '100%' }}>
                  <Typography.Text strong>{m.action.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{m.action.description}</Typography.Text>
                  <Space>
                    <Tag color="blue">{m.action.category}</Tag>
                    <Tag color={m.confidence > 70 ? 'green' : 'orange'}>{m.confidence}% 匹配</Tag>
                  </Space>
                </Space>
                </div>
              </Card>
            ))}
          </Space>
        )}

        {selectedAction && (
          <Card title={`${selectedAction.name} - 参数配置`}>
            <Form form={form}>
              {selectedAction.inputSchema.map((param) => (
                <div key={param.name} style={{ marginBottom: 12 }}>
                  {renderParamField(param)}
                </div>
              ))}
            </Form>
            <Button
              theme="solid"
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={executing}
              onClick={() => setConfirmOpen(true)}
              block
            >
              确认执行
            </Button>
          </Card>
        )}
      </Space>

      <Modal
        title="确认执行 Action"
        visible={confirmOpen}
        onOk={handleExecute}
        onCancel={() => setConfirmOpen(false)}
        confirmLoading={executing}
        okText="确认执行"
        cancelText="取消"
      >
        {selectedAction && (
          <Banner
            type="info"
            description={`即将执行：${selectedAction.name}。请确认参数无误后执行。该操作将调用后端 Action Engine。`}
          />
        )}
      </Modal>
    </Card>
  );
}
