package com.metaplatform.copilot.controller;

import com.metaplatform.copilot.config.CopilotProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/copilot/actions")
public class ActionsController {
    private final WebClient client;

    public ActionsController(WebClient.Builder builder, CopilotProperties properties) {
        this.client = builder.clone().baseUrl(properties.getActionBaseUrl()).build();
    }

    @PostMapping("/parse")
    public Mono<Object> parse(@RequestBody Object body) {
        return client.post().uri("/api/v1/action/parse").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/execute")
    public Mono<Object> execute(@RequestBody Object body) {
        return client.post().uri("/api/v1/action/execute").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/history")
    public Mono<Object> history(@RequestParam String userId,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size) {
        return client.get().uri(uri -> uri.path("/api/v1/action/history")
                .queryParam("userId", userId)
                .queryParam("page", page)
                .queryParam("size", size).build()).retrieve().bodyToMono(Object.class);
    }
}