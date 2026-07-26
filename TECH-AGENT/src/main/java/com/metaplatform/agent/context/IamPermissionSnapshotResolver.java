package com.metaplatform.agent.context;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.config.AgentProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.List;
import java.util.Map;

/** IAM-backed resolver with a secure deny-by-default fallback when IAM is not configured. */
@Component
@Primary
public class IamPermissionSnapshotResolver implements PermissionSnapshotResolver {
    private final AgentProperties properties;
    private final ObjectMapper mapper;
    @Qualifier("iamWebClient") private final WebClient client;
    @Qualifier("denyByDefaultPermissionSnapshotResolver") private final PermissionSnapshotResolver fallback;

    public IamPermissionSnapshotResolver(AgentProperties properties, ObjectMapper mapper,
                                         @Qualifier("iamWebClient") WebClient client,
                                         @Qualifier("denyByDefaultPermissionSnapshotResolver") PermissionSnapshotResolver fallback) {
        this.properties = properties; this.mapper = mapper; this.client = client; this.fallback = fallback;
    }

    @Override
    public PermissionSnapshot resolve(String tenantId, String userId, InteractionContext.Subject subject) {
        if (properties.getIamBaseUrl() == null || properties.getIamBaseUrl().isBlank()) return fallback.resolve(tenantId, userId, subject);
        try {
            Map<String,Object> build = mapper.readValue(client.post().uri("/api/v1/iam/permission-snapshots/build")
                    .header("X-Tenant-Id", tenantId).header("X-User-Id", userId)
                    .bodyValue(Map.of("conceptCode", subject.conceptCode(), "objectId", subject.objectId(), "candidates", Map.of()))
                    .retrieve().bodyToMono(String.class).block(), new TypeReference<>() {});
            Map<String,Object> data = asMap(build.get("data")); String id = String.valueOf(data.get("snapshotId"));
            Map<String,Object> get = mapper.readValue(client.get().uri("/api/v1/iam/permission-snapshots/{id}", id)
                    .header("X-Tenant-Id", tenantId).header("X-User-Id", userId).retrieve().bodyToMono(String.class).block(), new TypeReference<>() {});
            Map<String,Object> dto = asMap(get.get("data"));
            return new PermissionSnapshot(id, strings(dto.get("metrics")), strings(dto.get("allowedActions")),
                    Map.of("scope", dto.getOrDefault("dataScope", "SELF"), "rowFilter", dto.getOrDefault("rowFilter", "")),
                    strings(dto.get("deniedFields")));
        } catch (Exception ex) { return fallback.resolve(tenantId, userId, subject); }
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> asMap(Object v) { return v instanceof Map<?,?> m ? (Map<String,Object>)m : Map.of(); }
    private static List<String> strings(Object v) { return v instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.of(); }
}
