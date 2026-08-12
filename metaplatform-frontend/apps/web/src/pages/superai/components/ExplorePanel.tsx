import { useState, useCallback } from 'react';
import {
  Button,
  Input,
  TextArea,
  Card,
  Tag,
  Space,
  Typography,
  Tabs,
  TabPane,
  Table,
  Empty,
  Select,
  InputGroup,
  Toast,
} from '@douyinfe/semi-ui';
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
} from '@/api/superai/ontology';
import type { OntologyConcept, GraphData } from '@/api/superai/types';

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
      Toast.warning('请输入查询内容');
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
        Toast.info(`实体节点：${nodeId}（详情可至数据中心查看）`);
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
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        <Typography.Title heading={5}>{selectedConcept.name}</Typography.Title>
        <Typography.Paragraph type="secondary">{selectedConcept.definition}</Typography.Paragraph>

        {selectedConcept.tags && selectedConcept.tags.length > 0 && (
          <Space wrap spacing="tight">
            {selectedConcept.tags.map((t) => (
              <Tag key={t} color="violet">{t}</Tag>
            ))}
          </Space>
        )}

        <Card  title="属性定义">
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
            scroll={{ x: 'max-content' }}
          />
        </Card>

        <Card  title={`实例列表 (${selectedConcept.instances.length})`}>
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
            scroll={{ x: 'max-content' }}
          />
        </Card>

        {selectedConcept.relatedConcepts.length > 0 && (
          <Card  title="关联概念">
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
    <Card  style={{ marginBottom: 8 }}>
      <Space vertical spacing="tight" style={{ width: '100%' }}>
        <TextArea
          value={query}
          onChange={(v) => onQueryChange(v)}
          placeholder="探索企业数据关系，如：客户A有哪些关联的合同和订单"
          rows={2}
        />
        <Button theme="solid" type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSemanticQuery}>
          语义查询
        </Button>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          tabList={[
            {
              itemKey: 'graph',
              tab: (
                <Space spacing={4}>
                  <ApartmentOutlined />
                  图谱
                </Space>
              ),
            },
            {
              itemKey: 'concepts',
              tab: (
                <Space spacing={4}>
                  <NodeIndexOutlined />
                  概念搜索
                </Space>
              ),
            },
            { itemKey: 'detail', tab: '概念详情' },
          ]}
        >
          <TabPane itemKey="graph">
            {graphData ? (
              <KnowledgeGraph data={graphData} height={350} onNodeClick={handleGraphNodeClick} />
            ) : (
              <Empty description="输入查询后展示知识图谱" />
            )}
          </TabPane>
          <TabPane itemKey="concepts">
            <Space vertical spacing="tight" style={{ width: '100%' }}>
              <InputGroup style={{ width: '100%' }}>
                <Select
                  value={searchField}
                  onChange={(v) => setSearchField(v as SearchField)}
                  style={{ width: 120 }}
                  optionList={[
                    { label: '关键字', value: 'keyword' },
                    { label: '属性', value: 'attribute' },
                    { label: '标签', value: 'tag' },
                  ]}
                  suffixIcon={<FilterOutlined />}
                />
                <Input
                  placeholder={
                    searchField === 'keyword'
                      ? '搜索概念名称/定义/编码'
                      : searchField === 'attribute'
                        ? '按属性名/编码搜索概念'
                        : '按标签过滤概念'
                  }
                  value={conceptSearchKeyword}
                  onChange={(v) => setConceptSearchKeyword(v)}
                  onEnterPress={() => handleConceptSearch(conceptSearchKeyword)}
                  style={{ flex: 1 }}
                />
                <Button
                  theme="solid"
                  type="primary"
                  icon={<SearchOutlined />}
                  loading={loading}
                  onClick={() => handleConceptSearch(conceptSearchKeyword)}
                >
                  搜索
                </Button>
              </InputGroup>
              {concepts.length === 0 ? (
                <Empty description="暂无搜索结果" />
              ) : (
                concepts.map((concept) => (
                  <Card
                    key={concept.id}
                    size="small"
                    onClick={() => handleConceptClick(concept.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Space vertical spacing="tight" style={{ width: '100%' }}>
                      <Space>
                        <Typography.Text strong>{concept.name}</Typography.Text>
                        <Tag>{concept.attributes.length} 属性</Tag>
                        <Tag>{concept.instances.length} 实例</Tag>
                        {concept.tags && concept.tags.length > 0 && (
                          <Tag color="violet">{concept.tags.length} 标签</Tag>
                        )}
                      </Space>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {concept.definition}
                      </Typography.Text>
                      {concept.relatedConcepts.length > 0 && (
                        <Space wrap spacing="tight">
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
                        <Space wrap spacing="tight">
                          {concept.tags.map((t) => (
                            <Tag key={t} color="violet">
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
          </TabPane>
          <TabPane itemKey="detail">
            {renderConceptDetail()}
          </TabPane>
        </Tabs>
      </Space>
    </Card>
  );
}
