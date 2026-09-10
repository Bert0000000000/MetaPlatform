// SchemaWipCard - G33 WIP 暂存视图（GovernancePage「Schema 暂存（WIP）」卡）。
//
// GET /ont/v2/object-types/wip → [{rid, author, payload, created_at}]（他人不可见的
// schema 变更暂存区）。每行两操作：
//   应用 —— POST /object-types/wip/{rid}/apply；若返回 409 且 detail 是对象
//     {error:"destructive_confirm_required", changes:[...], confirm_with:"..."}，
//     展开行内二段确认区（changes 清单 + confirm_with 输入 + 重发；
//     apply 是 POST，confirm_name 走 query 参数）；
//   丢弃 —— DELETE /object-types/wip/{rid}。
//
// dev 模式 Semi 交互组件 onClick 被截 noop —— 交互元素全部原生 + 内联样式。

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@douyinfe/semi-ui';
import { AlertTriangle, Inbox } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  applySchemaWip, discardSchemaWip, errDetailText, extractDestructiveConfirm,
  listSchemaWip, type DestructiveConfirmDetail, type SchemaWipEntry,
} from '@/api/ont/kernel';

const btnStyle: CSSProperties = {
  height: 26, padding: '0 10px', fontSize: 12, borderRadius: 4,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--foreground)', cursor: 'pointer', whiteSpace: 'nowrap',
};

const destructiveBtnStyle: CSSProperties = {
  ...btnStyle,
  border: '1px solid var(--destructive)', background: 'transparent',
  color: 'var(--destructive)',
};

const confirmInputStyle: CSSProperties = {
  height: 28, flex: 1, minWidth: 0, boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0 10px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none', fontFamily: 'monospace',
};

export default function SchemaWipCard() {
  const [wips, setWips] = useState<SchemaWipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busyRid, setBusyRid] = useState('');
  // 行内二段确认（破坏性 409）：confirmRid 标记展开行
  const [confirmRid, setConfirmRid] = useState('');
  const [confirmInfo, setConfirmInfo] = useState<DestructiveConfirmDetail | null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setWips(await listSchemaWip());
    } catch (e) {
      setErr(errDetailText(e, 'WIP 暂存列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const clearConfirm = () => {
    setConfirmRid('');
    setConfirmInfo(null);
    setConfirmInput('');
  };

  /** 应用 WIP；confirmName 非空 = 二段确认重发（?confirm_name=...）。 */
  const doApply = async (rid: string, confirmName = '') => {
    setBusyRid(rid); setErr(''); setMsg('');
    try {
      const ot = await applySchemaWip(rid, confirmName);
      setMsg(`已应用 WIP → 正式表：${ot.rid ?? rid}`);
      toast('WIP 已应用', 'success');
      clearConfirm();
      await reload();
    } catch (e) {
      const dc = extractDestructiveConfirm(e);
      if (dc) {
        // 409 破坏性门禁：展开该行的二段确认区
        setConfirmRid(rid);
        setConfirmInfo(dc);
        setConfirmInput('');
      } else {
        setErr(errDetailText(e, `应用 WIP 失败：${rid}`));
      }
    } finally {
      setBusyRid('');
    }
  };

  const doDiscard = async (rid: string) => {
    if (!window.confirm(`丢弃 WIP 暂存 ${rid}？该操作不可恢复。`)) return;
    setBusyRid(rid); setErr(''); setMsg('');
    try {
      await discardSchemaWip(rid);
      setMsg(`已丢弃 WIP：${rid}`);
      if (confirmRid === rid) clearConfirm();
      await reload();
    } catch (e) {
      setErr(errDetailText(e, `丢弃 WIP 失败：${rid}`));
    } finally {
      setBusyRid('');
    }
  };

  return (
    <Card bodyStyle={{ padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Inbox style={{ width: 15, height: 15 }} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Schema 暂存（WIP）</h4>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>编辑器暂存的 schema 变更 · 应用走破坏性门禁 · 他人不可见</span>
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>加载 WIP 暂存…</div>
        ) : wips.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            无暂存变更 —— 编辑器保存到 WIP 后在此审阅（他人不可见）
          </div>
        ) : (
          wips.map((w) => {
            const busy = busyRid === w.rid;
            return (
              <div key={w.rid} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{w.rid}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                    {w.author || '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                    {w.created_at ? new Date(w.created_at).toLocaleString() : '—'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => void doApply(w.rid)}
                      disabled={busy}
                      style={{ ...btnStyle, cursor: busy ? 'wait' : 'pointer' }}
                    >
                      {busy ? '处理中…' : '应用'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void doDiscard(w.rid)}
                      disabled={busy}
                      style={{ ...destructiveBtnStyle, cursor: busy ? 'wait' : 'pointer' }}
                    >
                      丢弃
                    </button>
                  </div>
                </div>
                {/* 破坏性 409 二段确认区（仅该行展开） */}
                {confirmRid === w.rid && confirmInfo && (
                  <div style={{
                    marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--destructive)' }}>
                      <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
                      应用被拦截：包含破坏性变更，需确认后重发
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {confirmInfo.changes.map((c, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--destructive)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          · {c}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={confirmInput}
                        placeholder={`输入 ${confirmInfo.confirm_with} 以确认`}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        style={confirmInputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => void doApply(w.rid, confirmInput.trim())}
                        disabled={busy || !confirmInput.trim()}
                        style={{ ...destructiveBtnStyle, cursor: busy ? 'wait' : 'pointer', flexShrink: 0 }}
                      >
                        {busy ? '重发中…' : '重发（确认）'}
                      </button>
                      <button
                        type="button"
                        onClick={clearConfirm}
                        style={{ ...btnStyle, flexShrink: 0 }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
