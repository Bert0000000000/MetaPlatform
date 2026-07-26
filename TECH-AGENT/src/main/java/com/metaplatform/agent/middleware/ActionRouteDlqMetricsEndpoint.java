package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/agent/dlq/metrics")

public class ActionRouteDlqMetricsEndpoint {

    private ActionRouteDlqService dlqService;
    private ActionRouteDlqScheduler scheduler;

    @Autowired
    public ActionRouteDlqMetricsEndpoint(
            @Autowired(required = false) ActionRouteDlqService dlqService,
            @Autowired(required = false) ActionRouteDlqScheduler scheduler) {
        this.dlqService = dlqService;
        this.scheduler = scheduler;
    }

    @GetMapping
    public Map<String, Object> metrics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("service", "agent-action-dlq");
        if (dlqService != null) {
            result.put("pending_count", dlqService.size());
            try {
                result.put("pending", dlqService.getPending());
            } catch (Exception e) {
                result.put("pending_error", e.getMessage());
            }
        } else {
            result.put("pending_count", 0);
        }
        if (scheduler != null) {
            result.put("scheduler_present", true);
        } else {
            result.put("scheduler_present", false);
        }
        return result;
    }
}

