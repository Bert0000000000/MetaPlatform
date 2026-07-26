package com.metaplatform.ont.context;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OntologyContextEnvelope {
    private String envelopeId;
    private String tenantId;
    private String userId;
    private String runId;
    private Principal principal;
    private Subject subject;
    private Schema schema;
    private List<String> allowedTools;
    private List<String> allowedActions;
    private List<String> approvalRequiredActions;
    private DataScopes dataScopes;
    private String permissionSnapshotId;
    private Instant expiresAt;
    private EnvelopeSignature signature;

    // Existing internal callers use this compact permission reference; keep it for compatibility.
    @JsonIgnore private PermissionRef permission;
    @JsonIgnore private List<String> metrics;
    @JsonIgnore private List<String> concepts;
    @JsonIgnore private Map<String,Object> viewState;

    public boolean isValid() { return expiresAt != null && Instant.now().isBefore(expiresAt); }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Principal { private String tenantId; private String userId; private List<String> roles; }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Subject {
        @JsonProperty("concept") private String conceptCode;
        private String objectId;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Schema { private List<String> properties; private List<String> relationships; private List<String> metrics; private List<String> availableActions; }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DataScopes { private List<String> regions; private List<String> fieldsDenied; private List<String> objectDenied; }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EnvelopeSignature { private String alg; private String kid; private String value; }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PermissionRef {
        private String snapshotId; private String dataScope; private List<String> deniedFields;
        private List<String> allowedActions; private List<String> approvalRequiredActions; private List<String> allowedRelations;
    }
}
