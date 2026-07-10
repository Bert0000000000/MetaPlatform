package com.metaplatform.appservice.domain.form;

import com.metaplatform.appservice.api.error.ApiResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/apps/{appId}/forms")
public class AppFormController {

    private final AppFormService service;

    public AppFormController(AppFormService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AppFormEntity>> list(@PathVariable Long appId) {
        return ApiResponse.ok(service.list(appId), MDC.get("traceId"));
    }

    @GetMapping("/{fid}")
    public ApiResponse<AppFormEntity> get(@PathVariable Long appId,
                                          @PathVariable Long fid) {
        return ApiResponse.ok(service.get(appId, fid), MDC.get("traceId"));
    }

    @PostMapping
    public ApiResponse<AppFormEntity> create(@PathVariable Long appId,
                                             @RequestBody AppFormService.AppFormCreateRequest req) {
        return ApiResponse.ok(service.create(appId, req), MDC.get("traceId"));
    }

    @PutMapping("/{fid}")
    public ApiResponse<AppFormEntity> update(@PathVariable Long appId,
                                             @PathVariable Long fid,
                                             @RequestBody AppFormService.AppFormUpdateRequest req) {
        return ApiResponse.ok(service.update(appId, fid, req), MDC.get("traceId"));
    }

    @PostMapping("/{fid}/publish")
    public ApiResponse<AppFormEntity> publish(@PathVariable Long appId,
                                              @PathVariable Long fid) {
        return ApiResponse.ok(service.publish(appId, fid), MDC.get("traceId"));
    }
}
