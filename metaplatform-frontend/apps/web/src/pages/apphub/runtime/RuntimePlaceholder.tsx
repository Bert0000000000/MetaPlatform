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
    <div className="mp-text-center mp-p-10">
      <Empty
        description={
          <div className="mp-text-2">
            <Tag color="blue" className="mp-mr-2">{nodeType}</Tag>
            <span>{title}</span>
            <div className="mp-mt-2 mp-text-sm">{LABELS[nodeType] || '该模块类型运行时渲染待实现'}</div>
          </div>
        }
      />
    </div>
  );
}
