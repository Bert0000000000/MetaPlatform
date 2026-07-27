package com.metaplatform.wfe.apphub.controller;

import com.metaplatform.wfe.apphub.dto.AppVersionCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppVersionResponse;
import com.metaplatform.wfe.apphub.service.AppVersionService;
import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 应用版本管理 API（V11-08）：路径前缀 /api/v1/apphub。
 * 对齐 APP-APPHUB 前端 versions.ts 的调用：
 *   GET    /v1/apphub/apps/{appId}/versions
 *   POST   /v1/apphub/apps/{appId}/versions
 *   GET    /v1/apphub/versions/{versionId}
 *   POST   /v1/apphub/versions/{versionId}/publish
 *   POST   /v1/apphub/versions/{versionId}/rollback
 *   DELETE /v1/apphub/versions/{versionId}
 *   GET    /v1/apphub/versions/compare?a={aId}&b={bId}
 */
@RestController
@RequestMapping("/api/v1/apphub")
@RequiredArgsConstructor
public class AppVersionController {

    private final AppVersionService appVersionService;

    @GetMapping("/apps/{appId}/versions")
    public ApiResponse<PageResponse<AppVersionResponse>> list(
            @PathVariable String appId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(appVersionService.list(appId, page, size));
    }

    @PostMapping("/apps/{appId}/versions")
    public ApiResponse<AppVersionResponse> create(
            @PathVariable String appId,
            @Valid @RequestBody AppVersionCreateRequest request) {
        request.setAppId(appId);
        return ApiResponse.success(appVersionService.create(request));
    }

    @GetMapping("/versions/{versionId}")
    public ApiResponse<AppVersionResponse> get(@PathVariable String versionId) {
        return ApiResponse.success(appVersionService.get(versionId));
    }

    @PostMapping("/versions/{versionId}/publish")
    public ApiResponse<AppVersionResponse> publish(@PathVariable String versionId) {
        return ApiResponse.success(appVersionService.publish(versionId));
    }

    @PostMapping("/versions/{versionId}/rollback")
    public ApiResponse<AppVersionResponse> rollback(@PathVariable String versionId) {
        return ApiResponse.success(appVersionService.rollback(versionId));
    }

    @DeleteMapping("/versions/{versionId}")
    public ApiResponse<Void> delete(@PathVariable String versionId) {
        appVersionService.delete(versionId);
        return ApiResponse.success();
    }

    @GetMapping("/versions/compare")
    public ApiResponse<Map<String, List<String>>> compare(
            @RequestParam String a, @RequestParam String b) {
        return ApiResponse.success(appVersionService.compare(a, b));
    }
}
