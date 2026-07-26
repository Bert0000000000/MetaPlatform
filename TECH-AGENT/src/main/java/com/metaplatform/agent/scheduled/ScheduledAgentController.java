package com.metaplatform.agent.scheduled;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/agent/scheduled")
@RequiredArgsConstructor
public class ScheduledAgentController {
    private final ScheduledAgentService service;

    @PostMapping public ApiResponse<ScheduledAgentEntity> create(@RequestBody ScheduledAgentEntity s) {
        s.setTenantId(TenantContext.getTenantIdOrDefault());
        return ApiResponse.success(service.create(s));
    }

    @PostMapping("/{id}/pause") public ApiResponse<Void> pause(@PathVariable String id) {
        service.pause(id); return ApiResponse.success();
    }

    @PostMapping("/{id}/resume") public ApiResponse<Void> resume(@PathVariable String id) {
        service.resume(id); return ApiResponse.success();
    }

    @PostMapping("/{id}/trigger") public ApiResponse<Void> trigger(@PathVariable String id) {
        service.triggerNow(id); return ApiResponse.success();
    }

    @PostMapping("/tick") public ApiResponse<Integer> tick() {
        return ApiResponse.success(service.tick());
    }
}
