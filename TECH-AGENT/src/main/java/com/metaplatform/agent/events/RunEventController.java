package com.metaplatform.agent.events;

import com.metaplatform.agent.runs.AgentRunService;
import com.metaplatform.agent.events.dto.RunEventDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.List;

@RestController
@RequestMapping("/agent/runs/{runId}/events")
@RequiredArgsConstructor
public class RunEventController {
    private final AgentRunService runService;
    private final RunEventService eventService;

    /** Replayable SSE stream. Clients reconnect with afterSeq to avoid duplicate events. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String runId, @RequestParam(required=false) Long afterSeq) {
        runService.require(runId);
        SseEmitter emitter = new SseEmitter(30_000L);
        Thread.startVirtualThread(() -> {
            try {
                for (RunEventDto event : eventService.list(runId, afterSeq, null)) {
                    emitter.send(SseEmitter.event().id(String.valueOf(event.getSeq()))
                            .name(event.getType()).data(event));
                }
                emitter.complete();
            } catch (Exception ex) { emitter.completeWithError(ex); }
        });
        return emitter;
    }

    @GetMapping
    public List<RunEventDto> list(@PathVariable String runId, @RequestParam(required=false) Long afterSeq,
                                  @RequestParam(required=false) List<RunEventType> types) {
        runService.require(runId);
        return eventService.list(runId, afterSeq, types);
    }
}
