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
  confirmProposal, executeProposal, getProposal, getProposalPreview, rejectProposal,
  type ProposalPreflight, type ProposalPreview, type ProposalRecord,
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
  edit_set: '执行动作',
};

export default function ProposalConfirmDrawer({
  open,
  proposalId,
  initialKind,
  onExecuted,
  onClosed,
}: ProposalConfirmDrawerProps) {
  const [preview, setPreview] = useState<ProposalPreview | null>(null);
  const [authoritativeProposal, setAuthoritativeProposal] = useState<ProposalRecord | null>(null);
  // ONT-GATE-01：三闸门预检报告（blocked 时禁用确认按钮）
  const [preflight, setPreflight] = useState<ProposalPreflight | null>(null);
  const [state, setState] = useState<DrawerState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<{
    created_rid?: string;
    affected_individuals?: number;
    affected_links?: number;
    audit_id?: string;
    outbox_event_ids?: string[];
  } | null>(null);

  // open=true + proposalId 变化 → 加载 preview + 三闸门预检（ONT-GATE-01）
  useEffect(() => {
    if (!open || !proposalId) return;
    let cancelled = false;
    setState('loading');
    setErrorMsg(null);
    setPreview(null);
    setAuthoritativeProposal(null);
    setExecuteResult(null);
    setPreflight(null);
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
      // 预检独立加载：失败不阻塞 preview 展示（execute 端还会权威复核）
      try {
        const rec = await getProposal(proposalId);
        if (cancelled) return;
        setPreflight(rec.preflight ?? null);
      } catch {
        /* 预检不可得 = 无报告，不放行信号也不报错 */
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
    setAuthoritativeProposal(null);
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
      const confirmed = await getProposal(proposalId);
      if (confirmed.status !== 'confirmed') throw new Error(`服务端确认状态异常：${confirmed.status}`);
      setAuthoritativeProposal(confirmed);
    } catch (e) {
      const msg = (e as Error).message || '确认失败';
      setErrorMsg(msg);
      setState('loaded');
      return;
    }
    setState('executing');
    try {
      const result = await executeProposal(proposalId);
      const executed = await getProposal(proposalId);
      if (executed.status !== 'executed') throw new Error(`服务端执行状态异常：${executed.status}`);
      setAuthoritativeProposal(executed);
      const execSummary = {
        created_rid: result.created_rid,
        affected_individuals: result.affected_individuals,
        affected_links: result.affected_links,
        audit_id: result.audit_id,
        outbox_event_ids: result.outbox_event_ids,
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
  const serverStatus = authoritativeProposal?.status ?? preview?.status ?? 'pending';
  const statusLabel: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    rejected: '已拒绝',
    executed: '已执行',
  };

  return (
    <div>
      <div
        onClick={() => state !== 'confirming' && state !== 'executing' && close('cancel')}
        className="mp-flex mp-justify-end mp-onto-drawer-mask"
      >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mp-h-full mp-flex-col mp-onto-drawer-panel mp-onto-drawer-panel--wide"
      >
        {/* Header */}
        <div className="mp-justify-between mp-border mp-shrink-0 mp-flex-center mp-py-4 mp-px-6" >
          <div>
            <div className="mp-text-xs mp-text-2 mp-mb-1" >
              AI 提案 · {statusLabel[serverStatus] ?? serverStatus}
            </div>
            <h3 className="mp-fw-600 mp-m-0 mp-text-lg">
              {preview?.title ?? kindLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => close('cancel')}
            disabled={state === 'confirming' || state === 'executing'}
            className="mp-border mp-text-md mp-text-2 mp-bg-1 mp-rounded-sm mp-onto-close-btn"
            aria-label="关闭抽屉"
          >
            <X className="mp-icon-14" />
          </button>
        </div>

        {/* Body */}
        <div className="mp-flex-1 mp-overflow-y-auto mp-py-5 mp-px-6" >
          {state === 'loading' && (
            <div className="mp-justify-center mp-gap-2 mp-p-10 mp-text-body mp-text-2 mp-flex-center">
              <Loader2 className="mp-icon-16 mp-spin"  />
              正在加载 staging 预览…
            </div>
          )}

          {state === 'error' && (
            <div className="mp-flex mp-rounded mp-gap-2 mp-text-body mp-text-danger mp-py-3 mp-px-4 mp-items-start mp-onto-banner-danger">
              <AlertTriangle className="mp-icon-16 mp-shrink-0 mp-mt-1"  />
              <div>
                <strong className="mp-mb-1 mp-block" >加载失败</strong>
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
                  className="mp-mt-2 mp-onto-btn mp-onto-btn--md"
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {(state === 'loaded' || state === 'confirming' || state === 'executing' || state === 'done') && preview && (
            <OntologyStagingPreview preview={preview} />
          )}

          {/* ONT-GATE-01 三闸门预检横幅（schema × SHACL × Axiom） */}
          {state !== 'done' && preflight && (
            <div className={`mp-flex mp-rounded mp-mt-4 mp-gap-2 mp-text-body mp-py-3 mp-px-4 mp-items-start ${preflight.blocked ? 'mp-onto-banner-danger' : 'mp-onto-banner-success'}`}>
              {preflight.blocked
                ? <AlertTriangle className="mp-icon-18 mp-text-danger mp-shrink-0 mp-mt-1"  />
                : <CheckCircle2 className="mp-icon-18 mp-text-success mp-shrink-0 mp-mt-1"  />}
              <div className="mp-flex-1">
                <div className="mp-fw-600 mp-mb-1">
                  机器预检{preflight.blocked ? '阻断' : '通过'}
                </div>
                <div className="mp-text-sm mp-text-2">
                  {preflight.summary}
                </div>
                {preflight.blocked && (
                  <ul className="mp-text-sm mp-text-2 mp-onto-list-indent">
                    {(preflight.schema?.errors ?? []).slice(0, 4).map((e, i) => (
                      <li key={`s${i}`}>schema：{e}</li>
                    ))}
                    {(preflight.shacl?.violations ?? []).slice(0, 3).map((v, i) => (
                      <li key={`h${i}`}>SHACL：{String((v as { message?: string }).message ?? (v as { constraint?: string }).constraint ?? '')}</li>
                    ))}
                    {preflight.axioms.filter(a => a.severity === 'violation').slice(0, 3).map((a, i) => (
                      <li key={`a${i}`}>Axiom[{a.rule}]：{a.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* 执行结果横幅 */}
          {state === 'done' && executeResult && (
            <div className="mp-flex mp-rounded mp-mt-4 mp-gap-2 mp-text-body mp-text-1 mp-py-3 mp-px-4 mp-items-start mp-onto-banner-success">
              <CheckCircle2 className="mp-icon-18 mp-text-success mp-shrink-0 mp-mt-1"  />
              <div className="mp-flex-1">
                <strong className="mp-mb-1 mp-text-success mp-block" >
                  已执行成功
                </strong>
                <div className="mp-text-2 mp-lh-16" >
                  <>
                    服务端状态：<code>{serverStatus}</code><br />
                  </>
                  {authoritativeProposal?.confirmed_by && (
                    <>确认人：<code>{authoritativeProposal.confirmed_by}</code><br /></>
                  )}
                  {authoritativeProposal?.confirmed_at && (
                    <>确认时间：<code>{authoritativeProposal.confirmed_at}</code><br /></>
                  )}
                  {executeResult.created_rid && (
                    <>新建 rid：<code>{executeResult.created_rid}</code><br /></>
                  )}
                  {typeof executeResult.affected_individuals === 'number' && (
                    <>受影响 Individual：{executeResult.affected_individuals}<br /></>
                  )}
                  {typeof executeResult.affected_links === 'number' && (
                    <>受影响 LinkInstance：{executeResult.affected_links}</>
                  )}
                  {executeResult.audit_id && (
                    <>审计记录：<code>{executeResult.audit_id}</code><br /></>
                  )}
                  {executeResult.outbox_event_ids?.length ? (
                    <>Outbox 事件：<code>{executeResult.outbox_event_ids.join(', ')}</code></>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {errorMsg && state !== 'error' && state !== 'loading' && (
            <div className="mp-flex mp-rounded mp-mt-4 mp-gap-2 mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-items-start mp-onto-banner-danger">
              <AlertTriangle className="mp-icon-14 mp-shrink-0 mp-mt-1"  />
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mp-justify-between mp-border mp-shrink-0 mp-gap-2 mp-flex-center mp-py-3 mp-px-6" >
          <div className="mp-text-xs mp-text-2">
            {state === 'loaded' && '取消后状态保持 pending，可下次再确认'}
            {state === 'done' && '已生效，可关闭抽屉'}
          </div>
          <div className="mp-flex-center mp-gap-2" >
            {state === 'done' ? (
              <button
                type="button"
                onClick={() => close('execute')}
                className="mp-onto-btn mp-onto-btn--lg mp-onto-btn--primary"
              >
                关闭
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => close('cancel')}
                  disabled={state === 'confirming' || state === 'executing'}
                  className="mp-onto-btn mp-onto-btn--lg"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={state === 'confirming' || state === 'executing'}
                  className="mp-onto-btn mp-onto-btn--lg mp-onto-btn--danger"
                >
                  {state === 'confirming' ? '处理中…' : '拒绝'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={state === 'confirming' || state === 'executing' || preflight?.blocked === true}
                  title={preflight?.blocked === true ? '预检阻断（schema/SHACL/Axiom violation），需先修正提案' : undefined}
                  className="mp-fw-500 mp-onto-btn mp-onto-btn--lg mp-onto-btn--primary"
                >
                  {state === 'executing' ? '执行中…' : state === 'confirming' ? '确认中…' : preflight?.blocked === true ? '预检阻断，不可执行' : '确认并执行'}
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
