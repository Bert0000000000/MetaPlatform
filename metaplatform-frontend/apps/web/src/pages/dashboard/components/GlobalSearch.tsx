import { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Typography, Empty } from '@douyinfe/semi-ui';
import { SearchOutlined } from '@ant-design/icons';
import { globalSearch } from '@/api/dashboard/search';
import type { SearchResult, SearchCategory } from '@/api/dashboard/types';

const { Text } = Typography;

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
        showClear
        value={keyword}
        onChange={(v) => setKeyword(v)}
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
            background: 'var(--card)',
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
            <Empty description="未找到相关结果" style={{ padding: 16 }} />
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <Text type="secondary" style={{ fontSize: 12, padding: '8px 16px', display: 'block', background: 'var(--muted)' }}>
                  {CATEGORY_LABEL[cat as SearchCategory]}
                </Text>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseDown={() => {
                      window.open(item.link, '_blank');
                      setKeyword('');
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{CATEGORY_ICON[item.category]}</span>
                      <Text strong>{item.title}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
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
