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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;

@DisplayName("P6.2 AuthoringService")
class AuthoringServiceTest {

    private OntologyDraftService draftService;
    private AuthoringService service;

    @BeforeEach
    void setUp() {
        draftService = Mockito.mock(OntologyDraftService.class);
        Mockito.when(draftService.proposeDraft(any())).thenAnswer(inv -> {
            ProposeDraftRequest req = inv.getArgument(0);
            return OntologyDraftEntity.builder()
                    .id("DRAFT-test-" + System.nanoTime())
                    .tenantId(req.getTenantId())
                    .draftKind("OBJECT")
                    .source(req.getSource())
                    .sourceRunId(req.getRunId())
                    .summary(req.getSummary())
                    .status("DRAFT")
                    .build();
        });
        service = new AuthoringService(draftService, null);
    }

    @Test
    @DisplayName("buildDraft: minimal required fields")
    void buildDraftMinimal() {
        ProposeDraftRequest req = service.buildDraft("TENANT-01", "RUN-1", "AGENT", "v1", "v2", "test summary", List.of());
        assertEquals("TENANT-01", req.getTenantId());
        assertEquals("RUN-1", req.getRunId());
        assertEquals("AGENT", req.getSource());
        assertEquals("v1", req.getBaseVersion());
        assertEquals("v2", req.getTargetVersion());
    }

    @Test
    @DisplayName("buildDraft: null defaults to safe values")
    void buildDraftSafeDefaults() {
        ProposeDraftRequest req = service.buildDraft(null, null, null, null, null, null, null);
        assertEquals("tenant-default", req.getTenantId());
        assertEquals("AGENT", req.getSource());
        assertEquals("v1", req.getBaseVersion());
        assertEquals("v2", req.getTargetVersion());
        assertEquals("Agent Run extraction", req.getSummary());
        assertNotNull(req.getCandidates());
        assertTrue(req.getCandidates().isEmpty());
    }

    @Test
    @DisplayName("buildFromExtraction: maps single candidate correctly")
    void buildFromExtractionSingle() {
        Map<String, Object> extraction = Map.of(
                "candidates", List.of(Map.of(
                        "conceptCode", "Customer",
                        "objectId", "CUST-10086",
                        "property", "churnRisk",
                        "value", "HIGH",
                        "evidenceRef", "DOC-1",
                        "confidence", 0.95,
                        "conflictLevel", "NONE"
                ))
        );
        ProposeDraftRequest req = service.buildFromExtraction("TENANT-01", "RUN-1", "v1", "v2", "summary", extraction);
        assertEquals(1, req.getCandidates().size());
        CandidateInput c = req.getCandidates().get(0);
        assertEquals("Customer", c.getConceptCode());
        assertEquals("CUST-10086", c.getObjectId());
        assertEquals("churnRisk", c.getProperty());
        assertEquals("HIGH", c.getProposedValue());
        assertEquals(0.95, c.getConfidence(), 0.001);
    }

    @Test
    @DisplayName("buildFromExtraction: handles evidenceRefs list")
    void buildFromExtractionEvidenceList() {
        Map<String, Object> extraction = Map.of(
                "candidates", List.of(Map.of(
                        "conceptCode", "Order",
                        "objectId", "ORD-1",
                        "property", "status",
                        "value", "OPEN",
                        "evidenceRefs", List.of("EVD-1", "EVD-2")
                ))
        );
        ProposeDraftRequest req = service.buildFromExtraction("T1", "R1", "v1", "v2", "", extraction);
        CandidateInput c = req.getCandidates().get(0);
        assertEquals(2, c.getEvidenceRefs().size());
        assertTrue(c.getEvidenceRefs().contains("EVD-1"));
    }

    @Test
    @DisplayName("buildFromExtraction: missing candidates -> empty list")
    void buildFromExtractionEmpty() {
        ProposeDraftRequest req = service.buildFromExtraction("T1", "R1", "v1", "v2", "", Map.of());
        assertNotNull(req.getCandidates());
        assertTrue(req.getCandidates().isEmpty());
    }

    @Test
    @DisplayName("submit: forwards to OntologyDraftService and returns draft")
    void submitForwards() {
        ProposeDraftRequest req = service.buildDraft("TENANT-01", "RUN-X", "AGENT", "v1", "v2", "summary", List.of());
        OntologyDraftEntity draft = service.submit(req);
        assertNotNull(draft);
        assertEquals("RUN-X", draft.getSourceRunId());
        ArgumentCaptor<ProposeDraftRequest> captor = ArgumentCaptor.forClass(ProposeDraftRequest.class);
        Mockito.verify(draftService).proposeDraft(captor.capture());
        assertEquals("RUN-X", captor.getValue().getRunId());
    }

    @Test
    @DisplayName("submit: returns null when OntologyDraftService unavailable")
    void submitWithoutDraftService() {
        AuthoringService bareService = new AuthoringService(null, null);
        ProposeDraftRequest req = service.buildDraft("T1", "R1", "AGENT", "v1", "v2", "s", List.of());
        assertNull(bareService.submit(req));
    }
}
