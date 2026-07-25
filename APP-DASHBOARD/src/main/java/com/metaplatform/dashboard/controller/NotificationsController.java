package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.config.DashboardProperties;
import com.metaplatform.dashboard.dto.BatchDeleteRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dashboard/notifications")
public class NotificationsController {
    private final WebClient client;
    public NotificationsController(WebClient.Builder builder, DashboardProperties properties) { this.client = builder.clone().baseUrl(properties.getObsBaseUrl()).build(); }
    @GetMapping public Mono<Object> list() { return client.get().uri("/api/v1/obs/notifications").retrieve().bodyToMono(Object.class); }
    @GetMapping("/unread-count") public Mono<Object> unread() { return client.get().uri("/api/v1/obs/notifications/unread-count").retrieve().bodyToMono(Object.class); }
    @PutMapping("/{id}/read") public Mono<Object> read(@PathVariable String id) { return client.put().uri("/api/v1/obs/notifications/{id}/read", id).retrieve().bodyToMono(Object.class); }
    @PutMapping("/read-all") public Mono<Object> readAll() { return client.put().uri("/api/v1/obs/notifications/read-all").retrieve().bodyToMono(Object.class); }
    @DeleteMapping("/{id}") public Mono<Void> delete(@PathVariable String id) { return client.delete().uri("/api/v1/obs/notifications/{id}", id).retrieve().bodyToMono(Void.class); }
    @DeleteMapping("/batch") public Mono<Void> batch(@RequestBody BatchDeleteRequest request) { return reactor.core.publisher.Flux.fromIterable(request.ids()).concatMap(this::delete).then(); }
}
