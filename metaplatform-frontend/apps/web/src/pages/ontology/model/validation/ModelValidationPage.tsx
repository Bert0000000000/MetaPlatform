import { useCallback, useEffect, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { ShieldAlert } from 'lucide-react';
import { lintAntiPatterns, type LintFinding } from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
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
 */
export default function ModelValidationPage() {
  const [findings, setFindings] = useState<LintFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    </>
  );
}
