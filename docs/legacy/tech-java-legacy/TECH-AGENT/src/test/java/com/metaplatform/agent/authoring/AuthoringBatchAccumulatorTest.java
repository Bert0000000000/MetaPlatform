package com.metaplatform.agent.authoring;

import com.metaplatform.ont.draft.OntologyDraftEntity;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P6-AUTH-06 AuthoringBatchAccumulator - same-document coalescing.
 */
@DisplayName("P6-AUTH-06 AuthoringBatchAccumulator")
class AuthoringBatchAccumulatorTest {

    private OntologyDraftService draftService;
    private AuthoringService authoringService;
    private AuthoringBatchAccumulator acc;

    @BeforeEach
    void setUp() {
        draftService = Mockito.mock(OntologyDraftService.class);
        authoringService = Mockito.mock(AuthoringService.class);
        acc = new AuthoringBatchAccumulator();
        // buildDraft returns a stub request; submit returns a fake entity.
        when(authoringService.buildDraft(
                Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
                .thenAnswer(inv -> ProposeDraftRequest.builder()
                        .tenantId(inv.getArgument(0))
                        .runId(inv.getArgument(1))
                        .source(inv.getArgument(2))
                        .baseVersion(inv.getArgument(3))
                        .targetVersion(inv.getArgument(4))
                        .summary(inv.getArgument(5))
                        .candidates(inv.getArgument(6))
                        .build());
        OntologyDraftEntity fake = Mockito.mock(OntologyDraftEntity.class);
        when(fake.getId()).thenReturn("DRAFT-FAKE");
        when(authoringService.submit(Mockito.any(ProposeDraftRequest.class))).thenReturn(fake);
    }

    private static CandidateInput cand(String concept, String property, String value, double conf) {
        CandidateInput c = new CandidateInput();
        c.setConceptCode(concept);
        c.setProperty(property);
        c.setProposedValue(value);
        c.setConfidence(conf);
        c.setConflictLevel("NONE");
        c.setEvidenceRefs(List.of("DOC-1"));
        return c;
    }

    @Test
    @DisplayName("enqueue same documentId/tenantId -> one key with many candidates")
    void sameKeyCoalesces() {
        acc.enqueue("T1", "DOC-A", "RUN-1", cand("Contract", "amount", "4800000", 0.95));
        acc.enqueue("T1", "DOC-A", "RUN-1", cand("Contract", "party", "ACME", 0.90));
        acc.enqueue("T1", "DOC-A", "RUN-1", cand("Contract", "date", "2026-12-31", 0.99));

        assertEquals(3, acc.size());
        assertEquals(1, acc.sizeByKey());
    }

    @Test
    @DisplayName("different documentId -> separate keys")
    void differentDocsSeparateKeys() {
        acc.enqueue("T1", "DOC-A", null, cand("Contract", "amount", "1", 0.9));
        acc.enqueue("T1", "DOC-B", null, cand("Contract", "amount", "2", 0.9));
        acc.enqueue("T2", "DOC-A", null, cand("Contract", "amount", "3", 0.9));
        assertEquals(3, acc.size());
        assertEquals(3, acc.sizeByKey());
    }

    @Test
    @DisplayName("flushAll submits each key as a single draft")
    void flushAllSubmitsOncePerKey() {
        acc.enqueue("T1", "DOC-A", "RUN-1", cand("C", "p", "1", 0.9));
        acc.enqueue("T1", "DOC-A", "RUN-1", cand("C", "p", "2", 0.9));
        acc.enqueue("T1", "DOC-B", "RUN-1", cand("C", "p", "3", 0.9));
        acc.enqueue("T2", "DOC-A", null, cand("C", "p", "4", 0.9));

        int submitted = acc.flushAll(authoringService);
        assertEquals(3, submitted, "expected one submit per unique (tenant, documentId) key");
        verify(authoringService, times(3)).submit(Mockito.any(ProposeDraftRequest.class));
        assertTrue(acc.isEmpty(), "buffer must be drained after flushAll");
    }

    @Test
    @DisplayName("flushDue: respect maxAgeMillis - recent entries are kept")
    void flushDueKeepsRecent() throws InterruptedException {
        // Recently enqueued buffer: nothing should be flushed under very large maxAge.
        acc.enqueue("T1", "DOC-A", null, cand("C", "p", "1", 0.9));
        int submittedNow = acc.flushDue(authoringService, 10_000L);
        assertEquals(0, submittedNow, "fresh entries must remain until maxAge elapsed");
        // After 50ms sleep and maxAge=10ms, the entry is now eligible.
        Thread.sleep(50);
        int submittedAfter = acc.flushDue(authoringService, 10L);
        assertEquals(1, submittedAfter);
        assertTrue(acc.isEmpty());
    }

    @Test
    @DisplayName("flushAll: empty buffer returns 0")
    void flushAllEmpty() {
        int submitted = acc.flushAll(authoringService);
        assertEquals(0, submitted);
        verify(authoringService, never()).submit(Mockito.any());
    }

    @Test
    @DisplayName("null AuthoringService is a safe no-op (no NPE)")
    void nullAuthoringServiceIsSafe() {
        acc.enqueue("T1", "DOC-A", null, cand("C", "p", "1", 0.9));
        assertEquals(0, acc.flushDue(null, 0L));
        assertEquals(0, acc.flushAll(null));
        // Buffer is unchanged since no one drained it:
        assertEquals(1, acc.size());
    }

    @Test
    @DisplayName("flushAll captures the merged CandidateInput list with all rows")
    void flushAllMergesCandidates() {
        acc.enqueue("T1", "DOC-A", null, cand("C", "a", "1", 0.9));
        acc.enqueue("T1", "DOC-A", null, cand("C", "b", "2", 0.9));
        acc.enqueue("T1", "DOC-A", null, cand("C", "c", "3", 0.9));
        acc.flushAll(authoringService);
        ArgumentCaptor<ProposeDraftRequest> captor = ArgumentCaptor.forClass(ProposeDraftRequest.class);
        verify(authoringService).submit(captor.capture());
        List<CandidateInput> merged = captor.getValue().getCandidates();
        assertEquals(3, merged.size(), "all candidates for the same key should be merged into one draft");
    }
}
