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
} from 'antd';
import {
  ThunderboltOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { matchAction, executeAction, listActions } from '@/api/actions';
import type { ActionItem, ActionMatchResult, ActionResult, ActionParam } from '@/types';

const { TextArea } = Input;

interface ActionPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult: (metadata: { actionResult?: ActionResult }) => void;
}

export default function ActionPanel({ query, onQueryChange, onResult }: ActionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ActionMatchResult[]>([]);
  const [allActions, setAllActions] = useState<ActionItem[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    listActions().then(setAllActions).catch(() => {});
  }, []);

  const handleMatch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const results = await matchAction(query);
      setMatches(results);
    } finally {
      setLoading(false);
    }
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
    setResult(null);
  }, [form]);

  const handleExecute = useCallback(async () => {
    if (!selectedAction) return;
    try {
      const values = await form.validateFields();
      setConfirmOpen(false);
      setExecuting(true);
      const res = await executeAction(selectedAction.id, values);
      setResult(res);
      onResult({ actionResult: res });
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
        return (
          <Select
            placeholder={`请选择${param.label}`}
            options={param.options}
          />
        );
      default:
        return <Input />;
    }
  };

  const renderResult = () => {
    if (!result) return null;
    return (
      <Card size="small" title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />执行结果</Space>}>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Action">{result.actionName}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {result.success ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
            ) : (
              <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="消息">{result.message}</Descriptions.Item>
          <Descriptions.Item label="时间">{new Date(result.executedAt).toLocaleString()}</Descriptions.Item>
        </Descriptions>
        {result.output && typeof result.output === 'object' && !Array.isArray(result.output) && (
          <Table
            size="small"
            style={{ marginTop: 8 }}
            dataSource={Object.entries(result.output as Record<string, unknown>).map(([k, v]) => ({ key: k, field: k, value: String(v) }))}
            columns={[
              { title: '字段', dataIndex: 'field', key: 'field' },
              { title: '值', dataIndex: 'value', key: 'value' },
            ]}
            pagination={false}
          />
        )}
        {Array.isArray(result.output) && (
          <Table
            size="small"
            style={{ marginTop: 8 }}
            dataSource={result.output as Record<string, unknown>[]}
            columns={result.output.length > 0 ? Object.keys(result.output[0] as Record<string, unknown>).map((k) => ({ title: k, dataIndex: k, key: k })) : []}
            rowKey={(_, i) => String(i)}
            pagination={{ pageSize: 5 }}
          />
        )}
        {typeof result.output === 'string' && (
          <Typography.Paragraph style={{ marginTop: 8 }}>{result.output}</Typography.Paragraph>
        )}
      </Card>
    );
  };

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <TextArea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="描述您想执行的操作，如：给合同快到期的客户发送提醒"
          rows={2}
        />
        <Space>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleMatch}>
            匹配 Action
          </Button>
        </Space>

        {matches.length > 0 && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>匹配到的 Action：</Typography.Text>
            <Space wrap style={{ marginTop: 4 }}>
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
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space>
                      <ThunderboltOutlined style={{ color: '#1677ff' }} />
                      <Typography.Text strong>{m.action.name}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{m.action.description}</Typography.Text>
                    <Space>
                      <Tag color="blue">{m.action.category}</Tag>
                      <Tag color={m.confidence > 70 ? 'green' : 'orange'}>{m.confidence}% 匹配</Tag>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        )}

        {matches.length === 0 && allActions.length > 0 && !loading && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>所有可用 Action：</Typography.Text>
            <Space wrap style={{ marginTop: 4 }}>
              {allActions.map((action) => (
                <Button
                  key={action.id}
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleSelectAction(action)}
                  type={selectedAction?.id === action.id ? 'primary' : 'default'}
                >
                  {action.name}
                </Button>
              ))}
            </Space>
          </div>
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

        {result && renderResult()}
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
