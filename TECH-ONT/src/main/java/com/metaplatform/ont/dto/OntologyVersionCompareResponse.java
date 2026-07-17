package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OntologyVersionCompareResponse {

    private String sourceVersionId;
    private String targetVersionId;
    private Map<String, ChangeSummary> changes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeSummary {
        private int added;
        private int removed;
        private int modified;
    }
}
