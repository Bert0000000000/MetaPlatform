package com.metaplatform.agent.authoring;

import com.metaplatform.agent.clients.RAGClient;
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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P2-RAG-04 - AuthoringService.submitWithRagBackfill(): end-to-end authoring + RAG search.
 */
@DisplayName("P2-RAG-04 AuthoringService RAG backfill")
class AuthoringServiceRagBackfillTest {

    private OntologyDraftService draftService;
    private RAGClient ragClient;
    private AuthoringService service;

    @BeforeEach
    void setUp() {
        draftService = Mockito.mock(OntologyDraftService.class);
        ragClient = Mockito.mock(RAGClient.class);
        service = new AuthoringService(draftService, ragClient);
        OntologyDraftEntity fake = Mockito.mock(OntologyDraftEntity.class);
        when(fake.getId()).thenReturn("DRAFT-FAKE");
        when(draftService.proposeDraft(any(ProposeDraftRequest.class))).thenReturn(fake);
    }

    private static CandidateInput cand(String concept, String property, Object value) {
        CandidateInput c = new CandidateInput();
        c.setConceptCode(concept);
        c.setProperty(property);
        c.setProposedValue(value);
        c.setConfidence(0.9);
        c.setConflictLevel("NONE");
        return c;
    }

    @Test
    @DisplayName("happy path: candidates without evidence get backfilled from RAG search results")
    void backfillsMissingEvidence() {
        CandidateInput c1 = cand("Contract", "amount", "4800000");
        // c1 has no evidenceRefs; should be backfilled.
        when(ragClient.search(eq("Contract amount 4800000"), any(), eq(3), any(), any()))
                .thenReturn(List.of(
                        Map.of("source", "kb.contract.doc-7"),
                        Map.of("source", "kb.contract.doc-9")
                ));
        ProposeDraftRequest req = service.buildDraft(
                "TENANT-1", "RUN-X", "AGENT", "v1", "v2",
                "extraction", List.of(c1));
        OntologyDraftEntity entity = service.submitWithRagBackfill(req, 3);
        assertNotNull(entity);
        assertEquals(2, c1.getEvidenceRefs().size());
        assertTrue(c1.getEvidenceRefs().contains("kb.contract.doc-7"));
        assertTrue(c1.getEvidenceRefs().contains("kb.contract.doc-9"));
        verify(ragClient, times(1)).search(
                eq("Contract amount 4800000"), any(), eq(3), eq("TENANT-1"), eq("RUN-X"));
    }

    @Test
    @DisplayName("candidates with existing evidenceRefs are kept verbatim (no RAG call)")
    void preservesExistingEvidence() {
        CandidateInput c1 = cand("Contract", "party", "ACME");
        c1.setEvidenceRefs(List.of("existing-source-1"));
        ProposeDraftRequest req = service.buildDraft(
                "TENANT-1", "RUN-X", "AGENT", "v1", "v2",
                "extraction", List.of(c1));
        service.submitWithRagBackfill(req, 3);
        // No RAG call - candidate already cited.
        Mockito.verifyNoInteractions(ragClient);
        assertEquals(List.of("existing-source-1"), c1.getEvidenceRefs());
    }

    @Test
    @DisplayName("RAG throws -> exception is caught and candidate remains without evidence")
    void ragFailureDoesNotAbort() {
        CandidateInput c1 = cand("Contract", "amount", "1");
        CandidateInput c2 = cand("Contract", "date", "2026-12-31");
        when(ragClient.search(eq("Contract amount 1"), any(), anyInt(), any(), any()))
                .thenThrow(new RuntimeException("RAG down"));
        when(ragClient.search(eq("Contract date 2026-12-31"), any(), anyInt(), any(), any()))
                .thenReturn(List.of(Map.of("id", "kb.doc-22")));
        ProposeDraftRequest req = service.buildDraft(
                "TENANT-1", "RUN-X", "AGENT", "v1", "v2",
                "extraction", List.of(c1, c2));
        // Should not throw; failed candidate remains without refs, second one is filled.
        OntologyDraftEntity entity = service.submitWithRagBackfill(req, 3);
        assertNotNull(entity);
        assertTrue(c1.getEvidenceRefs() == null || c1.getEvidenceRefs().isEmpty());
        assertEquals(List.of("kb.doc-22"), c2.getEvidenceRefs());
    }

    @Test
    @DisplayName("no RAGClient wired: falls back to plain submit (no error)")
    void noRagClientSafe() {
        AuthoringService bare = new AuthoringService(draftService, null);
        CandidateInput c1 = cand("Contract", "amount", "1");
        ProposeDraftRequest req = bare.buildDraft(
                "TENANT-1", "RUN-X", "AGENT", "v1", "v2",
                "extraction", List.of(c1));
        assertDoesNotThrow(() -> bare.submitWithRagBackfill(req, 3));
    }

    @Test
    @DisplayName("empty candidates list: returns submit() result; no RAG call")
    void emptyCandidatesSafe() {
        ProposeDraftRequest req = service.buildDraft(
                "TENANT-1", "RUN-X", "AGENT", "v1", "v2",
                "extraction", List.of());
        service.submitWithRagBackfill(req, 3);
        Mockito.verifyNoInteractions(ragClient);
        // draftService.proposeDraft still called for the empty submission.
        verify(draftService, times(1)).proposeDraft(any(ProposeDraftRequest.class));
    }

    private static int anyInt() { return Mockito.anyInt(); }
}
