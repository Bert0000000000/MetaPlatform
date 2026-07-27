package com.metaplatform.agent.context;

import org.springframework.stereotype.Component;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Short-lived registry for signed context envelopes referenced by tool calls. */
@Component
public class OntologyContextRegistry {
    private final Map<String, OntologyContextEnvelope> envelopes = new ConcurrentHashMap<>();

    public void put(OntologyContextEnvelope envelope) {
        if (envelope == null) throw new IllegalArgumentException("envelope is required");
        envelopes.put(envelope.envelopeId(), envelope);
    }

    public Optional<OntologyContextEnvelope> get(String envelopeId) {
        var envelope = envelopes.get(envelopeId);
        if (envelope != null && envelope.isExpired(OffsetDateTime.now())) {
            envelopes.remove(envelopeId);
            return Optional.empty();
        }
        return Optional.ofNullable(envelope);
    }

    public void revoke(String envelopeId) { envelopes.remove(envelopeId); }
}
