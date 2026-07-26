package com.metaplatform.ont.event;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Domain Event REST API（P1.1.5 + Phase 7 联动）。
 */
@RestController
@RequestMapping("/api/v1/ont/events")
@RequiredArgsConstructor
public class DomainEventController {

    private final DomainEventService service;

    @PostMapping("/publish")
    public ApiResponse<DomainEventEntity> publish(@RequestBody PublishRequest req) {
        return ApiResponse.success(service.publish(
                TenantContext.tenantIdOrDefault(),
                req.eventCode,
                req.conceptCode,
                req.objectId,
                req.payload
        ));
    }

    @GetMapping
    public ApiResponse<List<DomainEventEntity>> list(@RequestParam(required = false) String eventCode) {
        String tid = TenantContext.tenantIdOrDefault();
        return ApiResponse.success(eventCode == null
                ? service.listPending(tid)
                : service.listByEventCode(tid, eventCode));
    }

    @PostMapping("/{id}/consumed")
    public ApiResponse<Void> markConsumed(@PathVariable String id) {
        service.markConsumed(id);
        return ApiResponse.success();
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class PublishRequest {
        private String eventCode;
        private String conceptCode;
        private String objectId;
        private Map<String, Object> payload;
    }
}
