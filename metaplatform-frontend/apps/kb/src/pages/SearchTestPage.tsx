import React, { useState } from 'react';
import { Card, Input, Button, Select, Space, List, Tag, Typography, Row, Col } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { listKb, search, Evidence, KbEntity } from '../api/kb';

/**
 * 检索测试页面（P2.3.1）。
 *
 * <p>输入 query → 后端 HybridSearch → Top-K Evidence 列表展示。
 * 支持按 KB 选择 + 显示得分 + 引用跳转。</p>
 */
export default function SearchTestPage() {
  const [query, setQuery] = useState('');
  const [kbId, setKbId] = useState<string | undefined>(undefined);
  const [kbs, setKbs] = useState<KbEntity[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    listKb().then(setKbs).catch(() => setKbs([]));
  }, []);

  const onSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await search({
        tenantId: 'tenant-default',
        kbId,
        query,
      });
      setEvidences(resp);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="检索测试（P2.3.1）" extra={<Tag color="blue">Hybrid: BM25 + Milvus</Tag>}>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            placeholder="选择 KB"
            style={{ width: 240 }}
            value={kbId}
            onChange={setKbId}
            allowClear
            options={kbs.map(kb => ({ value: kb.id, label: kb.displayName }))}
          />
          <Input
            placeholder="输入检索内容"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onPressEnter={onSearch}
            style={{ width: '60%' }}
            prefix={<SearchOutlined />}
          />
          <Button type="primary" onClick={onSearch} loading={loading}>检索</Button>
        </Space.Compact>
      </Card>

      <Card title={`命中 ${evidences.length} 条`} style={{ marginTop: 16 }}>
        <List
          dataSource={evidences}
          renderItem={(ev) => (
            <List.Item
              key={ev.evidenceId}
              actions={[
                <Tag color="green" key="score">score {ev.score.toFixed(3)}</Tag>,
                <Tag key="type">{ev.type}</Tag>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                title={<Typography.Text strong>{ev.title ?? ev.documentId}</Typography.Text>}
                description={<Typography.Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>{ev.fragment}</Typography.Paragraph>}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无命中，输入 query 开始检索' }}
        />
      </Card>
    </div>
  );
}
