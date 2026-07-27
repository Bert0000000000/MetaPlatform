package com.metaplatform.copilot.controller;

import com.metaplatform.copilot.config.CopilotProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/copilot/ontology")
public class OntologyController {
    private final WebClient client;

    public OntologyController(WebClient.Builder builder, CopilotProperties properties) {
        this.client = builder.clone().baseUrl(properties.getOntBaseUrl()).build();
    }

    @PostMapping("/query")
    public Mono<Object> query(@RequestBody Object body) {
        return client.post().uri("/api/v1/ont/query").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/search")
    public Mono<Object> search(@RequestParam String keyword,
                                @RequestParam(defaultValue = "10") int limit) {
        return client.get().uri(uri -> uri.path("/api/v1/ont/search")
                .queryParam("keyword", keyword)
                .queryParam("limit", limit).build()).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/concepts/{conceptId}/relations")
    public Mono<Object> relations(@PathVariable String conceptId) {
        return client.get().uri("/api/v1/ont/concepts/{id}/relations", conceptId).retrieve().bodyToMono(Object.class);
    }
}