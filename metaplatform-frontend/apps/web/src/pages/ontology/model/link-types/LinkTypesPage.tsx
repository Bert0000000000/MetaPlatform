import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import { listLinkTypes, type KernelLinkType } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 关系类型（IA2-2 从 ModelingPage 抽出）：正式路由 /ontology/model/link-types。
 * 列与搜索匹配串与原容器一致——只移动，不复制业务逻辑。
 */
export default function LinkTypesPage() {
  return (
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
        { title: 'rid', dataIndex: 'rid', ellipsis: true },
      ]}
    />
  );
}
