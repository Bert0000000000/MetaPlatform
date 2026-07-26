package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalRepository;
import com.metaplatform.agent.action.ActionProposalEntity;
import com.metaplatform.agent.action.dto.ActionProposalCreateRequest;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.RiskLevel;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.common.TenantContext;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/**
 * Ontology Action Guard Middleware闁挎稑婀?.1.6 + P5.1 濠㈣泛绉堕弫銈夋晬婢跺牃鍋?
 *
 * <p>Agent 闁圭粯鍔掑?ActionProposal 闁哄啳娉涘閬嶅礆閼哥數澧″Δ鐘茬焿缁?/p>
 * <ol>
 *   <li>actionCode 闁?allowedActions</li>
 *   <li>閻庣數顢婇挅鍕级閸愵喗顎欓柨娑樼墕閸戯繝鎮?Permission Snapshot 闁哄稄绻濋悰娆撴晬?/li>
 *   <li>闁告瑥鍊归弳?Schema 闁告艾鐗婄涵鍫曟晬閸垻鐓愰柡宥忕節閻涙瑩鏁?/li>
 *   <li>濡炲閰ｅ▍鎾剁驳婢跺矂鐛撻柨娑欘儢IGH/CRITICAL 閺夆晜绋戦崣?Temporal/WFE 閻庡厜鍓濇竟?/li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OntologyActionGuardMiddleware implements AgentMiddleware {

    private final ActionProposalService proposalService;
    private final ActionApprovalBridgeService approvalBridge;
    private final ActionRouteDlqService dlqService;
    private final ActionProposalRepository proposalRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** P5.5 Convenience no-arg constructor for unit tests (ActionGuard only does in-memory mark here). */
    public OntologyActionGuardMiddleware() { this(null, null, null, null); }

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
                    // P5.12: cross-tenant dedup - skip if same (tenant + run + action + target) exists
                    boolean crossTenantDedupHit = false;
                    // P5.10: cross-run dedup - skip if an existing proposal exists for same (runId, actionCode, targetObjects)
                    boolean crossRunDedupHit = false;
                    String targetObjectsJson = toJson(proposal.get("targetObjects"));
                    if (proposalRepository != null && targetObjectsJson != null) {
                        try {
                            // P5.12: try cross-tenant first (more strict)
                            String tenantIdForDedup = context.getTenantId() != null ? context.getTenantId() : "tenant-default";
                            var tenantExisting = proposalRepository.findRecentForTenantDedup(tenantIdForDedup, context.getRunId(), actionCode, targetObjectsJson);
                            if (tenantExisting != null && !tenantExisting.isEmpty()) {
                                ActionProposalEntity firstTenant = tenantExisting.get(0);
                                proposal.put("proposalId", firstTenant.getProposalId());
                                proposal.put("wfeTaskId", "tenant-reused");
                                proposal.put("crossTenantDedupHit", true);
                                log.info("[OntologyActionGuardMW] cross-tenant dedup hit tenant={} action={} reusing proposal={}",
                                        tenantIdForDedup, actionCode, firstTenant.getProposalId());
                                crossTenantDedupHit = true;
                            }
                        } catch (Exception dbEx) {
                            log.debug("[OntologyActionGuardMW] cross-tenant dedup DB query failed: {}", dbEx.getMessage());
                        }
                        try {
                            var existing = proposalRepository.findRecentForDedup(context.getRunId(), actionCode, targetObjectsJson);
                            if (existing != null && !existing.isEmpty()) {
                                ActionProposalEntity firstExisting = existing.get(0);
                                proposal.put("proposalId", firstExisting.getProposalId());
                                proposal.put("wfeTaskId", "reused");
                                proposal.put("crossRunDedupHit", true);
                                log.info("[OntologyActionGuardMW] cross-run dedup hit action={} reusing proposal={} from run={}",
                                        actionCode, firstExisting.getProposalId(), firstExisting.getRunId());
                                crossRunDedupHit = true;
                            }
                        } catch (Exception dbEx) {
                            log.debug("[OntologyActionGuardMW] cross-run dedup DB query failed: {}", dbEx.getMessage());
                        }
                    }

                    if (!crossRunDedupHit && !crossTenantDedupHit) {
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
                    }
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

    private String toJson(Object o) {
        try { return objectMapper.writeValueAsString(o); }
        catch (Exception e) { return null; }
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



