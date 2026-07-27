package com.metaplatform.agent.context;

import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class OntologyContextEnvelopeSignerTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-26T03:00:00Z"), ZoneOffset.UTC);

    @Test void signsAndVerifiesEnvelope() {
        var signer = new OntologyContextEnvelopeSigner("01234567890123456789012345678901", CLOCK);
        var signed = signer.sign(envelope(OffsetDateTime.parse("2026-07-26T04:00:00Z")));
        assertNotNull(signed.signature());
        assertDoesNotThrow(() -> signer.verify(signed));
    }

    @Test void rejectsTamperingAndExpiry() {
        var signer = new OntologyContextEnvelopeSigner("01234567890123456789012345678901", CLOCK);
        var signed = signer.sign(envelope(OffsetDateTime.parse("2026-07-26T04:00:00Z")));
        var tampered = new OntologyContextEnvelope(signed.envelopeId(), signed.tenantId(), signed.userId(), signed.runId(), signed.subject(),
                signed.ontologyVersion(), signed.schema(), signed.metrics(), List.of("ontology.delete"), signed.allowedActions(), signed.dataScopes(),
                signed.permissionSnapshotId(), signed.expiresAt(), signed.signature(), signed.contractVersion());
        assertThrows(IllegalArgumentException.class, () -> signer.verify(tampered));
        var expired = signer.sign(envelope(OffsetDateTime.parse("2026-07-26T02:59:59Z")));
        assertThrows(IllegalArgumentException.class, () -> signer.verify(expired));
    }

    private OntologyContextEnvelope envelope(OffsetDateTime expiresAt) {
        return new OntologyContextEnvelope("env-1", "tenant-1", "user-1", "run-1",
                new InteractionContext.Subject("Customer", "cust-1"), "v1", Map.of(), List.of("customer.revenue"),
                List.of("ontology.get_object"), List.of(), Map.of(), "perm-1", expiresAt, null, "1.0");
    }
}
