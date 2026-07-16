package com.metaplatform.appservice.domain.form;

import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.app.AppService;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/apps/{appId}/forms")
public class AppFormController {

    private final AppFormService service;
    private final AppService appService;

    public AppFormController(AppFormService service, AppService appService) {
        this.service = service;
        this.appService = appService;
    }

    @GetMapping
    public ApiResponse<List<AppFormEntity>> list(@PathVariable String appId) {
        return ApiResponse.ok(service.list(resolveAppId(appId)), MDC.get("traceId"));
    }

    @GetMapping("/{fid}")
    public ApiResponse<AppFormEntity> get(@PathVariable String appId,
                                          @PathVariable Long fid) {
        return ApiResponse.ok(service.get(resolveAppId(appId), fid), MDC.get("traceId"));
    }

    @PostMapping
    public ApiResponse<AppFormEntity> create(@PathVariable String appId,
                                             @RequestBody AppFormService.AppFormCreateRequest req) {
        return ApiResponse.ok(service.create(resolveAppId(appId), req), MDC.get("traceId"));
    }

    @PutMapping("/{fid}")
    public ApiResponse<AppFormEntity> update(@PathVariable String appId,
                                             @PathVariable Long fid,
                                             @RequestBody AppFormService.AppFormUpdateRequest req) {
        return ApiResponse.ok(service.update(resolveAppId(appId), fid, req), MDC.get("traceId"));
    }

    @PostMapping("/{fid}/publish")
    public ApiResponse<AppFormEntity> publish(@PathVariable String appId,
                                              @PathVariable Long fid) {
        return ApiResponse.ok(service.publish(resolveAppId(appId), fid), MDC.get("traceId"));
    }

    private Long resolveAppId(String appRef) {
        return appService.resolveByIdOrCode(appRef).getId();
    }
}
