package com.metaplatform.agent.tools;

import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.context.*;
import com.metaplatform.agent.clients.OntologyClient;
import com.metaplatform.agent.evidence.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class GroundToolServiceTest {
    @Test void verifiesEnvelopeAndAllowlist() {
        var signer = new OntologyContextEnvelopeSigner("01234567890123456789012345678901");
        var registry = new OntologyContextRegistry();
        var envelope = signer.sign(new OntologyContextEnvelope("env-1", "t", "u", "r",
                new InteractionContext.Subject("Customer", "c1"), "v1", Map.of(), List.of(),
                List.of("ontology.query_metric"), List.of(), Map.of(), "p", OffsetDateTime.now().plusMinutes(5), null, "1.0"));
        registry.put(envelope);
        var client = mock(OntologyClient.class);
        when(client.invokeGroundTool(anyString(), anyString(), anyMap(), anyString(), anyString()))
                .thenReturn(Map.of("value", 42));
        var evidenceService = mock(EvidenceService.class);
        var claimService = mock(com.metaplatform.agent.evidence.ClaimService.class);
        when(evidenceService.captureToolResult(anyString(), anyString(), anyString(), anyMap(), anyMap()))
                .thenReturn(EvidenceEntity.builder().evidenceId("EVD-1").build());
        when(claimService.createToolClaim(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(com.metaplatform.agent.evidence.ClaimEntity.builder().claimId("CLM-1").build());
        var service = new GroundToolService(registry, signer, client, evidenceService, claimService);
        var result = service.invoke("ontology.query_metric", new GroundToolRequest("env-1", Map.of("metric", "revenue")));
        assertEquals("v1", result.get("ontologyVersion"));
        assertThrows(Phase1Exception.class, () -> service.invoke("ontology.fetch_evidence",
                new GroundToolRequest("env-1", Map.of())));
    }
}
