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
  Alert,
  Modal,
  Descriptions,
  Table,
  message,
} from 'antd';
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
        message.warning('Action 匹配失败');
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
    form.setFieldsValue(formValues);
  }, [form]);

  const handleExecute = useCallback(async () => {
    if (!selectedAction) return;
    try {
      const values = await form.validateFields();
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
    switch (param.type) {
      case 'string':
        return <Input placeholder={param.description || `请输入${param.label}`} />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={param.description} />;
      case 'boolean':
        return <Switch />;
      case 'select':
        return <Select placeholder={`请选择${param.label}`} options={param.options} />;
      default:
        return <Input />;
    }
  };

  return (
    <Card size="small" style={{ marginTop: 8, maxWidth: 480 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="small">
        <Space>
          <ThunderboltOutlined style={{ color: '#1677ff' }} />
          <Typography.Text strong>匹配「{query}」的 Action</Typography.Text>
        </Space>

        {matches.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>未匹配到可执行的 Action</Typography.Text>
        ) : (
          <Space wrap>
            {matches.map((m) => (
              <Card
                key={m.action.id}
                size="small"
                hoverable
                style={{
                  width: 220,
                  border: selectedAction?.id === m.action.id ? '2px solid #1677ff' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                }}
                onClick={() => handleSelectAction(m.action)}
              >
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  <Typography.Text strong>{m.action.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{m.action.description}</Typography.Text>
                  <Space>
                    <Tag color="blue">{m.action.category}</Tag>
                    <Tag color={m.confidence > 70 ? 'green' : 'orange'}>{m.confidence}% 匹配</Tag>
                  </Space>
                </Space>
              </Card>
            ))}
          </Space>
        )}

        {selectedAction && (
          <Card size="small" title={`${selectedAction.name} - 参数配置`}>
            <Form form={form} layout="vertical" size="small">
              {selectedAction.inputSchema.map((param) => (
                <Form.Item
                  key={param.name}
                  name={param.name}
                  label={
                    <Space size={4}>
                      <span>{param.label}</span>
                      {param.required && <Tag color="red" style={{ fontSize: 10 }}>必填</Tag>}
                    </Space>
                  }
                  rules={param.required ? [{ required: true, message: `请输入${param.label}` }] : []}
                >
                  {renderParamField(param)}
                </Form.Item>
              ))}
            </Form>
            <Button
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
        open={confirmOpen}
        onOk={handleExecute}
        onCancel={() => setConfirmOpen(false)}
        confirmLoading={executing}
        okText="确认执行"
        cancelText="取消"
      >
        {selectedAction && (
          <Alert
            message={`即将执行：${selectedAction.name}`}
            description="请确认参数无误后执行。该操作将调用后端 Action Engine。"
            type="info"
            showIcon
          />
        )}
      </Modal>
    </Card>
  );
}
