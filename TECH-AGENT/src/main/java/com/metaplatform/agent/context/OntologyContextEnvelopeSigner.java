package com.metaplatform.agent.context;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;

/** Signs and verifies the runtime envelope; callers must not trust client-supplied permissions. */
@Service
public class OntologyContextEnvelopeSigner {
    private static final String HMAC = "HmacSHA256";
    private final byte[] secret;
    private final Clock clock;

    public OntologyContextEnvelopeSigner(
            @Value("${mate.agent.context-signing-secret:${mate.agent.jwt-secret:change-me-in-production}}") String secret) {
        this(secret, Clock.systemUTC());
    }

    OntologyContextEnvelopeSigner(String secret, Clock clock) {
        if (secret == null || secret.length() < 32) throw new IllegalArgumentException("context signing secret must be at least 32 characters");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.clock = clock;
    }

    public OntologyContextEnvelope sign(OntologyContextEnvelope envelope) {
        String signature = hmac(canonical(envelope));
        return new OntologyContextEnvelope(envelope.envelopeId(), envelope.tenantId(), envelope.userId(), envelope.runId(),
                envelope.subject(), envelope.ontologyVersion(), envelope.schema(), envelope.metrics(), envelope.allowedTools(),
                envelope.allowedActions(), envelope.dataScopes(), envelope.permissionSnapshotId(), envelope.expiresAt(),
                signature, envelope.contractVersion());
    }

    public void verify(OntologyContextEnvelope envelope) {
        if (envelope == null || envelope.signature() == null || envelope.signature().isBlank())
            throw new IllegalArgumentException("signed envelope is required");
        if (envelope.isExpired(OffsetDateTime.now(clock))) throw new IllegalArgumentException("ontology context envelope expired");
        if (!MessageDigest.isEqual(hmac(canonical(envelope)).getBytes(StandardCharsets.US_ASCII), envelope.signature().getBytes(StandardCharsets.US_ASCII)))
            throw new IllegalArgumentException("ontology context envelope signature mismatch");
    }

    private String canonical(OntologyContextEnvelope e) {
        return String.join("|", e.envelopeId(), e.tenantId(), e.userId(), e.runId(), e.subject().conceptCode(),
                e.subject().objectId(), e.ontologyVersion(), e.permissionSnapshotId(), e.expiresAt().toString(),
                String.join(",", e.allowedTools()), String.join(",", e.allowedActions()));
    }
    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC); mac.init(new SecretKeySpec(secret, HMAC));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) { throw new IllegalStateException("unable to sign ontology context envelope", ex); }
    }
}
