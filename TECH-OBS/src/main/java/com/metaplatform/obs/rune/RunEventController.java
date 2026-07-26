package com.metaplatform.obs.rune;

import com.metaplatform.obs.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/obs/run-events")
@RequiredArgsConstructor
public class RunEventController {

    private final RunEventService service;

    @PostMapping
    public ApiResponse<RunEventEntity> record(@RequestBody RecordRequest req) {
        return ApiResponse.success(service.record(
                req.tenantId, req.runId, req.type, req.payload, req.traceId));
    }

    @GetMapping("/by-run/{runId}")
    public ApiResponse<List<RunEventEntity>> byRun(@PathVariable String runId) {
        return ApiResponse.success(service.listByRun(runId));
    }

    @lombok.Data @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class RecordRequest {
        private String tenantId;
        private String runId;
        private String type;
        private String payload;
        private String traceId;
    }
}
