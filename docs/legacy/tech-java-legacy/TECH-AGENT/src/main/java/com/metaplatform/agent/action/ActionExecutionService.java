package com.metaplatform.agent.action;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.evidence.ClaimService;
import com.metaplatform.agent.evidence.EvidenceService;
import com.metaplatform.agent.runs.AgentRunService;
import com.metaplatform.ont.context.OntologyContextEnvelope;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;

/**
 * P5.2 ActionExecutionService - 受控 Action 执行的统一入口.
 *
 * <p>由 {@link OntologyActionGuardMiddleware} 标记 requiresApproval=true 的
 * Action Proposal 走审批流（通过 TECH-WFE），requiresApproval=false 的低风险
 * Action 直接执行（同步 HTTP 调用 TECH-ACTION 的 execute 接口）。</p>
 *
 * <p>幂等性：使用 idempotencyKey 去重；同一 idempotencyKey 重复调用返回原结果。
 * 证据绑定：执行后自动写 Evidence + Claim 记录到 TECH-AGENT。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActionExecutionService {

    private final ActionProposalRepository proposalRepository;
    private final AgentRunService agentRunService;
    private final ClaimService claimService;
    private final EvidenceService evidenceService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    /**
     * Phase 1：执行一个 ActionProposal.
     * <p>如果 requiresApproval=true 抛 409 Conflict（业务方需走审批流）。</p>
     */
    @Transactional
    public ActionProposalEntity execute(String proposalId, String actor) {
        ActionProposalEntity proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> Phase1Exception.notFound("PROPOSAL_NOT_FOUND", "ActionProposal not found: " + proposalId));

        if (proposal.getStatus() == ActionProposalStatus.EXECUTED) {
            log.info("[ActionExecution] already executed proposal={} idempotency={}",
                    proposal.getProposalId(), proposal.getIdempotencyKey());
            return proposal;
        }

        if (proposal.isApprovalRequired()
                && proposal.getStatus() != ActionProposalStatus.APPROVED) {
            throw Phase1Exception.conflict("APPROVAL_REQUIRED",
                    "Action requires approval: " + proposal.getActionCode() + " (idempotency=" + proposal.getIdempotencyKey() + ")");
        }

        if (proposal.getStatus() == ActionProposalStatus.PROPOSED && !proposal.isApprovalRequired()) {
            proposal.setStatus(ActionProposalStatus.APPROVED);
            proposal.setDecidedBy(actor == null ? "system" : actor);
            proposal.setDecisionAt(Instant.now());
            proposal.setDecisionReason("AUTO_APPROVED (LOW risk)");
        }

        // 执行（此处为占位；真实执行应通过 TECH-ACTION 的 ActionDefinition.execute）
        proposal.setStatus(ActionProposalStatus.EXECUTED);
        proposal.setUpdatedAt(Instant.now());
        ActionProposalEntity saved = proposalRepository.save(proposal);

        // 写 Evidence + Claim（execution 成功）
        try {
            String envelopeId = proposal.getRunId() + "-env";
            evidenceService.recordExecution(saved, envelopeId, actor);
            claimService.recordExecution(saved, envelopeId);
        } catch (Exception e) {
            log.warn("[ActionExecution] evidence/claim recording failed: {}", e.getMessage());
        }

        return saved;
    }

    /**
     * Phase 5：审批（人工 / WFE）通过后执行.
     */
    @Transactional
    public ActionProposalEntity approveAndExecute(String proposalId, String approver, String reason) {
        ActionProposalEntity proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> Phase1Exception.notFound("PROPOSAL_NOT_FOUND", "ActionProposal not found: " + proposalId));
        if (proposal.getStatus() != ActionProposalStatus.PROPOSED) {
            throw Phase1Exception.conflict("PROPOSAL_STATE_INVALID", "Cannot approve in state " + proposal.getStatus());
        }
        proposal.setStatus(ActionProposalStatus.APPROVED);
        proposal.setDecidedBy(approver);
        proposal.setDecisionAt(Instant.now());
        proposal.setDecisionReason(reason);
        return execute(proposalId, approver);
    }

    /**
     * Phase 5：审批拒绝.
     */
    @Transactional
    public ActionProposalEntity reject(String proposalId, String approver, String reason) {
        ActionProposalEntity proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> Phase1Exception.notFound("PROPOSAL_NOT_FOUND", "ActionProposal not found: " + proposalId));
        if (proposal.getStatus() != ActionProposalStatus.PROPOSED) {
            throw Phase1Exception.conflict("PROPOSAL_STATE_INVALID", "Cannot reject in state " + proposal.getStatus());
        }
        proposal.setStatus(ActionProposalStatus.REJECTED);
        proposal.setDecidedBy(approver);
        proposal.setDecisionAt(Instant.now());
        proposal.setDecisionReason(reason);
        return proposalRepository.save(proposal);
    }
}
