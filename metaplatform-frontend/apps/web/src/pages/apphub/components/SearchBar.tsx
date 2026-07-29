import { Input, Space, Select } from 'antd';
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
        onChange={(e) => onKeywordChange(e.target.value)}
        style={{ width: 280 }}
        allowClear
      />
      <Select
        value={sortBy || 'newest'}
        onChange={onSortChange}
        style={{ width: 140 }}
        options={[
          { label: '最新', value: 'newest' },
          { label: '最热', value: 'popular' },
          { label: '评分', value: 'rating' },
        ]}
      />
    </Space>
  );
}
