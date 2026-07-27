package com.metaplatform.agent.runs;

import com.metaplatform.agent.runs.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.events.dto.RunEventDto;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;

import java.util.List;

@RestController
@RequestMapping("/agent/runs")
@RequiredArgsConstructor
@Validated
public class AgentRunController {
    private final AgentRunService service;
    private final RunEventService runEventService;

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
    @GetMapping(value = "/{runId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<RunEventDto>> events(@PathVariable String runId,
                                                      @RequestParam(required = false) Long afterSeq) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return Flux.fromIterable(runEventService.listForTenant(tenantId, runId, afterSeq))
                .map(event -> ServerSentEvent.<RunEventDto>builder()
                        .id(event.getEventId()).event(event.getType()).data(event).build());
    }

}
