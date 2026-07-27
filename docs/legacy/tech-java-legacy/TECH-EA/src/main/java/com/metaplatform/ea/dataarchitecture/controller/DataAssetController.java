package com.metaplatform.ea.dataarchitecture.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetCatalogResponse;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.service.DataAssetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/data-assets")
@RequiredArgsConstructor
public class DataAssetController {

    private final DataAssetService service;

    @PostMapping
    public ApiResponse<DataAssetResponse> create(@Valid @RequestBody CreateDataAssetRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<DataAssetResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String assetType,
            @RequestParam(required = false) String classification) {
        return ApiResponse.success(service.list(keyword, assetType, classification));
    }

    @GetMapping("/catalog")
    public ApiResponse<DataAssetCatalogResponse> catalog(
            @RequestParam(required = false, defaultValue = "type") String groupBy) {
        return ApiResponse.success(service.catalog(groupBy));
    }

    @GetMapping("/{id}")
    public ApiResponse<DataAssetResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DataAssetResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateDataAssetRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
