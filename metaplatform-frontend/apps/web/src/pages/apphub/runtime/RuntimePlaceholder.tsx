import { Empty, Tag } from '@douyinfe/semi-ui';

/**
 * flow / board 节点的运行时占位：这些模块类型的运行时引擎尚未实现，
 * 给出明确的占位提示而非空白。
 */
interface RuntimePlaceholderProps {
  nodeType: string;
  title: string;
}

const LABELS: Record<string, string> = {
  flow: '审批流程运行时待实现：待办列表 / 状态机 / 审批通过·拒绝',
  board: '看板运行时待实现',
};

export default function RuntimePlaceholder({ nodeType, title }: RuntimePlaceholderProps) {
  return (
    <div style={{ padding: 64, textAlign: 'center' }}>
      <Empty
        description={
          <div style={{ color: 'var(--semi-color-text-2)' }}>
            <Tag color="blue" style={{ marginRight: 8 }}>{nodeType}</Tag>
            <span>{title}</span>
            <div style={{ marginTop: 8, fontSize: 12 }}>{LABELS[nodeType] || '该模块类型运行时渲染待实现'}</div>
          </div>
        }
      />
    </div>
  );
}
