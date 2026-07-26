package com.metaplatform.ont.context;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Ontology Context Envelope（P1.2.1）。
 *
 * <p>注入到 DeerFlow / Agent / RAG 的不可变业务上下文。
 * 由 {@code OntologyContextService.build()} 产出，含：</p>
 *
 * <ul>
 *   <li>{@code subject}：当前业务对象（conceptCode + objectId）</li>
 *   <li>{@code schema}：当前 Concept 的属性、关系、可见 Metric / Action</li>
 *   <li>{@code permissionSnapshotId}：字段级 / 对象级 / Action 级权限快照 ID（IAM）</li>
 *   <li>{@code allowedTools}：可调用的 ontology.* / rag.* / mcp.* / action.* tools</li>
 *   <li>{@code expiresAt} / {@code signature}：TTL + 防篡改</li>
 * </ul>
 *
 * <p>DeerFlow 必须在每次 Tool Call 前校验 {@link #isValid()}。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OntologyContextEnvelope {

    private String envelopeId;
    private String tenantId;
    private String userId;
    private String runId;

    private Subject subject;
    private Schema schema;
    private PermissionRef permission;

    private List<String> allowedTools;
    private List<String> metrics;
    private List<String> concepts;

    private Map<String, Object> viewState;
    private Instant expiresAt;
    private String signature;

    public boolean isValid() {
        return expiresAt != null && Instant.now().isBefore(expiresAt);
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Subject {
        private String conceptCode;
        private String objectId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Schema {
        private List<String> properties;
        private List<String> relationships;
        private List<String> availableActions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PermissionRef {
        private String snapshotId;
        private String dataScope;
        private List<String> deniedFields;
        private List<String> allowedActions;
        private List<String> approvalRequiredActions;
        private List<String> allowedRelations;
    }
}
