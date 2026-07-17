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
public class BatchImportUsersResponse {

    private int totalCount;
    private int successCount;
    private int failedCount;
    private List<ImportResult> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportResult {
        private int index;
        private String username;
        private String userId;
        private boolean success;
        private String errorMessage;
    }
}