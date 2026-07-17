import { useState, useCallback } from 'react';
import {
  Button,
  Input,
  Card,
  Tag,
  Space,
  Typography,
  Tabs,
  Table,
  Empty,
  Input as AntInput,
} from 'antd';
import {
  ApartmentOutlined,
  SearchOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import KnowledgeGraph from './KnowledgeGraph';
import { queryConcepts, semanticQuery, getConceptDetail } from '@/api/ontology';
import type { OntologyConcept, GraphData } from '@/types';

const { TextArea } = Input;
const { Search } = AntInput;

interface ExplorePanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult: (metadata: { graphData?: GraphData }) => void;
}

export default function ExplorePanel({ query, onQueryChange, onResult }: ExplorePanelProps) {
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<OntologyConcept[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<OntologyConcept | null>(null);
  const [conceptSearchKeyword, setConceptSearchKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('graph');

  const handleSemanticQuery = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const [graph, conceptList] = await Promise.all([
        semanticQuery(query),
        queryConcepts(query),
      ]);
      setGraphData(graph);
      setConcepts(conceptList);
      onResult({ graphData: graph });
      setActiveTab('graph');
    } finally {
      setLoading(false);
    }
  }, [query, onResult]);

  const handleConceptSearch = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const results = await queryConcepts(keyword);
      setConcepts(results);
      setActiveTab('concepts');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConceptClick = useCallback(async (conceptId: string) => {
    setLoading(true);
    try {
      const detail = await getConceptDetail(conceptId);
      setSelectedConcept(detail);
      setActiveTab('detail');
    } finally {
      setLoading(false);
    }
  }, []);

  const renderConceptDetail = () => {
    if (!selectedConcept) return <Empty description="请选择一个概念查看详情" />;
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Typography.Title level={5}>{selectedConcept.name}</Typography.Title>
        <Typography.Paragraph type="secondary">{selectedConcept.definition}</Typography.Paragraph>

        <Card size="small" title="属性定义">
          <Table
            size="small"
            dataSource={selectedConcept.attributes.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '属性名', dataIndex: 'name', key: 'name' },
              { title: '类型', dataIndex: 'type', key: 'type' },
              { title: '必填', dataIndex: 'required', key: 'required', render: (v: boolean) => v ? <Tag color="red">必填</Tag> : <Tag>可选</Tag> },
              { title: '说明', dataIndex: 'description', key: 'description' },
            ]}
            pagination={false}
          />
        </Card>

        <Card size="small" title={`实例列表 (${selectedConcept.instances.length})`}>
          <Table
            size="small"
            dataSource={selectedConcept.instances.map((inst) => ({ ...inst, key: inst.id }))}
            columns={[
              { title: '实例名称', dataIndex: 'name', key: 'name' },
              ...Object.keys(selectedConcept.instances[0]?.values || {}).map((k) => ({
                title: k,
                dataIndex: ['values', k],
                key: k,
                render: (v: unknown) => String(v),
              })),
            ]}
            pagination={{ pageSize: 5 }}
          />
        </Card>

        {selectedConcept.relatedConcepts.length > 0 && (
          <Card size="small" title="关联概念">
            <Space wrap>
              {selectedConcept.relatedConcepts.map((c) => (
                <Tag key={c} color="blue">{c}</Tag>
              ))}
            </Space>
          </Card>
        )}
      </Space>
    );
  };

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <TextArea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="探索企业数据关系，如：客户A有哪些关联的合同和订单"
          rows={2}
        />
        <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSemanticQuery}>
          语义查询
        </Button>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={[
            {
              key: 'graph',
              label: <Space size={4}><ApartmentOutlined />图谱</Space>,
              children: graphData ? (
                <KnowledgeGraph data={graphData} height={350} />
              ) : (
                <Empty description="输入查询后展示知识图谱" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            },
            {
              key: 'concepts',
              label: <Space size={4}><NodeIndexOutlined />概念搜索</Space>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Search
                    placeholder="搜索概念名称或定义"
                    enterButton="搜索"
                    value={conceptSearchKeyword}
                    onChange={(e) => setConceptSearchKeyword(e.target.value)}
                    onSearch={handleConceptSearch}
                    loading={loading}
                  />
                  {concepts.length === 0 ? (
                    <Empty description="暂无搜索结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    concepts.map((concept) => (
                      <Card
                        key={concept.id}
                        size="small"
                        hoverable
                        onClick={() => handleConceptClick(concept.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <Space>
                            <Typography.Text strong>{concept.name}</Typography.Text>
                            <Tag>{concept.attributes.length} 属性</Tag>
                            <Tag>{concept.instances.length} 实例</Tag>
                          </Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {concept.definition}
                          </Typography.Text>
                          {concept.relatedConcepts.length > 0 && (
                            <Space wrap size="small">
                              {concept.relatedConcepts.map((r) => (
                                <Tag key={r} color="blue">{r}</Tag>
                              ))}
                            </Space>
                          )}
                        </Space>
                      </Card>
                    ))
                  )}
                </Space>
              ),
            },
            {
              key: 'detail',
              label: '概念详情',
              children: renderConceptDetail(),
            },
          ]}
        />
      </Space>
    </Card>
  );
}
