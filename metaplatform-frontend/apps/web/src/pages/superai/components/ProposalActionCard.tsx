// ProposalActionCard - 聊天里 AI 产出提案后的「action 计划」卡片。
//
// 三个动作：
//   - 同意：交由宿主打开 ProposalConfirmDrawer（复用其 preview + preflight
//     状态机，真正落库由用户在那里确认）
//   - 详细讨论：把提案上下文回填输入框，AI 带着上下文重新推理
//   - 驳回：直接调 rejectProposal，卡片就地转为已驳回
//
// 按钮用原生 <button>：dev 模式下 Semi Button 的 onClick 会被 React 18 root
// delegation + vite HMR 截成 noop（见 CLAUDE.md）。

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { rejectProposal } from '@/api/ont/kernel';
import type { AgentProposalEvent } from '@/api/superai/chat';

const KIND_LABEL: Record<string, string> = {
  action: '执行 Action',
  create_instance: '创建实例',
  model_type: '新建概念',
  merge_suggestion: '合并建议',
};

export interface ProposalActionCardProps {
  proposal: AgentProposalEvent;
  /** 同意：宿主打开确认抽屉（抽屉负责 confirm + execute）。 */
  onApprove: (proposal: AgentProposalEvent) => void;
  /** 详细讨论：宿主把提案上下文回填输入框并继续对话。 */
  onDiscuss: (proposal: AgentProposalEvent) => void;
  /** 驳回成功后通知宿主（可用于刷新列表或审计展示）。 */
  onRejected?: (proposalId: string) => void;
  /** 已执行过的提案（从历史重建）不再提供按钮。 */
  resolvedStatus?: 'rejected' | 'executed' | null;
}

type CardState = 'pending' | 'rejecting' | 'rejected' | 'failed';

export default function ProposalActionCard({
  proposal,
  onApprove,
  onDiscuss,
  onRejected,
  resolvedStatus,
}: ProposalActionCardProps) {
  const [state, setState] = useState<CardState>(
    resolvedStatus === 'rejected' ? 'rejected' : 'pending',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isResolved = resolvedStatus === 'executed' || state === 'rejected';
  const busy = state === 'rejecting';

  const handleReject = async () => {
    if (busy || isResolved) return;
    setState('rejecting');
    setErrorMsg(null);
    try {
      await rejectProposal(proposal.proposalId);
      setState('rejected');
      onRejected?.(proposal.proposalId);
    } catch (e) {
      setState('failed');
      setErrorMsg(e instanceof Error ? e.message : '驳回失败');
    }
  };

  return (
    <div className="mp-proposal-card" data-proposal-id={proposal.proposalId}>
      <div className="mp-proposal-head">
        <span className="mp-proposal-kind">
          {KIND_LABEL[proposal.kind] ?? proposal.kind ?? '提案'}
        </span>
        <code className="mp-proposal-id">{proposal.proposalId}</code>
        {resolvedStatus === 'executed' ? (
          <span className="mp-proposal-status mp-text-success">
            <CheckCircle2 size={14} strokeWidth={1.5} /> 已执行
          </span>
        ) : state === 'rejected' ? (
          <span className="mp-proposal-status mp-text-danger">已驳回</span>
        ) : (
          <span className="mp-proposal-status">待确认</span>
        )}
      </div>

      {proposal.impactSummary ? (
        <div className="mp-proposal-impact">{proposal.impactSummary}</div>
      ) : null}

      {errorMsg ? (
        <div className="mp-proposal-error">
          <AlertTriangle size={14} strokeWidth={1.5} />
          {errorMsg}
        </div>
      ) : null}

      {!isResolved && state !== 'failed' ? (
        <div className="mp-proposal-actions">
          <button
            type="button"
            className="mp-proposal-btn mp-proposal-btn--primary"
            disabled={busy}
            onClick={() => onApprove(proposal)}
          >
            同意
          </button>
          <button
            type="button"
            className="mp-proposal-btn"
            disabled={busy}
            onClick={() => onDiscuss(proposal)}
          >
            详细讨论
          </button>
          <button
            type="button"
            className="mp-proposal-btn mp-proposal-btn--danger"
            disabled={busy}
            onClick={handleReject}
          >
            {busy ? <Loader2 size={14} strokeWidth={1.5} /> : null}
            {busy ? '驳回中…' : '驳回'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
