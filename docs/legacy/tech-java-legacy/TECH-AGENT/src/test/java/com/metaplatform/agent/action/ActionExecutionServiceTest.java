package com.metaplatform.agent.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.evidence.ClaimService;
import com.metaplatform.agent.evidence.EvidenceService;
import com.metaplatform.agent.runs.AgentRunService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.client.RestClient;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("P5.2 ActionExecutionService")
class ActionExecutionServiceTest {

    private ActionProposalRepository repo;
    private AgentRunService runService;
    private ClaimService claimService;
    private EvidenceService evidenceService;
    private ObjectMapper objectMapper;
    private ActionExecutionService service;

    @BeforeEach
    void setUp() {
        repo = Mockito.mock(ActionProposalRepository.class);
        runService = Mockito.mock(AgentRunService.class);
        claimService = Mockito.mock(ClaimService.class);
        evidenceService = Mockito.mock(EvidenceService.class);
        objectMapper = new ObjectMapper();
        service = new ActionExecutionService(repo, runService, claimService, evidenceService, objectMapper, RestClient.builder().build());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("execute: LOW risk auto-approves and executes")
    void lowRiskAutoExecutes() {
        ActionProposalEntity p = baseProposal(ActionProposalStatus.PROPOSED, false);
        when(repo.findById("p-1")).thenReturn(java.util.Optional.of(p));

        ActionProposalEntity result = service.execute("p-1", "user-1001");

        assertEquals(ActionProposalStatus.EXECUTED, result.getStatus());
        assertNotNull(result.getDecisionAt());
        assertEquals("user-1001", result.getDecidedBy());
        assertTrue(result.getDecisionReason().contains("AUTO_APPROVED"));
    }

    @Test
    @DisplayName("execute: HIGH risk without approval throws 409")
    void highRiskRequiresApproval() {
        ActionProposalEntity p = baseProposal(ActionProposalStatus.PROPOSED, true);
        when(repo.findById("p-2")).thenReturn(java.util.Optional.of(p));

        Phase1Exception ex = assertThrows(Phase1Exception.class, () -> service.execute("p-2", "user-1001"));
        assertEquals("APPROVAL_REQUIRED", ex.getErrorCode());
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("approveAndExecute: APPROVED proposal runs immediately")
    void approvedExecutesImmediately() {
        ActionProposalEntity p = baseProposal(ActionProposalStatus.PROPOSED, true);
        when(repo.findById("p-3")).thenReturn(java.util.Optional.of(p));

        ActionProposalEntity result = service.approveAndExecute("p-3", "manager-1", "approved by manager");

        assertEquals(ActionProposalStatus.EXECUTED, result.getStatus());
        assertEquals("manager-1", result.getDecidedBy());
        assertEquals("approved by manager", result.getDecisionReason());
    }

    @Test
    @DisplayName("reject: PROPOSED -> REJECTED")
    void rejectProposal() {
        ActionProposalEntity p = baseProposal(ActionProposalStatus.PROPOSED, true);
        when(repo.findById("p-4")).thenReturn(java.util.Optional.of(p));

        ActionProposalEntity result = service.reject("p-4", "manager-1", "out of scope");

        assertEquals(ActionProposalStatus.REJECTED, result.getStatus());
        assertEquals("manager-1", result.getDecidedBy());
        assertEquals("out of scope", result.getDecisionReason());
    }

    @Test
    @DisplayName("execute: idempotency returns existing EXECUTED")
    void idempotencyReturnsSameResult() {
        ActionProposalEntity p = baseProposal(ActionProposalStatus.EXECUTED, false);
        when(repo.findById("p-5")).thenReturn(java.util.Optional.of(p));

        ActionProposalEntity result = service.execute("p-5", "user-1001");

        assertEquals(ActionProposalStatus.EXECUTED, result.getStatus());
        verify(repo, never()).save(any());
    }

    private ActionProposalEntity baseProposal(ActionProposalStatus status, boolean approvalRequired) {
        Instant now = Instant.now();
        return ActionProposalEntity.builder()
                .proposalId("p-test")
                .runId("run-1")
                .actionCode("CreateFollowUpTask")
                .targetObjects("[\"CUST-10086\"]")
                .parameters("{}")
                .reason("customer churn risk")
                .evidenceRefs("[\"EVD-1\"]")
                .riskLevel(approvalRequired ? RiskLevel.HIGH : RiskLevel.LOW)
                .approvalRequired(approvalRequired)
                .idempotencyKey("key-" + System.nanoTime())
                .status(status)
                .proposedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
