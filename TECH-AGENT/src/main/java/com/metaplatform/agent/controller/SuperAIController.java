package com.metaplatform.agent.controller;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.deerflow.DeerFlowAdapter;
import com.metaplatform.agent.runtime.RuntimeRouter;
import com.metaplatform.agent.runtime.RuntimeRouter.RouteDecision;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/agent/superai")
@RequiredArgsConstructor
public class SuperAIController {

    private final RuntimeRouter router;
    private final DeerFlowAdapter deerFlowAdapter;

    @PostMapping("/route")
    public ApiResponse<Map<String, Object>> route(@RequestBody Map<String, Object> body) {
        String msg = String.valueOf(body.getOrDefault("message", ""));
        RouteDecision decision = router.route(com.metaplatform.agent.middleware.MiddlewareContext.builder()
                .userMessage(msg).build());
        return ApiResponse.success(Map.of(
                "decision", decision.name(),
                "isDeep", decision.isDeep(),
                "expectedLatencyMs", decision.isDeep() ? 30000 : 1500
        ));
    }

    @PostMapping("/run")
    public ApiResponse<Map<String, Object>> run(@RequestBody DeerFlowAdapter.StartRunRequest request) {
        String runId = deerFlowAdapter.startRun(request);
        return ApiResponse.success(Map.of("runId", runId));
    }
}
