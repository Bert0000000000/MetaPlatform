import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Rate,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, UserOutlined } from '@ant-design/icons';
import {
  addTemplateComment,
  getTemplate,
  installTemplate,
  listTemplateComments,
} from '@/api/marketplace';
import type { TemplateComment, TemplateItem } from '@/api/marketplace';

interface CommentFormValues {
  rating: number;
  comment?: string;
}

export default function MarketplaceDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<TemplateComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CommentFormValues>();

  useEffect(() => {
    if (!templateId) return;
    getTemplate(templateId)
      .then((t) => {
        setTemplate(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [templateId]);

  const refreshComments = (id: string) => {
    setCommentsLoading(true);
    listTemplateComments(id)
      .then((list) => setComments(list))
      .finally(() => setCommentsLoading(false));
  };

  useEffect(() => {
    if (templateId) refreshComments(templateId);
  }, [templateId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (!template) return <Empty />;

  const handleInstall = async () => {
    const res = await installTemplate(template.templateId);
    if (res.success) {
      message.success('已安装');
    }
  };

  const handleSubmitComment = async (values: CommentFormValues) => {
    if (!templateId) return;
    setSubmitting(true);
    try {
      await addTemplateComment(templateId, {
        rating: values.rating,
        comment: values.comment,
      });
      message.success('评论已提交');
      form.resetFields();
      refreshComments(templateId);
      // 重新拉取模板以更新平均评分
      const updated = await getTemplate(templateId);
      setTemplate(updated);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/marketplace')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {template.name}
        </Typography.Title>
        <Tag color="blue">{template.category}</Tag>
        <Rate disabled value={template.rating} allowHalf />
        {template.ratingCount ? (
          <Typography.Text type="secondary">{template.ratingCount} 人评分</Typography.Text>
        ) : null}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Typography.Paragraph>{template.description}</Typography.Paragraph>
        <Space wrap>
          {template.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
        <div style={{ marginTop: 16 }}>
          <Typography.Text>已安装 {template.downloadCount} 次</Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          style={{ marginTop: 16 }}
          onClick={handleInstall}
        >
          安装到我的应用
        </Button>
      </Card>

      <Card title="评分与评论" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitComment}
          initialValues={{ rating: 5 }}
        >
          <Form.Item
            name="rating"
            label="评分"
            rules={[{ required: true, message: '请选择评分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="评论">
            <Input.TextArea rows={3} placeholder="说说你对这个模板的看法" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交评论
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title={`全部评论 (${comments.length})`}>
        <Spin spinning={commentsLoading}>
          {comments.length === 0 ? (
            <Empty description="暂无评论" />
          ) : (
            <List
              dataSource={comments}
              renderItem={(item) => (
                <li key={item.id}>
                  <div style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
                    <Avatar icon={<UserOutlined />} />
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Typography.Text strong>{item.userId}</Typography.Text>
                        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          {new Date(item.updatedAt).toLocaleString()}
                        </Typography.Text>
                      </div>
                      <Rate disabled value={item.rating} style={{ fontSize: 12 }} />
                      {item.comment ? (
                        <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                          {item.comment}
                        </Typography.Paragraph>
                      ) : null}
                    </div>
                  </div>
                </li>
              )}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
