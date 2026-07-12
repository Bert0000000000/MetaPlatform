package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/apps/{appId}/objects")
public class AppObjectController {

    private final AppObjectService service;

    public AppObjectController(AppObjectService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AppObjectEntity>> list(@PathVariable String appId) {
        return ApiResponse.ok(service.list(appId), MDC.get("traceId"));
    }

    @GetMapping("/{oid}")
    public ApiResponse<AppObjectEntity> get(@PathVariable String appId,
                                            @PathVariable Long oid) {
        return ApiResponse.ok(service.get(appId, oid), MDC.get("traceId"));
    }

    @PostMapping
    public ApiResponse<AppObjectEntity> create(@PathVariable String appId,
                                               @RequestBody AppObjectService.AppObjectCreateRequest req) {
        return ApiResponse.ok(service.create(appId, req), MDC.get("traceId"));
    }

    @PutMapping("/{oid}")
    public ApiResponse<AppObjectEntity> update(@PathVariable String appId,
                                               @PathVariable Long oid,
                                               @RequestBody AppObjectService.AppObjectUpdateRequest req) {
        return ApiResponse.ok(service.update(appId, oid, req), MDC.get("traceId"));
    }

    @DeleteMapping("/{oid}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String appId,
                                                   @PathVariable Long oid) {
        service.delete(appId, oid);
        return ApiResponse.ok(Map.of("deleted", true), MDC.get("traceId"));
    }
}
