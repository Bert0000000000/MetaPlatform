package com.metaplatform.agent.runs;

import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.authoring.AuthoringService;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.ont.draft.OntologyDraftService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P6.4 AgentRunService.complete() - lifecycle closure + Authoring hook.
 */
@DisplayName("P6.4 AgentRunService.complete")
class AgentRunServiceCompleteTest {

    private AgentRunRepository runRepository;
    private RunEventService runEventService;
    private AuthoringService authoringService;
    private TokenBudgetEnforcer tokenBudgetEnforcer;
    private AgentRunService service;

    @BeforeEach
    void setUp() {
        runRepository = Mockito.mock(AgentRunRepository.class);
        runEventService = Mockito.mock(RunEventService.class);
        authoringService = Mockito.mock(AuthoringService.class);
        tokenBudgetEnforcer = Mockito.mock(TokenBudgetEnforcer.class);
        Mockito.when(tokenBudgetEnforcer.check(Mockito.any(), Mockito.anyInt(), Mockito.anyLong()))
                .thenReturn(TokenBudgetEnforcer.EnforcementResult.allowed());
        var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        service = new AgentRunService(runRepository, objectMapper, runEventService, authoringService, tokenBudgetEnforcer);
        TenantContext.setTenantId("TENANT-01");
        TenantContext.setUserId("user-1001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("complete: marks COMPLETED, records event")
    void completeMarksStatus() {
        AgentRunEntity run = baseRunWithId("RUN-1");
        when(runRepository.findById("RUN-1")).thenReturn(Optional.of(run));
        when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.complete("RUN-1", "COMPLETED", "final answer", null, null);

        assertEquals("COMPLETED", result.getStatus());
        assertNotNull(result.getFinishedAt());
        verify(runEventService).record(any(), org.mockito.ArgumentMatchers.eq("RUN_COMPLETED"), any());
    }

    @Test
    @DisplayName("complete: FAILED status + errorCode/Message")
    void completeFailedStatus() {
        AgentRunEntity run = baseRunWithId("RUN-2");
        when(runRepository.findById("RUN-2")).thenReturn(Optional.of(run));
        when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.complete("RUN-2", "FAILED", null, "E_TIMEOUT", "Tool call timed out");

        assertEquals("FAILED", result.getStatus());
        verify(runEventService).record(any(), org.mockito.ArgumentMatchers.eq("RUN_FAILED"), any());
    }

    @Test
    @DisplayName("complete: invalid status throws 400")
    void completeInvalidStatus() {
        AgentRunEntity run = baseRunWithId("RUN-3");
        when(runRepository.findById("RUN-3")).thenReturn(Optional.of(run));

        Phase1Exception ex = assertThrows(Phase1Exception.class,
                () -> service.complete("RUN-3", "PENDING", "", null, null));
        assertEquals("INVALID_RUN_STATUS", ex.getErrorCode());
    }

    @Test
    @DisplayName("complete: answer with @candidates marker triggers Authoring")
    void completeTriggersAuthoringWithMarker() {
        AgentRunEntity run = baseRunWithId("RUN-4");
        when(runRepository.findById("RUN-4")).thenReturn(Optional.of(run));
        when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.complete("RUN-4", "COMPLETED", "@candidates extracted 3 facts", null, null);

        verify(authoringService).buildFromExtraction(any(), org.mockito.ArgumentMatchers.eq("RUN-4"), any(), any(), any(), any());
        verify(authoringService).submit(any());
    }

    @Test
    @DisplayName("complete: answer without marker does NOT trigger Authoring")
    void completeWithoutMarkerSkipsAuthoring() {
        AgentRunEntity run = baseRunWithId("RUN-5");
        when(runRepository.findById("RUN-5")).thenReturn(Optional.of(run));
        when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.complete("RUN-5", "COMPLETED", "just a regular answer", null, null);

        verify(authoringService, never()).submit(any());
    }

    @Test
    @DisplayName("complete: empty answer does NOT trigger Authoring")
    void completeEmptyAnswerSkipsAuthoring() {
        AgentRunEntity run = baseRunWithId("RUN-6");
        when(runRepository.findById("RUN-6")).thenReturn(Optional.of(run));
        when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.complete("RUN-6", "COMPLETED", "", null, null);

        verify(authoringService, never()).submit(any());
    }

    @Test
    @DisplayName("complete: AuthoringService failure does not break run closure")
    void completeAuthoringFailureHandled() {
        AgentRunEntity run = baseRunWithId("RUN-7");
        when(runRepository.findById("RUN-7")).thenReturn(Optional.of(run));
        when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Mockito.doThrow(new RuntimeException("draft service down")).when(authoringService).submit(any());

        // Should NOT throw - run closure is more important than authoring
        var result = assertDoesNotThrow(() -> service.complete("RUN-7", "COMPLETED", "@kb-extract findings", null, null));
        assertEquals("COMPLETED", result.getStatus());
    }

    private AgentRunEntity baseRun() {
        return baseRunWithId("RUN-X");
    }

    private AgentRunEntity baseRunWithId(String runId) {
        Instant now = Instant.now();
        return AgentRunEntity.builder()
                .runId(runId)
                .tenantId("TENANT-01")
                .userId("user-1001")
                .agentId("agent")
                .runtimeType("DEERFLOW")
                .status("RUNNING")
                .goal("test")
                .budget("{}")
                .traceId("TRACE-X")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    @DisplayName("P-NLB-01 7-arg overload: budget ok -> COMPLETED preserved")
    void budgetOkPassesThrough() {
        var run = AgentRunEntity.builder().runId("RUN-NLB-1").tenantId("TENANT-01").userId("user-1001")
                .agentId("agent-1").runtimeType("DEERFLOW").status("RUNNING").goal("g").traceId("t")
                .budget("{}").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        Mockito.when(runRepository.findById("RUN-NLB-1")).thenReturn(Optional.of(run));
        Mockito.when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        var result = service.complete("RUN-NLB-1", "COMPLETED", "done", null, null, 0, 0L);
        assertEquals("COMPLETED", result.getStatus());
        Mockito.verify(tokenBudgetEnforcer).check(any(), Mockito.eq(0), Mockito.eq(0L));
    }

    @Test
    @DisplayName("P-NLB-01 7-arg overload: budget violated -> DEGRADED + BUDGET_EXCEEDED")
    void budgetViolationForcesDegraded() {
        var run = AgentRunEntity.builder().runId("RUN-NLB-2").tenantId("TENANT-01").userId("user-1001")
                .agentId("agent-1").runtimeType("DEERFLOW").status("RUNNING").goal("g").traceId("t")
                .budget("{}").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        Mockito.when(runRepository.findById("RUN-NLB-2")).thenReturn(Optional.of(run));
        Mockito.when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Mockito.when(tokenBudgetEnforcer.check(any(), Mockito.anyInt(), Mockito.anyLong()))
                .thenReturn(TokenBudgetEnforcer.EnforcementResult.denied("TOKENS", 1000L));
        var result = service.complete("RUN-NLB-2", "COMPLETED", "answer", null, null, 5000, 0L);
        assertEquals("DEGRADED", result.getStatus());
        assertEquals("BUDGET_EXCEEDED", result.getErrorCode());
        assertTrue(result.getErrorMessage().contains("TOKENS"));
    }
}
