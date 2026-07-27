package com.metaplatform.agent.evidence;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.metaplatform.agent.evidence.dto.*;
import com.metaplatform.agent.runs.AgentRunService;

@RestController
@RequestMapping("/agent/runs/{runId}")
@RequiredArgsConstructor
public class EvidenceController {
    private final AgentRunService runService;
    private final EvidenceService service;
    @GetMapping("/evidence")
    public List<EvidenceDto> list(@PathVariable String runId) { runService.require(runId); return service.list(runId); }
}
