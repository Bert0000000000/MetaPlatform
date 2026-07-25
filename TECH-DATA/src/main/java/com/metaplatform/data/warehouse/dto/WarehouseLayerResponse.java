package com.metaplatform.data.warehouse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 数据分层信息。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarehouseLayerResponse {

    private List<LayerInfo> layers;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LayerInfo {
        private String name;
        private String description;
        private int tableCount;
        private long totalSizeBytes;
    }
}
