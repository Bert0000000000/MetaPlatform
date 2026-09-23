import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  listBigDataSources,
  SOURCE_TYPE_META,
  type BigDataSource,
  type BigDataSourceStatus,
} from '@/api/ontology-bigdata';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import '../data-sections.css';
import '../../ontology.css';

const STATUS_COLOR: Record<BigDataSourceStatus, 'green' | 'red' | 'amber' | 'grey' | 'blue'> = {
  ACTIVE: 'green',
  ERROR: 'red',
  DRAFT: 'amber',
  INACTIVE: 'grey',
  DELETED: 'grey',
};

/**
 * 全局数据资产清单（IA2-3 自 DatacenterPage 的 assets 视图拆出保留）。
 *
 * <p>**不挂本体路由**：这是数据平台控制面的全局资产门户，不是本体映射直接
 * 相关的数据面（ADR-0069 §7.3：全局 BigDataSource 资产清单移出本体导航）。
 * 归宿是「数据与治理」域——Gov 侧迁移单独跟踪（见 IA2-3 验收边界登记），
 * 迁移前本文件保留可用组件，不删除。
 */
export default function AssetsInventoryPage() {
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSources(await listBigDataSources({}));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(
    () => [
      {
        title: '数据资产',
        dataIndex: 'name',
        width: 240,
        ellipsis: true,
        render: (_: unknown, row: BigDataSource) => (
          <span>
            <span className="mp-onto-strong">{row.name}</span>
            {row.description ? (
              <span className="mp-onto-canvas-card-sub"> · {row.description}</span>
            ) : null}
          </span>
        ),
      },
      {
        title: '类型',
        dataIndex: 'sourceType',
        width: 120,
        render: (v: BigDataSource['sourceType']) => (
          <Tag size="small" type="light">{SOURCE_TYPE_META[v]?.label ?? v}</Tag>
        ),
      },
      {
        title: '地址',
        dataIndex: 'host',
        width: 220,
        ellipsis: true,
        render: (_: unknown, row: BigDataSource) => `${row.host}:${row.port}`,
      },
      {
        title: '库 / Schema',
        dataIndex: 'database',
        width: 180,
        ellipsis: true,
        render: (_: unknown, row: BigDataSource) => row.database ?? row.schema ?? '—',
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: BigDataSourceStatus) => (
          <Tag size="small" color={STATUS_COLOR[v] ?? 'grey'} type="light">
            {v}
          </Tag>
        ),
      },
      { title: '负责人', dataIndex: 'ownerUserId', width: 160, ellipsis: true },
      { title: '创建时间', dataIndex: 'createdAt', width: 180, ellipsis: true },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="数据资产清单"
        desc={`${sources.length} 个数据源 · 数据平台控制面登记（归宿：数据与治理域）`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />
      <DataTablePro<BigDataSource>
        columns={columns}
        dataSource={sources}
        rowKey="sourceId"
        loading={loading}
        empty={
          error ? (
            <EmptyState illustration="failure" title="数据源加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="还没有登记数据源"
              desc="在数据平台接入第一份数据源后，这里会出现资产清单。"
            />
          )
        }
      />
    </>
  );
}
