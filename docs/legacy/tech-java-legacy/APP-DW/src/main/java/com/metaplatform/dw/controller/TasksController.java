package com.metaplatform.dw.controller;

import com.metaplatform.dw.config.DwProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dw/tasks")
public class TasksController {
    private final WebClient client;

    public TasksController(WebClient.Builder builder, DwProperties properties) {
        this.client = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
    }

    @GetMapping
    public Mono<Object> list(@RequestParam(required = false) String userId,
                              @RequestParam(required = false) String employeeId,
                              @RequestParam(required = false) String status,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size) {
        return client.get().uri(uri -> {
            var b = uri.path("/api/v1/agent/tasks")
                    .queryParam("page", page)
                    .queryParam("size", size);
            if (userId != null) b.queryParam("userId", userId);
            if (employeeId != null) b.queryParam("employeeId", employeeId);
            if (status != null) b.queryParam("status", status);
            return b.build();
        }).retrieve().bodyToMono(Object.class);
    }

    @PostMapping
    public Mono<Object> create(@RequestBody Object body) {
        return client.post().uri("/api/v1/agent/tasks").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{taskId}")
    public Mono<Object> get(@PathVariable String taskId) {
        return client.get().uri("/api/v1/agent/tasks/{id}", taskId).retrieve().bodyToMono(Object.class);
    }

    @PutMapping("/{taskId}/cancel")
    public Mono<Object> cancel(@PathVariable String taskId) {
        return client.put().uri("/api/v1/agent/tasks/{id}/cancel", taskId).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{taskId}/steps")
    public Mono<Object> steps(@PathVariable String taskId) {
        return client.get().uri("/api/v1/agent/tasks/{id}/steps", taskId).retrieve().bodyToMono(Object.class);
    }
}