package com.metaplatform.dw.controller;

import com.metaplatform.dw.config.DwProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/a2a")
public class InvokeController {
    private final WebClient a2aClient;

    public InvokeController(WebClient.Builder builder, DwProperties properties) {
        this.a2aClient = builder.clone().baseUrl(properties.getA2aBaseUrl()).build();
    }

    @PostMapping("/agents/{agentId}/invoke")
    public Mono<Object> invoke(@PathVariable String agentId, @RequestBody Map<String, Object> body) {
        Map<String, Object> request = Map.of(
                "id", java.util.UUID.randomUUID().toString(),
                "agentId", agentId,
                "input", body.getOrDefault("input", body.getOrDefault("message", "")),
                "pageContext", body.getOrDefault("pageContext", Map.of()),
                "sessionId", body.getOrDefault("sessionId", java.util.UUID.randomUUID().toString())
        );
        return a2aClient.post()
                .uri("/api/v1/a2a/inbound/tasks/send")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Object.class);
    }

    @GetMapping("/agents/{agentId}/status")
    public Mono<Object> status(@PathVariable String agentId) {
        return a2aClient.get()
                .uri("/api/v1/a2a/agents/{id}/status", agentId)
                .retrieve()
                .bodyToMono(Object.class);
    }
}