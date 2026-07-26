package com.metaplatform.agent.artifact;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/agent/artifacts")
@RequiredArgsConstructor
public class ArtifactController {
    private final ArtifactService service;

    @PostMapping public ApiResponse<ArtifactEntity> record(@RequestBody ArtifactEntity a) {
        a.setTenantId(TenantContext.getTenantIdOrDefault());
        return ApiResponse.success(service.record(
                a.getTenantId(), a.getRunId(), a.getAgentId(),
                a.getArtifactKind(), a.getDisplayName(), a.getStorageKey(),
                a.getMimeType(), a.getByteSize(), a.getMetadata()));
    }

    @GetMapping("/by-run/{runId}") public ApiResponse<List<ArtifactEntity>> byRun(@PathVariable String runId) {
        return ApiResponse.success(service.listByRun(runId));
    }
}
