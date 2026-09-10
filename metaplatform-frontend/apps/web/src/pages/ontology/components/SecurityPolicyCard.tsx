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

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { ShieldCheck } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  deleteSecurityPolicy, errDetailText, listSecurityPolicies, upsertSecurityPolicy,
  type KernelSecurityPolicy,
} from '@/api/ont/kernel';

const ROW_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'startswith', 'contains', 'in', 'truthy'] as const;

const inputStyle: CSSProperties = {
  height: 30, minWidth: 0, flex: 1, boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0 10px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none',
};

const monoInputStyle: CSSProperties = { ...inputStyle, fontFamily: 'monospace' };

const labelStyle: CSSProperties = {
  fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0, width: 88,
};

const btnStyle: CSSProperties = {
  height: 28, padding: '0 12px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--foreground)', cursor: 'pointer', whiteSpace: 'nowrap',
};

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
      <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{v}</span>) },
    { title: '类型', dataIndex: 'kind', width: 70, render: (v: string) => (
      <Tag size="small" color={v === 'row' ? 'blue' : 'violet'}>{v === 'row' ? '行' : '列'}</Tag>) },
    { title: '类型 rid', dataIndex: 'class_rid', render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v || '—'}</span>) },
    { title: '属性 rid', dataIndex: 'property_rid', render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{v || '—'}</span>) },
    { title: '字段', dataIndex: 'field', width: 110, render: (v: string) => v || '—' },
    { title: '操作符', dataIndex: 'op', width: 90, render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v || '—'}</span>) },
    { title: '值', dataIndex: 'value', width: 110, render: (v: unknown) => {
      if (v === null || v === undefined || v === '') return '—';
      return typeof v === 'string' ? v : JSON.stringify(v);
    } },
    { title: '标记', dataIndex: 'markings', render: (v: string[]) => (
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
        {v && v.length > 0 ? v.join('、') : '—'}
      </span>) },
    { title: '', dataIndex: '__ops', width: 64, render: (_: unknown, row: KernelSecurityPolicy) => (
      <button
        type="button"
        onClick={() => void doDelete(row.rid)}
        disabled={busy}
        style={{
          padding: '2px 10px', fontSize: 12, borderRadius: 4,
          border: '1px solid var(--destructive)', background: 'transparent',
          color: 'var(--destructive)', cursor: busy ? 'wait' : 'pointer',
        }}
      >删除</button>
    ) },
  ];

  return (
    <Card bodyStyle={{ padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <ShieldCheck style={{ width: 15, height: 15 }} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>安全策略（行/列）</h4>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>行策略过滤实例 · 列策略置空属性值（单元格级）</span>
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msg && (
          <div style={{
            padding: '8px 14px', fontSize: 12, borderRadius: 6,
            border: '1px solid var(--success)', color: 'var(--success)',
            wordBreak: 'break-all',
          }}>{msg}</div>
        )}
        {err && (
          <div style={{
            padding: '8px 14px', fontSize: 12, borderRadius: 6,
            border: '1px solid var(--destructive)', color: 'var(--destructive)',
            wordBreak: 'break-all',
          }}>{err}</div>
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
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>新建策略</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={labelStyle}>策略类型</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value === 'column' ? 'column' : 'row')}
              style={{ ...inputStyle, flex: '0 0 260px', cursor: 'pointer' }}
            >
              <option value="row">行策略（row）—— 按条件过滤实例</option>
              <option value="column">列策略（column）—— 按标记置空属性值</option>
            </select>
          </div>
          {kind === 'row' ? (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={labelStyle}>类型 rid *</span>
                <input
                  type="text"
                  placeholder="ont.<租户>.obj.<域>.<slug>.v1"
                  value={classRid}
                  onChange={(e) => setClassRid(e.target.value)}
                  style={monoInputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={labelStyle}>字段（field）*</span>
                <input
                  type="text"
                  placeholder="过滤字段（属性 slug 或标记字段）"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  style={monoInputStyle}
                />
                <span style={{ ...labelStyle, width: 62 }}>操作符 *</span>
                <select
                  value={op}
                  onChange={(e) => setOp(e.target.value)}
                  style={{ ...inputStyle, flex: '0 0 130px', fontFamily: 'monospace', cursor: 'pointer' }}
                >
                  {ROW_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span style={{ ...labelStyle, width: 42 }}>值</span>
                <input
                  type="text"
                  placeholder="比较值（truthy 可留空）"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={labelStyle}>bypass 标记</span>
                <input
                  type="text"
                  placeholder="bypass_markings，逗号分隔（持这些标记的用户绕过本行策略）"
                  value={bypassMarkings}
                  onChange={(e) => setBypassMarkings(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={labelStyle}>属性 rid *</span>
                <input
                  type="text"
                  placeholder="ont.<租户>.prop.<域>.<slug>.v1"
                  value={propertyRid}
                  onChange={(e) => setPropertyRid(e.target.value)}
                  style={monoInputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={labelStyle}>必需标记</span>
                <input
                  type="text"
                  placeholder="required_markings，逗号分隔（不满足的单元格被置空）"
                  value={requiredMarkings}
                  onChange={(e) => setRequiredMarkings(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => void doCreate()} disabled={busy} style={{ ...btnStyle, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? '保存中…' : '保存策略'}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
