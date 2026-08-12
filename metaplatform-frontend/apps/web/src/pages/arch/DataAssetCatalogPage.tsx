import { useEffect, useState } from 'react';
import { Card, Tree, Input, Select, Button, Space, SideSheet, Tag, Form, Modal, Toast, Popconfirm } from '@douyinfe/semi-ui';
import { SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAssetCatalog, listAssets, createAsset, updateAsset, deleteAsset, listEntities } from '@/api/arch/dataArchitecture';
import type { DataAsset, DataAssetCatalog, DataEntity } from '@/api/arch/types';

interface DataAssetFormValues {
  name: string;
  code: string;
  assetType: string;
  classification?: string;
  entityId?: string;
  tags?: string;
  description?: string;
}

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
  const [form] = Form.useForm<DataAssetFormValues>();

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
    form.reset();
    setModalOpen(true);
  };

  const openEdit = (asset: DataAsset) => {
    setEditing(asset);
    form.setValues({ ...asset, tags: asset.tags?.join(',') });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    const { tags, ...rest } = values;
    const payload = {
      ...rest,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    if (editing) {
      await updateAsset(editing.id, payload);
      Toast.success('更新成功');
    } else {
      await createAsset(payload);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    form.reset();
    loadCatalog();
    loadAssets();
  };

  const handleDelete = async (id: string) => {
    await deleteAsset(id);
    Toast.success('已删除');
    loadCatalog();
    loadAssets();
  };

  const treeData = catalog?.groups.map((g) => ({
    label: `${g.label} (${g.assets.length})`,
    key: g.key,
    children: g.assets.map((a) => ({
      label: a.name,
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
      headerExtraContent={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>登记资产</Button>}
    >
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索资产"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(value) => setKeyword(value)}
          onEnterPress={loadAssets}
          style={{ width: 240 }}
        />
        <Select value={groupBy} optionList={GROUP_OPTIONS} onChange={(v) => setGroupBy(v as string)} style={{ width: 160 }} />
        <Button onClick={() => { loadAssets(); loadCatalog(); }}>刷新</Button>
      </Space>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 320 }}>
          <Tree
            treeData={treeData}
            onSelect={(key, selected, node) => {
              const asset = (node as unknown as { asset?: DataAsset })?.asset;
              if (selected && asset) {
                setSelectedAsset(asset);
                setDrawerOpen(true);
              }
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          {filteredAssets.map((asset) => (
            <Card key={asset.id} bodyStyle={{ padding: 12 }} style={{ marginBottom: 12 }} shadows="hover">
              <div onClick={() => { setSelectedAsset(asset); setDrawerOpen(true); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{asset.name}</strong> <Tag>{asset.assetType}</Tag>
                    <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>{asset.code} {asset.classification ? `· ${asset.classification}` : ''}</div>
                  </div>
                  <Space>
                    <Button theme="borderless" type="primary" size="small" onClick={(e) => { e.stopPropagation(); openEdit(asset); }}>编辑</Button>
                    <Popconfirm title="确认删除？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(asset.id); }}>
                      <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
                    </Popconfirm>
                  </Space>
                </div>
                <div style={{ marginTop: 8 }}>
                  {asset.tags?.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <SideSheet title={selectedAsset ? selectedAsset.name : '资产详情'} visible={drawerOpen} onCancel={() => setDrawerOpen(false)}>
        {selectedAsset && (
          <Space vertical style={{ width: '100%' }}>
            <div><strong>编码：</strong>{selectedAsset.code}</div>
            <div><strong>类型：</strong><Tag>{selectedAsset.assetType}</Tag></div>
            <div><strong>主题域：</strong>{selectedAsset.classification || '-'}</div>
            <div><strong>描述：</strong>{selectedAsset.description || '-'}</div>
            <div><strong>关联实体：</strong>{entities.find((e) => e.id === selectedAsset.entityId)?.name || '-'}</div>
            <div><strong>标签：</strong>{selectedAsset.tags?.map((t) => <Tag key={t}>{t}</Tag>) || '-'}</div>
          </Space>
        )}
      </SideSheet>

      <Modal title={editing ? '编辑资产' : '登记资产'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.Input field="assetType" label="系统类型" rules={[{ required: true }]} placeholder="如 TABLE / API / TOPIC" />
          <Form.Input field="classification" label="主题域" placeholder="如 L1 / 客户域" />
          <Form.Select field="entityId" label="关联实体" showClear optionList={entities.map((e) => ({ label: e.name, value: e.id }))} />
          <Form.Input field="tags" label="标签" placeholder="逗号分隔" />
          <Form.TextArea field="description" label="描述" rows={2} />
        </Form>
      </Modal>
    </Card>
  );
}
