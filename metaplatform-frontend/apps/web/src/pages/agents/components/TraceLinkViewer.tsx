import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { Copy, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/skeleton';

interface TraceLinkViewerProps {
  traceId?: string;
}

/**
 * Trace 链路入口。
 *
 * 说明：这个组件原先渲染 6 条**写死的假 span**（tech-agent / tool.invoke / llm.call…），
 * 而后端并没有「按 traceId 取 span 列表」的接口。这里改为如实呈现：
 * 展示 traceId + 复制，并指向真正持有链路明细的可观测平台，不再伪造 span。
 */
export default function TraceLinkViewer({ traceId }: TraceLinkViewerProps) {
  if (!traceId) {
    return (
      <EmptyState
        illustration="no-content"
        title="无 Trace ID"
        desc="该任务没有关联的链路 ID，可能是未开启链路采样。"
      />
    );
  }

  return (
    <Card title="Trace 链路">
      <div className="mp-agent-line">
        <span className="mp-agent-line-label">Trace ID</span>
        <span className="mp-agent-chips">
          <code>{traceId}</code>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Copy size={14} strokeWidth={1.5} />}
            onClick={() => {
              void navigator.clipboard?.writeText(traceId);
              Toast.success('Trace ID 已复制');
            }}
          >
            复制
          </Button>
        </span>
      </div>
      <div className="mp-agent-line">
        <span className="mp-agent-line-label">链路明细</span>
        <span className="mp-agent-chips">
          <ExternalLink size={14} strokeWidth={1.5} />
          在可观测平台（TECH-OBS）按此 Trace ID 查看 span 瀑布
        </span>
      </div>
    </Card>
  );
}
