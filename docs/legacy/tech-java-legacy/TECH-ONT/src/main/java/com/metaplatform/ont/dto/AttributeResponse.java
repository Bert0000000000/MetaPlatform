package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttributeResponse {

    private String attributeId;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String dataType;
    private Boolean required;
    private Boolean unique;
    private Object defaultValue;
    private List<Map<String, String>> enumValues;
    private Map<String, Object> constraints;
    private String unit;
    private Long conceptCount;
    private List<ConceptRef> concepts;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConceptRef {
        private String conceptId;
        private String conceptName;
    }
}
