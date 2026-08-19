// ProposalConfirmDrawer - 收到 AI Assistant 流返回的 proposal_id 后弹出的确认抽屉
// (MP-ONT-PROPOSAL-01)。
//
// 流程：
//   1. 打开时立刻 GET /ont/v2/proposals/{id}/preview 拉 staging JSON
//   2. 中间挂 OntologyStagingPreview 渲染（model_type / create_instance /
//      merge_suggestion / action 四种 kind 分支）
//   3. 底部三按钮：
//      - 确认：POST .../confirm 然后 POST .../execute，最后通知父组件刷新列表
//      - 拒绝：POST .../reject 然后关闭 drawer
//      - 取消：只关 drawer，状态保持 pending（下次再确认）
//
// 严格原生 button（CLAUDE.md dev 模式 Semi Button onClick 截 noop）。
// 状态机：loading → preview-loaded → confirming → executing → done | error。

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  confirmProposal, executeProposal, getProposalPreview, rejectProposal,
  type ProposalPreview,
} from '@/api/ont/kernel';
import OntologyStagingPreview from './OntologyStagingPreview';

export interface ProposalConfirmDrawerProps {
  open: boolean;
  proposalId: string | null;
  /** 默认 Proposal kind（流返回的 kind，preview 加载完成前用这个显示顶栏）。 */
  initialKind?: string;
  /** 成功 execute 后调用，用于刷新列表 / 选中新建概念。 */
  onExecuted?: (proposalId: string, result: { created_rid?: string; affected_individuals?: number; affected_links?: number }) => void;
  /** 拒绝 / 取消时调用（不会触发 onExecuted）。 */
  onClosed?: (proposalId: string, action: 'cancel' | 'reject') => void;
}

type DrawerState = 'loading' | 'loaded' | 'confirming' | 'executing' | 'done' | 'error';

const KIND_FALLBACK_LABEL: Record<string, string> = {
  model_type: '新建概念',
  create_instance: '创建实例',
  merge_suggestion: '合并建议',
  action: '执行 Action',
};

export default function ProposalConfirmDrawer({
  open,
  proposalId,
  initialKind,
  onExecuted,
  onClosed,
}: ProposalConfirmDrawerProps) {
  const [preview, setPreview] = useState<ProposalPreview | null>(null);
  const [state, setState] = useState<DrawerState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<{
    created_rid?: string;
    affected_individuals?: number;
    affected_links?: number;
  } | null>(null);

  // open=true + proposalId 变化 → 加载 preview
  useEffect(() => {
    if (!open || !proposalId) return;
    let cancelled = false;
    setState('loading');
    setErrorMsg(null);
    setPreview(null);
    setExecuteResult(null);
    (async () => {
      try {
        const data = await getProposalPreview(proposalId);
        if (cancelled) return;
        setPreview(data);
        setState('loaded');
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || '加载 staging 预览失败';
        setErrorMsg(msg);
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, proposalId]);

  // 关闭 drawer
  const close = (action: 'cancel' | 'reject' | 'execute') => {
    if (proposalId && action !== 'execute') onClosed?.(proposalId, action);
    setPreview(null);
    setExecuteResult(null);
    setErrorMsg(null);
    setState('loading');
  };

  // 拒绝：POST /reject → 关闭
  const handleReject = async () => {
    if (!proposalId) return;
    setState('confirming');
    setErrorMsg(null);
    try {
      await rejectProposal(proposalId);
      close('reject');
    } catch (e) {
      const msg = (e as Error).message || '拒绝失败';
      setErrorMsg(msg);
      setState('loaded');
    }
  };

  // 确认 + 执行：先 confirm 再 execute，成功后通知父组件
  const handleConfirm = async () => {
    if (!proposalId) return;
    setState('confirming');
    setErrorMsg(null);
    try {
      await confirmProposal(proposalId);
    } catch (e) {
      const msg = (e as Error).message || '确认失败';
      setErrorMsg(msg);
      setState('loaded');
      return;
    }
    setState('executing');
    try {
      const result = await executeProposal(proposalId);
      const execSummary = {
        created_rid: result.created_rid,
        affected_individuals: result.affected_individuals,
        affected_links: result.affected_links,
      };
      setExecuteResult(execSummary);
      setState('done');
      // 通知父组件刷新（不立刻 close，让用户看到结果再手动关）
      onExecuted?.(proposalId, execSummary);
    } catch (e) {
      const msg = (e as Error).message || '执行失败';
      setErrorMsg(msg);
      setState('loaded');
    }
  };

  if (!open || !proposalId) return null;

  const kindLabel = KIND_FALLBACK_LABEL[preview?.kind ?? initialKind ?? '']
    ?? `未知类型（${preview?.kind ?? initialKind ?? '?'}）`;

  return (
    <div>
      <style>{`
        @keyframes osp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        onClick={() => state !== 'confirming' && state !== 'executing' && close('cancel')}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', justifyContent: 'flex-end',
        }}
      >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '66.666%', minWidth: 720, maxWidth: 960,
          height: '100%',
          background: 'var(--background)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>
              AI 提案 · 待确认
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              {preview?.title ?? kindLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => close('cancel')}
            disabled={state === 'confirming' || state === 'executing'}
            style={{
              width: 32, height: 32, borderRadius: 4, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--muted-foreground)',
              cursor: state === 'confirming' || state === 'executing' ? 'not-allowed' : 'pointer',
              fontSize: 14,
              opacity: state === 'confirming' || state === 'executing' ? 0.5 : 1,
            }}
            aria-label="关闭抽屉"
          >
            <X style={{ width: 14, height: 14, margin: 'auto', display: 'block' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {state === 'loading' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: 60, color: 'var(--muted-foreground)', fontSize: 13,
            }}>
              <Loader2 style={{ width: 16, height: 16, animation: 'osp-spin 1s linear infinite' }} />
              正在加载 staging 预览…
            </div>
          )}

          {state === 'error' && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius)',
              background: 'rgba(239,68,68,0.08)', border: '1px solid var(--destructive)',
              color: 'var(--destructive)', fontSize: 13,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 4 }}>加载失败</strong>
                <div>{errorMsg ?? '未知错误'}</div>
                <button
                  type="button"
                  onClick={() => {
                    // 重试：重新触发 effect
                    setState('loading');
                    setErrorMsg(null);
                    (async () => {
                      try {
                        const data = await getProposalPreview(proposalId);
                        setPreview(data);
                        setState('loaded');
                      } catch (e) {
                        setErrorMsg((e as Error).message || '重试失败');
                        setState('error');
                      }
                    })();
                  }}
                  style={{
                    marginTop: 10, height: 30, padding: '0 12px', fontSize: 12,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {(state === 'loaded' || state === 'confirming' || state === 'executing' || state === 'done') && preview && (
            <OntologyStagingPreview preview={preview} />
          )}

          {/* 执行结果横幅 */}
          {state === 'done' && executeResult && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: 'rgba(16,185,129,0.10)', border: '1px solid var(--success)',
              borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              fontSize: 13, color: 'var(--foreground)',
            }}>
              <CheckCircle2 style={{ width: 18, height: 18, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', marginBottom: 4, color: 'var(--success)' }}>
                  已执行成功
                </strong>
                <div style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                  {executeResult.created_rid && (
                    <>新建 rid：<code>{executeResult.created_rid}</code><br /></>
                  )}
                  {typeof executeResult.affected_individuals === 'number' && (
                    <>受影响 Individual：{executeResult.affected_individuals}<br /></>
                  )}
                  {typeof executeResult.affected_links === 'number' && (
                    <>受影响 LinkInstance：{executeResult.affected_links}</>
                  )}
                </div>
              </div>
            </div>
          )}

          {errorMsg && state !== 'error' && state !== 'loading' && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid var(--destructive)',
              borderRadius: 'var(--radius)',
              color: 'var(--destructive)', fontSize: 12,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {state === 'loaded' && '取消后状态保持 pending，可下次再确认'}
            {state === 'done' && '已生效，可关闭抽屉'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {state === 'done' ? (
              <button
                type="button"
                onClick={() => close('execute')}
                style={{
                  height: 34, padding: '0 14px', fontSize: 13,
                  background: 'var(--primary)', color: 'var(--primary-foreground, #fff)',
                  border: 'none', borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                }}
              >
                关闭
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => close('cancel')}
                  disabled={state === 'confirming' || state === 'executing'}
                  style={{
                    height: 34, padding: '0 14px', fontSize: 13,
                    background: 'var(--card)', color: 'var(--foreground)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    cursor: state === 'confirming' || state === 'executing' ? 'not-allowed' : 'pointer',
                    opacity: state === 'confirming' || state === 'executing' ? 0.5 : 1,
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={state === 'confirming' || state === 'executing'}
                  style={{
                    height: 34, padding: '0 14px', fontSize: 13,
                    background: 'var(--card)', color: 'var(--destructive)',
                    border: '1px solid var(--destructive)', borderRadius: 'var(--radius)',
                    cursor: state === 'confirming' || state === 'executing' ? 'not-allowed' : 'pointer',
                    opacity: state === 'confirming' || state === 'executing' ? 0.5 : 1,
                  }}
                >
                  {state === 'confirming' ? '处理中…' : '拒绝'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={state === 'confirming' || state === 'executing'}
                  style={{
                    height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500,
                    background: 'var(--primary)', color: 'var(--primary-foreground, #fff)',
                    border: 'none', borderRadius: 'var(--radius)',
                    cursor: state === 'confirming' || state === 'executing' ? 'not-allowed' : 'pointer',
                    opacity: state === 'confirming' || state === 'executing' ? 0.6 : 1,
                  }}
                >
                  {state === 'executing' ? '执行中…' : state === 'confirming' ? '确认中…' : '确认并执行'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}