package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.OntologyVersionCompareResponse;
import com.metaplatform.ont.dto.OntologyVersionCreateRequest;
import com.metaplatform.ont.dto.OntologyVersionResponse;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.service.OntologyVersionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ont/versions")
@RequiredArgsConstructor
public class OntologyVersionController {

    private final OntologyVersionService versionService;

    @PostMapping("/snapshot")
    public ApiResponse<OntologyVersionResponse> createSnapshot(@Valid @RequestBody OntologyVersionCreateRequest request) {
        return ApiResponse.success(versionService.createSnapshot(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<OntologyVersionResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(versionService.list(page, pageSize));
    }

    @GetMapping("/{versionId}")
    public ApiResponse<OntologyVersionResponse> get(@PathVariable String versionId) {
        return ApiResponse.success(versionService.getById(versionId));
    }

    @GetMapping("/current")
    public ApiResponse<OntologyVersionResponse> getCurrent() {
        return ApiResponse.success(versionService.getCurrent());
    }

    @PostMapping("/{versionId}/publish")
    public ApiResponse<OntologyVersionResponse> publish(@PathVariable String versionId) {
        return ApiResponse.success(versionService.publish(versionId));
    }

    @PostMapping("/{versionId}/rollback")
    public ApiResponse<OntologyVersionResponse> rollback(@PathVariable String versionId) {
        return ApiResponse.success(versionService.rollback(versionId));
    }

    @PostMapping("/{versionId}/compare")
    public ApiResponse<OntologyVersionCompareResponse> compare(
            @PathVariable String versionId,
            @RequestParam(required = false) String targetVersionId) {
        return ApiResponse.success(versionService.compare(versionId, targetVersionId));
    }
}
