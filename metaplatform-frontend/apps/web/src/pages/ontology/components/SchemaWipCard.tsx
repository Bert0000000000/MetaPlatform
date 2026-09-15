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

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@douyinfe/semi-ui';
import { AlertTriangle, Inbox } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  applySchemaWip, discardSchemaWip, errDetailText, extractDestructiveConfirm,
  listSchemaWip, type DestructiveConfirmDetail, type SchemaWipEntry,
} from '@/api/ont/kernel';

// 按钮 / 输入统一走 mp-onto-* 类（见 pages/ontology/ontology.css）。

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
      <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
        <Inbox className="mp-icon-14" />
        <h4 className="mp-fw-600 mp-m-0 mp-text-md">Schema 暂存（WIP）</h4>
        <span className="mp-text-xs mp-text-2">编辑器暂存的 schema 变更 · 应用走破坏性门禁 · 他人不可见</span>
      </div>
      <div className="mp-flex mp-gap-2 mp-py-3 mp-px-5 mp-flex-col" >
        {msg && (
          <div className="mp-break-all mp-text-sm mp-text-success mp-py-2 mp-px-3 mp-rounded mp-onto-box-success">{msg}</div>
        )}
        {err && (
          <div className="mp-break-all mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-rounded mp-onto-box-danger">{err}</div>
        )}
        {loading ? (
          <div className="mp-text-center mp-p-6 mp-text-sm mp-text-2">加载 WIP 暂存…</div>
        ) : wips.length === 0 ? (
          <div className="mp-text-center mp-p-6 mp-text-sm mp-text-2">
            无暂存变更 —— 编辑器保存到 WIP 后在此审阅（他人不可见）
          </div>
        ) : (
          wips.map((w) => {
            const busy = busyRid === w.rid;
            return (
              <div key={w.rid} className="mp-border mp-py-2 mp-px-3 mp-rounded" >
                <div className="mp-flex-center mp-wrap mp-gap-2" >
                  <span className="mp-text-sm mp-break-all mp-mono" >{w.rid}</span>
                  <span className="mp-text-xs mp-text-2 mp-shrink-0" >
                    {w.author || '—'}
                  </span>
                  <span className="mp-text-xs mp-text-2 mp-shrink-0" >
                    {w.created_at ? new Date(w.created_at).toLocaleString() : '—'}
                  </span>
                  <div className="mp-flex mp-shrink-0 mp-ml-auto mp-gap-1" >
                    <button
                      type="button"
                      onClick={() => void doApply(w.rid)}
                      disabled={busy}
                      className="mp-onto-btn mp-onto-btn--xs"
                    >
                      {busy ? '处理中…' : '应用'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void doDiscard(w.rid)}
                      disabled={busy}
                      className="mp-onto-btn mp-onto-btn--xs mp-onto-btn--danger"
                    >
                      丢弃
                    </button>
                  </div>
                </div>
                {/* 破坏性 409 二段确认区（仅该行展开） */}
                {confirmRid === w.rid && confirmInfo && (
                  <div className="mp-flex-col mp-mt-2 mp-gap-2 mp-pt-2 mp-onto-dashed-top">
                    <div className="mp-fw-600 mp-text-sm mp-text-danger mp-flex-center mp-gap-1" >
                      <AlertTriangle className="mp-shrink-0 mp-icon-12"  />
                      应用被拦截：包含破坏性变更，需确认后重发
                    </div>
                    <div className="mp-flex mp-gap-1 mp-flex-col" >
                      {confirmInfo.changes.map((c, i) => (
                        <div key={i} className="mp-text-xs mp-text-danger mp-break-all mp-mono" >
                          · {c}
                        </div>
                      ))}
                    </div>
                    <div className="mp-gap-2 mp-flex-center">
                      <input
                        type="text"
                        value={confirmInput}
                        placeholder={`输入 ${confirmInfo.confirm_with} 以确认`}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        className="mp-flex-1 mp-min-w-0 mp-mono mp-onto-input mp-onto-input--sm"
                      />
                      <button
                        type="button"
                        onClick={() => void doApply(w.rid, confirmInput.trim())}
                        disabled={busy || !confirmInput.trim()}
                        className="mp-shrink-0 mp-onto-btn mp-onto-btn--xs mp-onto-btn--danger"
                      >
                        {busy ? '重发中…' : '重发（确认）'}
                      </button>
                      <button
                        type="button"
                        onClick={clearConfirm}
                        className="mp-shrink-0 mp-onto-btn mp-onto-btn--xs"
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
