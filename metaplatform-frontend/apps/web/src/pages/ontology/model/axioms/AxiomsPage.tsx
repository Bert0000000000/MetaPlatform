import { Tag } from '@douyinfe/semi-ui';
import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import { listAxioms, type KernelAxiom } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import '../../ontology.css';

/** 公理类型中文标签（内核 AxiomKind；未收录的原样显示）。IA2-2 随 ModelingPage 迁入。 */
const AXIOM_KIND_LABEL: Record<string, string> = {
  subclass: '子类',
  transitivity: '传递性',
  property: '属性约束',
  same_as: '同一性',
  disjoint: '不相交',
  has_key: '唯一键',
  equivalent_class: '等价类',
  property_domain: '定义域',
  property_range: '值域',
  functional: '函数性',
  inverse_functional: '逆函数性',
  transitive_property: '传递属性',
  symmetric_property: '对称属性',
  property_chain: '属性链',
};

/**
 * 公理（IA2-2 从 ModelingPage 抽出）：正式路由 /ontology/model/axioms。
 * 公理计数正则断言（ui-p1a）随本页保留——它是「公理计数曾被写死为 0」回归的锁。
 */
export default function AxiomsPage() {
  return (
    <KernelPrimitiveListPage<KernelAxiom>
      title="公理"
      load={listAxioms}
      rowKey={(row) => row.rid}
      searchText={(a) => `${a.kind} ${a.rid} ${a.rule_ref} ${a.operands.join(' ')}`}
      searchPlaceholder="搜索公理"
      columns={[
        {
          title: '公理',
          dataIndex: 'rid',
          width: 300,
          ellipsis: true,
          render: (_: unknown, row: KernelAxiom) => (
            <span className="mp-onto-strong">{ridTail(row.rid)}</span>
          ),
        },
        {
          title: '类型',
          dataIndex: 'kind',
          width: 130,
          render: (v: string) => (
            <Tag size="small" type="light">
              {AXIOM_KIND_LABEL[v] ?? v}
            </Tag>
          ),
        },
        { title: '规则', dataIndex: 'rule_ref', width: 170, ellipsis: true },
        {
          title: '操作数',
          dataIndex: 'operands',
          ellipsis: true,
          render: (v: string[]) =>
            v.length ? v.map(ridTail).join(' → ') : <span className="mp-onto-muted">—</span>,
        },
        {
          title: '元数据',
          dataIndex: 'metadata',
          width: 200,
          ellipsis: true,
          render: (v: string[][]) =>
            v.length ? (
              v.map(([k, val]) => `${k}=${val}`).join('; ')
            ) : (
              <span className="mp-onto-muted">—</span>
            ),
        },
      ]}
    />
  );
}
