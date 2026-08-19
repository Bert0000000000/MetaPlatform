// 本体合并 drawer（MP-DEDUP-01）：
// 把 source ObjectType 的属性并入 target ObjectType，
// 用户在表格里勾选 source 属性 → 目标 target 属性（Property 映射），
// 提交时调 POST /ont/v2/object-types/merge。
//
// - 必传：source / target（已 resolved 的 KernelObjectType）
// - onMerge 成功后关闭 drawer；onCancel 直接关闭
// - 表格中所有交互按钮用原生 <button>，绕开 dev 模式 Semi Button onClick 被截 noop 的坑
// - 风格与 OntologyModelingPage 一致：CSS variables、紧凑表格、原生 input/select

import { useMemo, useState } from 'react';
import { ArrowRight, GitMerge } from 'lucide-react';
import type { KernelObjectType, KernelProperty } from '@/api/ont/kernel';

interface OntologyMergeDrawerProps {
  open: boolean;
  source: KernelObjectType | null;
  target: KernelObjectType | null;
  /** 真实合并 API 调用，由父组件注入；返回是否成功。 */
  onMerge: (mapping: Record<string, string>) => Promise<boolean>;
  onCancel: () => void;
  /** 推断出的 source → target 默认映射（仅展示在 select 默认值上，不自动提交） */
  initialMapping?: Record<string, string>;
  submitting?: boolean;
}

// 从 property rid 取末段 slug（形如 ont.<tenant>.prop.<slug>.v<N>）。
function propSlug(prop: KernelProperty): string {
  const parts = prop.rid.split('.');
  // 砍掉 kind 段（prop / prp），后端用 'prop'，统一兼容
  return (parts[parts.length - 2] ?? prop.rid).replace(/^(prop|prp)\./, '');
}

// 按 slug 兜底生成初始映射：source prop rid → target prop rid（同名 slug）
function defaultMappingFor(
  source: KernelObjectType,
  target: KernelObjectType,
): Record<string, string> {
  const map: Record<string, string> = {};
  const targetBySlug = new Map(target.properties.map((p) => [propSlug(p), p.rid]));
  for (const sp of source.properties) {
    const slug = propSlug(sp);
    const tr = targetBySlug.get(slug);
    if (tr) map[sp.rid] = tr;
  }
  return map;
}

export default function OntologyMergeDrawer({
  open,
  source,
  target,
  onMerge,
  onCancel,
  initialMapping,
  submitting,
}: OntologyMergeDrawerProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // source 或 target 变化时重置 mapping：用注入的初始值，否则按 slug 兜底
  const seedKey = `${source?.rid ?? ''}::${target?.rid ?? ''}`;
  const seed = useMemo(() => {
    if (!source || !target) return {} as Record<string, string>;
    if (initialMapping) return { ...initialMapping };
    return defaultMappingFor(source, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const activeMapping = Object.keys(mapping).length === 0 && seedKey
    ? seed
    : mapping;

  const setCell = (srcRid: string, tgtRid: string) => {
    setMapping((prev) => {
      const base = Object.keys(prev).length === 0 ? seed : prev;
      const next = { ...base };
      if (!tgtRid) delete next[srcRid];
      else next[srcRid] = tgtRid;
      return next;
    });
  };

  const submit = async () => {
    const ok = await onMerge(activeMapping);
    if (ok) setMapping({});
  };

  const cancel = () => {
    setMapping({});
    onCancel();
  };

  if (!open || !source || !target) return null;

  const targetSlugSet = new Set(target.properties.map((p) => p.rid));

  return (
    <div
      onClick={cancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '66.666%', minWidth: 720, height: '100%',
          background: 'var(--background)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitMerge style={{ width: 18, height: 18, color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              合并概念 · {source.display_name} → {target.display_name}
            </h3>
          </div>
          <button
            type="button"
            onClick={cancel}
            style={{
              width: 32, height: 32, borderRadius: 4, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--muted-foreground)',
              cursor: 'pointer', fontSize: 14,
            }}
            aria-label="关闭合并 drawer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16, lineHeight: 1.6 }}>
            <div>source rid：<code>{source.rid}</code></div>
            <div>target rid：<code>{target.rid}</code></div>
            <div style={{ marginTop: 6 }}>
              下方表格中，为 source 的每个属性选择 target 中对应的属性；
              未勾选的 source 属性不会参与合并（数据迁移时被丢弃）。
              后端会按 Individual.props 的键名重映射到 target 的 Property rid。
            </div>
          </div>

          <table className="om-merge-table" style={{
            width: '100%', borderCollapse: 'collapse',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th style={thStyle}>source 属性（slug）</th>
                <th style={thStyle}>类型</th>
                <th style={{ ...thStyle, width: 64, textAlign: 'center' }}>映射</th>
                <th style={thStyle}>target 属性（slug）</th>
              </tr>
            </thead>
            <tbody>
              {source.properties.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                    source 没有属性定义，无需映射
                  </td>
                </tr>
              ) : source.properties.map((sp) => {
                const srcSlug = propSlug(sp);
                const mapped = activeMapping[sp.rid] ?? '';
                const matchedTarget = target.properties.find((p) => p.rid === mapped);
                return (
                  <tr key={sp.rid}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{srcSlug}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{sp.rid}</div>
                    </td>
                    <td style={tdStyle}>
                      <span className="type-badge">{sp.type_id}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setCell(sp.rid, matchedTarget ? '' : (targetSlugSet.values().next().value ?? ''))}
                        title={matchedTarget ? '取消映射' : '映射到默认'}
                        disabled={target.properties.length === 0}
                        style={{
                          width: 28, height: 28, borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: matchedTarget ? 'var(--primary)' : 'var(--card)',
                          color: matchedTarget ? 'var(--primary-foreground, #fff)' : 'var(--muted-foreground)',
                          cursor: matchedTarget || target.properties.length === 0 ? 'pointer' : 'not-allowed',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        aria-label={matchedTarget ? '取消映射' : '勾选映射'}
                      >
                        <ArrowRight style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={mapped}
                        onChange={(e) => setCell(sp.rid, e.target.value)}
                        disabled={target.properties.length === 0}
                        style={{
                          width: '100%', height: 32,
                          background: 'var(--card)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12,
                          color: 'var(--foreground)', outline: 'none',
                        }}
                      >
                        <option value="">— 不映射（丢弃） —</option>
                        {target.properties.map((tp) => (
                          <option key={tp.rid} value={tp.rid}>
                            {propSlug(tp)} ({tp.type_id})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{
            marginTop: 16, padding: 12, borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)', background: 'var(--muted)',
            fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--foreground)' }}>合并影响：</strong>
            source 的所有 Individual（实体）会被改写 class_rid 指向 target；
            LinkInstance 的 src/dst 引用同步替换；
            source ObjectType 本身会被软删（archived=true），slug 释放后可复用。
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          padding: '12px 24px', borderTop: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={cancel}
            style={{
              height: 34, padding: '0 14px', fontSize: 13,
              background: 'var(--card)', color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!!submitting}
            style={{
              height: 34, padding: '0 14px', fontSize: 13,
              background: 'var(--primary)', color: 'var(--primary-foreground, #fff)',
              border: 'none', borderRadius: 'var(--radius)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '合并中…' : '确认合并'}
          </button>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12, fontWeight: 500,
  color: 'var(--muted-foreground)', textAlign: 'left',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 13,
  borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
};