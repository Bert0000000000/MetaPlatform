import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from '@douyinfe/semi-ui';
import {
  listInterfaces,
  listInterfaceImplementations,
  type KernelInterface,
} from '@/api/ont/kernel';
import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 接口（IA2-2 从 ModelingPage 抽出）：正式路由 /ontology/model/interfaces。
 *
 * <p>2026-09-24（概念完整性批次 · E）：补「实现方」列——`listInterfaceImplementations`
 * 是既有契约端点但此前未使用（接口不可查询的真差距）。实现方渲染为可点击 Tag
 * 直达对象类型详情，让 Interface 从纯声明列表变成可导航的多态视图。
 */
export default function InterfacesPage() {
  // rid → 实现方 ObjectType rid 列表（接口数量少，一次并发拉齐）
  const [implementations, setImplementations] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const ifcs = await listInterfaces().catch(() => [] as KernelInterface[]);
      if (!active) return;
      const entries = await Promise.all(
        ifcs.map(async (i) => {
          const impl = await listInterfaceImplementations(i.rid).catch(() => [] as string[]);
          return [i.rid, impl] as const;
        }),
      );
      if (active) setImplementations(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <KernelPrimitiveListPage<KernelInterface>
      title="接口"
      load={listInterfaces}
      rowKey={(row) => row.rid}
      searchText={(i) => `${i.rid} ${(implementations[i.rid] ?? []).join(' ')}`}
      searchPlaceholder="搜索接口或实现方"
      columns={[
        {
          title: '接口',
          dataIndex: 'rid',
          width: 260,
          ellipsis: true,
          render: (_: unknown, row: KernelInterface) => (
            <span className="mp-onto-strong">{ridTail(row.rid)}</span>
          ),
        },
        { title: 'rid', dataIndex: 'rid', ellipsis: true },
        {
          title: '属性签名',
          dataIndex: 'properties',
          width: 110,
          render: (v: KernelInterface['properties']) => v.length,
        },
        {
          title: '必填关系',
          dataIndex: 'required_links',
          width: 110,
          render: (v: string[]) => v.length,
        },
        {
          title: '多态动作约束',
          dataIndex: 'polymorphic_action_constraints',
          width: 130,
          render: (v: string[]) => v.length,
        },
        {
          title: '实现方',
          dataIndex: '__impl',
          width: 240,
          render: (_: unknown, row: KernelInterface) => {
            const impl = implementations[row.rid];
            if (!impl) return <span className="mp-onto-muted">…</span>;
            if (impl.length === 0) return <span className="mp-onto-muted">—</span>;
            return (
              <span className="mp-flex mp-wrap mp-gap-1">
                {impl.slice(0, 3).map((rid) => (
                  <Link
                    key={rid}
                    to={`/ontology/model/object-types/${encodeURIComponent(rid)}`}
                    title={rid}
                  >
                    <Tag size="small" type="light">{ridTail(rid)}</Tag>
                  </Link>
                ))}
                {impl.length > 3 ? <Tag size="small" type="light">+{impl.length - 3}</Tag> : null}
              </span>
            );
          },
        },
      ]}
    />
  );
}
