package com.metaplatform.agent.runtime;

import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.runs.AgentRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.Map;

/** Bridges Native execution lifecycle into the durable RunEvent stream when a persisted run exists. */
@Component
@RequiredArgsConstructor
public class NativeRuntimeEventPublisher {
    private final AgentRunService runService;
    private final RunEventService eventService;

    public void publish(String runId, String type, Map<String,Object> payload) {
        if (runId == null || runId.isBlank()) return;
        try { eventService.record(runService.require(runId), type, payload == null ? Map.of() : payload); }
        catch (RuntimeException ignored) { /* internal/test contexts may not have a persisted run */ }
    }
}
