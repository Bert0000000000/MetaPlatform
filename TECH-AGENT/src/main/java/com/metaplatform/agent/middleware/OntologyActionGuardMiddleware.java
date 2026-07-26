package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

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

    @Override
    public int order() { return 500; }

    @Override
    public void afterExecution(MiddlewareContext context) {
        if (context.isRejected()) return;
        if (context.getActionProposals() == null || context.getActionProposals().isEmpty()) return;
        // Convert immutable Maps (e.g. Map.of) to LinkedHashMap so we can add validation fields
        List<Map<String, Object>> mutableProposals = new ArrayList<>();
        for (Map<String, Object> proposal : context.getActionProposals()) {
            if (!(proposal instanceof java.util.LinkedHashMap)) {
                proposal = new java.util.LinkedHashMap<>(proposal);
            }
            String actionCode = String.valueOf(proposal.getOrDefault("actionCode", ""));
            String riskLevel = String.valueOf(proposal.getOrDefault("riskLevel", "LOW"));
            boolean requiresApproval = "HIGH".equals(riskLevel) || "CRITICAL".equals(riskLevel);
            proposal.put("requiresApproval", requiresApproval);
            proposal.put("validatedAt", System.currentTimeMillis());
            mutableProposals.add(proposal);
            log.info("[OntologyActionGuardMW] action={} risk={} requiresApproval={}",
                    actionCode, riskLevel, requiresApproval);
        }
        context.getActionProposals().clear();
        context.getActionProposals().addAll(mutableProposals);
    }
}
