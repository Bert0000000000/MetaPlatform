package com.metaplatform.wfe.apphub.controller;

import com.metaplatform.wfe.apphub.dto.AppReleaseCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppReleaseResponse;
import com.metaplatform.wfe.apphub.dto.ReleaseLogResponse;
import com.metaplatform.wfe.apphub.service.AppReleaseService;
import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 应用发布记录 API（V14-05）：路径前缀 /api/v1/apphub。
 * 对齐 APP-APPHUB 前端 release.ts 的调用：
 *   GET  /v1/apphub/apps/{appId}/releases
 *   POST /v1/apphub/apps/{appId}/releases
 *   GET  /v1/apphub/releases/{releaseId}
 *   GET  /v1/apphub/releases/{releaseId}/logs
 */
@RestController
@RequestMapping("/api/v1/apphub")
@RequiredArgsConstructor
public class AppReleaseController {

    private final AppReleaseService appReleaseService;

    @GetMapping("/apps/{appId}/releases")
    public ApiResponse<PageResponse<AppReleaseResponse>> list(
            @PathVariable String appId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(appReleaseService.list(appId, page, size));
    }

    @PostMapping("/apps/{appId}/releases")
    public ApiResponse<AppReleaseResponse> create(
            @PathVariable String appId,
            @Valid @RequestBody AppReleaseCreateRequest request) {
        request.setAppId(appId);
        return ApiResponse.success(appReleaseService.create(request));
    }

    @GetMapping("/releases/{releaseId}")
    public ApiResponse<AppReleaseResponse> get(@PathVariable String releaseId) {
        return ApiResponse.success(appReleaseService.get(releaseId));
    }

    @GetMapping("/releases/{releaseId}/logs")
    public ApiResponse<List<ReleaseLogResponse>> logs(@PathVariable String releaseId) {
        return ApiResponse.success(appReleaseService.getLogs(releaseId));
    }
}
