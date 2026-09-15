import { Input, Space, Select } from '@douyinfe/semi-ui';
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
    <Space>
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索模板"
        value={keyword || ''}
        onChange={(v) => onKeywordChange(v)}
        className="mp-w-280"
        showClear
      />
      <Select
        value={sortBy || 'newest'}
        onChange={(v) => onSortChange(v as "newest" | "popular" | "rating")}
        className="mp-w-140"
        optionList={[
          { label: '最新', value: 'newest' },
          { label: '最热', value: 'popular' },
          { label: '评分', value: 'rating' },
        ]}
      />
    </Space>
  );
}
