import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Space, Spin, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { canInstallTemplate, getTemplate, installTemplate, type TemplateItem } from '@/api/apphub/marketplace';
import './apps.css';

const TYPE_LABELS: Record<string, string> = { workflow: '工作流', form: '表单', approval: '审批' };

export default function TemplateDetailPage() {
  const { templateId: routeTemplateId } = useParams<{ templateId: string }>();
  const [searchParams] = useSearchParams();
  const templateId = routeTemplateId ?? searchParams.get('tid');
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!templateId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTemplate(null);
    setInstalled(false);
    getTemplate(templateId)
      .then((data) => { if (!cancelled) setTemplate(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : '模板读取失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [templateId, refreshKey]);

  const handleInstall = async () => {
    if (!template) return;
    setInstalling(true);
    try {
      const result = await installTemplate(template.templateId);
      if (result.success) {
        setInstalled(true);
        if (result.alreadyInstalled) Toast.info('该市场制品已安装');
        else Toast.success('市场制品安装请求已提交');
      } else Toast.error(result.error || '安装失败，请重试');
    } finally { setInstalling(false); }
  };

  let content = template?.configSnapshot ?? '';
  try { content = content ? JSON.stringify(JSON.parse(content), null, 2) : ''; } catch { /* 保留服务端原文 */ }
  const installable = Boolean(template && canInstallTemplate(template.templateId));

  return (
    <div className="mp-apps-page">
      <PageHeader
        title={template?.name ?? '模板详情'}
        desc={template?.description ?? '查看模板类型与配置内容。'}
        actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps/market')}>返回应用市场</Button>}
      />
      {loading ? <div className="mp-app-loading"><Spin tip="正在读取模板…" /></div>
        : error ? <div role="alert"><EmptyState illustration="failure" title="模板读取失败" desc={error} actions={<Button type="primary" onClick={() => setRefreshKey((key) => key + 1)}>重试</Button>} /></div>
          : !template ? <EmptyState title="未选择模板" desc="请从模板目录打开要查看的模板。" actions={<Button onClick={() => navigate('/apps/market')}>查看模板目录</Button>} />
            : <>
              <Card className="mp-mb-4">
                <Space wrap>
                  <Tag color="blue">{TYPE_LABELS[template.category] ?? template.category}</Tag>
                  <Typography.Text type="tertiary">{template.templateId}</Typography.Text>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    disabled={installed || !installable}
                    loading={installing}
                    onClick={handleInstall}
                  >{installed ? '安装请求已提交' : installable ? '安装市场制品' : '安装暂不可用'}</Button>
                </Space>
                {!installable && <Typography.Paragraph type="tertiary" className="mp-mt-3">该模板尚未关联可安装的市场制品，当前可查看配置内容。</Typography.Paragraph>}
              </Card>
              <Card title="模板配置" className="mp-mb-4">
                {content && content !== '{}' ? <pre className="mp-app-template-content">{content}</pre> : <EmptyState title="暂无配置内容" desc="此模板没有提供字段或流程配置。" />}
              </Card>
              <Card title="模板反馈">
                <Typography.Paragraph type="tertiary">评分与评论暂未开放。</Typography.Paragraph>
              </Card>
            </>}
    </div>
  );
}
