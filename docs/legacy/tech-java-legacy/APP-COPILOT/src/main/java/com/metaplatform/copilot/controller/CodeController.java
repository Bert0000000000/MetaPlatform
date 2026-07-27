package com.metaplatform.copilot.controller;

import com.metaplatform.copilot.config.CopilotProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/copilot/code")
public class CodeController {
    private final WebClient client;

    public CodeController(WebClient.Builder builder, CopilotProperties properties) {
        this.client = builder.clone().baseUrl(properties.getLlmgwBaseUrl()).build();
    }

    @PostMapping("/generate")
    public Mono<Object> generate(@RequestBody Object body) {
        return client.post().uri("/api/v1/llmgw/code/generate").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/explain")
    public Mono<Object> explain(@RequestBody Object body) {
        return client.post().uri("/api/v1/llmgw/code/explain").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/review")
    public Mono<Object> review(@RequestBody Object body) {
        return client.post().uri("/api/v1/llmgw/code/review").bodyValue(body).retrieve().bodyToMono(Object.class);
    }
}