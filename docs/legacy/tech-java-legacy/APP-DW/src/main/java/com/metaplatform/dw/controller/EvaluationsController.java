package com.metaplatform.dw.controller;

import com.metaplatform.dw.config.DwProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dw/evaluations")
public class EvaluationsController {
    private final WebClient client;

    public EvaluationsController(WebClient.Builder builder, DwProperties properties) {
        this.client = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
    }

    @GetMapping
    public Mono<Object> list(@RequestParam(required = false) String userId,
                              @RequestParam(required = false) String employeeId,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size) {
        return client.get().uri(uri -> {
            var b = uri.path("/api/v1/agent/evaluations").queryParam("page", page).queryParam("size", size);
            if (userId != null) b.queryParam("userId", userId);
            if (employeeId != null) b.queryParam("employeeId", employeeId);
            return b.build();
        }).retrieve().bodyToMono(Object.class);
    }

    @PostMapping
    public Mono<Object> create(@RequestBody Object body) {
        return client.post().uri("/api/v1/agent/evaluations").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{evalId}")
    public Mono<Object> get(@PathVariable String evalId) {
        return client.get().uri("/api/v1/agent/evaluations/{id}", evalId).retrieve().bodyToMono(Object.class);
    }

    @PutMapping("/{evalId}")
    public Mono<Object> update(@PathVariable String evalId, @RequestBody Object body) {
        return client.put().uri("/api/v1/agent/evaluations/{id}", evalId).bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/summary")
    public Mono<Object> summary(@RequestParam(required = false) String employeeId) {
        return client.get().uri(uri -> {
            var b = uri.path("/api/v1/agent/evaluations/summary");
            if (employeeId != null) b.queryParam("employeeId", employeeId);
            return b.build();
        }).retrieve().bodyToMono(Object.class);
    }
}