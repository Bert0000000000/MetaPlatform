import { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Typography, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { globalSearch } from '@/api/search';
import type { SearchResult, SearchCategory } from '@/types';

const CATEGORY_LABEL: Record<SearchCategory, string> = {
  app: '应用',
  knowledge: '知识库',
  ontology: '本体',
  task: '任务',
};

const CATEGORY_ICON: Record<SearchCategory, string> = {
  app: '📱',
  knowledge: '📚',
  ontology: '🔗',
  task: '📋',
};

export default function GlobalSearch() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const search = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(kw);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword, search]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ position: 'relative', width: 320 }}>
      <Input
        placeholder="全局搜索应用、知识、本体、任务..."
        prefix={<SearchOutlined />}
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {focused && keyword && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            maxHeight: 400,
            overflow: 'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : results.length === 0 ? (
            <Empty description="未找到相关结果" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 16 }} />
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <Typography.Text type="secondary" style={{ fontSize: 12, padding: '8px 16px', display: 'block', background: '#fafafa' }}>
                  {CATEGORY_LABEL[cat as SearchCategory]}
                </Typography.Text>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}
                    onMouseDown={() => {
                      window.open(item.link, '_blank');
                      setKeyword('');
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{CATEGORY_ICON[item.category]}</span>
                      <Typography.Text strong>{item.title}</Typography.Text>
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {item.description}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
