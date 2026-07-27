package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.config.DashboardProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dashboard/profile")
public class ProfileController {
    private final WebClient client;
    public ProfileController(WebClient.Builder builder, DashboardProperties properties) { this.client = builder.clone().baseUrl(properties.getIamBaseUrl()).build(); }
    @GetMapping public Mono<Object> get() { return client.get().uri("/api/v1/iam/auth/me").retrieve().bodyToMono(Object.class); }
    @PutMapping public Mono<Object> update(@RequestBody Object body) { return client.put().uri("/api/v1/iam/auth/me").bodyValue(body).retrieve().bodyToMono(Object.class); }
    @GetMapping("/permissions") public Mono<Object> permissions() { return client.get().uri("/api/v1/iam/auth/me/permissions").retrieve().bodyToMono(Object.class); }
}
