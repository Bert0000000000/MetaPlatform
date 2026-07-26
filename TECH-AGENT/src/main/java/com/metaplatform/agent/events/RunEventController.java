package com.metaplatform.agent.events;

import com.metaplatform.agent.runs.AgentRunService;
import com.metaplatform.agent.events.dto.RunEventDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/agent/runs/{runId}/events")
@RequiredArgsConstructor
public class RunEventController {
    private final AgentRunService runService;
    private final RunEventService eventService;

    @GetMapping
    public List<RunEventDto> list(@PathVariable String runId, @RequestParam(required=false) Long afterSeq,
                                  @RequestParam(required=false) List<RunEventType> types) {
        runService.require(runId);
        return eventService.list(runId, afterSeq, types);
    }
}
