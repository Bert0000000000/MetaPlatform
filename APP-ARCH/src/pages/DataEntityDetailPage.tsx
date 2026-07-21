import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Table, Input, Select, Switch, InputNumber, Space, Form, message, Popconfirm } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, DeleteOutlined, DragOutlined, SaveOutlined } from '@ant-design/icons';
import { getEntity, updateEntity } from '@/api/dataArchitecture';
import type { DataEntity, DataField } from '@/types';

const FIELD_TYPES = ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON', 'TEXT'];

export default function DataEntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<DataEntity | null>(null);
  const [fields, setFields] = useState<DataField[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEntity(id)
      .then((e) => {
        setEntity(e);
        setFields(e.fields || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id || !entity) return;
    await updateEntity(id, { ...entity, fields });
    message.success('保存成功');
  };

  const addField = () => {
    setFields([...fields, { name: '', type: 'STRING', required: false, description: '' }]);
  };

  const removeField = (index: number) => {
    const next = [...fields];
    next.splice(index, 1);
    setFields(next);
  };

  const updateField = (index: number, patch: Partial<DataField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    setFields(next);
  };

  const onDragStart = (index: number) => {
    setDragIndex(index);
  };

  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const next = [...fields];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(index);
    setFields(next);
  };

  const onDragEnd = () => {
    setDragIndex(null);
  };

  const columns = [
    { title: '', key: 'drag', width: 40, render: (_: unknown, __: DataField, index: number) => <DragOutlined draggable onDragStart={() => onDragStart(index)} style={{ cursor: 'grab' }} /> },
    { title: '字段名', dataIndex: 'name', key: 'name', render: (_: unknown, __: DataField, index: number) => <Input value={fields[index].name} onChange={(e) => updateField(index, { name: e.target.value })} placeholder="字段名" /> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 140, render: (_: unknown, __: DataField, index: number) => <Select value={fields[index].type} options={FIELD_TYPES.map((t) => ({ label: t, value: t }))} onChange={(v) => updateField(index, { type: v })} style={{ width: '100%' }} /> },
    { title: '长度', dataIndex: 'length', key: 'length', width: 100, render: (_: unknown, __: DataField, index: number) => <InputNumber value={fields[index].length} onChange={(v) => updateField(index, { length: v ?? undefined })} placeholder="长度" style={{ width: '100%' }} /> },
    { title: '必填', dataIndex: 'required', key: 'required', width: 80, render: (_: unknown, __: DataField, index: number) => <Switch checked={!!fields[index].required} onChange={(v) => updateField(index, { required: v })} /> },
    { title: '默认值', dataIndex: 'defaultValue', key: 'defaultValue', width: 140, render: (_: unknown, __: DataField, index: number) => <Input value={fields[index].defaultValue} onChange={(e) => updateField(index, { defaultValue: e.target.value })} placeholder="默认值" /> },
    { title: '注释', dataIndex: 'description', key: 'description', render: (_: unknown, __: DataField, index: number) => <Input value={fields[index].description} onChange={(e) => updateField(index, { description: e.target.value })} placeholder="注释" /> },
    { title: '操作', key: 'action', width: 80, render: (_: unknown, __: DataField, index: number) => <Popconfirm title="确认删除？" onConfirm={() => removeField(index)}><Button type="link" danger icon={<DeleteOutlined />} /></Popconfirm> },
  ];

  return (
    <Card
      loading={loading}
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/arch/data')}>返回</Button>
          <span>{entity ? `${entity.name} (${entity.code})` : '数据实体详情'}</span>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<PlusOutlined />} onClick={addField}>添加字段</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <Form layout="vertical">
        <Form.Item label="描述">
          <Input.TextArea value={entity?.description} onChange={(e) => entity && setEntity({ ...entity, description: e.target.value })} rows={2} />
        </Form.Item>
      </Form>
      <Table
        rowKey={(_, index) => `${index}`}
        columns={columns}
        dataSource={fields}
        size="small"
        pagination={false}
        onRow={(_, index) => ({
          draggable: true,
          onDragStart: () => onDragStart(index || 0),
          onDragOver: (e) => onDragOver(e, index || 0),
          onDragEnd,
          style: { cursor: 'grab' },
        })}
       scroll={{ x: 'max-content' }}/>
    </Card>
  );
}
