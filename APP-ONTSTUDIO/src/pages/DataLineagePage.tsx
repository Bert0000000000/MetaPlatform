import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AlertOutlined,
  ApartmentOutlined,
  CrownOutlined,
  DownloadOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import LineageGraph from '@/components/LineageGraph';
import { analyzeImpact, getLineage } from '@/api/lineage';
import type { DataLineage, LineageImpactResult, LineageNode, LineageNodeType } from '@/types';

const TYPE_LABELS: Record<LineageNodeType, string> = {
  datasource: '数据源',
  table: '表',
  field: '字段',
  mapping: '映射',
  concept: '概念',
  attribute: '属性',
  entity: '实体',
  relation: '关系',
  action: 'Action',
  output: '输出',
};

const TYPE_COLORS: Record<LineageNodeType, string> = {
  datasource: 'purple',
  table: 'blue',
  field: 'cyan',
  mapping: 'orange',
  concept: 'blue',
  attribute: 'green',
  entity: 'magenta',
  relation: 'gold',
  action: 'volcano',
  output: 'cyan',
};

function countByType(nodes: LineageNode[]): Record<LineageNodeType, number> {
  const result = {} as Record<LineageNodeType, number>;
  for (const n of nodes) {
    result[n.type] = (result[n.type] ?? 0) + 1;
  }
  return result;
}

export default function DataLineagePage() {
  const [lineage, setLineage] = useState<DataLineage | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [impact, setImpact] = useState<LineageImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const data = await getLineage(s);
      setLineage(data);
      setImpact(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope);
  }, [scope, load]);

  const handleSearch = useCallback(() => {
    const v = searchInput.trim() || 'all';
    setScope(v);
    setSelectedNodeId(undefined);
  }, [searchInput]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !lineage) return null;
    return lineage.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, lineage]);

  const handleAnalyzeImpact = useCallback(async () => {
    if (!selectedNodeId) {
      message.warning('请先在图中选择一个节点');
      return;
    }
    setImpactLoading(true);
    try {
      const result = await analyzeImpact(selectedNodeId);
      setImpact(result);
      message.success(
        `影响分析完成：上游 ${result.upstreamCount} 个，下游 ${result.downstreamCount} 个`,
      );
    } finally {
      setImpactLoading(false);
    }
  }, [selectedNodeId]);

  const highlightedNodes = useMemo(() => {
    if (!impact) return undefined;
    return new Set(impact.impactedNodes);
  }, [impact]);

  const typeCounts = useMemo(() => (lineage ? countByType(lineage.nodes) : ({} as Record<LineageNodeType, number>)), [lineage]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <ApartmentOutlined /> 数据血缘
        </Typography.Title>
        <Space>
          <Input.Search
            placeholder="搜索节点名称，如：客户 / 合同 / CRM"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            enterButton={
              <Button type="primary" icon={<SearchOutlined />}>
                查询
              </Button>
            }
            style={{ width: 320 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(scope)} loading={loading}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} disabled={!lineage} onClick={() => message.info('导出功能开发中')}>
            导出
          </Button>
        </Space>
      </Space>

      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="节点总数" value={lineage?.nodes.length ?? 0} prefix={<NodeIndexOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="关系边数" value={lineage?.edges.length ?? 0} prefix={<ApartmentOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="数据源" value={typeCounts.datasource ?? 0} prefix={<CrownOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="概念/属性" value={(typeCounts.concept ?? 0) + (typeCounts.attribute ?? 0)} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="实体/关系" value={(typeCounts.entity ?? 0) + (typeCounts.relation ?? 0)} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Action/输出" value={(typeCounts.action ?? 0) + (typeCounts.output ?? 0)} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={selectedNode ? 16 : 24}>
          <Card
            title={
              <Space>
                <ApartmentOutlined />
                血缘图谱
                {impact && (
                  <Tag color="blue">
                    影响范围：{impact.impactedNodes.length} 节点
                  </Tag>
                )}
              </Space>
            }
            size="small"
            extra={
              <Space size="small">
                {selectedNodeId && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<AlertOutlined />}
                    onClick={handleAnalyzeImpact}
                    loading={impactLoading}
                  >
                    影响分析
                  </Button>
                )}
                {impact && (
                  <Button size="small" onClick={() => setImpact(null)}>
                    清除高亮
                  </Button>
                )}
              </Space>
            }
          >
            {lineage && lineage.nodes.length > 0 ? (
              <LineageGraph
                data={lineage}
                height={560}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => {
                  setSelectedNodeId(id);
                  setImpact(null);
                }}
                highlightedNodes={highlightedNodes}
              />
            ) : (
              <Empty description="暂无血缘数据，请输入查询条件" />
            )}
          </Card>
        </Col>

        {selectedNode && (
          <Col span={8}>
            <Card
              title="节点详情"
              size="small"
              extra={
                <Button size="small" type="link" onClick={() => setSelectedNodeId(undefined)}>
                  关闭
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="节点ID">{selectedNode.id}</Descriptions.Item>
                  <Descriptions.Item label="名称">
                    <Typography.Text strong>{selectedNode.label}</Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="类型">
                    <Tag color={TYPE_COLORS[selectedNode.type]}>
                      {TYPE_LABELS[selectedNode.type]}
                    </Tag>
                  </Descriptions.Item>
                  {selectedNode.parentId && (
                    <Descriptions.Item label="父节点">
                      {lineage?.nodes.find((n) => n.id === selectedNode.parentId)?.label ??
                        selectedNode.parentId}
                    </Descriptions.Item>
                  )}
                  {selectedNode.metadata?.sourceType && (
                    <Descriptions.Item label="数据源类型">
                      {selectedNode.metadata.sourceType}
                    </Descriptions.Item>
                  )}
                  {selectedNode.metadata?.schedule && (
                    <Descriptions.Item label="调度">{selectedNode.metadata.schedule}</Descriptions.Item>
                  )}
                  {selectedNode.metadata?.status && (
                    <Descriptions.Item label="状态">
                      <Tag color={selectedNode.metadata.status === 'active' ? 'green' : 'default'}>
                        {selectedNode.metadata.status}
                      </Tag>
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* 直接上下游关系 */}
                <DirectRelations lineage={lineage!} nodeId={selectedNode.id} />

                {impact && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<AlertOutlined />}
                    message={`影响范围分析`}
                    description={
                      <Space direction="vertical" size={4}>
                        <Typography.Text>
                          上游节点：<Typography.Text strong>{impact.upstreamCount}</Typography.Text> 个
                        </Typography.Text>
                        <Typography.Text>
                          下游受影响节点：<Typography.Text strong>{impact.downstreamCount}</Typography.Text> 个
                        </Typography.Text>
                        {impact.impactPath.length > 1 && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            关键路径：{impact.impactPath.join(' → ')}
                          </Typography.Text>
                        )}
                      </Space>
                    }
                  />
                )}
              </Space>
            </Card>
          </Col>
        )}
      </Row>

      {/* 图例 */}
      <Card size="small" title="图例与说明">
        <Space wrap>
          {(Object.keys(TYPE_LABELS) as LineageNodeType[]).map((t) => (
            <Tag key={t} color={TYPE_COLORS[t]}>
              {TYPE_LABELS[t]}
            </Tag>
          ))}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          点击节点查看详情；选中节点后可点击「影响分析」查看修改该节点会影响的上下游范围。
          血缘图按层级从上到下展示：数据源 → 表 → 字段 → 映射 → 概念/属性 → 实体 → 关系 → Action → 输出。
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}

/** 直接展示选中节点的上下游（一跳）。 */
function DirectRelations({
  lineage,
  nodeId,
}: {
  lineage: DataLineage;
  nodeId: string;
}) {
  const upstream = lineage.edges.filter((e) => e.target === nodeId);
  const downstream = lineage.edges.filter((e) => e.source === nodeId);

  const nodeLabel = (id: string) =>
    lineage.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div>
      <Typography.Title level={5} style={{ fontSize: 13 }}>
        直接上下游
      </Typography.Title>
      {upstream.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            上游（{upstream.length}）：
          </Typography.Text>
          <Space wrap size={4} style={{ marginTop: 4 }}>
            {upstream.map((e) => (
              <Tag key={e.id} color="blue">
                {nodeLabel(e.source)}
                {e.label ? ` · ${e.label}` : ''}
              </Tag>
            ))}
          </Space>
        </div>
      )}
      {downstream.length > 0 && (
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            下游（{downstream.length}）：
          </Typography.Text>
          <Space wrap size={4} style={{ marginTop: 4 }}>
            {downstream.map((e) => (
              <Tag key={e.id} color="orange">
                {nodeLabel(e.target)}
                {e.label ? ` · ${e.label}` : ''}
              </Tag>
            ))}
          </Space>
        </div>
      )}
      {upstream.length === 0 && downstream.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无直接上下游" />
      )}
    </div>
  );
}
