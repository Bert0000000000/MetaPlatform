import KernelPrimitiveListPage from '../../model/KernelPrimitiveListPage';
import { listFunctions, type KernelFunction } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * 函数（IA2-2 从 ModelingPage 迁出语义模型，归「动作与函数」）：
 * 正式路由 /ontology/logic/functions。详情路由（:rid）随 IA2-5 落地。
 */
export default function FunctionsPage() {
  return (
    <KernelPrimitiveListPage<KernelFunction>
      title="函数"
      load={listFunctions}
      rowKey={(row) => row.rid}
      searchText={(f) => `${f.rid} ${f.source_ref} ${f.language}`}
      searchPlaceholder="搜索函数"
      columns={[
        {
          title: '函数',
          dataIndex: 'rid',
          width: 240,
          ellipsis: true,
          render: (_: unknown, row: KernelFunction) => (
            <span className="mp-onto-strong">{ridTail(row.rid)}</span>
          ),
        },
        { title: 'rid', dataIndex: 'rid', width: 300, ellipsis: true },
        { title: '语言', dataIndex: 'language', width: 120 },
        { title: '版本', dataIndex: 'version', width: 90 },
        {
          title: '签名',
          dataIndex: 'signatures',
          width: 90,
          render: (v: KernelFunction['signatures']) => v.length,
        },
        { title: '来源', dataIndex: 'source_ref', ellipsis: true },
      ]}
    />
  );
}
