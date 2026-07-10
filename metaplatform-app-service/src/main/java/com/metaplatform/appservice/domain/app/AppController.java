package com.metaplatform.appservice.domain.app;

import com.metaplatform.appservice.api.error.ApiResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 应用 REST 接口（v1.0.1 Sprint 1 范围）。
 *
 * <pre>
 * GET    /api/apps           — 列应用
 * POST   /api/apps           — 建应用
 * GET    /api/apps/{id}      — 应用详情
 * PUT    /api/apps/{id}      — 更新（需带 version 乐观锁）
 * DELETE /api/apps/{id}      — 软删
 * </pre>
 */
@RestController
@RequestMapping("/api/apps")
public class AppController {

    private final AppService service;

    public AppController(AppService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AppEntity>> list() {
        return ApiResponse.ok(service.list(), MDC.get("traceId"));
    }

    @GetMapping("/{id}")
    public ApiResponse<AppEntity> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id), MDC.get("traceId"));
    }

    @PostMapping
    public ApiResponse<AppEntity> create(@RequestBody AppCreateRequest req) {
        AppEntity input = new AppEntity();
        input.setCode(req.code());
        input.setName(req.name());
        input.setIcon(req.icon());
        input.setDescription(req.description());
        input.setCreatedBy("dev-user");
        return ApiResponse.ok(service.create(input), MDC.get("traceId"));
    }

    @PutMapping("/{id}")
    public ApiResponse<AppEntity> update(@PathVariable Long id,
                                         @RequestBody AppUpdateRequest req) {
        AppEntity patch = new AppEntity();
        patch.setName(req.name());
        patch.setIcon(req.icon());
        patch.setDescription(req.description());
        return ApiResponse.ok(service.update(id, req.version(), patch), MDC.get("traceId"));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.archive(id);
        return ApiResponse.ok(null, MDC.get("traceId"));
    }

    // —— DTO —— //
    public record AppCreateRequest(String code, String name, String icon, String description) {}
    public record AppUpdateRequest(Integer version, String name, String icon, String description) {}
}
