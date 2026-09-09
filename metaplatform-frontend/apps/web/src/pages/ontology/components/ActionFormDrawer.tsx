// ActionFormDrawer - 人工 Action 执行表单（ONT-UI-02，Palantir Action 表单对位）。
//
// D7「预览即确认」：按 ActionType.declarative_edits 模板解析参数 →
// 一步提交 POST /action-types/{rid}/apply-edit-set（即时 proposal + 单事务 + 审计，
// 证据链不旁路）。AI 路径不走本组件（走 propose-edit-set + ProposalConfirmDrawer）。
//
// 严格原生 button/input（dev 模式 Semi 交互组件 onClick noop 纪律）。

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X, Zap } from 'lucide-react';
import { applyEditSet, type KernelActionType, type KernelProperty } from '@/api/ont/kernel';

export interface ActionFormDrawerProps {
  open: boolean;
  action: KernelActionType | null;
  targetIid: string | null;
  targetLabel?: string;
  onClose: () => void;
  onApplied?: (result: Record<string, unknown>) => void;
}

function inputTypeFor(p: KernelProperty): string {
  switch (p.format) {
    case 'integer':
    case 'double':
      return 'number';
    case 'boolean':
      return 'checkbox';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

function propSlug(rid: string): string {
  const parts = rid.split('.');
  return parts[3] ?? rid;
}

export default function ActionFormDrawer({
  open, action, targetIid, targetLabel, onClose, onApplied,
}: ActionFormDrawerProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (open) {
      setValues({});
      setError('');
      setDone(null);
      setSubmitting(false);
    }
  }, [open, action?.rid]);

  if (!open || !action) return null;

  const submit = async () => {
    // 前端侧必填校验（后端 validate_referenced_parameters 兜底）
    for (const p of action.parameters) {
      const slug = propSlug(p.rid);
      if (!p.nullable) {
        const v = values[slug];
        if (v === undefined || v === '' || v === false) {
          setError(`必填参数缺失：${p.title || slug}`);
          return;
        }
      }
    }
    // checkbox → boolean；number → number
    const parameters: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      const p = action.parameters.find((pp) => propSlug(pp.rid) === k);
      if (p?.format === 'boolean') parameters[k] = Boolean(v);
      else if (p && (p.format === 'integer' || p.format === 'double') && v !== '')
        parameters[k] = Number(v);
      else if (v !== '' && v !== undefined) parameters[k] = v;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await applyEditSet(action.rid, {
        parameters, target_iid: targetIid ?? '',
      });
      setDone(result);
      onApplied?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const requiredParams = action.parameters.filter((p) => !p.nullable);

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, height: '100%', background: 'var(--background)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>
              执行动作 · 提交即审计
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Zap style={{ width: 14, height: 14, color: '#fbbf24' }} />
              {action.title || action.rid}
            </h3>
            {targetLabel && (
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                目标：{targetLabel}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" style={{
            width: 30, height: 30, borderRadius: 4, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer',
          }}>
            <X style={{ width: 14, height: 14, margin: 'auto', display: 'block' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {done ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start',
              padding: 24, border: '1px solid var(--success)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--success)', fontSize: 14 }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} /> 执行成功
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                审计 {String(done.audit_id ?? '')} · 编辑 {String(done.applied_count ?? 0)} 条
                {Array.isArray(done.created_rids) && done.created_rids.length > 0
                  ? ` · 新建 ${done.created_rids.length} 对象` : ''}
              </div>
              <button type="button" onClick={onClose} style={{
                padding: '6px 16px', fontSize: 13, borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--card)',
                color: 'var(--foreground)', cursor: 'pointer',
              }}>关闭</button>
            </div>
          ) : (
            <>
              {action.parameters.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
                  该动作无参数，确认即执行。
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {action.parameters.map((p) => {
                    const slug = propSlug(p.rid);
                    const t = inputTypeFor(p);
                    return (
                      <label key={p.rid} style={{ display: 'block' }}>
                        <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--foreground)' }}>
                          {p.title || slug}
                          {!p.nullable && <span style={{ color: 'var(--destructive)' }}> *</span>}
                          <span style={{ marginLeft: 6, color: 'var(--muted-foreground)', fontSize: 11 }}>
                            {p.format}
                          </span>
                        </div>
                        {t === 'checkbox' ? (
                          <input
                            type="checkbox"
                            checked={Boolean(values[slug])}
                            onChange={(e) => setValues((v) => ({ ...v, [slug]: e.target.checked }))}
                          />
                        ) : (
                          <input
                            type={t}
                            value={String(values[slug] ?? '')}
                            onChange={(e) => setValues((v) => ({ ...v, [slug]: e.target.value }))}
                            style={{
                              width: '100%', height: 34, boxSizing: 'border-box',
                              background: 'var(--card)', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '0 10px', fontSize: 13,
                              color: 'var(--foreground)', outline: 'none',
                            }}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {requiredParams.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  带 * 为必填；提交生成即时提案并单事务执行（可审计、可 revert）。
                </div>
              )}
              {error && (
                <div style={{
                  marginTop: 12, padding: 10, fontSize: 12,
                  border: '1px solid var(--destructive)', borderRadius: 6,
                  color: 'var(--destructive)', display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} /> {error}
                </div>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                style={{
                  marginTop: 16, width: '100%', height: 38, fontSize: 13,
                  fontWeight: 600, borderRadius: 8, border: 'none', cursor: submitting ? 'wait' : 'pointer',
                  background: submitting ? 'var(--muted)' : 'var(--foreground)',
                  color: submitting ? 'var(--muted-foreground)' : 'var(--background)',
                }}
              >
                {submitting ? '执行中…' : '确认执行（预览即确认）'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
