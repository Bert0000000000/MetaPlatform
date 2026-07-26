package com.metaplatform.action.proposal;

import com.metaplatform.action.policy.ActionPolicyService;
import com.metaplatform.msg.topology.TopologyTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Action Proposal Service（Phase 5.1 / Phase 5.2）。
 *
 * <p>提供：</p>
 * <ul>
 *   <li>{@link #propose} — Agent 提交 ActionProposal（写库 + ActionGuard 决策）</li>
 *   <li>{@link #approve} / {@link #reject} — Reviewer 处理</li>
 *   <li>{@link #execute} — 幂等执行（仅 APPROVED 或 AUTO）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActionProposalService {

    private final ActionProposalRepository repository;
    private final ActionPolicyService policyService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public ActionProposalEntity propose(ProposeRequest req) {
        ActionPolicyService.Decision decision = policyService.decide(
                req.actionCode, req.riskLevel, req.userRoles);

        String status;
        if (decision.isReject()) {
            status = "REJECTED";
        } else if (decision.isApproval()) {
            status = "PROPOSED";
        } else {
            status = "APPROVED";   // AUTO：直接进入可执行
        }

        ActionProposalEntity p = ActionProposalEntity.builder()
                .id("PROP-" + UUID.randomUUID())
                .tenantId(req.tenantId)
                .runId(req.runId)
                .actionCode(req.actionCode)
                .targetObjectId(req.targetObjectId)
                .conceptCode(req.conceptCode)
                .parameters(req.parameters == null ? null : req.parameters.toString())
                .riskLevel(req.riskLevel == null ? "LOW" : req.riskLevel)
                .idempotencyKey(req.idempotencyKey == null ? UUID.randomUUID().toString() : req.idempotencyKey)
                .requiresApproval(decision.isApproval())
                .status(status)
                .evidenceRefs(req.evidenceRefs == null ? null : req.evidenceRefs.toString())
                .reason(req.reason)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        ActionProposalEntity saved = repository.save(p);
        log.info("[ActionProposalService] proposed id={} action={} decision={}", saved.getId(), req.actionCode, decision.type());
        kafkaTemplate.send(TopologyTopics.AGENT_ACTION_PROPOSED, saved.getId(), saved);
        return saved;
    }

    public ActionProposalEntity approve(String proposalId, String approver) {
        ActionProposalEntity p = repository.findById(proposalId).orElseThrow();
        p.setStatus("APPROVED");
        p.setApprover(approver);
        p.setUpdatedAt(Instant.now());
        return repository.save(p);
    }

    public ActionProposalEntity reject(String proposalId, String approver, String reason) {
        ActionProposalEntity p = repository.findById(proposalId).orElseThrow();
        p.setStatus("REJECTED");
        p.setApprover(approver);
        p.setReason(reason);
        p.setUpdatedAt(Instant.now());
        return repository.save(p);
    }

    public ActionProposalEntity execute(String proposalId) {
        ActionProposalEntity p = repository.findById(proposalId).orElseThrow();
        if (!"APPROVED".equals(p.getStatus())) {
            throw new IllegalStateException("proposal not approved: " + p.getStatus());
        }
        // 幂等检查
        if (repository.findByTenantIdAndIdempotencyKey(p.getTenantId(), p.getIdempotencyKey()).isPresent()
                && !repository.findByTenantIdAndIdempotencyKey(p.getTenantId(), p.getIdempotencyKey()).get().getId().equals(proposalId)) {
            log.info("[ActionProposalService] idempotency hit key={}", p.getIdempotencyKey());
            p.setStatus("EXECUTED");
            return p;
        }
        // P5.3 阶段：实际执行逻辑 stub；真实动作由对应业务服务响应
        p.setStatus("EXECUTED");
        p.setExecutedAt(Instant.now());
        p.setUpdatedAt(Instant.now());
        ActionProposalEntity saved = repository.save(p);
        kafkaTemplate.send(TopologyEvents.ACTION_EXECUTED_TOPIC, saved.getId(), saved);
        return saved;
    }

    public List<ActionProposalEntity> listByRun(String runId) {
        return repository.findByRunId(runId);
    }

    public ActionProposalEntity get(String proposalId) {
        return repository.findById(proposalId).orElseThrow();
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ProposeRequest {
        private String tenantId;
        private String runId;
        private String actionCode;
        private String targetObjectId;
        private String conceptCode;
        private Map<String, Object> parameters;
        private String riskLevel;
        private String idempotencyKey;
        private java.util.List<String> userRoles;
        private java.util.List<String> evidenceRefs;
        private String reason;
    }
}
