import { Card, Empty, Typography } from '@douyinfe/semi-ui';
import type { PageDesignerConfig, DashboardWidget } from '@/api/apphub/pages';
import TableWidget from '../components/TableWidget';
import ChartWidget from '../components/ChartWidget';
import '../apps.css';

/**
 * 页面/看板运行时渲染器：从 PageDesignerPage 的 renderWidget 提取。
 * 接收 page/board 节点的 config（PageDesignerConfig），按 widget.type 渲染，
 * 表格/图表复用 TableWidget/ChartWidget（内含 useDataSource 数据源拉取）。
 */
interface RuntimePageProps {
  config: PageDesignerConfig;
}

function renderWidget(w: DashboardWidget) {
  if (w.type === 'table') return <TableWidget widget={w} />;
  if (['chart-bar', 'chart-line', 'chart-pie', 'chart-area', 'chart-scatter', 'gauge'].includes(w.type)) {
    return <ChartWidget widget={w} />;
  }
  if (w.type === 'iframe') {
    const url = (w.config?.url as string) || '';
    return (
      <Card title={w.title}>
        {url ? (
          <iframe title={w.title} src={url} className="mp-w-full mp-border-none mp-app-iframe" />
        ) : (
          <div className="mp-text-center mp-p-6 mp-text-2">请在 config.url 配置嵌入地址</div>
        )}
      </Card>
    );
  }
  if (w.type === 'rich-text') {
    return (
      <Card title={w.title}>
        <div className="mp-p-3 mp-app-min-80 mp-app-pre-wrap">{(w.config?.content as string) || '富文本内容为空'}</div>
      </Card>
    );
  }
  if (w.type === 'stat') {
    return (
      <Card title={w.title}>
        <div className="mp-text-primary mp-text-xl mp-app-fw-700">{(w.config?.value as string) || '—'}</div>
        <Typography.Text type="tertiary">{(w.config?.caption as string) || ''}</Typography.Text>
      </Card>
    );
  }
  return (
    <Card title={w.title}>
      <div className="mp-p-3 mp-app-min-80">{(w.config?.text as string) || '文本'}</div>
    </Card>
  );
}

export default function RuntimePage({ config }: RuntimePageProps) {
  if (!config?.widgets?.length) {
    return <Empty description="该页面暂无组件" className="mp-p-9" />;
  }
  return (
    <div>
      {config.name && <Typography.Title heading={5} className="mp-mb-4">{config.name}</Typography.Title>}
      <div className="mp-gap-4 mp-grid mp-app-grid-2">
        {config.widgets.map((w) => <div key={w.id}>{renderWidget(w)}</div>)}
      </div>
    </div>
  );
}
