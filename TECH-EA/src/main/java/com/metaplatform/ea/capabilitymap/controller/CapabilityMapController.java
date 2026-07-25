package com.metaplatform.ea.capabilitymap.controller;

import com.metaplatform.ea.capability.dto.CapabilityResponse;
import com.metaplatform.ea.capabilitymap.dto.*;
import com.metaplatform.ea.capabilitymap.service.CapabilityMapService;
import com.metaplatform.ea.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/capability-maps")
@RequiredArgsConstructor
public class CapabilityMapController {

    private final CapabilityMapService capabilityMapService;

    // ---------- 能力地图 CRUD ----------

    @PostMapping
    public ApiResponse<CapabilityMapResponse> create(@Valid @RequestBody CreateCapabilityMapRequest request) {
        return ApiResponse.success(capabilityMapService.create(request));
    }

    @GetMapping
    public ApiResponse<List<CapabilityMapResponse>> list(
            @RequestParam(required = false) String businessDomain) {
        return ApiResponse.success(capabilityMapService.list(businessDomain));
    }

    @GetMapping("/{mapId}")
    public ApiResponse<CapabilityMapResponse> get(@PathVariable UUID mapId) {
        return ApiResponse.success(capabilityMapService.get(mapId));
    }

    @PutMapping("/{mapId}")
    public ApiResponse<CapabilityMapResponse> update(@PathVariable UUID mapId,
                                                      @Valid @RequestBody UpdateCapabilityMapRequest request) {
        return ApiResponse.success(capabilityMapService.update(mapId, request));
    }

    @DeleteMapping("/{mapId}")
    public ApiResponse<Void> delete(@PathVariable UUID mapId) {
        capabilityMapService.delete(mapId);
        return ApiResponse.success();
    }

    // ---------- 根能力管理 ----------

    @PutMapping("/{mapId}/root-capability")
    public ApiResponse<CapabilityMapResponse> setRootCapability(
            @PathVariable UUID mapId,
            @Valid @RequestBody SetRootCapabilityRequest request) {
        return ApiResponse.success(capabilityMapService.setRootCapability(mapId, request));
    }

    @GetMapping("/{mapId}/root-capability")
    public ApiResponse<CapabilityResponse> getRootCapability(@PathVariable UUID mapId) {
        return ApiResponse.success(capabilityMapService.getRootCapability(mapId));
    }

    // ---------- 版本管理 ----------

    @GetMapping("/{mapId}/versions")
    public ApiResponse<List<CapabilityMapVersionResponse>> listVersions(@PathVariable UUID mapId) {
        return ApiResponse.success(capabilityMapService.listVersions(mapId));
    }

    @PostMapping("/{mapId}/versions")
    public ApiResponse<CapabilityMapVersionResponse> createVersion(
            @PathVariable UUID mapId,
            @Valid @RequestBody CreateVersionRequest request) {
        return ApiResponse.success(capabilityMapService.createVersion(mapId, request));
    }

    @PostMapping("/{mapId}/versions/{versionId}/publish")
    public ApiResponse<CapabilityMapVersionResponse> publishVersion(
            @PathVariable UUID mapId,
            @PathVariable UUID versionId) {
        return ApiResponse.success(capabilityMapService.publishVersion(mapId, versionId));
    }

    @PostMapping("/{mapId}/versions/{versionId}/rollback")
    public ApiResponse<CapabilityMapVersionResponse> rollbackVersion(
            @PathVariable UUID mapId,
            @PathVariable UUID versionId) {
        return ApiResponse.success(capabilityMapService.rollbackVersion(mapId, versionId));
    }
}
