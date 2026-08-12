import { useState } from 'react';
import { Form, Input, Modal, Radio, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { LikeOutlined, DislikeOutlined, EditOutlined } from '@ant-design/icons';
import type { EmployeeTask, ExecutionResult, FeedbackType } from '@/api/dw/types';

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

type FeedbackFormValues = {
  executionResult: ExecutionResult;
  feedbackType: FeedbackType;
  suggestion: string;
};

export default function TaskFeedbackModal({
  open,
  task,
  onCancel,
  onSubmit,
  loading,
}: TaskFeedbackModalProps) {
  const [form] = Form.useForm<FeedbackFormValues>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  const handleOk = async () => {
    const values = await form.validate();
    await onSubmit({ ...values, tags: selectedTags });
    form.reset();
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
      visible={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
    >
      <Form
        form={form}
        initValues={{
          executionResult: task?.status === 'failed' ? 'failed' : 'success',
          feedbackType: 'thumb_up',
          suggestion: '',
        }}
      >
        <Form.RadioGroup field="executionResult" label="执行结果" type="button">
          {EXECUTION_OPTIONS.map((opt) => (
            <Radio key={opt.value} value={opt.value}>
              {opt.label}
            </Radio>
          ))}
        </Form.RadioGroup>

        <Form.RadioGroup field="feedbackType" label="反馈类型" type="button">
          {FEEDBACK_OPTIONS.map((opt) => (
            <Radio key={opt.value} value={opt.value}>
              <Space spacing={4}>
                {opt.icon}
                {opt.label}
              </Space>
            </Radio>
          ))}
        </Form.RadioGroup>

        <Form.TextArea
          field="suggestion"
          label="修改建议 / 备注"
          rows={4}
          placeholder="请输入具体建议，帮助员工学习优化"
        />

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Typography.Text>标签</Typography.Text>
          </div>
          <Space wrap>
            {PRESET_TAGS.map((tag) => (
              <Tag
                key={tag}
                color={selectedTags.includes(tag) ? 'blue' : 'grey'}
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
                onChange={(v: string) => setCustomTag(v)}
                onEnterPress={addCustomTag}
              />
              <Typography.Text link onClick={addCustomTag}>添加</Typography.Text>
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
        </div>
      </Form>
    </Modal>
  );
}
