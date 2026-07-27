package com.metaplatform.dw.controller;

import com.metaplatform.dw.config.DwProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dw/collaborations")
public class CollaborationsController {
    private final WebClient client;

    public CollaborationsController(WebClient.Builder builder, DwProperties properties) {
        this.client = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
    }

    @GetMapping
    public Mono<Object> list(@RequestParam(required = false) String employeeId,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size) {
        return client.get().uri(uri -> {
            var b = uri.path("/api/v1/agent/collaboration").queryParam("page", page).queryParam("size", size);
            if (employeeId != null) b.queryParam("employeeId", employeeId);
            return b.build();
        }).retrieve().bodyToMono(Object.class);
    }

    @PostMapping
    public Mono<Object> create(@RequestBody Object body) {
        return client.post().uri("/api/v1/agent/collaboration").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{collabId}")
    public Mono<Object> get(@PathVariable String collabId) {
        return client.get().uri("/api/v1/agent/collaboration/{id}", collabId).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{collabId}/messages")
    public Mono<Object> messages(@PathVariable String collabId) {
        return client.get().uri("/api/v1/agent/collaboration/{id}/messages", collabId).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/{collabId}/messages")
    public Mono<Object> postMessage(@PathVariable String collabId, @RequestBody Object body) {
        return client.post().uri("/api/v1/agent/collaboration/{id}/messages", collabId).bodyValue(body).retrieve().bodyToMono(Object.class);
    }
}