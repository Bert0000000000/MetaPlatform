package com.metaplatform.agent.evidence;

import com.metaplatform.agent.events.RunEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.metaplatform.agent.evidence.dto.*;
import com.metaplatform.agent.runs.AgentRunService;

@RestController
@RequestMapping("/agent/runs/{runId}")
@RequiredArgsConstructor
public class ClaimController {
    private final AgentRunService runService;
    private final ClaimService service;
    @GetMapping("/claims")
    public List<ClaimDto> list(@PathVariable String runId) { runService.require(runId); return service.list(runId); }
}
