import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  analyzeDataSource,
  importCandidates,
  listDiscoveryDataSources,
  suggestCandidates,
} from '@/api/discovery';
import type {
  CandidateAttribute,
  CandidateConcept,
  CandidateRelation,
  DataSourceListItem,
  DiscoveryResult,
  ImportResult,
} from '@/api/discovery';

const { Title, Text } = Typography;


const STEP_SELECT = 0;
const STEP_ANALYZE = 1;
const STEP_PREVIEW = 2;
const STEP_DONE = 3;

const STEP_TITLES = ['选择数据源', '自动分析', '预览确认', '导入完成'];

export default function OntologyDiscoveryPage() {
  const [currentStep, setCurrentStep] = useState(STEP_SELECT);
  const [sources, setSources] = useState<DataSourceListItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [concepts, setConcepts] = useState<CandidateConcept[]>([]);
  const [relations, setRelations] = useState<CandidateRelation[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedConceptKeys, setSelectedConceptKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    setLoadingSources(true);
    listDiscoveryDataSources()
      .then((res) => {
        setSources(res.items);
      })
      .catch(() => {
        setError('加载数据源列表失败');
      })
      .finally(() => {
        setLoadingSources(false);
      });
  }, []);

  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  const handleAnalyze = async () => {
    if (!selectedSourceId) {
      message.warning('请先选择数据源');
      return;
    }
    setError(null);
    setCurrentStep(STEP_ANALYZE);
    setAnalyzing(true);
    try {
      const result = await analyzeDataSource(selectedSourceId);
      applyDiscoveryResult(result);
      setCurrentStep(STEP_PREVIEW);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      setCurrentStep(STEP_SELECT);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSuggest = async () => {
    if (!selectedSourceId) return;
    setSuggesting(true);
    try {
      const result = await suggestCandidates(selectedSourceId, concepts, relations);
      applyDiscoveryResult(result);
      message.success('AI 建议已应用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'AI 建议失败');
    } finally {
      setSuggesting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedSourceId) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importCandidates(selectedSourceId, concepts, relations);
      setImportResult(result);
      setCurrentStep(STEP_DONE);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const applyDiscoveryResult = (result: DiscoveryResult) => {
    setConcepts(result.concepts);
    setRelations(result.relations);
  };

  const updateConcept = (tempId: string, patch: Partial<CandidateConcept>) => {
    setConcepts((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)),
    );
  };

  const updateRelation = (tempId: string, patch: Partial<CandidateRelation>) => {
    setRelations((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)),
    );
  };

  const toggleConceptSelected = (tempId: string, checked: boolean) => {
    updateConcept(tempId, { selected: checked });
  };

  const toggleRelationSelected = (tempId: string, checked: boolean) => {
    updateRelation(tempId, { selected: checked });
  };

  const handleMergeConcepts = () => {
    if (selectedConceptKeys.length < 2) return;
    const selected = concepts.filter((c) => selectedConceptKeys.includes(c.tempId));
    const [base, ...rest] = selected;
    if (!base || rest.length === 0) return;

    const existingColumns = new Set(base.attributes.map((a) => a.sourceColumn));
    const mergedAttributes: CandidateAttribute[] = [...base.attributes];
    rest.forEach((c) => {
      c.attributes.forEach((attr) => {
        if (!existingColumns.has(attr.sourceColumn)) {
          mergedAttributes.push({ ...attr, tempId: `${attr.tempId}-merged` });
          existingColumns.add(attr.sourceColumn);
        }
      });
    });

    const merged: CandidateConcept = {
      ...base,
      tempId: `merged-${base.tempId}`,
      name: `${base.name}（合并 ${rest.map((r) => r.name).join('、')}）`,
      description: `合并自表: ${selected.map((s) => s.sourceTable).join(', ')}`,
      attributes: mergedAttributes,
    };

    setConcepts((prev) =>
      prev
        .map((c) =>
          selectedConceptKeys.includes(c.tempId) ? { ...c, selected: false } : c,
        )
        .concat(merged),
    );
    setSelectedConceptKeys([]);
    message.success('已合并选中概念');
  };

  const selectedCount = concepts.filter((c) => c.selected).length;
  const selectedRelationCount = relations.filter((r) => r.selected).length;

  const conceptColumns: ColumnsType<CandidateConcept> = [
    {
      title: '导入',
      dataIndex: 'selected',
      width: 60,
      render: (_value, record) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => toggleConceptSelected(record.tempId, e.target.checked)}
        />
      ),
    },
    {
      title: '源表',
      dataIndex: 'sourceTable',
    },
    {
      title: '编码',
      dataIndex: 'code',
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: '显示名',
      dataIndex: 'name',
      render: (_value, record) => (
        <Input
          value={record.name}
          onChange={(e) => updateConcept(record.tempId, { name: e.target.value })}
        />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (_value, record) => (
        <Input
          value={record.description || ''}
          onChange={(e) =>
            updateConcept(record.tempId, { description: e.target.value })
          }
        />
      ),
    },
    {
      title: '属性数',
      dataIndex: 'attributes',
      width: 80,
      render: (value: CandidateAttribute[]) => value.length,
    },
  ];

  const relationColumns: ColumnsType<CandidateRelation> = [
    {
      title: '导入',
      dataIndex: 'selected',
      width: 60,
      render: (_value, record) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => toggleRelationSelected(record.tempId, e.target.checked)}
        />
      ),
    },
    {
      title: '源 → 目标',
      render: (_, record) => (
        <Text>
          {record.sourceTable}.{record.sourceColumn} → {record.targetTable}.
          {record.targetColumn}
        </Text>
      ),
    },
    {
      title: '编码',
      dataIndex: 'code',
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: '显示名',
      dataIndex: 'name',
      render: (_value, record) => (
        <Input
          value={record.name}
          onChange={(e) => updateRelation(record.tempId, { name: e.target.value })}
        />
      ),
    },
    {
      title: '基数',
      dataIndex: 'cardinality',
      width: 100,
      render: (_value, record) => (
        <Select
          value={record.cardinality}
          onChange={(value) => updateRelation(record.tempId, { cardinality: value })}
          options={[
            { label: '1-1', value: '1-1' },
            { label: '1-N', value: '1-N' },
            { label: 'N-1', value: 'N-1' },
            { label: 'N-N', value: 'N-N' },
          ]}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (_value, record) => (
        <Input
          value={record.description || ''}
          onChange={(e) =>
            updateRelation(record.tempId, { description: e.target.value })
          }
        />
      ),
    },
  ];

  const renderSelectStep = () => (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>选择已连接的数据源，系统将自动分析其表结构并发现候选本体。</Text>
        <Select
          placeholder="选择数据源"
          loading={loadingSources}
          style={{ width: 320 }}
          value={selectedSourceId}
          onChange={setSelectedSourceId}
          options={sources.map((s) => ({
            label: `${s.name}（${s.type} · ${s.tableCount} 张表）`,
            value: s.id,
          }))}
        />
        <Button type="primary" disabled={!selectedSourceId} onClick={handleAnalyze}>
          开始分析
        </Button>
      </Space>
    </Card>
  );

  const renderAnalyzeStep = () => (
    <Card>
      <Space direction="vertical" align="center" style={{ width: '100%', padding: 32 }}>
        <Spin size="large" />
        <Text>正在分析 {selectedSource?.name} 的元数据...</Text>
      </Space>
    </Card>
  );

  const renderPreviewStep = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={`发现 ${concepts.length} 个候选概念，${relations.length} 条候选关系`}
        description={`已选择导入：${selectedCount} 个概念，${selectedRelationCount} 条关系。可在下方表格中修改显示名、描述、基数，或取消勾选。`}
      />
      <Space>
        <Button onClick={handleSuggest} loading={suggesting}>
          AI 优化命名
        </Button>
        <Button onClick={handleMergeConcepts} disabled={selectedConceptKeys.length < 2}>
          合并选中概念
        </Button>
        <Button type="primary" loading={importing} onClick={handleImport}>
          一键导入本体
        </Button>
      </Space>
      <Card title="候选概念" size="small">
        <Table
          rowKey="tempId"
          size="small"
          dataSource={concepts}
          columns={conceptColumns}
          rowSelection={{
            selectedRowKeys: selectedConceptKeys,
            onChange: setSelectedConceptKeys,
          }}
          pagination={false} scroll={{ x: 'max-content' }} />
      </Card>
      <Card title="候选关系" size="small">
        <Table
          rowKey="tempId"
          size="small"
          dataSource={relations}
          columns={relationColumns}
          pagination={false} scroll={{ x: 'max-content' }} />
      </Card>
    </Space>
  );

  const renderDoneStep = () =>
    importResult ? (
      <Alert
        type={importResult.failed.length > 0 ? 'warning' : 'success'}
        showIcon
        message="导入完成"
        description={
          <Space direction="vertical">
            <Text>
              概念：{importResult.createdConcepts} 个，属性：{importResult.createdAttributes} 个，关系：{importResult.createdRelations} 条
            </Text>
            {importResult.failed.length > 0 && (
              <Text type="warning">失败：{importResult.failed.length} 项</Text>
            )}
            <Button type="primary" onClick={() => window.location.reload()}>
              再导一次
            </Button>
          </Space>
        }
      />
    ) : null;

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        本体自动发现
      </Title>
      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        items={STEP_TITLES.map((title) => ({ key: title, title }))}
      />
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error}
          closable
          onClose={() => setError(null)}
        />
      )}
      {currentStep === STEP_SELECT && renderSelectStep()}
      {currentStep === STEP_ANALYZE && renderAnalyzeStep()}
      {currentStep === STEP_PREVIEW && renderPreviewStep()}
      {currentStep === STEP_DONE && renderDoneStep()}
    </div>
  );
}
