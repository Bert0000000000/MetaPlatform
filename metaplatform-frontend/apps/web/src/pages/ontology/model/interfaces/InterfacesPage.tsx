import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import { listInterfaces, type KernelInterface } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 接口（IA2-2 从 ModelingPage 抽出）：正式路由 /ontology/model/interfaces。
 */
export default function InterfacesPage() {
  return (
    <KernelPrimitiveListPage<KernelInterface>
      title="接口"
      load={listInterfaces}
      rowKey={(row) => row.rid}
      searchText={(i) => i.rid}
      searchPlaceholder="搜索接口"
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
          width: 120,
          render: (v: KernelInterface['properties']) => v.length,
        },
        {
          title: '必填关系',
          dataIndex: 'required_links',
          width: 120,
          render: (v: string[]) => v.length,
        },
        {
          title: '多态动作约束',
          dataIndex: 'polymorphic_action_constraints',
          width: 140,
          render: (v: string[]) => v.length,
        },
      ]}
    />
  );
}
