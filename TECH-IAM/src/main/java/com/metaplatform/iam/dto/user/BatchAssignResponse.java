package com.metaplatform.iam.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchAssignResponse {

    private int totalCount;
    private int successCount;
    private int failedCount;
    private List<AssignResult> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignResult {
        private String userId;
        private boolean success;
        private String errorMessage;
    }
}