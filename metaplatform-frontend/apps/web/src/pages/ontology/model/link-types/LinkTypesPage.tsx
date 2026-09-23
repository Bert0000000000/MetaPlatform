import { useCallback, useEffect, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import {
  listLinkInstances,
  listLinkTypes,
  type KernelLinkInstance,
  type KernelLinkType,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, SheetDetail } from '@/components/skeleton';
import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 关系类型（IA2-2 从 ModelingPage 抽出）：正式路由 /ontology/model/link-types。
 *
 * <p>2026-09-24（12 基元补全 · B）：加「实例」抽屉——LinkInstance 一等公民浏览。
 * `GET /v2/link-instances` 是既有契约（无过滤参数），按 link_type_rid 客户端过滤。
 */
export default function LinkTypesPage() {
  const [instances, setInstances] = useState<KernelLinkInstance[] | null>(null);
  const [openType, setOpenType] = useState<KernelLinkType | null>(null);

  const loadInstances = useCallback(async () => {
    try {
      setInstances(await listLinkInstances());
    } catch {
      setInstances([]);
    }
  }, []);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  const countFor = (rid: string) => (instances ?? []).filter((li) => li.link_type_rid === rid).length;

  return (
    <>
      <KernelPrimitiveListPage<KernelLinkType>
        title="关系类型"
        load={listLinkTypes}
        rowKey={(row) => row.rid}
        searchText={(l) =>
          `${l.rid} ${l.src} ${l.dst} ${l.src_display_name ?? ''} ${l.dst_display_name ?? ''}`
        }
        searchPlaceholder="搜索关系类型"
        columns={[
          {
            title: '关系',
            dataIndex: 'rid',
            width: 200,
            ellipsis: true,
            render: (_: unknown, row: KernelLinkType) => (
              <span className="mp-onto-strong">{ridTail(row.rid)}</span>
            ),
          },
          {
            title: '源 → 目标',
            dataIndex: 'src',
            width: 320,
            ellipsis: true,
            render: (_: unknown, row: KernelLinkType) =>
              `${row.src_display_name || ridTail(row.src)} → ${row.dst_display_name || ridTail(row.dst)}`,
          },
          { title: '基数', dataIndex: 'cardinality', width: 120 },
          { title: '方向性', dataIndex: 'directionality', width: 130 },
          {
            title: '链属性',
            dataIndex: 'link_properties',
            width: 100,
            render: (v: KernelLinkType['link_properties']) => v.length,
          },
          {
            title: '实例数',
            dataIndex: '__instances',
            width: 90,
            render: (_: unknown, row: KernelLinkType) =>
              instances === null ? '…' : <span className="mp-onto-num">{countFor(row.rid)}</span>,
          },
          {
            title: '操作',
            dataIndex: '__ops',
            width: 100,
            render: (_: unknown, row: KernelLinkType) => (
              <Button
                theme="light"
                type="secondary"
                className="mp-text-sm mp-onto-btn--sm"
                onClick={() => setOpenType(row)}
              >
                实例
              </Button>
            ),
          },
        ]}
      />

      <SheetDetail
        title={openType ? `关系实例 · ${ridTail(openType.rid)}` : '关系实例'}
        open={openType !== null}
        onClose={() => setOpenType(null)}
      >
        {openType ? (
          <LinkInstanceList linkType={openType} instances={instances} />
        ) : null}
      </SheetDetail>
    </>
  );
}

function LinkInstanceList({
  linkType,
  instances,
}: {
  linkType: KernelLinkType;
  instances: KernelLinkInstance[] | null;
}) {
  const filtered = (instances ?? []).filter((li) => li.link_type_rid === linkType.rid);
  return (
    <>
      <div className="mp-flex mp-gap-2 mp-mb-4 mp-wrap">
        <Tag color="blue" type="light">
          {linkType.src_display_name || ridTail(linkType.src)} →{' '}
          {linkType.dst_display_name || ridTail(linkType.dst)}
        </Tag>
        <Tag type="light">{linkType.cardinality}</Tag>
        <Tag type="light">{filtered.length} 条实例</Tag>
      </div>
      <DataTablePro<KernelLinkInstance>
        columns={[
          {
            title: '源实例',
            dataIndex: 'src',
            width: 160,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
          },
          {
            title: '目标实例',
            dataIndex: 'dst',
            width: 160,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
          },
          {
            title: '链属性',
            dataIndex: 'props',
            ellipsis: true,
            render: (v: Array<[string, unknown]>) =>
              v.length === 0
                ? '—'
                : v.map(([k, val]) => `${k.split('.').pop()}=${String(val)}`).join('; '),
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            width: 150,
            ellipsis: true,
            render: (v: string | undefined) => <span className="mp-onto-muted">{v ?? '—'}</span>,
          },
        ]}
        dataSource={filtered}
        rowKey="rid"
        loading={instances === null}
        empty={
          <EmptyState
            illustration="no-content"
            title="该关系类型还没有实例"
            desc="LinkInstance 通过 Action 落库或 API 创建后出现在这里。"
          />
        }
      />
    </>
  );
}
