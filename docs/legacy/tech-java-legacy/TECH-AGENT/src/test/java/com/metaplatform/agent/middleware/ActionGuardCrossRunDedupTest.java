package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalEntity;
import com.metaplatform.agent.action.ActionProposalRepository;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.RiskLevel;
import com.metaplatform.agent.action.ActionProposalStatus;
import com.metaplatform.ont.draft.OntologyDraftService;
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

@DisplayName("P5.10 ActionGuard cross-run dedup")
class ActionGuardCrossRunDedupTest {

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
        when(proposalService.create(any())).thenAnswer(inv -> {
            var req = (com.metaplatform.agent.action.dto.ActionProposalCreateRequest) inv.getArgument(0);
            return com.metaplatform.agent.action.dto.ActionProposalDto.builder()
                    .proposalId("PROP-new")
                    .runId(req.getRunId())
                    .actionCode(req.getActionCode())
                    .build();
        });
        when(approvalBridge.submitForApproval(anyString(), any())).thenReturn("WFE-1");
    }

    @Test
    @DisplayName("cross-run dedup: skips when existing proposal found in DB")
    void crossRunDedupHit() {
        ActionProposalEntity existing = ActionProposalEntity.builder()
                .proposalId("PROP-existing")
                .runId("run-old")
                .actionCode("RequestDiscount")
                .riskLevel(RiskLevel.HIGH)
                .status(ActionProposalStatus.APPROVED)
                .build();
        when(proposalRepository.findRecentForDedup(anyString(), anyString(), anyString()))
                .thenReturn(List.of(existing));

        MiddlewareContext ctx = baseCtx("run-new");
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
        assertEquals(true, ctx.getActionProposals().get(0).get("crossRunDedupHit"));
    }

    @Test
    @DisplayName("cross-run dedup: no match -> LOW risk no create")
    void crossRunDedupNoMatch() {
        when(proposalRepository.findRecentForDedup(anyString(), anyString(), anyString()))
                .thenReturn(List.of());

        MiddlewareContext ctx = baseCtx("run-x");
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

    @Test
    @DisplayName("cross-run dedup: null repository safe")
    void nullRepositorySafe() {
        OntologyActionGuardMiddleware bareGuard = new OntologyActionGuardMiddleware(
                proposalService, approvalBridge, dlqService, null);

        MiddlewareContext ctx = baseCtx("run-y");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH",
                "targetObjects", List.of("CUST-1"),
                "parameters", Map.of(),
                "reason", "test",
                "evidenceRefs", List.of("EVD-1")
        )));
        assertDoesNotThrow(() -> bareGuard.afterExecution(ctx));
    }

    private MiddlewareContext baseCtx(String runId) {
        return MiddlewareContext.builder()
                .tenantId("TENANT-01")
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
