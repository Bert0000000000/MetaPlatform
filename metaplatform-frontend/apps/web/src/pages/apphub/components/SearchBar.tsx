import { Input, Select } from '@douyinfe/semi-ui';
import { SearchOutlined } from '@ant-design/icons';

interface SearchBarProps {
  keyword?: string;
  onKeywordChange: (v: string) => void;
  sortBy?: 'newest' | 'popular' | 'rating';
  onSortChange: (v: 'newest' | 'popular' | 'rating') => void;
}

export default function SearchBar({
  keyword,
  onKeywordChange,
  sortBy,
  onSortChange,
}: SearchBarProps) {
  return (
    <div className="mp-app-market-filter">
      <div className="mp-app-market-search">
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索模板"
        value={keyword || ''}
        onChange={(v) => onKeywordChange(v)}
        showClear
      />
      </div>
      <Select
        value={sortBy || 'newest'}
        onChange={(v) => onSortChange(v as "newest" | "popular" | "rating")}
        className="mp-w-140"
        optionList={[
          { label: '目录顺序', value: 'newest' },
        ]}
      />
    </div>
  );
}
