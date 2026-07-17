import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { globalSearch } from '@/api/search';
import type { SearchResult } from '@/types';

export default function GlobalSearch() {
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode; item: SearchResult }[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  const handleSearch = async (keyword: string) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    if (!keyword.trim()) {
      setOptions([]);
      return;
    }
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const results = await globalSearch(keyword);
        setOptions(
          results.map((item) => ({
            value: `${item.type}:${item.id}`,
            item,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.name}</span>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {item.type === 'concept' ? '概念' : '实体'}
                  {item.conceptName ? ` · ${item.conceptName}` : ''}
                </span>
              </div>
            ),
          }))
        );
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (_: string, option: { item: SearchResult }) => {
    const { item } = option;
    if (item.type === 'concept') {
      navigate(`/concepts/${item.id}`);
    } else {
      navigate(`/entities/${item.id}`);
    }
    setOptions([]);
  };

  return (
    <AutoComplete
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      style={{ width: 320 }}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索概念或实体"
        loading={loading}
        allowClear
      />
    </AutoComplete>
  );
}
