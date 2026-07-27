package com.metaplatform.dw.controller;

import com.metaplatform.dw.config.DwProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dw/executions")
public class ExecutionsController {
    private final WebClient client;

    public ExecutionsController(WebClient.Builder builder, DwProperties properties) {
        this.client = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
    }

    @GetMapping
    public Mono<Object> list(@RequestParam(required = false) String employeeId,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size) {
        return client.get().uri(uri -> {
            var b = uri.path("/api/v1/agent/executions").queryParam("page", page).queryParam("size", size);
            if (employeeId != null) b.queryParam("employeeId", employeeId);
            return b.build();
        }).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{executionId}")
    public Mono<Object> get(@PathVariable String executionId) {
        return client.get().uri("/api/v1/agent/executions/{id}", executionId).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/{executionId}/retry")
    public Mono<Object> retry(@PathVariable String executionId) {
        return client.post().uri("/api/v1/agent/executions/{id}/retry", executionId).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/{executionId}/cancel")
    public Mono<Object> cancel(@PathVariable String executionId) {
        return client.post().uri("/api/v1/agent/executions/{id}/cancel", executionId).retrieve().bodyToMono(Object.class);
    }
}