package com.metaplatform.agent.memory;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/agent/memories")
@RequiredArgsConstructor
public class MemoryController {
    private final MemoryService service;

    @PostMapping
    public ApiResponse<MemoryEntity> write(@RequestBody WriteRequest req) {
        return ApiResponse.success(service.write(
                TenantContext.getTenantIdOrDefault(),
                req.scope, req.memoryKind, req.content, req.tags, req.sourceRunId));
    }

    @GetMapping
    public ApiResponse<List<MemoryEntity>> recall(@RequestParam String scope,
                                                  @RequestParam(required = false) String memoryKind) {
        return ApiResponse.success(service.recall(
                TenantContext.getTenantIdOrDefault(), scope, memoryKind));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id, TenantContext.getTenantIdOrDefault());
        return ApiResponse.success();
    }

    @lombok.Data @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class WriteRequest {
        private String scope;
        private String memoryKind;
        private String content;
        private List<String> tags;
        private String sourceRunId;
    }
}
