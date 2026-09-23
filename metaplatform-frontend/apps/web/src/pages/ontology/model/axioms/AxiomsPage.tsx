import { useCallback, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { ShieldCheck } from 'lucide-react';
import KernelPrimitiveListPage from '../KernelPrimitiveListPage';
import {
  listAxioms,
  validateAxioms,
  type AxiomValidationReport,
  type KernelAxiom,
} from '@/api/ont/kernel';
import { EmptyState, SheetDetail } from '@/components/skeleton';
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
 *
 * <p>2026-09-24（ADR-0070）：新增「运行时违规检查」——`POST /v2/axioms/validate`
 * 检查**当前数据实例**是否违反已声明的公理（Core 三条：disjoint / has_key /
 * subclass）。与「模型校验」页的 SHACL 校验并列但独立：SHACL 消费 ObjectType
 * 合成 shapes，本检查消费 Axiom 公理。
 */
export default function AxiomsPage() {
  const [report, setReport] = useState<AxiomValidationReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setCheckError('');
    setSheetOpen(true);
    try {
      setReport(await validateAxioms());
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setChecking(false);
    }
  }, []);

  return (
    <>
      <KernelPrimitiveListPage<KernelAxiom>
        title="公理"
        load={listAxioms}
        rowKey={(row) => row.rid}
        searchText={(a) => `${a.kind} ${a.rid} ${a.rule_ref} ${a.operands.join(' ')}`}
        searchPlaceholder="搜索公理"
        actions={
          <Button
            icon={<ShieldCheck size={15} strokeWidth={1.5} />}
            loading={checking}
            onClick={() => void runCheck()}
          >
            运行时校验
          </Button>
        }
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

      <SheetDetail
        title="公理运行时校验"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      >
        {checkError ? (
          <EmptyState illustration="failure" title="校验失败" desc={checkError} />
        ) : checking || !report ? (
          <div className="mp-text-sm mp-text-2">正在校验当前租户的数据实例…</div>
        ) : (
          <>
            <div className="mp-flex mp-gap-2 mp-wrap mp-mb-3">
              {report.conforms ? (
                <Tag color="green" type="light">✓ conforms</Tag>
              ) : (
                <Tag color="red" type="light">
                  ✗ {report.violations.length} 条违规
                </Tag>
              )}
            </div>
            <div className="mp-text-sm mp-text-2 mp-mb-4">
              Core 规则 {report.stats.checked} 条已检查（命中 {report.stats.violated} 条）；
              {report.stats.skipped} 条公理 kind 未覆盖，计入跳过。
            </div>
            {report.violations.length === 0 ? (
              <div className="mp-text-sm mp-text-2">
                {report.stats.checked === 0
                  ? '当前公理没有可执行的 Core 规则（disjoint / has_key / subclass）。'
                  : '当前数据实例未违反任何已声明的公理。'}
              </div>
            ) : (
              <div className="mp-onto-lint-list">
                {report.violations.map((v, i) => (
                  <div key={i} className="mp-onto-lint-item">
                    <Tag size="small" color="red" type="light">
                      {AXIOM_KIND_LABEL[v.kind ?? ''] ?? v.kind ?? v.severity ?? 'Violation'}
                    </Tag>
                    <div className="mp-onto-lint-body">
                      <div className="mp-onto-mono mp-onto-strong">{v.focus_node ?? '—'}</div>
                      <div>{v.message ?? '—'}</div>
                      {v.axiom_rid ? (
                        <div className="mp-onto-muted">公理: {ridTail(v.axiom_rid)}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SheetDetail>
    </>
  );
}
