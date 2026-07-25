package com.metaplatform.data.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.catalog.dto.AssetLineageResponse;
import com.metaplatform.data.catalog.dto.AssetProfileResponse;
import com.metaplatform.data.catalog.dto.CatalogAssetResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 数据目录端点。
 *
 * <p>对应 Python app/api/v1/catalog.py（6 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogService catalogService;

    @GetMapping("/assets")
    public ApiResponse<PageResponse<CatalogAssetResponse>> listAssets(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(catalogService.list(type, owner, page, pageSize));
    }

    @GetMapping("/assets/{assetId}")
    public ApiResponse<CatalogAssetResponse> getAsset(@PathVariable String assetId) {
        return ApiResponse.success(catalogService.get(assetId));
    }

    @GetMapping("/assets/{assetId}/metadata")
    public ApiResponse<JsonNode> getAssetMetadata(@PathVariable String assetId) {
        return ApiResponse.success(catalogService.getMetadata(assetId));
    }

    @GetMapping("/assets/{assetId}/lineage")
    public ApiResponse<AssetLineageResponse> getAssetLineage(@PathVariable String assetId) {
        return ApiResponse.success(catalogService.getLineage(assetId));
    }

    @GetMapping("/assets/{assetId}/profile")
    public ApiResponse<AssetProfileResponse> getAssetProfile(@PathVariable String assetId) {
        return ApiResponse.success(catalogService.getProfile(assetId));
    }

    @GetMapping("/search")
    public ApiResponse<PageResponse<CatalogAssetResponse>> search(
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(catalogService.search(keyword, page, pageSize));
    }
}
