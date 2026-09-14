import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: ReactNode;
  desc?: ReactNode;
  /** 主操作，右对齐（DESIGN-SPEC §5 共享元素：页头 = 标题 + 描述 + 主操作右对齐） */
  actions?: ReactNode;
  className?: string;
}

/** 页头骨架（五骨架共用）。只负责排版，不承担任何数据逻辑。 */
export default function PageHeader({ title, desc, actions, className }: PageHeaderProps) {
  return (
    <header className={className ? `mp-page-head ${className}` : 'mp-page-head'}>
      <div className="mp-page-head-main">
        <h1 className="mp-page-head-title">{title}</h1>
        {desc ? <p className="mp-page-head-desc">{desc}</p> : null}
      </div>
      {actions ? <div className="mp-page-head-actions">{actions}</div> : null}
    </header>
  );
}
