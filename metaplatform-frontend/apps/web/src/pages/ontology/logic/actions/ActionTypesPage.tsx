import KernelPrimitiveListPage from '../../model/KernelPrimitiveListPage';
import { listActionTypes, type KernelActionType } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 动作类型（IA2-2 从 ModelingPage 迁出语义模型，归「动作与函数」）：
 * 正式路由 /ontology/logic/actions。详情路由（:rid）随 IA2-5 落地。
 */
export default function ActionTypesPage() {
  return (
    <KernelPrimitiveListPage<KernelActionType>
      title="动作类型"
      load={listActionTypes}
      rowKey={(row) => row.rid}
      searchText={(a) => `${a.title ?? ''} ${a.rid} ${a.function_ref}`}
      searchPlaceholder="搜索动作类型"
      columns={[
        {
          title: '动作',
          dataIndex: 'title',
          width: 220,
          ellipsis: true,
          render: (v: string | undefined, row: KernelActionType) => (
            <span className="mp-onto-strong">{v || ridTail(row.rid)}</span>
          ),
        },
        { title: 'rid', dataIndex: 'rid', width: 300, ellipsis: true },
        {
          title: '绑定类型',
          dataIndex: 'on',
          width: 110,
          render: (v: string[]) => v.length,
        },
        {
          title: '参数',
          dataIndex: 'parameters',
          width: 90,
          render: (v: KernelActionType['parameters']) => v.length,
        },
        {
          title: '提交条件',
          dataIndex: 'submission_criteria',
          width: 120,
          render: (v: string[]) => v.length,
        },
        { title: '函数引用', dataIndex: 'function_ref', ellipsis: true },
      ]}
    />
  );
}
