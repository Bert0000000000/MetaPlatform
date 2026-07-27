package com.metaplatform.wfe.apphub.controller;

import com.metaplatform.wfe.apphub.dto.AppCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppItemResponse;
import com.metaplatform.wfe.apphub.dto.AppUpdateRequest;
import com.metaplatform.wfe.apphub.service.AppService;
import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 应用管理 API：路径前缀 /api/v1/apphub。
 * 对齐 APP-APPHUB 前端 apps.ts 的调用：
 *   GET    /v1/apphub/apps?keyword=&group=&status=
 *   GET    /v1/apphub/apps/groups
 *   GET    /v1/apphub/apps/{appId}
 *   POST   /v1/apphub/apps
 *   PUT    /v1/apphub/apps/{appId}
 *   DELETE /v1/apphub/apps/{appId}
 */
@RestController
@RequestMapping("/api/v1/apphub")
@RequiredArgsConstructor
public class AppController {

    private final AppService appService;

    @GetMapping("/apps")
    public ApiResponse<PageResponse<AppItemResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(appService.list(keyword, group, status, page, pageSize));
    }

    @GetMapping("/apps/groups")
    public ApiResponse<List<String>> listGroups() {
        return ApiResponse.success(appService.listGroups());
    }

    @GetMapping("/apps/{appId}")
    public ApiResponse<AppItemResponse> get(@PathVariable String appId) {
        return ApiResponse.success(appService.get(appId));
    }

    @PostMapping("/apps")
    public ApiResponse<AppItemResponse> create(@Valid @RequestBody AppCreateRequest request) {
        return ApiResponse.success(appService.create(request));
    }

    @PutMapping("/apps/{appId}")
    public ApiResponse<AppItemResponse> update(
            @PathVariable String appId,
            @RequestBody AppUpdateRequest request) {
        return ApiResponse.success(appService.update(appId, request));
    }

    @DeleteMapping("/apps/{appId}")
    public ApiResponse<Void> delete(@PathVariable String appId) {
        appService.delete(appId);
        return ApiResponse.success();
    }
}
