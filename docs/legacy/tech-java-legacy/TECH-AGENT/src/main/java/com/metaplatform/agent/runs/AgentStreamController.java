package com.metaplatform.agent.runs;

import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.events.dto.RunEventDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

/** Frontend-compatible alias for the canonical tenant-scoped RunEvent stream. */
@RestController
@RequestMapping("/api/v1/agent/run")
@RequiredArgsConstructor
public class AgentStreamController {
    private final RunEventService runEventService;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<RunEventDto>> stream(@RequestParam String runId,
                                                       @RequestParam(required = false) Long afterSeq) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return Flux.fromIterable(runEventService.listForTenant(tenantId, runId, afterSeq))
                .map(event -> ServerSentEvent.<RunEventDto>builder()
                        .id(event.getEventId()).event(event.getType()).data(event).build());
    }
}
