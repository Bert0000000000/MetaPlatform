import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Select, Tag } from '@douyinfe/semi-ui';
import { Play, RefreshCw } from 'lucide-react';
import {
  evaluateObjectSet,
  listObjectTypes,
  type KernelIndividual,
  type KernelObjectType,
  type ObjectSetResult,
} from '@/api/ont/kernel';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import { ridTail } from '../../rid';
import '../../ontology.css';

/**
 * ObjectSet 构建器（12 基元补全 · C）：正式路由 /ontology/explore/objectset。
 *
 * <p>查询层基元的首个前端呈现——`POST /v2/object-sets/query`（既有契约）：
 * 选对象类型 + 可选 filter_expr 表达式 + 分页上限 → bindings 表。filter_expr
 * 是内核表达式字符串（见 kernel 编译器），首版直接暴露输入框并附示例；结构化
 * 条件构建器（QueryConditionV2）待后续迭代接 /v2/object-query。
 */
export default function ObjectSetBuilderPage() {
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [classRid, setClassRid] = useState('');
  const [filterExpr, setFilterExpr] = useState('');
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<ObjectSetResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadTypes = useCallback(async () => {
    try {
      const ts = await listObjectTypes();
      setTypes(ts);
      setClassRid((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : ts[0]?.rid ?? ''));
    } catch {
      setTypes([]);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const selectedType = types.find((t) => t.rid === classRid) ?? null;

  const run = useCallback(async () => {
    if (!classRid) return;
    setRunning(true);
    setError('');
    try {
      setResult(
        await evaluateObjectSet({
          class_rid: classRid,
          ...(filterExpr.trim() ? { filter_expr: filterExpr.trim() } : {}),
          paging_limit: limit,
        }),
      );
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [classRid, filterExpr, limit]);

  const propCols =
    (selectedType?.properties ?? []).slice(0, 5).map((p) => ({
      title: p.title || p.rid.split('.').pop() || '属性',
      dataIndex: p.rid,
      ellipsis: true,
      render: (_: unknown, row: KernelIndividual) => {
        const v = row.props?.[p.rid];
        if (v === undefined || v === null || v === '') return '—';
        const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return <span title={text}>{text.length > 60 ? `${text.slice(0, 60)}…` : text}</span>;
      },
    })) ?? [];

  return (
    <>
      <PageHeader
        title="ObjectSet 构建器"
        desc="12 基元查询层的可视入口 · POST /v2/object-sets/query"
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={running}
              onClick={() => void loadTypes()}
            >
              刷新类型
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Play size={15} strokeWidth={1.5} />}
              loading={running}
              disabled={!classRid}
              onClick={() => void run()}
            >
              运行查询
            </Button>
          </>
        }
      />

      <div className="mp-flex mp-gap-2 mp-mb-4 mp-flex-center mp-wrap">
        <Select
          className="mp-onto-objectset-select"
          placeholder="选择对象类型"
          value={classRid}
          onChange={(v) => setClassRid(v as string)}
          optionList={types.map((t) => ({
            value: t.rid,
            label: `${t.display_name || ridTail(t.rid)} (${t.properties.length} 属性)`,
          }))}
          filter
        />
        <Input
          className="mp-flex-1"
          placeholder={"filter_expr 表达式（可空）——示例：primary_key.startswith('C')"}
          value={filterExpr}
          onChange={setFilterExpr}
          showClear
        />
        <Select
          className="mp-onto-objectset-limit"
          value={limit}
          onChange={(v) => setLimit(v as number)}
          optionList={[20, 50, 100, 500, 1000].map((n) => ({ value: n, label: `上限 ${n}` }))}
        />
        {selectedType ? (
          <Tag color="blue" type="light">
            {selectedType.display_name}
          </Tag>
        ) : null}
      </div>

      {error ? (
        <EmptyState illustration="failure" title="查询失败" desc={error} />
      ) : result === null ? (
        <EmptyState
          illustration="no-content"
          title="选择类型后点「运行查询」"
          desc="ObjectSet 会返回该类型的实例绑定（bindings）与总数。"
        />
      ) : (
        <>
          <div className="mp-text-sm mp-text-2 mp-mb-2">
            {result.count} 条绑定 · 显示前 {result.results.length} 条
          </div>
          <DataTablePro
            columns={[
              {
                title: '主键',
                dataIndex: 'primary_key',
                width: 200,
                ellipsis: true,
                render: (v: string) => <span className="mp-onto-strong">{v || '—'}</span>,
              },
              ...propCols,
              {
                title: 'rid',
                dataIndex: 'rid',
                ellipsis: true,
                render: (v: string) => <span className="mp-onto-muted mp-onto-mono">{v}</span>,
              },
            ]}
            dataSource={result.results}
            rowKey="rid"
            empty={<EmptyState illustration="no-result" title="没有匹配的绑定" desc="调整 filter_expr 或换一个类型。" />}
          />
        </>
      )}
    </>
  );
}
