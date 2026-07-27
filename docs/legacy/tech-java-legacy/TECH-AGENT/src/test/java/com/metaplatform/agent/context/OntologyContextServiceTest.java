package com.metaplatform.agent.context;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class OntologyContextServiceTest {
    @Test void buildsSignedServerOwnedEnvelope() {
        var signer = new OntologyContextEnvelopeSigner("01234567890123456789012345678901",
                java.time.Clock.fixed(Instant.parse("2026-07-26T03:00:00Z"), ZoneOffset.UTC));
        var service = new OntologyContextService(signer);
        var input = new InteractionContext("分析客户", new InteractionContext.Interaction("DW", "customer-detail", "/customers/1", null),
                new InteractionContext.Subject("Customer", "cust-1"), Map.of(), "1.0");
        var envelope = service.build("tenant-1", "user-1", "run-1", input, "v1", "perm-1", Map.of(),
                List.of("customer.revenue"), List.of("ontology.get_object"), List.of(), Map.of(), Duration.ofMinutes(5));
        assertEquals("cust-1", envelope.subject().objectId());
        assertTrue(envelope.allowsTool("ontology.get_object"));
        assertFalse(envelope.allowsTool("ontology.delete"));
        assertDoesNotThrow(() -> signer.verify(envelope));
    }

    @Test void rejectsExcessiveTtl() {
        var signer = new OntologyContextEnvelopeSigner("01234567890123456789012345678901");
        var service = new OntologyContextService(signer);
        var input = new InteractionContext("x", null, new InteractionContext.Subject("Customer", "cust-1"), Map.of(), "1.0");
        assertThrows(IllegalArgumentException.class, () -> service.build("t", "u", "r", input, "v1", "p", null, null, null, null, null, Duration.ofHours(2)));
    }
}
