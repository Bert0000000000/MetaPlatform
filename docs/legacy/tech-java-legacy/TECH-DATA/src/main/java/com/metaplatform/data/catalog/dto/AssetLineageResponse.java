package com.metaplatform.data.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 资产血缘（lineage）响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetLineageResponse {

    private String assetId;
    private List<String> upstreamAssetIds;
    private List<String> downstreamAssetIds;
}
