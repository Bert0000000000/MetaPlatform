import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  List,
  Rating,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import * as Icons from '@ant-design/icons';
import {
  OFFICIAL_TEMPLATES,
  CATEGORY_LABEL,
  type OfficialTemplate,
} from './data/templates';
import {
  getTemplate,
  listTemplateComments,
  addTemplateComment,
  installTemplate,
  type TemplateComment,
} from '@/api/apphub/marketplace';

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

const NODE_TYPE_COLOR: Record<string, 'green' | 'blue' | 'orange' | 'grey'> = {
  start: 'green',
  approval: 'blue',
  condition: 'orange',
  end: 'grey',
};

// Semi TagColor 无 gold，按映射 gold → yellow；其余与 CATEGORY_COLOR 保持一致
const CATEGORY_TAG_COLOR: Record<OfficialTemplate['category'], TagColor> = {
  CRM: 'orange',
  HR: 'green',
  Finance: 'yellow',
  Procurement: 'cyan',
  Project: 'purple',
  Collaboration: 'blue',
};

interface CommentFormValues {
  rating: number;
  comment?: string;
}

type DisplayTemplate = Omit<OfficialTemplate, 'isOfficial'> & { isOfficial: boolean };

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<DisplayTemplate | undefined>(undefined);
  const [installed, setInstalled] = useState(false);
  const [comments, setComments] = useState<TemplateComment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm<CommentFormValues>();

  useEffect(() => {
    const fetchData = async () => {
      if (!templateId) return;
      setLoading(true);
      try {
        const apiData = await getTemplate(templateId);
        // API is primary source; merge with local data for rich preview fields
        const localData = OFFICIAL_TEMPLATES.find((t) => t.templateId === templateId);
        if (localData) {
          setTemplate({
            ...localData,
            name: apiData.name,
            description: apiData.description,
            icon: apiData.icon,
            tags: apiData.tags,
            rating: apiData.rating,
            ratingCount: apiData.ratingCount ?? localData.ratingCount,
            usageCount: apiData.usageCount ?? localData.usageCount,
            author: apiData.author ?? localData.author,
            createdAt: apiData.createdAt,
          });
        } else {
          setTemplate({
            templateId: apiData.templateId,
            name: apiData.name,
            category: apiData.category as OfficialTemplate['category'],
            description: apiData.description,
            icon: apiData.icon,
            tags: apiData.tags,
            rating: apiData.rating,
            ratingCount: apiData.ratingCount ?? 0,
            usageCount: apiData.usageCount ?? apiData.downloadCount,
            author: apiData.author ?? '—',
            screenshots: [],
            fields: [],
            flows: [],
            isOfficial: false,
            createdAt: apiData.createdAt,
          });
        }
      } catch {
        setTemplate(OFFICIAL_TEMPLATES.find((t) => t.templateId === templateId));
      } finally {
        setLoading(false);
      }

      try {
        const data = await listTemplateComments(templateId);
        setComments(data);
      } catch {
        setComments([]);
      }
    };
    fetchData();
  }, [templateId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!template) {
    return (
      <Empty description="模板不存在">
        <Button theme="solid" type="primary" onClick={() => navigate('/market')}>
          返回应用市场
        </Button>
      </Empty>
    );
  }

  const ratingInfo = { rating: template.rating, ratingCount: template.ratingCount ?? 0 };

  const handleInstall = async () => {
    try {
      const result = await installTemplate(template.templateId);
      if (result.success) {
        Toast.success(`已安装模板：${template.name}`);
        setInstalled(true);
      } else {
        Toast.info('该模板已安装');
        setInstalled(true);
      }
    } catch {
      Toast.error('安装失败，请稍后重试');
    }
  };

  const handleSubmitComment = async (values: CommentFormValues) => {
    if (!templateId) return;
    setSubmitting(true);
    try {
      await addTemplateComment(templateId, { rating: values.rating, comment: values.comment });
      const data = await listTemplateComments(templateId);
      setComments(data);
      Toast.success('评论已提交');
      form.reset();
    } catch {
      Toast.error('评论提交失败');
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
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {template.name}
        </Typography.Title>
        <Tag color={CATEGORY_TAG_COLOR[template.category]}>{CATEGORY_LABEL[template.category]}</Tag>
        {template.isOfficial && <Tag>官方模板</Tag>}
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
                    background: 'linear-gradient(135deg, var(--semi-color-primary) 0%, var(--semi-color-primary-light-hover) 100%)',
                    color: 'var(--semi-color-white)',
                    fontSize: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderIcon(template.icon)}
                </div>
              </Col>
              <Col style={{ flex: 'auto' }}>
                <Typography.Title heading={5} style={{ margin: 0 }}>
                  {template.name}
                </Typography.Title>
                <Space spacing="medium" style={{ marginTop: 8 }}>
                  <Space>
                    <Rating disabled value={ratingInfo.rating} allowHalf style={{ fontSize: 14 }} />
                    <Typography.Text strong>{ratingInfo.rating}</Typography.Text>
                    <Typography.Text type="tertiary">({ratingInfo.ratingCount} 人评分)</Typography.Text>
                  </Space>
                  <Typography.Text type="tertiary">·</Typography.Text>
                  <Typography.Text type="tertiary">{template.usageCount} 次使用</Typography.Text>
                  <Typography.Text type="tertiary">·</Typography.Text>
                  <Typography.Text type="tertiary">作者：{template.author}</Typography.Text>
                </Space>
              </Col>
              <Col>
                <Button
                  theme="solid"
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
              <Empty description="暂无截图" />
            ) : (
              <Row gutter={[12, 12]}>
                {template.screenshots.map((s, idx) => (
                  <Col key={idx} xs={24} sm={12}>
                    <img
                      src={s}
                      alt={`截图 ${idx + 1}`}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid var(--semi-color-border)' }}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          {/* 字段预览 */}
          <Card title={`字段预览（${template.fields.length} 个）`} style={{ marginBottom: 16 }}>
            {template.fields.length === 0 ? (
              <Empty description="暂无字段定义" />
            ) : (
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
                        <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                          选项：{field.options.join(' / ')}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* 流程预览 */}
          <Card title={`流程预览（${template.flows.length} 个）`} style={{ marginBottom: 16 }}>
            {template.flows.length === 0 ? (
              <Empty description="暂无流程定义" />
            ) : (
              template.flows.map((flow, idx) => (
                <Card
                  key={idx}
                  title={flow.name}
                  headerExtraContent={flow.description ? <Typography.Text type="tertiary">{flow.description}</Typography.Text> : null}
                  style={{ marginBottom: idx === template.flows.length - 1 ? 0 : 12 }}
                >
                  <Timeline
                    dataSource={flow.nodes.map((node) => ({
                      color: NODE_TYPE_COLOR[node.type],
                      dot: <Icons.CheckCircleOutlined style={{ fontSize: 16 }} />,
                      content: (
                        <Space vertical spacing={0}>
                          <Space>
                            <Typography.Text strong>{node.name}</Typography.Text>
                            <Tag color={NODE_TYPE_COLOR[node.type]}>{node.type}</Tag>
                          </Space>
                          {node.assignee ? (
                            <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                              处理人：{node.assignee}
                            </Typography.Text>
                          ) : null}
                        </Space>
                      ),
                    }))}
                  />
                </Card>
              ))
            )}
          </Card>
        </Col>

        {/* 右侧：评论 */}
        <Col xs={24} lg={8}>
          <Card title="提交评论" style={{ marginBottom: 16 }}>
            <Form
              form={form}
              layout="vertical"
              onSubmit={handleSubmitComment}
              initValues={{ rating: 5 }}
            >
              <Form.Rating
                field="rating"
                label="评分"
                rules={[{ required: true, message: '请选择评分' }]}
              />
              <Form.TextArea
                field="comment"
                label="评论"
                rows={3}
                placeholder="说说你对这个模板的看法"
              />
              <Button theme="solid" type="primary" htmlType="submit" loading={submitting}>
                提交评论
              </Button>
            </Form>
          </Card>

          <Card title={`全部评论 (${comments.length})`}>
            {comments.length === 0 ? (
              <Empty description="暂无评论，快来发表第一条评论吧" />
            ) : (
              <List
                layout="vertical"
                dataSource={comments}
                renderItem={(item) => (
                  <List.Item
                    header={<Avatar><Icons.UserOutlined /></Avatar>}
                    main={
                      <>
                        <Space>
                          <Typography.Text>{item.userId}</Typography.Text>
                          <Rating disabled value={item.rating} style={{ fontSize: 12 }} />
                        </Space>
                        {item.comment ? (
                          <Typography.Paragraph style={{ marginTop: 8 }}>{item.comment}</Typography.Paragraph>
                        ) : null}
                        <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </Typography.Text>
                      </>
                    }
                  />
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
