import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Rate,
  Row,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import * as Icons from '@ant-design/icons';
import {
  OFFICIAL_TEMPLATES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  addTemplateComment,
  computeTemplateRating,
  installOfficialTemplate,
  loadTemplateComments,
  loadUserTemplates,
  type OfficialTemplate,
  type TemplateComment,
} from '@/data/templates';
import { getUser } from '@mate/shared';

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return <Icons.AppstoreOutlined />;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : <Icons.AppstoreOutlined />;
}

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  select: '下拉',
  textarea: '长文本',
  file: '附件',
};

const NODE_TYPE_COLOR: Record<string, string> = {
  start: 'green',
  approval: 'blue',
  condition: 'orange',
  end: 'gray',
};

interface CommentFormValues {
  rating: number;
  comment?: string;
}

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [installed, setInstalled] = useState(false);
  const [comments, setComments] = useState<TemplateComment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CommentFormValues>();

  const template: OfficialTemplate | undefined = useMemo(
    () => OFFICIAL_TEMPLATES.find((t) => t.templateId === templateId),
    [templateId],
  );

  useEffect(() => {
    if (!templateId) return;
    setInstalled(loadUserTemplates().some((t) => t.templateId === templateId));
    setComments(loadTemplateComments(templateId));
  }, [templateId]);

  if (!template) {
    return (
      <Empty description="模板不存在">
        <Button type="primary" onClick={() => navigate('/market')}>
          返回应用市场
        </Button>
      </Empty>
    );
  }

  const ratingInfo = computeTemplateRating(templateId!, {
    rating: template.rating,
    ratingCount: template.ratingCount,
  });

  const handleInstall = () => {
    const result = installOfficialTemplate(template.templateId);
    if (result) {
      message.success(`已安装模板：${template.name}`);
      setInstalled(true);
    } else {
      message.info('该模板已安装');
      setInstalled(true);
    }
  };

  const handleSubmitComment = (values: CommentFormValues) => {
    if (!templateId) return;
    setSubmitting(true);
    try {
      const user = getUser();
      const userId = user?.username ?? '匿名用户';
      addTemplateComment(templateId, userId, values.rating, values.comment);
      setComments(loadTemplateComments(templateId));
      message.success('评论已提交');
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<Icons.ArrowLeftOutlined />} onClick={() => navigate('/market')}>
          返回市场
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {template.name}
        </Typography.Title>
        <Tag color={CATEGORY_COLOR[template.category]}>{CATEGORY_LABEL[template.category]}</Tag>
        <Tag>官方模板</Tag>
      </Space>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          {/* 概览卡片 */}
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
                    color: '#fff',
                    fontSize: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderIcon(template.icon)}
                </div>
              </Col>
              <Col flex="auto">
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {template.name}
                </Typography.Title>
                <Space size="middle" style={{ marginTop: 8 }}>
                  <Space>
                    <Rate disabled value={ratingInfo.rating} allowHalf style={{ fontSize: 14 }} />
                    <Typography.Text strong>{ratingInfo.rating}</Typography.Text>
                    <Typography.Text type="secondary">({ratingInfo.ratingCount} 人评分)</Typography.Text>
                  </Space>
                  <Typography.Text type="secondary">·</Typography.Text>
                  <Typography.Text type="secondary">{template.usageCount} 次使用</Typography.Text>
                  <Typography.Text type="secondary">·</Typography.Text>
                  <Typography.Text type="secondary">作者：{template.author}</Typography.Text>
                </Space>
              </Col>
              <Col>
                <Button
                  type="primary"
                  size="large"
                  icon={<Icons.DownloadOutlined />}
                  disabled={installed}
                  onClick={handleInstall}
                >
                  {installed ? '已安装' : '一键安装'}
                </Button>
              </Col>
            </Row>
            <Typography.Paragraph style={{ marginTop: 16 }}>{template.description}</Typography.Paragraph>
            <Space wrap>
              {template.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Space>
          </Card>

          {/* 截图预览 */}
          <Card title="模板截图" style={{ marginBottom: 16 }}>
            {template.screenshots.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无截图（mock 数据，可后续在投稿表单中上传）"
              />
            ) : (
              <Row gutter={[12, 12]}>
                {template.screenshots.map((s, idx) => (
                  <Col key={idx} xs={24} sm={12}>
                    <img
                      src={s}
                      alt={`截图 ${idx + 1}`}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #f0f0f0' }}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          {/* 字段预览 */}
          <Card title={`字段预览（${template.fields.length} 个）`} style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={template.fields}
              renderItem={(field) => (
                <List.Item>
                  <Space>
                    <Typography.Text strong>{field.label}</Typography.Text>
                    <Tag>{field.fieldKey}</Tag>
                    <Tag color="blue">{FIELD_TYPE_LABEL[field.type] ?? field.type}</Tag>
                    {field.required ? <Tag color="red">必填</Tag> : null}
                    {field.options && field.options.length > 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        选项：{field.options.join(' / ')}
                      </Typography.Text>
                    ) : null}
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          {/* 流程预览 */}
          <Card title={`流程预览（${template.flows.length} 个）`} style={{ marginBottom: 16 }}>
            {template.flows.map((flow, idx) => (
              <Card
                key={idx}
                type="inner"
                title={flow.name}
                extra={flow.description ? <Typography.Text type="secondary">{flow.description}</Typography.Text> : null}
                style={{ marginBottom: idx === template.flows.length - 1 ? 0 : 12 }}
              >
                <Timeline
                  items={flow.nodes.map((node) => ({
                    color: NODE_TYPE_COLOR[node.type],
                    dot: <Icons.CheckCircleOutlined style={{ fontSize: 16 }} />,
                    children: (
                      <Space direction="vertical" size={0}>
                        <Space>
                          <Typography.Text strong>{node.name}</Typography.Text>
                          <Tag color={NODE_TYPE_COLOR[node.type]}>{node.type}</Tag>
                        </Space>
                        {node.assignee ? (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            处理人：{node.assignee}
                          </Typography.Text>
                        ) : null}
                      </Space>
                    ),
                  }))}
                />
              </Card>
            ))}
          </Card>
        </Col>

        {/* 右侧：评论 */}
        <Col xs={24} lg={8}>
          <Card title="提交评论" style={{ marginBottom: 16 }}>
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
            {comments.length === 0 ? (
              <Empty description="暂无评论，快来发表第一条评论吧" />
            ) : (
              <List
                itemLayout="vertical"
                dataSource={comments}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<Icons.UserOutlined />} />}
                      title={
                        <Space>
                          <Typography.Text>{item.userId}</Typography.Text>
                          <Rate disabled value={item.rating} style={{ fontSize: 12 }} />
                        </Space>
                      }
                      description={
                        <>
                          {item.comment ? (
                            <Typography.Paragraph style={{ marginTop: 8 }}>{item.comment}</Typography.Paragraph>
                          ) : null}
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(item.createdAt).toLocaleString()}
                          </Typography.Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
