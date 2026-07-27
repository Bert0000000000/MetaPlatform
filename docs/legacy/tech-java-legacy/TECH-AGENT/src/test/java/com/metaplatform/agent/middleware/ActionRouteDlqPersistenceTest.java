package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.ont.draft.OntologyDraftService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P5.7 ActionRouteDlqService - persistent DLQ with in-memory fallback.
 */
@DisplayName("P5.7 ActionRoute DLQ persistence")
class ActionRouteDlqPersistenceTest {

    private ActionProposalService proposalService;
    private ActionApprovalBridgeService approvalBridge;
    private ActionRouteDlqRepository repository;
    private ActionRouteDlqService service;

    private java.util.List<ActionRouteDlqEntity> savedEntities = new java.util.ArrayList<>();
    private java.util.concurrent.atomic.AtomicLong nextId = new java.util.concurrent.atomic.AtomicLong(1);

    @BeforeEach
    void setUp() {
        proposalService = Mockito.mock(ActionProposalService.class);
        approvalBridge = Mockito.mock(ActionApprovalBridgeService.class);
        repository = Mockito.mock(ActionRouteDlqRepository.class);
        service = new ActionRouteDlqService(proposalService, approvalBridge, null, repository);
        savedEntities.clear();
        when(repository.save(any())).thenAnswer(inv -> {
            Object arg = inv.getArgument(0);
            if (arg == null) return null;
            ActionRouteDlqEntity e = (ActionRouteDlqEntity) arg;
            if (e.getId() == null) e.setId(nextId.getAndIncrement());
            savedEntities.add(e);
            return e;
        });
        when(repository.findAll()).thenAnswer(inv -> new java.util.ArrayList<>(savedEntities));
    }

    @Test
    @DisplayName("enqueue: persists to DB and in-memory")
    void enqueuePersists() {
        service.enqueue("run-1", "PROP-1", "RequestDiscount", "HIGH", "WFE down");

        ArgumentCaptor<ActionRouteDlqEntity> captor = ArgumentCaptor.forClass(ActionRouteDlqEntity.class);
        verify(repository).save(captor.capture());
        ActionRouteDlqEntity saved = captor.getValue();
        assertEquals("PROP-1", saved.getProposalId());
        assertEquals("run-1", saved.getRunId());
        assertEquals("RequestDiscount", saved.getActionCode());
        assertEquals("HIGH", saved.getRiskLevel());
        assertEquals(0, saved.getRetryCount());
        assertNotNull(saved.getFailedAt());
        assertNull(saved.getResolvedAt());

        assertEquals(1, service.size());
    }

    @Test
    @DisplayName("enqueue: continues when DB save fails (in-memory kept)")
    void enqueueResilient() {
        when(repository.save(any())).thenThrow(new RuntimeException("DB down"));
        assertDoesNotThrow(() -> service.enqueue("run-2", "PROP-2", "X", "LOW", "transient"));
        assertEquals(1, service.size());
    }

    @Test
    @DisplayName("retry: increments retry count + marks SUCCESS")
    void retryMarksSuccess() {
        service.enqueue("run-3", "PROP-3", "RequestDiscount", "HIGH", "first failure");
        long id = savedEntities.get(0).getId();
        when(approvalBridge.submitForApproval(any(), any())).thenReturn("WFE-X");

        String wfe = service.retry(id);

        assertEquals("WFE-X", wfe);
        verify(repository).incrementRetryCount(eq(id), any(Instant.class));
        verify(repository).markResolved(eq(id), any(Instant.class), eq("SUCCESS"));
        assertEquals(0, service.size());
    }

    @Test
    @DisplayName("retry: marks FAILED on second failure")
    void retryMarksFailed() {
        service.enqueue("run-4", "PROP-4", "X", "HIGH", "fail");
        long id = savedEntities.get(0).getId();
        when(approvalBridge.submitForApproval(any(), any())).thenThrow(new RuntimeException("still down"));

        String wfe = service.retry(id);
        assertNull(wfe);
        verify(repository).markResolved(eq(id), any(Instant.class), eq("FAILED"));
    }

    @Test
    @DisplayName("discard: marks DISCARDED")
    void discardMarksDiscarded() {
        service.enqueue("run-5", "PROP-5", "X", "LOW", "noise");
        long id = savedEntities.get(0).getId();

        boolean ok = service.discard(id);
        assertTrue(ok);
        verify(repository).markResolved(eq(id), any(Instant.class), eq("DISCARDED"));
        assertEquals(0, service.size());
    }

    @Test
    @DisplayName("getPending: queries DB when available, falls back to in-memory on failure")
    void getPendingWithDbFallback() {
        when(repository.findAll()).thenReturn(List.of(
                ActionRouteDlqEntity.builder().id(100L).tenantId("T1").runId("r1").proposalId("P1")
                        .actionCode("A1").riskLevel("HIGH").reason("err")
                        .failedAt(Instant.now()).retryCount(0).createdAt(Instant.now()).updatedAt(Instant.now()).build()
        ));
        var pending = service.getPending();
        assertEquals(1, pending.size());
        assertEquals(100L, pending.get(0).id());
    }

    @Test
    @DisplayName("getPending: falls back to in-memory when DB read fails")
    void getPendingDbFailureFallback() {
        when(repository.findAll()).thenThrow(new RuntimeException("DB timeout"));
        service.enqueue("run-7", "PROP-7", "X", "LOW", "err");

        var pending = service.getPending();
        assertEquals(1, pending.size());
        assertEquals("PROP-7", pending.get(0).proposalId());
    }

    @Test
    @DisplayName("without repository: still works in-memory only")
    void noRepositoryFallback() {
        ActionRouteDlqService bareService = new ActionRouteDlqService(proposalService, approvalBridge, null, null);
        bareService.enqueue("run-8", "PROP-8", "X", "LOW", "err");
        assertEquals(1, bareService.size());
    }
}
