import { useState } from 'react';
import { Modal, Form, Radio, Input, Tag, Space, Typography } from 'antd';
import { LikeOutlined, DislikeOutlined, EditOutlined } from '@ant-design/icons';
import type { EmployeeTask, ExecutionResult, FeedbackType } from '@/types';

interface TaskFeedbackModalProps {
  open: boolean;
  task: EmployeeTask | null;
  onCancel: () => void;
  onSubmit: (values: {
    executionResult: ExecutionResult;
    feedbackType: FeedbackType;
    suggestion: string;
    tags: string[];
  }) => void | Promise<void>;
  loading?: boolean;
}

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { value: 'thumb_up', label: '点赞', icon: <LikeOutlined /> },
  { value: 'thumb_down', label: '点踩', icon: <DislikeOutlined /> },
  { value: 'suggestion', label: '建议', icon: <EditOutlined /> },
];

const EXECUTION_OPTIONS: { value: ExecutionResult; label: string }[] = [
  { value: 'success', label: '成功' },
  { value: 'partial', label: '部分成功' },
  { value: 'failed', label: '失败' },
];

const PRESET_TAGS = ['参数优化', '工具选择', 'Prompt', '结果格式', '超时处理', '权限问题'];

export default function TaskFeedbackModal({
  open,
  task,
  onCancel,
  onSubmit,
  loading,
}: TaskFeedbackModalProps) {
  const [form] = Form.useForm();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit({ ...values, tags: selectedTags });
    form.resetFields();
    setSelectedTags([]);
    setCustomTag('');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setCustomTag('');
    }
  };

  return (
    <Modal
      title={`任务反馈：${task?.title ?? ''}`}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          executionResult: task?.status === 'failed' ? 'failed' : 'success',
          feedbackType: 'thumb_up',
          suggestion: '',
        }}
      >
        <Form.Item name="executionResult" label="执行结果">
          <Radio.Group optionType="button" buttonStyle="solid">
            {EXECUTION_OPTIONS.map((opt) => (
              <Radio.Button key={opt.value} value={opt.value}>
                {opt.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item name="feedbackType" label="反馈类型">
          <Radio.Group optionType="button" buttonStyle="solid">
            {FEEDBACK_OPTIONS.map((opt) => (
              <Radio.Button key={opt.value} value={opt.value}>
                <Space size={4}>
                  {opt.icon}
                  {opt.label}
                </Space>
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item name="suggestion" label="修改建议 / 备注">
          <Input.TextArea rows={4} placeholder="请输入具体建议，帮助员工学习优化" />
        </Form.Item>

        <Form.Item label="标签">
          <Space wrap>
            {PRESET_TAGS.map((tag) => (
              <Tag
                key={tag}
                color={selectedTags.includes(tag) ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Tag>
            ))}
          </Space>
          <div style={{ marginTop: 8 }}>
            <Space>
              <Input
                size="small"
                placeholder="自定义标签"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onPressEnter={addCustomTag}
              />
              <Typography.Link onClick={addCustomTag}>添加</Typography.Link>
            </Space>
          </div>
          {selectedTags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {selectedTags.map((tag) => (
                <Tag key={tag} closable onClose={() => toggleTag(tag)}>
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}
