package com.metaplatform.ea.dataarchitecture.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataAssetCatalogResponse {
    private String groupBy;
    private List<CatalogGroup> groups;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CatalogGroup {
        private String key;
        private String label;
        private List<DataAssetResponse> assets;
    }
}
