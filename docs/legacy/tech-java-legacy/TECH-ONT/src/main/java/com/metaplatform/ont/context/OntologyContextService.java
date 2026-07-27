package com.metaplatform.ont.context;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.client.IamClient;
import com.metaplatform.ont.action.*;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.metric.*;
import com.metaplatform.ont.security.SnapshotSigner;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j @Service @RequiredArgsConstructor
public class OntologyContextService {
    private final ObjectMapper objectMapper;
    private final IamClient iamClient;
    private final MetricService metricService;
    private final ActionService actionService;
    private final Map<String, OntologyContextEnvelope> envelopeStore = new ConcurrentHashMap<>();

    @Value("${mate.ont.context.ttl-seconds:300}") private long ttlSeconds;
    @Value("${mate.iam.snapshot.secret:metaplatform-dev-snapshot-secret-2026}") private String snapshotSecret;

    public OntologyContextEnvelope build(OntologyContextRequest request) {
        String tenantId = request.getTenantId() == null ? TenantContext.tenantIdOrDefault() : request.getTenantId();
        String userId = request.getUserId() == null ? Optional.ofNullable(TenantContext.getUserId()).orElse("anonymous") : request.getUserId();
        OntologyContextEnvelope.Subject subject = request.getSubject() == null ?
                OntologyContextEnvelope.Subject.builder().conceptCode("unknown").objectId("unknown").build() : request.getSubject();
        String conceptCode = Optional.ofNullable(subject.getConceptCode()).orElse("unknown");
        String objectId = subject.getObjectId();

        PermissionSnapshotDto perm = iamClient.buildSnapshot(tenantId, userId, conceptCode, objectId);
        List<MetricEntity> visibleMetrics = safeMetrics(tenantId, conceptCode);
        List<ActionEntity> visibleActions = safeActions(tenantId, conceptCode);
        List<String> allowedActions = visibleActions.stream().map(ActionEntity::getActionCode)
                .filter(Objects::nonNull).filter(a -> perm.getAllowedActions() == null || perm.getAllowedActions().contains(a)).toList();
        List<String> approvalRequired = visibleActions.stream().map(ActionEntity::getActionCode).filter(Objects::nonNull)
                .filter(a -> perm.getApprovalRequiredActions() != null && perm.getApprovalRequiredActions().contains(a)).toList();
        List<String> metrics = visibleMetrics.stream().map(MetricEntity::getMetricCode).toList();
        String permissionId = Optional.ofNullable(perm.getSnapshotId()).orElse("DEFAULT");
        if (!permissionId.startsWith("PERM-")) permissionId = "PERM-" + permissionId;
        Instant expiresAt = Instant.now().plusSeconds(ttlSeconds > 0 ? ttlSeconds : 300);
        OntologyContextEnvelope envelope = OntologyContextEnvelope.builder()
                .envelopeId("ENV-" + UUID.randomUUID().toString().replace("-", "")).tenantId(tenantId).userId(userId)
                .runId(request.getRunId() == null ? "RUN-" + UUID.randomUUID().toString().replace("-", "") : request.getRunId())
                .principal(OntologyContextEnvelope.Principal.builder().tenantId(tenantId).userId(userId)
                        .roles(request.getPrincipalRoles() == null ? List.of() : request.getPrincipalRoles()).build())
                .subject(subject).schema(OntologyContextEnvelope.Schema.builder()
                        .properties(defaultList(request.getProperties())).relationships(defaultList(request.getRelationships())).metrics(metrics).build())
                .allowedTools(computeAllowedTools(visibleActions, perm)).allowedActions(allowedActions)
                .approvalRequiredActions(approvalRequired)
                .dataScopes(OntologyContextEnvelope.DataScopes.builder().regions(defaultList(perm.getRegions()))
                        .fieldsDenied(defaultList(perm.getDeniedFields())).objectDenied(List.of()).build())
                .permissionSnapshotId(permissionId).expiresAt(expiresAt).build();
        envelope.setPermission(OntologyContextEnvelope.PermissionRef.builder().snapshotId(permissionId).dataScope(perm.getDataScope())
                .deniedFields(defaultList(perm.getDeniedFields())).allowedActions(allowedActions)
                .approvalRequiredActions(approvalRequired).allowedRelations(defaultList(perm.getAllowedRelations())).build());
        envelope.setSignature(new OntologyContextEnvelope.EnvelopeSignature("HS256", "ontology-context-v1", signValue(envelope)));
        envelopeStore.put(envelope.getEnvelopeId(), envelope);
        return envelope;
    }

    public EnvelopeHandle handle(String id) {
        OntologyContextEnvelope envelope = get(id);
        return EnvelopeHandle.builder().envelopeId(id).signature(envelope.getSignature()).expiresAt(envelope.getExpiresAt()).build();
    }
    public OntologyContextEnvelope get(String envelopeId) {
        OntologyContextEnvelope envelope = envelopeStore.get(envelopeId);
        if (envelope == null) throw ContextException.notFound("ENVELOPE_NOT_FOUND", "Envelope not found: " + envelopeId);
        if (!envelope.isValid()) throw ContextException.gone("ENVELOPE_EXPIRED", "Envelope has expired: " + envelopeId);
        if (!verify(envelope)) throw ContextException.forbidden("ENVELOPE_INVALID", "Envelope signature is invalid");
        return envelope;
    }
    public void destroy(String envelopeId, String actor) { OntologyContextEnvelope e = envelopeStore.get(envelopeId); if (e != null) e.setExpiresAt(Instant.MIN); }
    public boolean verify(OntologyContextEnvelope envelope) { return envelope != null && envelope.isValid() && envelope.getSignature() != null
            && Objects.equals(signValue(envelope), envelope.getSignature().getValue()); }

    private String signValue(OntologyContextEnvelope env) {
        String subject = env.getSubject() == null ? "" : Optional.ofNullable(env.getSubject().getConceptCode()).orElse("") + ":" + Optional.ofNullable(env.getSubject().getObjectId()).orElse("");
        String payload = String.join("|", safe(env.getEnvelopeId()), safe(env.getTenantId()), safe(env.getUserId()), safe(subject),
                String.valueOf(env.getExpiresAt() == null ? 0L : env.getExpiresAt().toEpochMilli()));
        return new SnapshotSigner(snapshotSecret).signForContext(payload);
    }
    private static String safe(String s){return s == null ? "" : s.replace('|','_');}
    private static <T> List<T> defaultList(List<T> list){return list == null ? List.of() : list;}
    private List<MetricEntity> safeMetrics(String tenant, String concept){try{return metricService.listByConcept(tenant,concept);}catch(Exception e){return List.of();}}
    private List<ActionEntity> safeActions(String tenant, String concept){try{return actionService.listByConcept(tenant,concept);}catch(Exception e){return List.of();}}
    private List<String> computeAllowedTools(List<ActionEntity> actions, PermissionSnapshotDto perm){
        Set<String> tools = new LinkedHashSet<>(List.of("ontology.describe_concept","ontology.describe_relationship","ontology.describe_metric","ontology.resolve_object"));
        if (actions != null && perm != null && perm.getAllowedActions() != null) actions.stream().filter(a -> "LOW".equals(a.getRiskLevel()))
                .map(ActionEntity::getActionCode).filter(perm.getAllowedActions()::contains).map(a -> "ontology.action." + a).forEach(tools::add);
        return new ArrayList<>(tools);
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OntologyContextRequest {
        private String tenantId; private String userId; private String runId; private String message;
        private List<String> principalRoles; private OntologyContextEnvelope.Subject subject;
        private List<String> properties; private List<String> relationships; private Map<String,Object> viewState;
    }
}
