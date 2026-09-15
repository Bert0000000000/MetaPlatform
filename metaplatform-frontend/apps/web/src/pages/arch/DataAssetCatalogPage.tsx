import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Form, Popconfirm, Select, Space, Tag, Toast, Tree } from '@douyinfe/semi-ui';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import {
  createAsset,
  deleteAsset,
  getAssetCatalog,
  listAssets,
  listEntities,
  updateAsset,
} from '@/api/arch/dataArchitecture';
import type { DataAsset, DataAssetCatalog, DataEntity } from '@/api/arch/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  SplitPane,
} from '@/components/skeleton';

const GROUP_OPTIONS = [
  { label: '按系统类型', value: 'type' },
  { label: '按主题域', value: 'classification' },
  { label: '按标签', value: 'tag' },
];

interface AssetDraft {
  id?: string;
  name: string;
  code: string;
  assetType: string;
  classification?: string;
  entityId?: string;
  tags?: string;
  description?: string;
}

interface AssetTreeNode extends TreeNodeData {
  asset?: DataAsset;
}

/**
 * 数据资产目录（DESIGN-SPEC §5 版式 B：左树右表 + 抽屉详情）。
 * 数据面沿用 src/api/arch/dataArchitecture 的 catalog / assets。
 */
export default function DataAssetCatalogPage() {
  const [catalog, setCatalog] = useState<DataAssetCatalog | null>(null);
  const [assets, setAssets] = useState<DataAsset[]>([]);
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState('type');
  const [keyword, setKeyword] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<DataAsset | null>(null);
  const [draft, setDraft] = useState<AssetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<AssetDraft>();

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await getAssetCatalog(groupBy));
    } catch (e) {
      setCatalog(null);
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [groupBy]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAssets(await listAssets({ keyword: keyword || undefined }));
    } catch (e) {
      setAssets([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void listEntities()
      .then((data) => setEntities(Array.isArray(data) ? data : []))
      .catch(() => setEntities([]));
  }, []);

  const entityName = useCallback(
    (id: string | undefined) => (id ? entities.find((e) => e.id === id)?.name ?? id : '—'),
    [entities],
  );

  const openCreate = () => {
    setDraft({ name: '', code: '', assetType: '' });
    form.reset();
  };

  const openEdit = (asset: DataAsset) => {
    setDraft({
      id: asset.id,
      name: asset.name,
      code: asset.code,
      assetType: asset.assetType,
      classification: asset.classification,
      entityId: asset.entityId,
      tags: (asset.tags ?? []).join(','),
      description: asset.description,
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: AssetDraft;
    try {
      values = (await form.validate()) as AssetDraft;
    } catch {
      return;
    }
    const { tags, ...rest } = values;
    const payload = {
      ...rest,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    setSaving(true);
    try {
      if (draft.id) {
        await updateAsset(draft.id, payload);
        Toast.success('资产已更新');
      } else {
        await createAsset(payload);
        Toast.success('资产已登记');
      }
      setDraft(null);
      await Promise.all([loadCatalog(), loadAssets()]);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (asset: DataAsset) => {
    try {
      await deleteAsset(asset.id);
      Toast.success('资产已删除');
      if (selectedAsset?.id === asset.id) setSelectedAsset(null);
      await Promise.all([loadCatalog(), loadAssets()]);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const treeData = useMemo<AssetTreeNode[]>(
    () =>
      (catalog?.groups ?? []).map((g) => ({
        key: g.key,
        label: `${g.label}（${g.assets.length}）`,
        children: g.assets.map((a) => ({ key: a.id, label: a.name, isLeaf: true, asset: a })),
      })),
    [catalog],
  );

  const columns = useMemo(
    () => [
      { title: '资产名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
      { title: '编码', dataIndex: 'code', key: 'code', width: 160, ellipsis: true },
      {
        title: '系统类型',
        dataIndex: 'assetType',
        key: 'assetType',
        width: 130,
        render: (v: string | undefined) => (v ? <Tag type="light">{v}</Tag> : '—'),
      },
      {
        title: '主题域',
        dataIndex: 'classification',
        key: 'classification',
        width: 140,
        ellipsis: true,
        render: (v: string | undefined) => v || '—',
      },
      {
        title: '关联实体',
        dataIndex: '__entity__',
        key: 'entity',
        width: 180,
        ellipsis: true,
        render: (_: unknown, row: DataAsset) => entityName(row.entityId),
      },
      {
        title: '标签',
        dataIndex: '__tags__',
        key: 'tags',
        render: (_: unknown, row: DataAsset) => (
          <Space>
            {(row.tags ?? []).map((t) => (
              <Tag key={t} type="light">
                {t}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 140,
        render: (_: unknown, row: DataAsset) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该资产？" onConfirm={() => void remove(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityName],
  );

  return (
    <>
      <PageHeader
        title="资产目录"
        desc={`${assets.length} 项资产 · 按分组浏览与检索已登记的数据资产`}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => {
                void loadCatalog();
                void loadAssets();
              }}
            >
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              登记资产
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索资产名称、编码…' }}
        filters={
          <Select value={groupBy} onChange={(v) => setGroupBy(String(v))} optionList={GROUP_OPTIONS} />
        }
      />

      <SplitPane
        ariaLabel="资产分组"
        pane={
          <>
            <div className="mp-pane-title">资产分组</div>
            <div className="mp-pane-scroll">
              {treeData.length > 0 ? (
                <Tree
                  treeData={treeData}
                  defaultExpandAll
                  onSelect={(_key, selected, node) => {
                    const asset = (node as AssetTreeNode | undefined)?.asset;
                    if (selected && asset) setSelectedAsset(asset);
                  }}
                />
              ) : (
                <EmptyState illustration="no-content" title="暂无分组" desc="登记资产后，分组树会自动生成。" />
              )}
            </div>
          </>
        }
      >
        <DataTablePro<DataAsset>
          columns={columns}
          dataSource={assets}
          rowKey="id"
          loading={loading}
          onRow={(record) => ({ onDoubleClick: () => setSelectedAsset(record as DataAsset) })}
          empty={
            error ? (
              <EmptyState illustration="failure" title="资产加载失败" desc={error} />
            ) : (
              <EmptyState
                illustration="no-result"
                title="没有匹配的资产"
                desc="调整关键词，或登记第一项资产。"
              />
            )
          }
        />
      </SplitPane>

      <SheetDetail
        title={selectedAsset ? `资产详情 · ${selectedAsset.name}` : '资产详情'}
        open={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        footer={
          <>
            {selectedAsset ? (
              <Button
                icon={<Pencil size={15} strokeWidth={1.5} />}
                onClick={() => {
                  openEdit(selectedAsset);
                  setSelectedAsset(null);
                }}
              >
                编辑
              </Button>
            ) : null}
            <Button onClick={() => setSelectedAsset(null)}>关闭</Button>
          </>
        }
      >
        {selectedAsset ? (
          <Descriptions
            row
            data={[
              { key: '编码', value: selectedAsset.code },
              { key: '系统类型', value: selectedAsset.assetType },
              { key: '主题域', value: selectedAsset.classification ?? '—' },
              { key: '关联实体', value: entityName(selectedAsset.entityId) },
              { key: '描述', value: selectedAsset.description ?? '—' },
            ]}
          />
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={draft?.id ? `编辑资产 · ${draft.name}` : '登记资产'}
        open={draft !== null}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        {draft ? (
          <Form form={form} key={draft.id ?? 'new'} initValues={draft} labelPosition="top">
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} />
            <Form.Input
              field="assetType"
              label="系统类型"
              rules={[{ required: true, message: '请输入系统类型' }]}
              placeholder="如 TABLE / API / TOPIC"
            />
            <Form.Input field="classification" label="主题域" placeholder="如 L1 / 客户域" />
            <Form.Select
              field="entityId"
              label="关联实体"
              showClear
              optionList={entities.map((e) => ({ label: e.name, value: e.id }))}
            />
            <Form.Input field="tags" label="标签" placeholder="逗号分隔" />
            <Form.TextArea field="description" label="描述" rows={2} />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
