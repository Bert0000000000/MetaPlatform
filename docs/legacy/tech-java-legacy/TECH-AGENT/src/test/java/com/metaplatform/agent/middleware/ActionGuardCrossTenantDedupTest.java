package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalEntity;
import com.metaplatform.agent.action.ActionProposalRepository;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.RiskLevel;
import com.metaplatform.agent.action.ActionProposalStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("P5.12 ActionGuard cross-tenant dedup")
class ActionGuardCrossTenantDedupTest {

    private ActionProposalService proposalService;
    private ActionApprovalBridgeService approvalBridge;
    private ActionRouteDlqService dlqService;
    private ActionProposalRepository proposalRepository;
    private OntologyActionGuardMiddleware guard;

    @BeforeEach
    void setUp() {
        proposalService = Mockito.mock(ActionProposalService.class);
        approvalBridge = Mockito.mock(ActionApprovalBridgeService.class);
        dlqService = Mockito.mock(ActionRouteDlqService.class);
        proposalRepository = Mockito.mock(ActionProposalRepository.class);
        guard = new OntologyActionGuardMiddleware(proposalService, approvalBridge, dlqService, proposalRepository);
    }

    @Test
    @DisplayName("cross-tenant dedup: skips when same tenant+run+action+target exists")
    void crossTenantDedupHit() {
        ActionProposalEntity existing = ActionProposalEntity.builder()
                .proposalId("PROP-existing")
                .tenantId("TENANT-01")
                .runId("run-1")
                .actionCode("RequestDiscount")
                .riskLevel(RiskLevel.HIGH)
                .status(ActionProposalStatus.APPROVED)
                .build();
        when(proposalRepository.findRecentForTenantDedup(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(List.of(existing));

        MiddlewareContext ctx = baseCtx("TENANT-01", "run-1");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH",
                "targetObjects", List.of("CUST-1"),
                "parameters", Map.of(),
                "reason", "test",
                "evidenceRefs", List.of("EVD-1")
        )));

        guard.afterExecution(ctx);

        verify(proposalService, never()).create(any());
        verify(approvalBridge, never()).submitForApproval(anyString(), any());
        assertEquals("PROP-existing", ctx.getActionProposals().get(0).get("proposalId"));
        assertEquals(true, ctx.getActionProposals().get(0).get("crossTenantDedupHit"));
    }

    @Test
    @DisplayName("cross-tenant dedup: no match -> creates new proposal")
    void crossTenantDedupNoMatch() {
        when(proposalRepository.findRecentForTenantDedup(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(List.of());

        MiddlewareContext ctx = baseCtx("TENANT-02", "run-1");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "CreateFollowUpTask",
                "riskLevel", "LOW",
                "targetObjects", List.of("CUST-1"),
                "parameters", Map.of(),
                "reason", "test",
                "evidenceRefs", List.of("EVD-1")
        )));

        guard.afterExecution(ctx);

        verify(proposalService, never()).create(any());
    }

    private MiddlewareContext baseCtx(String tenantId, String runId) {
        return MiddlewareContext.builder()
                .tenantId(tenantId)
                .userId("user-1001")
                .agentId("agent")
                .threadId("THREAD-1")
                .runId(runId)
                .userMessage("test")
                .allowedTools(List.of("ontology.*"))
                .claims(new java.util.ArrayList<>())
                .actionProposals(new java.util.ArrayList<>())
                .build();
    }
}
