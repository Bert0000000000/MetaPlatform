// SecurityPolicyCard - SEC-12 行/列级安全策略卡（GovernancePage「安全策略（行/列）」卡）。
//
// GET  /ont/v2/security-policies        → 策略清单（rid/kind/class_rid/property_rid/
//                                         field/op/value/markings；kind Tag：row=行/column=列）
// POST /ont/v2/security-policies        → 新建（row：{kind,class_rid,field,op,value,markings}；
//                                         column：{kind,property_rid,markings}；markings 为数组）
// DEL  /ont/v2/security-policies/{rid}  → 删除
//
// 语义：无策略 = 全可见；行策略过滤实例、列策略置空属性值（单元格级）。
// dev 模式 Semi 交互组件 onClick 被截 noop —— 交互元素全部原生 + 内联样式。

import { useCallback, useEffect, useState } from 'react';
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { ShieldCheck } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  deleteSecurityPolicy, errDetailText, listSecurityPolicies, upsertSecurityPolicy,
  type KernelSecurityPolicy,
} from '@/api/ont/kernel';

const ROW_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'startswith', 'contains', 'in', 'truthy'] as const;

// 表单样式统一走 mp-onto-* 类（见 pages/ontology/ontology.css）。

/** 逗号分隔文本 → markings 数组（兼容中文逗号，去空白）。 */
function splitMarkings(s: string): string[] {
  return s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
}

export default function SecurityPolicyCard() {
  const [policies, setPolicies] = useState<KernelSecurityPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // 新建表单
  const [kind, setKind] = useState<'row' | 'column'>('row');
  const [classRid, setClassRid] = useState('');
  const [field, setField] = useState('');
  const [op, setOp] = useState<string>('eq');
  const [value, setValue] = useState('');
  const [bypassMarkings, setBypassMarkings] = useState('');
  const [propertyRid, setPropertyRid] = useState('');
  const [requiredMarkings, setRequiredMarkings] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPolicies(await listSecurityPolicies());
    } catch (e) {
      setErr(errDetailText(e, '安全策略列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const doDelete = async (rid: string) => {
    if (!window.confirm(`删除安全策略 ${rid}？`)) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await deleteSecurityPolicy(rid);
      setMsg(`已删除策略：${rid}`);
      await reload();
    } catch (e) {
      setErr(errDetailText(e, `删除策略失败：${rid}`));
    } finally {
      setBusy(false);
    }
  };

  const doCreate = async () => {
    setErr(''); setMsg('');
    if (kind === 'row') {
      if (!classRid.trim() || !field.trim() || !op) {
        setErr('行策略需要 class_rid / field / op'); return;
      }
    } else if (!propertyRid.trim()) {
      setErr('列策略需要 property_rid'); return;
    }
    setBusy(true);
    try {
      const body = kind === 'row'
        ? {
            kind: 'row' as const,
            class_rid: classRid.trim(),
            field: field.trim(),
            op,
            value: value.trim() ? value.trim() : undefined,
            markings: splitMarkings(bypassMarkings),
          }
        : {
            kind: 'column' as const,
            property_rid: propertyRid.trim(),
            markings: splitMarkings(requiredMarkings),
          };
      const resp = await upsertSecurityPolicy(body);
      const rid = typeof resp.rid === 'string' ? resp.rid : '（新策略）';
      setMsg(`策略已保存：${rid}（${kind === 'row' ? '行' : '列'}策略）`);
      toast('安全策略已保存', 'success');
      setClassRid(''); setField(''); setOp('eq'); setValue(''); setBypassMarkings('');
      setPropertyRid(''); setRequiredMarkings('');
      await reload();
    } catch (e) {
      setErr(errDetailText(e, '保存策略失败'));
    } finally {
      setBusy(false);
    }
  };

  const cols: ColumnProps<KernelSecurityPolicy>[] = [
    { title: 'rid', dataIndex: 'rid', render: (v: string) => (
      <span className="mp-text-xs mp-break-all mp-mono" >{v}</span>) },
    { title: '类型', dataIndex: 'kind', width: 70, render: (v: string) => (
      <Tag size="small" color={v === 'row' ? 'blue' : 'violet'}>{v === 'row' ? '行' : '列'}</Tag>) },
    { title: '类型 rid', dataIndex: 'class_rid', render: (v: string) => (
      <span className="mp-text-xs mp-mono" >{v || '—'}</span>) },
    { title: '属性 rid', dataIndex: 'property_rid', render: (v: string) => (
      <span className="mp-text-xs mp-break-all mp-mono" >{v || '—'}</span>) },
    { title: '字段', dataIndex: 'field', width: 110, render: (v: string) => v || '—' },
    { title: '操作符', dataIndex: 'op', width: 90, render: (v: string) => (
      <span className="mp-text-xs mp-mono" >{v || '—'}</span>) },
    { title: '值', dataIndex: 'value', width: 110, render: (v: unknown) => {
      if (v === null || v === undefined || v === '') return '—';
      return typeof v === 'string' ? v : JSON.stringify(v);
    } },
    { title: '标记', dataIndex: 'markings', render: (v: string[]) => (
      <span className="mp-text-xs mp-text-2">
        {v && v.length > 0 ? v.join('、') : '—'}
      </span>) },
    { title: '', dataIndex: '__ops', width: 64, render: (_: unknown, row: KernelSecurityPolicy) => (
      <button
        type="button"
        onClick={() => void doDelete(row.rid)}
        disabled={busy}
        className="mp-text-danger mp-onto-btn mp-onto-btn--xs mp-onto-btn--danger"
      >删除</button>
    ) },
  ];

  return (
    <Card bodyStyle={{ padding: 0 }}>
      <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
        <ShieldCheck className="mp-icon-14" />
        <h4 className="mp-fw-600 mp-m-0 mp-text-md">安全策略（行/列）</h4>
        <span className="mp-text-xs mp-text-2">行策略过滤实例 · 列策略置空属性值（单元格级）</span>
      </div>
      <div className="mp-flex mp-gap-3 mp-py-3 mp-px-5 mp-flex-col" >
        {msg && (
          <div className="mp-break-all mp-text-sm mp-text-success mp-py-2 mp-px-3 mp-rounded mp-onto-box-success">{msg}</div>
        )}
        {err && (
          <div className="mp-break-all mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-rounded mp-onto-box-danger">{err}</div>
        )}
        <Table<KernelSecurityPolicy>
          columns={cols}
          dataSource={policies}
          rowKey="rid"
          pagination={{ pageSize: 10 }}
          size="small"
          loading={loading}
          empty="无策略 = 全可见；行策略过滤实例、列策略置空属性值（单元格级）"
        />

        {/* 新建表单（原生元素） */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded" >
          <div className="mp-fw-600 mp-text-sm">新建策略</div>
          <div className="mp-flex-center mp-gap-2" >
            <span className="mp-onto-field-label mp-onto-field-label--rid">策略类型</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value === 'column' ? 'column' : 'row')}
              className="mp-clickable mp-onto-input mp-onto-input--md mp-onto-select--kind"
            >
              <option value="row">行策略（row）—— 按条件过滤实例</option>
              <option value="column">列策略（column）—— 按标记置空属性值</option>
            </select>
          </div>
          {kind === 'row' ? (
            <>
              <div className="mp-flex-center mp-gap-2" >
                <span className="mp-onto-field-label mp-onto-field-label--rid">类型 rid *</span>
                <input
                  type="text"
                  placeholder="ont.<租户>.obj.<域>.<slug>.v1"
                  value={classRid}
                  onChange={(e) => setClassRid(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-mono mp-onto-input mp-onto-input--md"
                />
              </div>
              <div className="mp-flex-center mp-gap-2" >
                <span className="mp-onto-field-label mp-onto-field-label--rid">字段（field）*</span>
                <input
                  type="text"
                  placeholder="过滤字段（属性 slug 或标记字段）"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-mono mp-onto-input mp-onto-input--md"
                />
                <span className="mp-onto-field-label mp-onto-field-label--op">操作符 *</span>
                <select
                  value={op}
                  onChange={(e) => setOp(e.target.value)}
                  className="mp-clickable mp-mono mp-onto-input mp-onto-input--md mp-onto-select--op"
                >
                  {ROW_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="mp-onto-field-label mp-onto-field-label--val">值</span>
                <input
                  type="text"
                  placeholder="比较值（truthy 可留空）"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-onto-input mp-onto-input--md"
                />
              </div>
              <div className="mp-flex-center mp-gap-2" >
                <span className="mp-onto-field-label mp-onto-field-label--rid">bypass 标记</span>
                <input
                  type="text"
                  placeholder="bypass_markings，逗号分隔（持这些标记的用户绕过本行策略）"
                  value={bypassMarkings}
                  onChange={(e) => setBypassMarkings(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-onto-input mp-onto-input--md"
                />
              </div>
            </>
          ) : (
            <>
              <div className="mp-flex-center mp-gap-2" >
                <span className="mp-onto-field-label mp-onto-field-label--rid">属性 rid *</span>
                <input
                  type="text"
                  placeholder="ont.<租户>.prop.<域>.<slug>.v1"
                  value={propertyRid}
                  onChange={(e) => setPropertyRid(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-mono mp-onto-input mp-onto-input--md"
                />
              </div>
              <div className="mp-flex-center mp-gap-2" >
                <span className="mp-onto-field-label mp-onto-field-label--rid">必需标记</span>
                <input
                  type="text"
                  placeholder="required_markings，逗号分隔（不满足的单元格被置空）"
                  value={requiredMarkings}
                  onChange={(e) => setRequiredMarkings(e.target.value)}
                  className="mp-flex-1 mp-min-w-0 mp-onto-input mp-onto-input--md"
                />
              </div>
            </>
          )}
          <div className="mp-flex mp-justify-end">
            <button type="button" onClick={() => void doCreate()} disabled={busy} className="mp-onto-btn mp-onto-btn--sm">
              {busy ? '保存中…' : '保存策略'}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
