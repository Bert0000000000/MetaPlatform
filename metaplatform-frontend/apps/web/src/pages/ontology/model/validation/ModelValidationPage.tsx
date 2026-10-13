import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Select, Tag } from '@douyinfe/semi-ui';
import { ShieldAlert } from 'lucide-react';
import {
  lintAntiPatterns,
  listObjectTypes,
  validateShacl,
  type KernelObjectType,
  type LintFinding,
  type ShaclValidateReport,
} from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { ridTail } from '../../rid';
import '../../ontology.css';

const PATTERN_LABEL: Record<string, string> = {
  god_object: '上帝对象',
  kitchen_sink: '大杂烩',
  misnomer: '误名',
  action_sprawl: 'Action 蔓延',
};

const PATTERN_COLOR: Record<string, 'red' | 'orange' | 'yellow'> = {
  god_object: 'red',
  kitchen_sink: 'orange',
  misnomer: 'yellow',
  action_sprawl: 'orange',
};

const SHACL_SCOPE = '当前对象类型的数据实例，按本次服务端执行的类型约束校验；不代表未执行规则或其他类型已通过。';
const SEVERITY_COLOR: Record<string, 'red' | 'orange' | 'blue'> = {
  Violation: 'red', Warning: 'orange', Info: 'blue',
};
interface ShaclReportReceipt {
  target_class: string;
  receivedAt: string;
  scope: string;
  report: ShaclValidateReport;
}

/**
 * 模型校验（IA2-2 从 GovernancePage 拆出）：正式路由 /ontology/model/validation。
 *
 * <p>反模式 lint（GET /lint/anti-patterns：god_object / kitchen_sink / misnomer /
 * action_sprawl）。发布与治理的「模型检查」页保留为入口链接，不重复实现
 * （设计规格 §7.6）。发现项渲染与 GovernancePage 原区块一致——只移动不复制。
 *
 * <p>2026-09-24（12 基元补全 · F）：新增「实例合规校验」区块——`POST /v2/shacl/validate`
 * 用 ObjectType 定义合成 NodeShape（主键/非空 → minCount、datatype），验证**数据实例**
 * 是否违反类型约束（既有契约，此前前端未接）。Axiom 的运行时违规检查后端无
 * violation 端点，仍登记。
 */
export default function ModelValidationPage() {
  const [findings, setFindings] = useState<LintFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // SHACL 实例合规校验（F 项）
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [shaclClass, setShaclClass] = useState('');
  const [shaclReceipt, setShaclReceipt] = useState<ShaclReportReceipt | null>(null);
  const [shaclError, setShaclError] = useState('');
  const [shaclLoading, setShaclLoading] = useState(false);
  const shaclRequest = useRef(0);
  const shaclAbort = useRef<AbortController | null>(null);
  const shaclTarget = useRef('');
  const mounted = useRef(false);
  const shaclReport = shaclReceipt?.target_class === shaclClass ? shaclReceipt.report : null;
  const severityCounts = { Violation: 0, Warning: 0, Info: 0, Other: 0 };
  for (const item of shaclReport?.violations ?? []) {
    if (item.severity === 'Violation' || item.severity === 'Warning' || item.severity === 'Info') severityCounts[item.severity]++;
    else severityCounts.Other++;
  }
  const countsMismatch = shaclReport?.severity_counts && ['Violation', 'Warning', 'Info'].some(level =>
    shaclReport.severity_counts?.[level] !== undefined && shaclReport.severity_counts[level] !== severityCounts[level as 'Violation' | 'Warning' | 'Info']);

  const selectShaclClass = useCallback((rid: string) => {
    if (shaclTarget.current === rid) return;
    shaclTarget.current = rid;
    shaclRequest.current++;
    shaclAbort.current?.abort();
    shaclAbort.current = null;
    setShaclClass(rid);
    setShaclReceipt(null);
    setShaclError('');
    setShaclLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; shaclRequest.current++; shaclAbort.current?.abort(); shaclAbort.current = null; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFindings(await lintAntiPatterns());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runShacl = useCallback(async () => {
    if (!shaclClass || !mounted.current) return;
    const target = shaclClass;
    const request = ++shaclRequest.current;
    shaclAbort.current?.abort();
    const controller = new AbortController();
    shaclAbort.current = controller;
    const isCurrent = () => mounted.current && shaclRequest.current === request && shaclTarget.current === target;
    setShaclLoading(true);
    setShaclError('');
    setShaclReceipt(null);
    try {
      const report = await validateShacl({ target_class: target }, controller.signal);
      if (isCurrent()) setShaclReceipt({ target_class: target, receivedAt: new Date().toISOString(), scope: SHACL_SCOPE, report });
    } catch (e) {
      if (isCurrent()) setShaclError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isCurrent()) { shaclAbort.current = null; setShaclLoading(false); }
    }
  }, [shaclClass]);

  const downloadShaclReport = () => {
    if (!shaclReceipt || shaclReceipt.target_class !== shaclTarget.current || shaclLoading) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(shaclReceipt, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `shacl-${ridTail(shaclReceipt.target_class).replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  useEffect(() => {
    listObjectTypes()
      .then((ts) => {
        if (!mounted.current) return;
        setTypes(ts);
        if (!ts.some((t) => t.rid === shaclTarget.current)) selectShaclClass(ts[0]?.rid ?? '');
      })
      .catch(() => { if (mounted.current) setTypes([]); });
  }, [selectShaclClass]);

  return (
    <>
      <PageHeader
        title="模型校验"
        desc={`${findings.length} 项发现（god_object / kitchen_sink / misnomer / action_sprawl）`}
        actions={
          <Button
            icon={<ShieldAlert size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            重新检查
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="反模式检查读取失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : findings.length === 0 ? (
        <EmptyState illustration="no-content" title="✓ 未发现反模式" desc="当前租户的本体模型没有命中已知反模式。" />
      ) : (
        <div className="mp-onto-lint-list">
          {findings.map((f, i) => (
            <div key={i} className="mp-onto-lint-item">
              <Tag size="small" color={PATTERN_COLOR[f.pattern] ?? 'grey'} type="light">
                {PATTERN_LABEL[f.pattern] ?? f.pattern}
              </Tag>
              <div className="mp-onto-lint-body">
                <div className="mp-onto-mono mp-onto-strong">{f.subject}</div>
                <div>{f.detail}</div>
                <div className="mp-onto-muted">💡 {f.hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ── F：SHACL 实例合规校验 ── */}
      <div className="mp-onto-detail-grid mp-mt-6">
        <div className="mp-onto-lint-list">
          <div className="mp-fw-600 mp-mb-2">实例合规校验（SHACL）</div>
          <div className="mp-text-sm mp-text-2 mp-mb-3">
            NodeShape 由 ObjectType 定义合成（主键/非空 → minCount、datatype），验证数据实例是否违反类型约束。
          </div>
          <div className="mp-flex mp-gap-2 mp-flex-center mp-wrap mp-mb-4">
            <span id="shacl-object-type-label">对象类型</span>
            <Select
              className="mp-onto-shacl-select"
              placeholder="选择对象类型"
              aria-labelledby="shacl-object-type-label"
              value={shaclClass}
              onChange={(v) => selectShaclClass(v as string)}
              optionList={types.map((t) => ({
                value: t.rid,
                label: t.display_name || ridTail(t.rid),
              }))}
              filter
            />
            <Button
              theme="solid"
              type="primary"
              loading={shaclLoading}
              disabled={!shaclClass || shaclLoading}
              onClick={() => void runShacl()}
            >
              校验
            </Button>
            <Button disabled={!shaclReport || shaclLoading} onClick={downloadShaclReport}>下载报告 JSON</Button>
          </div>
          {shaclError ? (
            <EmptyState illustration="failure" title="SHACL 校验失败" desc={shaclError} />
          ) : shaclReport ? (
            <>
              <div className="mp-flex mp-gap-2 mp-wrap mp-mb-3">
                {shaclReport.conforms ? (
                  <Tag color="green" type="light">✓ conforms</Tag>
                ) : (
                  <Tag color="red" type="light">
                    ✗ 未通过本次校验
                  </Tag>
                )}
                <Tag color="red" type="light">违规 {severityCounts.Violation}</Tag>
                <Tag color="orange" type="light">警告 {severityCounts.Warning}</Tag>
                <Tag color="blue" type="light">信息 {severityCounts.Info}</Tag>
                {severityCounts.Other > 0 ? <Tag color="grey" type="light">其他等级 {severityCounts.Other}</Tag> : null}
              </div>
              <div className="mp-text-sm mp-text-2 mp-mb-3">
                计数按本次报告条目统计。{SHACL_SCOPE}
                {countsMismatch ? <div role="status">服务端计数与报告条目不一致，请核对下载的原始报告。</div> : null}
              </div>
              {shaclReport.violations.length === 0 ? (
                <div className="mp-text-sm mp-text-2">本次报告没有返回校验发现项。</div>
              ) : (
                shaclReport.violations.map((v, i) => (
                  <div key={i} className="mp-onto-lint-item">
                    <Tag size="small" color={SEVERITY_COLOR[v.severity ?? ''] ?? 'grey'} type="light">{v.severity ?? '等级未提供'}</Tag>
                    <div className="mp-onto-lint-body">
                      <div className="mp-onto-mono mp-onto-strong">{v.focus_node ?? '—'}</div>
                      <div>{v.message ?? '—'}</div>
                      {v.path ? <div className="mp-onto-muted">path: {v.path}</div> : null}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : <div role="status" className="mp-text-sm mp-text-2">{shaclLoading ? '正在校验当前类型…' : shaclClass ? '当前类型尚未校验。' : '请选择要校验的对象类型。'}</div>}
        </div>
      </div>
    </>
  );
}
