package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.OntologyVersionCompareResponse;
import com.metaplatform.ont.dto.OntologyVersionCreateRequest;
import com.metaplatform.ont.dto.OntologyVersionResponse;
import com.metaplatform.ont.dto.OntologyVersionUpdateRequest;
import com.metaplatform.ont.service.OntologyVersionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ont/versions")
@RequiredArgsConstructor
public class OntologyVersionController {

    private final OntologyVersionService versionService;

    @PostMapping("/snapshot")
    public ApiResponse<OntologyVersionResponse> createSnapshot(@Valid @RequestBody OntologyVersionCreateRequest request) {
        return ApiResponse.success(versionService.createSnapshot(request));
    }

    /**
     * 修复 #2: 改返回 List<OntologyVersionResponse>（去掉 PageResponse 包装）
     */
    @GetMapping
    public ApiResponse<List<OntologyVersionResponse>> list() {
        return ApiResponse.success(versionService.listAll());
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

    /**
     * 保留原 POST 端点（向后兼容）
     */
    @PostMapping("/{versionId}/compare")
    public ApiResponse<OntologyVersionCompareResponse> compare(
            @PathVariable String versionId,
            @RequestParam(required = false) String targetVersionId) {
        return ApiResponse.success(versionService.compare(versionId, targetVersionId));
    }

    /**
     * 修复 #3: 新增 GET /compare?aId&bId（前端调用形式）
     */
    @GetMapping("/compare")
    public ApiResponse<OntologyVersionCompareResponse> compareByTwoIds(
            @RequestParam String aId,
            @RequestParam String bId) {
        return ApiResponse.success(versionService.compareByTwoIds(aId, bId));
    }

    /**
     * 修复 #4: 新增 PUT /{versionId}（前端 versions.ts 期望支持更新）
     */
    @PutMapping("/{versionId}")
    public ApiResponse<OntologyVersionResponse> update(
            @PathVariable String versionId,
            @Valid @RequestBody OntologyVersionUpdateRequest request) {
        return ApiResponse.success(versionService.update(versionId, request));
    }

    /**
     * 修复 #5: 新增 DELETE /{versionId}
     */
    @DeleteMapping("/{versionId}")
    public ApiResponse<Void> delete(@PathVariable String versionId) {
        versionService.delete(versionId);
        return ApiResponse.success();
    }
}