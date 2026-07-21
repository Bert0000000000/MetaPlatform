import { useEffect, useState } from 'react';
import { Card, Tree, Input, Select, Button, Space, Drawer, Tag, Form, Modal, message, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAssetCatalog, listAssets, createAsset, updateAsset, deleteAsset, listEntities } from '@/api/dataArchitecture';
import type { DataAsset, DataAssetCatalog, DataEntity } from '@/types';

const GROUP_OPTIONS = [
  { label: '按系统类型', value: 'type' },
  { label: '按主题域', value: 'classification' },
  { label: '按标签', value: 'tag' },
];

export default function DataAssetCatalogPage() {
  const [catalog, setCatalog] = useState<DataAssetCatalog | null>(null);
  const [assets, setAssets] = useState<DataAsset[]>([]);
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [groupBy, setGroupBy] = useState('type');
  const [keyword, setKeyword] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<DataAsset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DataAsset | null>(null);
  const [form] = Form.useForm<Partial<DataAsset>>();

  const loadCatalog = async () => {
    const data = await getAssetCatalog(groupBy);
    setCatalog(data);
  };

  const loadAssets = async () => {
    const data = await listAssets({ keyword: keyword || undefined });
    setAssets(data);
  };

  const loadEntities = async () => {
    const data = await listEntities();
    setEntities(data);
  };

  useEffect(() => { loadCatalog(); }, [groupBy]);
  useEffect(() => { loadAssets(); loadEntities(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (asset: DataAsset) => {
    setEditing(asset);
    form.setFieldsValue({ ...asset, tags: asset.tags?.join(',') });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = { ...values, tags: values.tags ? String(values.tags).split(',').map((t) => t.trim()).filter(Boolean) : [] };
    if (editing) {
      await updateAsset(editing.id, payload);
      message.success('更新成功');
    } else {
      await createAsset(payload);
      message.success('创建成功');
    }
    setModalOpen(false);
    form.resetFields();
    loadCatalog();
    loadAssets();
  };

  const handleDelete = async (id: string) => {
    await deleteAsset(id);
    message.success('已删除');
    loadCatalog();
    loadAssets();
  };

  const treeData = catalog?.groups.map((g) => ({
    title: `${g.label} (${g.assets.length})`,
    key: g.key,
    children: g.assets.map((a) => ({
      title: a.name,
      key: a.id,
      isLeaf: true,
      asset: a,
    })),
  })) || [];

  const filteredAssets = keyword
    ? assets.filter((a) => a.name.toLowerCase().includes(keyword.toLowerCase()) || a.code.toLowerCase().includes(keyword.toLowerCase()))
    : assets;

  return (
    <Card
      title="数据资产目录"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>登记资产</Button>}
    >
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索资产"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={loadAssets}
          style={{ width: 240 }}
        />
        <Select value={groupBy} options={GROUP_OPTIONS} onChange={setGroupBy} style={{ width: 160 }} />
        <Button onClick={() => { loadAssets(); loadCatalog(); }}>刷新</Button>
      </Space>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 320 }}>
          <Tree
            treeData={treeData}
            onSelect={(_, info) => {
              const asset = (info.selectedNodes[0] as unknown as { asset?: DataAsset })?.asset;
              if (asset) {
                setSelectedAsset(asset);
                setDrawerOpen(true);
              }
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          {filteredAssets.map((asset) => (
            <Card key={asset.id} size="small" style={{ marginBottom: 12 }} hoverable onClick={() => { setSelectedAsset(asset); setDrawerOpen(true); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{asset.name}</strong> <Tag>{asset.assetType}</Tag>
                  <div style={{ color: '#888', fontSize: 12 }}>{asset.code} {asset.classification ? `· ${asset.classification}` : ''}</div>
                </div>
                <Space>
                  <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); openEdit(asset); }}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(asset.id); }}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
              <div style={{ marginTop: 8 }}>
                {asset.tags?.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Drawer title={selectedAsset ? selectedAsset.name : '资产详情'} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={480}>
        {selectedAsset && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div><strong>编码：</strong>{selectedAsset.code}</div>
            <div><strong>类型：</strong><Tag>{selectedAsset.assetType}</Tag></div>
            <div><strong>主题域：</strong>{selectedAsset.classification || '-'}</div>
            <div><strong>描述：</strong>{selectedAsset.description || '-'}</div>
            <div><strong>关联实体：</strong>{entities.find((e) => e.id === selectedAsset.entityId)?.name || '-'}</div>
            <div><strong>标签：</strong>{selectedAsset.tags?.map((t) => <Tag key={t}>{t}</Tag>) || '-'}</div>
          </Space>
        )}
      </Drawer>

      <Modal title={editing ? '编辑资产' : '登记资产'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="assetType" label="系统类型" rules={[{ required: true }]}><Input placeholder="如 TABLE / API / TOPIC" /></Form.Item>
          <Form.Item name="classification" label="主题域"><Input placeholder="如 L1 / 客户域" /></Form.Item>
          <Form.Item name="entityId" label="关联实体">
            <Select allowClear options={entities.map((e) => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="tags" label="标签"><Input placeholder="逗号分隔" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
