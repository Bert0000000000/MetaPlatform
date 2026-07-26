package com.metaplatform.ont.context;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.client.IamClient;
import com.metaplatform.ont.action.ActionEntity;
import com.metaplatform.ont.action.ActionService;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.metric.MetricEntity;
import com.metaplatform.ont.metric.MetricService;
import com.metaplatform.ont.security.SnapshotSigner;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyContextService {

    private final ObjectMapper objectMapper;
    private final IamClient iamClient;
    private final MetricService metricService;
    private final ActionService actionService;

    @Value("${mate.ont.context.ttl-seconds:300}")
    private long ttlSeconds;

    @Value("${mate.iam.snapshot.secret:metaplatform-dev-snapshot-secret-2026}")
    private String snapshotSecret;

    public OntologyContextEnvelope build(OntologyContextRequest request) {
        String tenantId = TenantContext.tenantIdOrDefault();
        String userId = request.getUserId() == null ? "anonymous" : request.getUserId();
        String conceptCode = request.getSubject().getConceptCode();
        String objectId = request.getSubject().getObjectId();

        log.info("[OntologyContextService] build tenant={} user={} concept={} object={}",
                tenantId, userId, conceptCode, objectId);

        PermissionSnapshotDto perm = iamClient.buildSnapshot(tenantId, userId, conceptCode, objectId);
        List<MetricEntity> visibleMetrics = metricService.listByConcept(tenantId, conceptCode);
        List<ActionEntity> visibleActions = actionService.listByConcept(tenantId, conceptCode);

        List<String> allowedTools = computeAllowedTools(visibleActions, perm);

        List<String> allowedActions = visibleActions.stream()
                .map(ActionEntity::getActionCode)
                .filter(a -> perm.getAllowedActions() == null || perm.getAllowedActions().contains(a))
                .toList();

        List<String> approvalRequired = visibleActions.stream()
                .map(ActionEntity::getActionCode)
                .filter(a -> a != null && perm.getApprovalRequiredActions() != null
                        && perm.getApprovalRequiredActions().contains(a))
                .toList();

        OntologyContextEnvelope envelope = OntologyContextEnvelope.builder()
                .envelopeId("ENV-" + UUID.randomUUID())
                .tenantId(tenantId)
                .userId(userId)
                .runId(request.getRunId())
                .subject(request.getSubject())
                .schema(OntologyContextEnvelope.Schema.builder()
                        .properties(request.getProperties() == null ? List.of() : request.getProperties())
                        .relationships(request.getRelationships() == null ? List.of() : request.getRelationships())
                        .availableActions(allowedActions)
                        .build())
                .permission(OntologyContextEnvelope.PermissionRef.builder()
                        .snapshotId(perm.getSnapshotId())
                        .dataScope(perm.getDataScope())
                        .deniedFields(perm.getDeniedFields() == null ? List.of() : perm.getDeniedFields())
                        .allowedActions(allowedActions)
                        .approvalRequiredActions(approvalRequired)
                        .allowedRelations(perm.getAllowedRelations() == null ? List.of() : perm.getAllowedRelations())
                        .build())
                .allowedTools(allowedTools)
                .metrics(visibleMetrics.stream().map(MetricEntity::getMetricCode).toList())
                .concepts(List.of(conceptCode))
                .viewState(request.getViewState())
                .expiresAt(Instant.now().plusSeconds(ttlSeconds > 0 ? ttlSeconds : 300))
                .build();

        envelope.setSignature(sign(envelope));
        return envelope;
    }

    public boolean verify(OntologyContextEnvelope envelope) {
        if (envelope == null) {
            return false;
        }
        if (!envelope.isValid()) {
            log.warn("[OntologyContextService] envelope expired id={}", envelope.getEnvelopeId());
            return false;
        }
        String actual = sign(envelope);
        boolean ok = Objects.equals(actual, envelope.getSignature());
        if (!ok) {
            log.warn("[OntologyContextService] signature mismatch id={}", envelope.getEnvelopeId());
        }
        return ok;
    }

    private String sign(OntologyContextEnvelope env) {
        String payload = String.join("|",
                safe(env.getEnvelopeId()),
                safe(env.getTenantId()),
                safe(env.getUserId()),
                safe(env.getSubject() == null ? null : env.getSubject().getConceptCode()),
                safe(env.getSubject() == null ? null : env.getSubject().getObjectId()),
                String.valueOf(env.getExpiresAt() == null ? 0L : env.getExpiresAt().toEpochMilli()));
        return new SnapshotSigner(snapshotSecret).signForContext(payload);
    }

    private static String safe(String s) {
        return s == null ? "" : s.replace('|', '_');
    }

    private List<String> computeAllowedTools(List<ActionEntity> visibleActions, PermissionSnapshotDto perm) {
        Set<String> tools = new LinkedHashSet<>();
        tools.add("ontology.describe_concept");
        tools.add("ontology.describe_relationship");
        tools.add("ontology.describe_metric");
        tools.add("ontology.resolve_object");
        tools.add("ontology.search_objects");
        tools.add("ontology.query_metric");
        tools.add("ontology.compare_objects");
        tools.add("ontology.aggregate_metric");
        tools.add("ontology.explain_metric");
        tools.add("ontology.get_related_objects");
        tools.add("ontology.get_object_timeline");
        tools.add("ontology.attach_evidence");
        tools.add("ontology.get_provenance");
        if (visibleActions != null && perm != null && perm.getAllowedActions() != null) {
            for (ActionEntity a : visibleActions) {
                if ("LOW".equals(a.getRiskLevel()) && perm.getAllowedActions().contains(a.getActionCode())) {
                    tools.add("ontology.action." + a.getActionCode());
                }
            }
        }
        return new ArrayList<>(tools);
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OntologyContextRequest {
        private String userId;
        private String runId;
        private OntologyContextEnvelope.Subject subject;
        private List<String> properties;
        private List<String> relationships;
        private Map<String, Object> viewState;
    }
}