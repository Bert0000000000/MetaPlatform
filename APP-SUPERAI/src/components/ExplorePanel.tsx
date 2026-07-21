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
  Select,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  SearchOutlined,
  NodeIndexOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import KnowledgeGraph from './KnowledgeGraph';
import {
  queryConcepts,
  semanticQuery,
  getConceptDetail,
  searchConcepts,
} from '@/api/ontology';
import type { OntologyConcept, GraphData } from '@/types';

const { TextArea } = Input;
const { Search } = AntInput;

interface ExplorePanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult: (metadata: { graphData?: GraphData }) => void;
}

type SearchField = 'keyword' | 'attribute' | 'tag';

export default function ExplorePanel({ query, onQueryChange, onResult }: ExplorePanelProps) {
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<OntologyConcept[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<OntologyConcept | null>(null);
  const [conceptSearchKeyword, setConceptSearchKeyword] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('keyword');
  const [activeTab, setActiveTab] = useState('graph');

  /** 语义查询：同时拉取图谱与概念列表。 */
  const handleSemanticQuery = useCallback(async () => {
    if (!query.trim()) {
      message.warning('请输入查询内容');
      return;
    }
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

  /** 概念搜索（REQ-030：支持关键字/属性/标签三个维度）。 */
  const handleConceptSearch = useCallback(async (value: string) => {
    setLoading(true);
    try {
      let results: OntologyConcept[];
      if (searchField === 'keyword') {
        results = await searchConcepts(value || undefined);
      } else if (searchField === 'attribute') {
        results = await searchConcepts(undefined, value || undefined);
      } else {
        results = await searchConcepts(undefined, undefined, value || undefined);
      }
      setConcepts(results);
      setActiveTab('concepts');
    } finally {
      setLoading(false);
    }
  }, [searchField]);

  /** 概念详情（REQ-031）。 */
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

  /** REQ-033：图谱节点点击跳转概念详情。 */
  const handleGraphNodeClick = useCallback(
    async (nodeId: string, nodeType: string) => {
      // 仅 concept 节点跳转概念详情；entity 节点提示
      if (nodeType !== 'concept') {
        message.info(`实体节点：${nodeId}（详情可至数据中心查看）`);
        return;
      }
      try {
        const detail = await getConceptDetail(nodeId);
        setSelectedConcept(detail);
        setActiveTab('detail');
      } catch {
        // 静默失败：节点点击不应阻塞用户操作
      }
    },
    [],
  );

  const renderConceptDetail = () => {
    if (!selectedConcept) return <Empty description="请选择一个概念查看详情" />;
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Typography.Title level={5}>{selectedConcept.name}</Typography.Title>
        <Typography.Paragraph type="secondary">{selectedConcept.definition}</Typography.Paragraph>

        {selectedConcept.tags && selectedConcept.tags.length > 0 && (
          <Space wrap size="small">
            {selectedConcept.tags.map((t) => (
              <Tag key={t} color="geekblue">{t}</Tag>
            ))}
          </Space>
        )}

        <Card size="small" title="属性定义">
          <Table
            size="small"
            dataSource={selectedConcept.attributes.map((a, i) => ({ ...a, key: i }))}
            columns={[
              { title: '属性名', dataIndex: 'name', key: 'name' },
              { title: '类型', dataIndex: 'type', key: 'type' },
              {
                title: '必填',
                dataIndex: 'required',
                key: 'required',
                render: (v: boolean) => (v ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>),
              },
              { title: '说明', dataIndex: 'description', key: 'description' },
            ]}
            pagination={false}
           scroll={{ x: 'max-content' }}/>
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
           scroll={{ x: 'max-content' }}/>
        </Card>

        {selectedConcept.relatedConcepts.length > 0 && (
          <Card size="small" title="关联概念">
            <Space wrap>
              {selectedConcept.relatedConcepts.map((c) => (
                <Tag
                  key={c}
                  color="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleConceptClick(c)}
                >
                  {c}
                </Tag>
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
              label: (
                <Space size={4}>
                  <ApartmentOutlined />
                  图谱
                </Space>
              ),
              children: graphData ? (
                <KnowledgeGraph data={graphData} height={350} onNodeClick={handleGraphNodeClick} />
              ) : (
                <Empty description="输入查询后展示知识图谱" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            },
            {
              key: 'concepts',
              label: (
                <Space size={4}>
                  <NodeIndexOutlined />
                  概念搜索
                </Space>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      value={searchField}
                      onChange={(v) => setSearchField(v)}
                      style={{ width: 120 }}
                      options={[
                        { label: '关键字', value: 'keyword' },
                        { label: '属性', value: 'attribute' },
                        { label: '标签', value: 'tag' },
                      ]}
                      suffixIcon={<FilterOutlined />}
                    />
                    <Search
                      placeholder={
                        searchField === 'keyword'
                          ? '搜索概念名称/定义/编码'
                          : searchField === 'attribute'
                            ? '按属性名/编码搜索概念'
                            : '按标签过滤概念'
                      }
                      enterButton="搜索"
                      value={conceptSearchKeyword}
                      onChange={(e) => setConceptSearchKeyword(e.target.value)}
                      onSearch={handleConceptSearch}
                      loading={loading}
                      style={{ flex: 1 }}
                    />
                  </Space.Compact>
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
                            {concept.tags && concept.tags.length > 0 && (
                              <Tag color="geekblue">{concept.tags.length} 标签</Tag>
                            )}
                          </Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {concept.definition}
                          </Typography.Text>
                          {concept.relatedConcepts.length > 0 && (
                            <Space wrap size="small">
                              {concept.relatedConcepts.slice(0, 5).map((r) => (
                                <Tag key={r} color="blue">
                                  {r}
                                </Tag>
                              ))}
                              {concept.relatedConcepts.length > 5 && (
                                <Tag>+{concept.relatedConcepts.length - 5}</Tag>
                              )}
                            </Space>
                          )}
                          {concept.tags && concept.tags.length > 0 && (
                            <Space wrap size="small">
                              {concept.tags.map((t) => (
                                <Tag key={t} color="geekblue">
                                  {t}
                                </Tag>
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
