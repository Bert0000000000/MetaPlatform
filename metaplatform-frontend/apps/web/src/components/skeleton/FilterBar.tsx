import { Input } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface FilterBarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface FilterBarProps {
  /** 左侧搜索框；不传则不渲染 */
  search?: FilterBarSearch;
  /** 中段筛选控件（Select / DatePicker / Tag 等），由调用方给 */
  filters?: ReactNode;
  /** 右侧动作区（导出、刷新、列设置等） */
  right?: ReactNode;
  className?: string;
}

/** 筛选栏骨架：搜索 + 筛选控件 + 右侧动作。 */
export default function FilterBar({ search, filters, right, className }: FilterBarProps) {
  return (
    <div className={className ? `mp-filterbar ${className}` : 'mp-filterbar'}>
      {search ? (
        <Input
          className="mp-filterbar-search"
          prefix={<Search size={15} strokeWidth={1.5} />}
          value={search.value}
          placeholder={search.placeholder ?? '搜索'}
          onChange={search.onChange}
          showClear
        />
      ) : null}
      {filters ? <div className="mp-filterbar-filters">{filters}</div> : null}
      {right ? <div className="mp-filterbar-right">{right}</div> : null}
    </div>
  );
}
