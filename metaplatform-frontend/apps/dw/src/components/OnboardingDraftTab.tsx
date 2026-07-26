import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Tag, Space, Button, Modal, Alert, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

/**
 * Ontology 抽取 Tab（P6.2.1）。
 *
 * <p>展示三列：当前 Ontology / LLM 候选 / 操作。
 * 用户可以一次性采纳、选择性采纳或忽略。</p>
 */
export default function OntologyDraftTab({ objectId }: { objectId: string }) {
  const [draft, setDraft] = useState<any>(null);
  const [decisions, setDecisions] = useState<Record<string, 'ACCEPT' | 'REJECT' | 'MERGE'>>({});
  const [loading, setLoading] = useState(false);

  const fetchDraft = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`/api/v1/ont/drafts?status=DRAFT`);
      setDraft(resp.data?.data?.[0]);
      if (resp.data?.data?.[0]?.id) {
        const cands = await axios.get(`/api/v1/ont/drafts/${resp.data.data[0].id}/candidates`);
        setDraft((d: any) => ({ ...d, candidates: cands.data?.data ?? [] }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDraft(); }, [objectId]);

  const onDecision = (candidateId: string, decision: 'ACCEPT' | 'REJECT' | 'MERGE') => {
    setDecisions(d => ({ ...d, [candidateId]: decision }));
  };

  const onSubmit = async () => {
    if (!draft?.id) return;
    Modal.confirm({
      title: '提交草稿',
      content: `将对 ${Object.keys(decisions).length} 条候选事实的处理提交为草稿。`,
      onOk: async () => {
        await axios.post(`/api/v1/ont/drafts/${draft.id}/publish?approver=USER-1001`);
        message.success('草稿已提交');
        fetchDraft();
      },
    });
  };

  if (!draft) {
    return <Alert type="info" message="暂无 Ontology 草稿" showIcon />;
  }

  return (
    <Card
      title={<Space>Ontology 候选事实 <Tag color="blue">{draft.id}</Tag></Space>}
      extra={<Button type="primary" onClick={onSubmit}>提交草稿</Button>}
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={draft.candidates ?? []}
        columns={[
          { title: '概念', dataIndex: 'conceptCode' },
          { title: '对象', dataIndex: 'objectId' },
          { title: '属性', dataIndex: 'property' },
          { title: '候选值', dataIndex: 'proposedValue', render: (v: string) => <code>{v}</code> },
          {
            title: '冲突',
            dataIndex: 'conflictLevel',
            render: (l: string) => {
              const color = l === 'HIGH' ? 'red' : l === 'MEDIUM' ? 'orange' : l === 'LOW' ? 'gold' : 'green';
              return <Tag color={color}>{l}</Tag>;
            },
          },
          { title: '置信度', dataIndex: 'confidence', render: (c: number) => `${(c * 100).toFixed(0)}%` },
          {
            title: '决策',
            render: (_, record: any) => (
              <Space>
                <Button
                  size="small"
                  type={decisions[record.id] === 'ACCEPT' ? 'primary' : 'default'}
                  icon={<CheckCircleOutlined />}
                  onClick={() => onDecision(record.id, 'ACCEPT')}
                >采纳</Button>
                <Button
                  size="small"
                  danger={decisions[record.id] === 'REJECT'}
                  icon={<CloseCircleOutlined />}
                  onClick={() => onDecision(record.id, 'REJECT')}
                >忽略</Button>
              </Space>
            ),
          },
        ]}
        pagination={false}
      />
    </Card>
  );
}
