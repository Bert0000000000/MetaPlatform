package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.config.DashboardProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

/**
 * 个人中心扩展：偏好设置、通知偏好、会话管理、API Token 管理。
 * 通过 WebClient 代理到 TECH-IAM 对应端点。
 */
@RestController
@RequestMapping("/api/v1/dashboard/profile")
public class ProfilePreferencesController {

    private final WebClient iamClient;

    public ProfilePreferencesController(WebClient.Builder builder, DashboardProperties properties) {
        this.iamClient = builder.clone().baseUrl(properties.getIamBaseUrl()).build();
    }

    // ===== 偏好设置 =====

    @GetMapping("/preferences")
    public Mono<Object> getPreferences(@RequestParam String userId) {
        return iamClient.get()
                .uri(uri -> uri.path("/api/v1/iam/settings").queryParam("userId", userId).build())
                .retrieve().bodyToMono(Object.class);
    }

    @PutMapping("/preferences")
    public Mono<Object> updatePreferences(@RequestParam String userId, @RequestBody Object body) {
        return iamClient.put()
                .uri("/api/v1/iam/settings")
                .bodyValue(body)
                .retrieve().bodyToMono(Object.class);
    }

    // ===== 通知偏好 =====

    @GetMapping("/notification-preferences")
    public Mono<Object> getNotificationPreferences(@RequestParam String userId) {
        return iamClient.get()
                .uri(uri -> uri.path("/api/v1/iam/settings").queryParam("userId", userId).build())
                .retrieve().bodyToMono(Object.class);
    }

    @PutMapping("/notification-preferences")
    public Mono<Object> updateNotificationPreferences(@RequestParam String userId, @RequestBody Object body) {
        return iamClient.put()
                .uri("/api/v1/iam/settings")
                .bodyValue(body)
                .retrieve().bodyToMono(Object.class);
    }

    // ===== 会话管理 =====

    @GetMapping("/sessions")
    public Mono<Object> getSessions(@RequestParam String userId) {
        return iamClient.get()
                .uri(uri -> uri.path("/api/v1/iam/sessions").queryParam("userId", userId).build())
                .retrieve().bodyToMono(Object.class);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public Mono<Object> deleteSession(@PathVariable String sessionId) {
        return iamClient.delete()
                .uri("/api/v1/iam/sessions/{id}", sessionId)
                .retrieve().bodyToMono(Object.class);
    }

    // ===== API Token 管理 =====

    @GetMapping("/api-tokens")
    public Mono<Object> getApiTokens(@RequestParam(required = false) String tenantId,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return iamClient.get()
                .uri(uri -> uri.path("/api/v1/iam/api-keys")
                        .queryParamIfPresent("tenantId", tenantId == null ? java.util.Optional.empty() : java.util.Optional.of(tenantId))
                        .queryParam("page", page)
                        .queryParam("size", size)
                        .build())
                .retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/api-tokens")
    public Mono<Object> createApiToken(@RequestBody Object body) {
        return iamClient.post()
                .uri("/api/v1/iam/api-keys")
                .bodyValue(body)
                .retrieve().bodyToMono(Object.class);
    }

    @DeleteMapping("/api-tokens/{tokenId}")
    public Mono<Object> deleteApiToken(@PathVariable String tokenId) {
        return iamClient.delete()
                .uri("/api/v1/iam/api-keys/{id}", tokenId)
                .retrieve().bodyToMono(Object.class);
    }
}
