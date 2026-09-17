import { Button, Card, Empty, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { PlanDraft, PlanNode } from '@/api/wfe/workflowDefinitions';
import '../wfe.css';

interface PlanCanvasProps {
  plan: PlanDraft;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

function nodeLabel(node: PlanNode): string {
  if (node.type === 'action') return node.action_type || '未配置 ActionType';
  return node.type === 'start' ? '开始' : '结束';
}

export function PlanCanvas({ plan, selectedNodeId, onSelect, onDeleteNode }: PlanCanvasProps) {
  if (plan.nodes.length === 0) return <Empty description="尚未添加节点" />;

  return (
    <div aria-label="Plan 画布" className="mp-p-2" style={{ minHeight: 260, overflowX: 'auto' }}>
      <Space align="center" spacing={8} style={{ minWidth: 'max-content' }}>
        {plan.nodes.map((node, index) => (
          <div key={node.id} className="mp-gap-2 mp-flex-center">
            {index > 0 && <Typography.Text type="tertiary">→</Typography.Text>}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(node.id);
              }}
              className="mp-clickable mp-w-180"
            >
            <Card
              shadows="hover"
              className={selectedNodeId === node.id ? 'mp-wfe-node-on' : undefined}
              bodyStyle={{ padding: 12 }}
            >
              <Space vertical align="start" spacing="tight" className="mp-w-full">
                <Tag color={node.type === 'action' ? 'blue' : 'grey'}>{node.type}</Tag>
                <Typography.Text strong ellipsis={{ showTooltip: true }}>{nodeLabel(node)}</Typography.Text>
                {node.type === 'action' && (
                  <Button
                    theme="borderless"
                    type="danger"
                    size="small"
                    onClick={(event) => { event.stopPropagation(); onDeleteNode(node.id); }}
                  >
                    删除节点
                  </Button>
                )}
              </Space>
            </Card>
            </div>
          </div>
        ))}
      </Space>
      <Typography.Paragraph type="tertiary" className="mp-mt-3 mp-mb-1" >
        删除节点会同时删除所有关联连线；发布前由服务端校验图结构和 ActionType。
      </Typography.Paragraph>
    </div>
  );
}
