package com.metaplatform.agent.extraction;

import com.metaplatform.agent.authoring.AuthoringBatchAccumulator;
import com.metaplatform.agent.authoring.AuthoringService;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
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

@DisplayName("P6.3 DocumentCandidateListener")
class DocumentCandidateListenerTest {

    private OntologyDraftService draftService;
    private AuthoringService authoringService;
    private DocumentCandidateListener listener;

    @BeforeEach
    void setUp() {
        draftService = Mockito.mock(OntologyDraftService.class);
        authoringService = Mockito.mock(AuthoringService.class);
        listener = new DocumentCandidateListener(draftService, authoringService);
        when(authoringService.buildFromExtraction(any(), any(), any(), any(), any(), any()))
                .thenAnswer(inv -> ProposeDraftRequest.builder()
                        .tenantId(inv.getArgument(0))
                        .runId(inv.getArgument(1))
                        .baseVersion(inv.getArgument(2))
                        .targetVersion(inv.getArgument(3))
                        .summary(inv.getArgument(4))
                        .build());
    }

    @Test
    @DisplayName("happy path: candidate.ready -> AuthoringService -> submit")
    void happyPath() {
        EventEnvelope<Map<String, Object>> env = envelope("EVT-1", Map.of(
                "tenantId", "TENANT-01",
                "runId", "RUN-EXTRACTION-1",
                "documentId", "DOC-CONTRACT-2026",
                "candidates", List.of(
                        Map.of("conceptCode", "Contract", "objectId", "CONTRACT-1",
                                "property", "amount", "value", "4800000",
                                "evidenceRef", "DOC-CONTRACT-2026", "confidence", 0.95)
                )
        ));
        listener.onCandidateReady(env);

        ArgumentCaptor<ProposeDraftRequest> captor = ArgumentCaptor.forClass(ProposeDraftRequest.class);
        verify(authoringService).submit(captor.capture());
        assertEquals("TENANT-01", captor.getValue().getTenantId());
        assertEquals("RUN-EXTRACTION-1", captor.getValue().getRunId());
        assertTrue(captor.getValue().getSummary().contains("DOC-CONTRACT-2026"));
    }

    @Test
    @DisplayName("empty payload: skip without error")
    void emptyPayload() {
        EventEnvelope<Map<String, Object>> env = envelope("EVT-2", null);
        assertDoesNotThrow(() -> listener.onCandidateReady(env));
        verify(authoringService, never()).submit(any());
    }

    @Test
    @DisplayName("missing candidates: skip without error")
    void missingCandidates() {
        EventEnvelope<Map<String, Object>> env = envelope("EVT-3",
                Map.of("tenantId", "T1", "documentId", "DOC-1"));
        listener.onCandidateReady(env);
        verify(authoringService, never()).submit(any());
    }

    @Test
    @DisplayName("AuthoringService unavailable: log warning, no error")
    void authoringServiceUnavailable() {
        DocumentCandidateListener bareListener = new DocumentCandidateListener(null, null);
        EventEnvelope<Map<String, Object>> env = envelope("EVT-4", Map.of(
                "tenantId", "T1",
                "documentId", "DOC-1",
                "candidates", List.of(Map.of("conceptCode", "C"))));
        assertDoesNotThrow(() -> bareListener.onCandidateReady(env));
    }

    @Test
    @DisplayName("candidates is non-List: skip")
    void candidatesNotList() {
        EventEnvelope<Map<String, Object>> env = envelope("EVT-5",
                Map.of("tenantId", "T1", "candidates", "not a list"));
        listener.onCandidateReady(env);
        verify(authoringService, never()).submit(any());
    }

    @Test
    @DisplayName("P6-AUTH-06 BATCHED mode: enqueues + flushes via accumulator (no immediate submit)")
    void batchedModeRoutesThroughAccumulator() {
        AuthoringBatchAccumulator acc = Mockito.mock(AuthoringBatchAccumulator.class);
        Mockito.when(acc.flushAll(authoringService)).thenReturn(1);
        DocumentCandidateListener batched = new DocumentCandidateListener(
                null, authoringService, acc, DocumentCandidateListener.FlushMode.BATCHED);
        EventEnvelope<Map<String, Object>> env = envelope("EVT-9", Map.of(
                "tenantId", "TENANT-09",
                "runId", "RUN-BATCH-1",
                "documentId", "DOC-BATCH-9",
                "candidates", List.of(
                        Map.of("conceptCode", "Contract", "objectId", "C-9", "property", "amount",
                                "value", "4800000", "evidenceRef", "DOC-BATCH-9", "confidence", 0.95)
                )
        ));
        batched.onCandidateReady(env);
        // Immediate submit is bypassed.
        Mockito.verify(authoringService, Mockito.never()).submit(Mockito.any());
        // BATCHED path delegated to accumulator.
        Mockito.verify(acc).enqueue(Mockito.eq("TENANT-09"), Mockito.eq("DOC-BATCH-9"),
                Mockito.eq("RUN-BATCH-1"), Mockito.any());
        Mockito.verify(acc).flushAll(authoringService);
    }

    @Test
    @DisplayName("P6-AUTH-06 IMMEDIATE mode (default): still submits inline; accumulator untouched")
    void immediateModeBypassesAccumulator() {
        AuthoringBatchAccumulator acc = Mockito.mock(AuthoringBatchAccumulator.class);
        // Even with an accumulator injected, IMMEDIATE mode must NOT use it.
        DocumentCandidateListener immediate = new DocumentCandidateListener(
                null, authoringService, acc, DocumentCandidateListener.FlushMode.IMMEDIATE);
        EventEnvelope<Map<String, Object>> env = envelope("EVT-10", Map.of(
                "tenantId", "TENANT-10",
                "runId", "RUN-IMMEDIATE-1",
                "documentId", "DOC-IMMEDIATE-10",
                "candidates", List.of(
                        Map.of("conceptCode", "Contract", "objectId", "C-10", "property", "amount",
                                "value", "12000", "evidenceRef", "DOC-IMMEDIATE-10", "confidence", 0.95)
                )
        ));
        immediate.onCandidateReady(env);
        verify(authoringService, Mockito.times(1)).submit(Mockito.any());
        Mockito.verifyNoInteractions(acc);
    }

    @Test
    @DisplayName("flushMode(String): parses names case-insensitively; null -> IMMEDIATE")
    void flushModeStaticAccessor() {
        assertEquals(DocumentCandidateListener.FlushMode.IMMEDIATE, DocumentCandidateListener.flushMode(null));
        assertEquals(DocumentCandidateListener.FlushMode.IMMEDIATE, DocumentCandidateListener.flushMode("unknown"));
        assertEquals(DocumentCandidateListener.FlushMode.BATCHED, DocumentCandidateListener.flushMode("batched"));
        assertEquals(DocumentCandidateListener.FlushMode.BATCHED, DocumentCandidateListener.flushMode("BATCHED"));
    }

    private EventEnvelope<Map<String, Object>> envelope(String id, Map<String, Object> payload) {
        return new EventEnvelope<>(id, "kb.document.candidate.ready",
                "TENANT-01", "TRACE-1", "TECH-RAG",
                java.time.Instant.now(), payload);
    }
}
