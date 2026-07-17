package com.metaplatform.ea.mapping.dto;

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
    private int removedCount;
    private int skippedCount;
    private List<String> syncedConceptIds;
    private String summary;
}