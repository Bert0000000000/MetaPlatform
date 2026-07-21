package com.metaplatform.ea.ontmapping.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncResultResponse {

    private int createdCount;
    private int updatedCount;
    private int skippedCount;
    private int failedCount;
    private List<String> syncedConceptIds;
    private List<String> failedAssetIds;
    private String summary;
}
