package com.metaplatform.agent.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("P5.3 ActionApprovalBridge")
class ActionApprovalBridgeServiceTest {

    private ActionExecutionService executionService;
    private ActionProposalRepository repo;
    private ObjectMapper objectMapper;
    private ActionApprovalBridgeService bridge;

    @BeforeEach
    void setUp() {
        executionService = Mockito.mock(ActionExecutionService.class);
        repo = Mockito.mock(ActionProposalRepository.class);
        objectMapper = new ObjectMapper();
        bridge = new ActionApprovalBridgeService(executionService, repo, objectMapper, RestClient.builder().build());
    }

    @Test
    @DisplayName("onWfeApproved: delegates to execute")
    void onWfeApprovedDelegates() {
        ActionProposalEntity p = baseProposal(true);
        when(executionService.approveAndExecute("p-1", "manager-1", "approved"))
                .thenReturn(p);
        ActionProposalEntity result = bridge.onWfeApproved("p-1", "manager-1", "approved");
        assertNotNull(result);
        verify(executionService).approveAndExecute("p-1", "manager-1", "approved");
    }

    @Test
    @DisplayName("onWfeRejected: delegates to reject")
    void onWfeRejectedDelegates() {
        ActionProposalEntity p = baseProposal(true);
        when(executionService.reject("p-2", "manager-1", "out of scope"))
                .thenReturn(p);
        bridge.onWfeRejected("p-2", "manager-1", "out of scope");
        verify(executionService).reject("p-2", "manager-1", "out of scope");
    }

    @Test
    @DisplayName("submitForApproval: LOW risk returns null (no WFE routing)")
    void lowRiskNoWfeRouting() {
        ActionProposalEntity p = baseProposal(false);
        when(repo.findById("p-3")).thenReturn(Optional.of(p));
        String result = bridge.submitForApproval("p-3", "user-1001");
        assertNull(result);
    }

    @Test
    @DisplayName("submitForApproval: missing proposal throws 404")
    void missingProposalThrows() {
        when(repo.findById("missing")).thenReturn(Optional.empty());
        Phase1Exception ex = assertThrows(Phase1Exception.class,
                () -> bridge.submitForApproval("missing", "user-1001"));
        assertEquals("PROPOSAL_NOT_FOUND", ex.getErrorCode());
        verify(executionService, never()).approveAndExecute(any(), any(), any());
    }

    private ActionProposalEntity baseProposal(boolean approvalRequired) {
        Instant now = Instant.now();
        return ActionProposalEntity.builder()
                .proposalId("p-test")
                .runId("run-1")
                .actionCode("CreateFollowUpTask")
                .targetObjects("[]")
                .parameters("{}")
                .reason("high risk action")
                .evidenceRefs("[]")
                .riskLevel(approvalRequired ? RiskLevel.HIGH : RiskLevel.LOW)
                .approvalRequired(approvalRequired)
                .idempotencyKey("k-" + System.nanoTime())
                .status(ActionProposalStatus.PROPOSED)
                .proposedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
