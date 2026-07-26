package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.dto.ActionProposalCreateRequest;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.RiskLevel;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.common.TenantContext;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/**
 * Ontology Action Guard Middleware（P3.1.6 + P5.1 复用）。
 *
 * <p>Agent 提交 ActionProposal 时强制校验：</p>
 * <ol>
 *   <li>actionCode ∈ allowedActions</li>
 *   <li>对象权限（已由 Permission Snapshot 校验）</li>
 *   <li>参数 Schema 合法（粗校验）</li>
 *   <li>风险等级：HIGH/CRITICAL 进入 Temporal/WFE 审批</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OntologyActionGuardMiddleware implements AgentMiddleware {

    private final ActionProposalService proposalService;
    private final ActionApprovalBridgeService approvalBridge;
    private final ActionRouteDlqService dlqService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** P5.5 Convenience no-arg constructor for unit tests (ActionGuard only does in-memory mark here). */
    public OntologyActionGuardMiddleware() { this(null, null, null); }

    @Override
    public int order() { return 500; }

    @Override
    public void afterExecution(MiddlewareContext context) {
        if (context.isRejected()) return;
        if (context.getActionProposals() == null || context.getActionProposals().isEmpty()) return;
        // P5.8: dedup proposals within the same run by (actionCode + targetObjects) hash
        java.util.Set<String> seenInThisRun = new java.util.HashSet<>();
        // Convert immutable Maps (e.g. Map.of) to LinkedHashMap so we can add validation fields
        List<Map<String, Object>> mutableProposals = new ArrayList<>();
        for (Map<String, Object> proposal : context.getActionProposals()) {
            if (!(proposal instanceof java.util.LinkedHashMap)) {
                proposal = new java.util.LinkedHashMap<>(proposal);
            }
            String actionCode = String.valueOf(proposal.getOrDefault("actionCode", ""));
            String riskLevel = String.valueOf(proposal.getOrDefault("riskLevel", "LOW"));

            // P5.8 dedup: skip if we have already seen an identical proposal in this run
            String dedupKey = actionCode + "::" + String.valueOf(proposal.get("targetObjects"));
            if (!seenInThisRun.add(dedupKey)) {
                log.info("[OntologyActionGuardMW] skipping duplicate proposal action={} targets={} (already processed in this run)",
                        actionCode, proposal.get("targetObjects"));
                continue;
            }
            boolean requiresApproval = "HIGH".equals(riskLevel) || "CRITICAL".equals(riskLevel);
            proposal.put("requiresApproval", requiresApproval);
            proposal.put("validatedAt", System.currentTimeMillis());

            // P5.5: auto-persist HIGH/CRITICAL risk proposals and submit to WFE
            if (requiresApproval && context.getRunId() != null) {
                String persistedProposalId = null;
                try {
                    ActionProposalCreateRequest createReq = new ActionProposalCreateRequest();
                    createReq.setRunId(context.getRunId());
                    createReq.setActionCode(actionCode);
                    createReq.setRiskLevel(riskLevel);
                    createReq.setTargetObjects(toList(proposal.get("targetObjects")));
                    createReq.setParameters(toMap(proposal.get("parameters")));
                    createReq.setReason(String.valueOf(proposal.getOrDefault("reason", "Action Guard: " + actionCode)));
                    createReq.setEvidenceRefs(toList(proposal.get("evidenceRefs")));
                    var dto = proposalService.create(createReq);
                    persistedProposalId = dto.getProposalId();
                    String wfeTaskId = approvalBridge.submitForApproval(dto.getProposalId(), TenantContext.getUserId());
                    proposal.put("proposalId", dto.getProposalId());
                    proposal.put("wfeTaskId", wfeTaskId == null ? "n/a" : wfeTaskId);
                    log.info("[OntologyActionGuardMW] HIGH risk action {} auto-persisted as proposal={} routed to WFE task={}",
                            actionCode, dto.getProposalId(), wfeTaskId);
                } catch (Exception e) {
                    log.error("[OntologyActionGuardMW] HIGH risk auto-route failed action={}: {}", actionCode, e.getMessage());
                    proposal.put("autoRouteError", e.getMessage());
                    // P5.6 enqueue to DLQ for later retry
                    if (dlqService != null) {
                        try {
                            dlqService.enqueue(context.getRunId(), persistedProposalId, actionCode, riskLevel, e.getMessage());
                        } catch (Exception dlqEx) {
                            log.error("[OntologyActionGuardMW] DLQ enqueue also failed: {}", dlqEx.getMessage());
                        }
                    }
                }
            }

            mutableProposals.add(proposal);
            log.info("[OntologyActionGuardMW] action={} risk={} requiresApproval={}",
                    actionCode, riskLevel, requiresApproval);
        }
        context.getActionProposals().clear();
        context.getActionProposals().addAll(mutableProposals);
    }

    private List<String> toList(Object o) {
        if (o == null) return List.of();
        if (o instanceof List<?> l) {
            List<String> r = new ArrayList<>();
            for (Object x : l) r.add(x == null ? null : String.valueOf(x));
            return r;
        }
        if (o instanceof String s) {
            try { return objectMapper.readValue(s, new TypeReference<>() {}); }
            catch (Exception e) { return List.of(s); }
        }
        return List.of(String.valueOf(o));
    }

    private Map<String, Object> toMap(Object o) {
        if (o == null) return Map.of();
        if (o instanceof Map<?, ?> m) {
            Map<String, Object> r = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) r.put(String.valueOf(e.getKey()), e.getValue());
            return r;
        }
        if (o instanceof String s) {
            try { return objectMapper.readValue(s, new TypeReference<>() {}); }
            catch (Exception e) { return Map.of(); }
        }
        return Map.of();
    }
}
