package com.metaplatform.agent.artifact;

import com.metaplatform.agent.artifact.dto.*;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.runs.AgentRunService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping({"/agent", "/api/v1/agent"})
@RequiredArgsConstructor
public class ArtifactController {
    private final ArtifactService service;
    private final AgentRunService runService;

    @GetMapping("/runs/{runId}/artifacts")
    public List<AgentArtifactDto> list(@PathVariable String runId) {
        runService.require(runId); return service.listByRun(runId);
    }

    @PostMapping("/artifacts/{artifactId}/signed-url")
    public SignedUrlResponse signedUrl(@PathVariable String artifactId) { return service.signedUrl(artifactId); }

    /** Legacy artifact registration endpoint retained for existing producers. */
    @PostMapping("/artifacts")
    public ArtifactEntity record(@RequestBody ArtifactEntity a) {
        a.setTenantId(TenantContext.getTenantIdOrDefault());
        return service.record(a.getTenantId(), a.getRunId(), a.getAgentId(), a.getArtifactKind(), a.getDisplayName(),
                a.getStorageKey(), a.getMimeType(), a.getByteSize(), a.getMetadata());
    }

    @GetMapping("/artifacts/by-run/{runId}")
    public List<AgentArtifactDto> byRun(@PathVariable String runId) { return service.listByRun(runId); }
}
