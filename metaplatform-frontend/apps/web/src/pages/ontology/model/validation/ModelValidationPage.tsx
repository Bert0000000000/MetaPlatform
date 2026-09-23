import { useCallback, useEffect, useState } from 'react';
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
  const [shaclReport, setShaclReport] = useState<ShaclValidateReport | null>(null);
  const [shaclError, setShaclError] = useState('');
  const [shaclLoading, setShaclLoading] = useState(false);

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
    if (!shaclClass) return;
    setShaclLoading(true);
    setShaclError('');
    setShaclReport(null);
    try {
      setShaclReport(await validateShacl({ target_class: shaclClass }));
    } catch (e) {
      setShaclError(e instanceof Error ? e.message : String(e));
    } finally {
      setShaclLoading(false);
    }
  }, [shaclClass]);

  useEffect(() => {
    listObjectTypes()
      .then((ts) => {
        setTypes(ts);
        setShaclClass((cur) => {
          if (cur && ts.some((t) => t.rid === cur)) return cur;
          return ts[0]?.rid ?? '';
        });
      })
      .catch(() => setTypes([]));
  }, []);

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
            <Select
              className="mp-onto-shacl-select"
              placeholder="选择对象类型"
              value={shaclClass}
              onChange={(v) => setShaclClass(v as string)}
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
              disabled={!shaclClass}
              onClick={() => void runShacl()}
            >
              校验
            </Button>
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
                    ✗ {shaclReport.violations.length} 条违规
                  </Tag>
                )}
              </div>
              {shaclReport.violations.length === 0 ? (
                <div className="mp-text-sm mp-text-2">该类型的数据实例全部合规。</div>
              ) : (
                shaclReport.violations.map((v, i) => (
                  <div key={i} className="mp-onto-lint-item">
                    <Tag size="small" color="red" type="light">{v.severity ?? 'Violation'}</Tag>
                    <div className="mp-onto-lint-body">
                      <div className="mp-onto-mono mp-onto-strong">{v.focus_node ?? '—'}</div>
                      <div>{v.message ?? '—'}</div>
                      {v.path ? <div className="mp-onto-muted">path: {v.path}</div> : null}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
