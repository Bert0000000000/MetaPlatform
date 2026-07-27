package com.metaplatform.agent.context;

import com.metaplatform.agent.execution.ExecuteContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;

/** Converts transport execution context into signed ontology context when a subject is present. */
@Component
@RequiredArgsConstructor
public class OntologyExecutionContextFactory {
    private final OntologyContextService contextService;
    private final PermissionSnapshotResolver permissionResolver;
    private final OntologyContextRegistry contextRegistry;

    public OntologyContextEnvelope build(String tenantId, String runId, ExecuteContext context) {
        if (context == null || context.getVariables() == null) return null;
        String concept = value(context.getVariables(), "conceptCode");
        String objectId = value(context.getVariables(), "objectId");
        if (concept == null || objectId == null) return null;
        String message = value(context.getVariables(), "message");
        var interaction = new InteractionContext(message == null ? "contextual request" : message,
                new InteractionContext.Interaction(value(context.getVariables(), "appCode"), value(context.getVariables(), "pageCode"), null, null),
                new InteractionContext.Subject(concept, objectId), context.getVariables(), "1.0");
        var permissions = permissionResolver.resolve(tenantId, context.getUserId(), interaction.subject());
        var envelope = contextService.build(tenantId, context.getUserId(), runId, interaction, "default", permissions,
                Map.of(), java.util.List.of(), Duration.ofMinutes(5));
        contextRegistry.put(envelope);
        return envelope;
    }

    private static String value(Map<String, Object> values, String key) {
        Object value = values.get(key);
        return value == null ? null : String.valueOf(value).trim();
    }
}
