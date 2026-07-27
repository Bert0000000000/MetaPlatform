package com.metaplatform.data.catalog.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 资产数据画像（profile）。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetProfileResponse {

    private String assetId;
    private long rowCount;
    private long sizeBytes;
    private OffsetDateTime lastProfiledAt;
    private List<ColumnProfile> columns;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ColumnProfile {
        private String name;
        private String dataType;
        private long nullCount;
        private double nullRatio;
        private long distinctCount;
        private Map<String, Object> statistics;
    }
}
