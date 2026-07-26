package com.metaplatform.agent.context;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Builds the server-owned ontology context from a frontend interaction and resolved permissions. */
@Service
@RequiredArgsConstructor
public class OntologyContextService {
    private final OntologyContextEnvelopeSigner signer;
    private final Clock clock = Clock.systemUTC();

    public OntologyContextEnvelope build(String tenantId, String userId, String runId,
                                         InteractionContext interaction, String ontologyVersion,
                                         String permissionSnapshotId, Map<String, Object> schema,
                                         List<String> metrics, List<String> allowedTools,
                                         List<String> allowedActions, Map<String, Object> dataScopes,
                                         Duration ttl) {
        if (ttl == null || ttl.isNegative() || ttl.isZero() || ttl.compareTo(Duration.ofHours(1)) > 0) {
            throw new IllegalArgumentException("context ttl must be between 1 second and 1 hour");
        }
        var envelope = new OntologyContextEnvelope(
                "env-" + UUID.randomUUID(), tenantId, userId, runId, interaction.subject(), ontologyVersion,
                schema == null ? Map.of() : Map.copyOf(schema),
                metrics == null ? List.of() : List.copyOf(metrics),
                allowedTools == null ? List.of() : List.copyOf(allowedTools),
                allowedActions == null ? List.of() : List.copyOf(allowedActions),
                dataScopes == null ? Map.of() : Map.copyOf(dataScopes), permissionSnapshotId,
                OffsetDateTime.now(clock).plus(ttl), null, interaction.contractVersion());
        return signer.sign(envelope);
    }
}
