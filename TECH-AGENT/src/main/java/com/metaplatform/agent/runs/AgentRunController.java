package com.metaplatform.agent.runs;

import com.metaplatform.agent.runs.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/agent/runs")
@RequiredArgsConstructor
@Validated
public class AgentRunController {
    private final AgentRunService service;

    @PostMapping
    public ResponseEntity<AgentRunDto> create(@Valid @RequestBody CreateAgentRunRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }
    @GetMapping
    public List<AgentRunDto> list(@RequestParam String tenantId, @RequestParam(required=false) String status,
                                  @RequestParam(defaultValue="50") int limit) {
        return service.list(tenantId, status, limit);
    }
    @GetMapping("/{runId}")
    public AgentRunDto get(@PathVariable String runId) { return service.get(runId); }
    @PostMapping("/{runId}/cancel")
    public ResponseEntity<AgentRunDto> cancel(@PathVariable String runId) {
        return ResponseEntity.status(202).body(service.cancel(runId));
    }
}
