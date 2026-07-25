package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.config.DashboardProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class DashboardTodoService {
    private final WebClient wfeClient;

    public DashboardTodoService(WebClient.Builder builder, DashboardProperties properties) {
        this.wfeClient = builder.clone().baseUrl(properties.getWfeBaseUrl()).build();
    }

    public Mono<List<Map<String, Object>>> getTodos(String userId) {
        return wfeClient.get().uri(uri -> uri.path("/api/v1/wfe/tasks/todo").queryParamIfPresent("userId", java.util.Optional.ofNullable(userId)).build())
                .retrieve().bodyToMono(new ParameterizedTypeReference<>() {});
    }
    public Mono<Map<String, Object>> getTodo(String id) { return wfeClient.get().uri("/api/v1/wfe/tasks/{id}", id).retrieve().bodyToMono(new ParameterizedTypeReference<>() {}); }
    public Mono<Map<String, Object>> handle(String id, Object action) { return wfeClient.put().uri("/api/v1/wfe/tasks/{id}/action", id).bodyValue(action).retrieve().bodyToMono(new ParameterizedTypeReference<>() {}); }
    public Mono<List<Map<String, Object>>> batchHandle(List<String> ids, Object action) { return reactor.core.publisher.Flux.fromIterable(ids).concatMap(id -> handle(id, action)).collectList(); }
}
