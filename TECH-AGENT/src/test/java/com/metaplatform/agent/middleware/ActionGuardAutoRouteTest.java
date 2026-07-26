package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.middleware.ActionRouteDlqService;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.dto.ActionProposalCreateRequest;
import com.metaplatform.agent.action.dto.ActionProposalDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P5.5 OntologyActionGuardMiddleware - auto-route HIGH/CRITICAL risk actions to WFE.
 */
@DisplayName("P5.5 ActionGuard auto-route")
class ActionGuardAutoRouteTest {

    private ActionProposalService proposalService;
    private ActionApprovalBridgeService approvalBridge;
    private ActionRouteDlqService dlqService;
    private OntologyActionGuardMiddleware guard;

    @BeforeEach
    void setUp() {
        proposalService = Mockito.mock(ActionProposalService.class);
        approvalBridge = Mockito.mock(ActionApprovalBridgeService.class);
        dlqService = Mockito.mock(ActionRouteDlqService.class);
        guard = new OntologyActionGuardMiddleware(proposalService, approvalBridge, dlqService);

        when(proposalService.create(any())).thenAnswer(inv -> {
            ActionProposalCreateRequest req = inv.getArgument(0);
            return ActionProposalDto.builder()
                    .proposalId("PROP-auto")
                    .runId(req.getRunId())
                    .actionCode(req.getActionCode())
                    .riskLevel(req.getRiskLevel())
                    .approvalRequired(true)
                    .status("PROPOSED")
                    .build();
        });
        when(approvalBridge.submitForApproval(any(), any())).thenReturn("WFE-TASK-1");
    }

    @Test
    @DisplayName("HIGH risk: persists proposal and submits to WFE")
    void highRiskAutoRoutes() {
        MiddlewareContext ctx = baseCtx("run-1001");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH",
                "targetObjects", List.of("CUST-10086"),
                "parameters", Map.of("rate", 0.10),
                "reason", "Customer churn risk",
                "evidenceRefs", List.of("EVD-1")
        )));

        guard.afterExecution(ctx);

        ArgumentCaptor<ActionProposalCreateRequest> captor = ArgumentCaptor.forClass(ActionProposalCreateRequest.class);
        verify(proposalService).create(captor.capture());
        ActionProposalCreateRequest sent = captor.getValue();
        assertEquals("run-1001", sent.getRunId());
        assertEquals("RequestDiscount", sent.getActionCode());
        assertEquals("HIGH", sent.getRiskLevel());

        verify(approvalBridge).submitForApproval("PROP-auto", null);
        Map<String, Object> updated = ctx.getActionProposals().get(0);
        assertEquals(true, updated.get("requiresApproval"));
        assertEquals("PROP-auto", updated.get("proposalId"));
        assertEquals("WFE-TASK-1", updated.get("wfeTaskId"));
    }

    @Test
    @DisplayName("LOW risk: marks requiresApproval=false, no auto-route")
    void lowRiskDoesNotRoute() {
        MiddlewareContext ctx = baseCtx("run-1002");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "CreateFollowUpTask",
                "riskLevel", "LOW",
                "targetObjects", List.of("CUST-10086"),
                "parameters", Map.of(),
                "reason", "quick follow up",
                "evidenceRefs", List.of("EVD-1")
        )));

        guard.afterExecution(ctx);

        verify(proposalService, never()).create(any());
        verify(approvalBridge, never()).submitForApproval(any(), any());
        assertEquals(false, ctx.getActionProposals().get(0).get("requiresApproval"));
    }

    @Test
    @DisplayName("empty actionProposals: no-op")
    void emptyProposalsNoOp() {
        MiddlewareContext ctx = baseCtx("run-1003");
        guard.afterExecution(ctx);
        verify(proposalService, never()).create(any());
        verify(approvalBridge, never()).submitForApproval(any(), any());
    }

    @Test
    @DisplayName("submitForApproval failure: logs error, proposal still persisted")
    void submitFailureHandled() {
        when(approvalBridge.submitForApproval(any(), any())).thenThrow(new RuntimeException("WFE down"));
        MiddlewareContext ctx = baseCtx("run-1004");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH",
                "targetObjects", List.of("CUST-1"),
                "parameters", Map.of(),
                "reason", "test",
                "evidenceRefs", List.of("EVD-1")
        )));

        guard.afterExecution(ctx);

        verify(proposalService).create(any());
        Map<String, Object> updated = ctx.getActionProposals().get(0);
        assertNotNull(updated.get("autoRouteError"));
        assertTrue(String.valueOf(updated.get("autoRouteError")).contains("WFE down"));
    }

    @Test
    @DisplayName("submitForApproval failure: enqueues to DLQ")
    void submitFailureEnqueuesToDlq() {
        when(approvalBridge.submitForApproval(any(), any())).thenThrow(new RuntimeException("WFE down"));
        MiddlewareContext ctx = baseCtx("run-DLQ");
        ctx.getActionProposals().add(new java.util.LinkedHashMap<>(Map.of(
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH",
                "targetObjects", List.of("CUST-1"),
                "parameters", Map.of(),
                "reason", "test",
                "evidenceRefs", List.of("EVD-1")
        )));

        guard.afterExecution(ctx);

        // DLQ should have been enqueued
        verify(dlqService).enqueue(
                org.mockito.ArgumentMatchers.eq("run-DLQ"),
                org.mockito.ArgumentMatchers.eq("PROP-auto"),
                org.mockito.ArgumentMatchers.eq("RequestDiscount"),
                org.mockito.ArgumentMatchers.eq("HIGH"),
                org.mockito.ArgumentMatchers.contains("WFE down"));
    }

    @Test
    @DisplayName("no-arg constructor (test compat): does not throw")
    void noArgConstructorCompat() {
        OntologyActionGuardMiddleware bareGuard = new OntologyActionGuardMiddleware(null, null, null);
        MiddlewareContext ctx = baseCtx("run-1005");
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
                .agentId("customer-copilot")
                .threadId("THREAD-1")
                .runId(runId)
                .userMessage("test")
                .allowedTools(List.of("ontology.*"))
                .claims(new java.util.ArrayList<>())
                .actionProposals(new java.util.ArrayList<>())
                .build();
    }
}
