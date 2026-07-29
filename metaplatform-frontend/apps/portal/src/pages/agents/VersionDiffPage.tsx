import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Select, Space, Statistic, Row, Col } from 'antd';
import axios from 'axios';

/**
 * Version Diff 页面（P6.3）。
 *
 * <p>展示 Ontology Commit 之间的差异，支持回滚。</p>
 */
export default function VersionDiffPage() {
  const [diffs, setDiffs] = useState<any[]>([]);
  const [toVersion, setToVersion] = useState<string>('v2');

  useEffect(() => {
    axios.get(`/api/v1/ont/diff?toVersion=${toVersion}`).then(r => setDiffs(r.data?.data ?? []));
  }, [toVersion]);

  return (
    <div style={{ padding: 24 }}>
      <Card title="Ontology 版本差异">
        <Space style={{ marginBottom: 16 }}>
          <span>查看版本：</span>
          <Select value={toVersion} onChange={setToVersion} options={[
            { value: 'v1', label: 'v1 (基线)' },
            { value: 'v2', label: 'v2' },
            { value: 'v3', label: 'v3' },
          ]} style={{ width: 160 }} />
        </Space>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}><Statistic title="新增条目" value={diffs.filter(d => d.diffType.includes('ADDED')).length} /></Col>
          <Col span={8}><Statistic title="修改条目" value={diffs.filter(d => d.diffType.includes('MODIFIED')).length} /></Col>
          <Col span={8}><Statistic title="删除条目" value={diffs.filter(d => d.diffType.includes('REMOVED')).length} /></Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={diffs}
          columns={[
            { title: '差异类型', dataIndex: 'diffType', render: (t: string) => {
                const color = t.includes('ADDED') ? 'green' : t.includes('MODIFIED') ? 'orange' : t.includes('REMOVED') ? 'red' : 'blue';
                return <Tag color={color}>{t}</Tag>;
              }
            },
            { title: '目标版本', dataIndex: 'toVersion' },
            { title: '来源版本', dataIndex: 'fromVersion', render: (v: string) => v || '—' },
            { title: '变更内容', dataIndex: 'changes', render: (c: string) => <pre style={{ maxHeight: 120, overflow: 'auto', margin: 0 }}>{c}</pre> },
            { title: '时间', dataIndex: 'createdAt' },
          ]}
          pagination={false}
        />
      </Card>
    </div>
  );
}
