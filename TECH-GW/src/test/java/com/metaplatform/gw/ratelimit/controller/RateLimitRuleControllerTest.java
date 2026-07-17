package com.metaplatform.gw.ratelimit.controller;

import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.ratelimit.dto.*;
import com.metaplatform.gw.ratelimit.service.RateLimitRuleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@WebFluxTest(controllers = RateLimitRuleController.class)
class RateLimitRuleControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private RateLimitRuleService rateLimitService;

    private RateLimitResponse buildResponse(String ruleId) {
        return RateLimitResponse.builder()
                .ruleId(ruleId)
                .ruleName("test-limit")
                .description("Test rate limit rule")
                .routeId("route-1")
                .routeName("Test Route")
                .scope("USER")
                .limitType("QPS")
                .qpsLimit(100)
                .burstFactor(1.5)
                .quotaAlertThreshold(80)
                .status("ENABLED")
                .version(1)
                .currentStats(RateLimitResponse.CurrentStats.builder()
                        .currentQps(0L)
                        .maxQps(0L)
                        .triggeredCount(0L)
                        .totalRequests(0L)
                        .blockedRequests(0L)
                        .build())
                .createdAt(LocalDateTime.now())
                .createdBy("system")
                .updatedAt(LocalDateTime.now())
                .updatedBy("system")
                .build();
    }

    @Test
    void createRule_shouldReturn201() {
        when(rateLimitService.createRule(any(CreateRateLimitRequest.class)))
                .thenReturn(Mono.just(buildResponse("rl-1")));

        CreateRateLimitRequest request = CreateRateLimitRequest.builder()
                .ruleName("test-limit")
                .scope("USER")
                .limitType("QPS")
                .qpsLimit(100)
                .build();

        webTestClient.post()
                .uri("/api/v1/gw/rate-limits")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.ruleId").isEqualTo("rl-1")
                .jsonPath("$.data.ruleName").isEqualTo("test-limit")
                .jsonPath("$.data.status").isEqualTo("ENABLED");
    }

    @Test
    void listRules_shouldReturnPage() {
        RateLimitListItemResponse item = RateLimitListItemResponse.builder()
                .ruleId("rl-1")
                .ruleName("test-limit")
                .scope("USER")
                .limitType("QPS")
                .qpsLimit(100)
                .status("ENABLED")
                .currentQps(0L)
                .currentConcurrent(0L)
                .triggeredCount(0L)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        PageResponse<RateLimitListItemResponse> pageResponse = PageResponse.<RateLimitListItemResponse>builder()
                .items(List.of(item))
                .total(1)
                .page(1)
                .size(20)
                .totalPages(1)
                .build();

        when(rateLimitService.listRules(anyInt(), anyInt(), nullable(String.class), nullable(String.class),
                nullable(String.class), nullable(String.class), nullable(String.class), nullable(String.class)))
                .thenReturn(Mono.just(pageResponse));

        webTestClient.get()
                .uri("/api/v1/gw/rate-limits")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.items[0].ruleId").isEqualTo("rl-1")
                .jsonPath("$.data.total").isEqualTo(1)
                .jsonPath("$.data.page").isEqualTo(1);
    }

    @Test
    void getRule_shouldReturnDetail() {
        when(rateLimitService.getRule("rl-1"))
                .thenReturn(Mono.just(buildResponse("rl-1")));

        webTestClient.get()
                .uri("/api/v1/gw/rate-limits/rl-1")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.ruleId").isEqualTo("rl-1")
                .jsonPath("$.data.currentStats.currentQps").isEqualTo(0);
    }

    @Test
    void getRule_shouldReturn404WhenNotFound() {
        when(rateLimitService.getRule("non-existent"))
                .thenReturn(Mono.error(new RateLimitRuleService.RateLimitException(ErrorCode.RATE_LIMIT_NOT_FOUND)));

        webTestClient.get()
                .uri("/api/v1/gw/rate-limits/non-existent")
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.code").isEqualTo(40403)
                .jsonPath("$.message").isEqualTo("限流规则不存在");
    }

    @Test
    void updateRule_shouldReturnUpdated() {
        RateLimitResponse response = buildResponse("rl-1");
        response.setRuleName("updated-limit");
        response.setVersion(2);

        when(rateLimitService.updateRule(anyString(), any(UpdateRateLimitRequest.class)))
                .thenReturn(Mono.just(response));

        UpdateRateLimitRequest request = UpdateRateLimitRequest.builder()
                .ruleName("updated-limit")
                .version(1)
                .build();

        webTestClient.put()
                .uri("/api/v1/gw/rate-limits/rl-1")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.ruleName").isEqualTo("updated-limit")
                .jsonPath("$.data.version").isEqualTo(2);
    }

    @Test
    void deleteRule_shouldReturnSuccess() {
        RateLimitDeleteResponse response = RateLimitDeleteResponse.builder()
                .ruleId("rl-1")
                .ruleName("test-limit")
                .deletedAt(LocalDateTime.now())
                .deletedBy("system")
                .build();

        when(rateLimitService.deleteRule("rl-1", null))
                .thenReturn(Mono.just(response));

        webTestClient.delete()
                .uri("/api/v1/gw/rate-limits/rl-1")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.ruleId").isEqualTo("rl-1");
    }

    @Test
    void updateState_shouldReturnToggledStatus() {
        RateLimitStateResponse response = RateLimitStateResponse.builder()
                .ruleId("rl-1")
                .previousStatus("ENABLED")
                .currentStatus("DISABLED")
                .updatedAt(LocalDateTime.now())
                .updatedBy("system")
                .build();

        when(rateLimitService.updateState(anyString(), any(RateLimitStateRequest.class)))
                .thenReturn(Mono.just(response));

        RateLimitStateRequest request = RateLimitStateRequest.builder()
                .status("DISABLED")
                .reason("压测期间临时关闭限流")
                .build();

        webTestClient.put()
                .uri("/api/v1/gw/rate-limits/rl-1/state")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.previousStatus").isEqualTo("ENABLED")
                .jsonPath("$.data.currentStatus").isEqualTo("DISABLED");
    }

    @Test
    void resetCounters_shouldReturnSuccess() {
        RateLimitResetResponse response = RateLimitResetResponse.builder()
                .ruleId("rl-1")
                .resetType("TOKEN")
                .scopeId("user-001")
                .resetAt(LocalDateTime.now())
                .resetBy("system")
                .build();

        when(rateLimitService.resetCounters(anyString(), any(RateLimitResetRequest.class)))
                .thenReturn(Mono.just(response));

        RateLimitResetRequest request = RateLimitResetRequest.builder()
                .resetType("TOKEN")
                .scopeId("user-001")
                .reason("用户 Token 配额异常，手动重置")
                .build();

        webTestClient.put()
                .uri("/api/v1/gw/rate-limits/rl-1/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.resetType").isEqualTo("TOKEN")
                .jsonPath("$.data.scopeId").isEqualTo("user-001");
    }

    @Test
    void getStats_shouldReturnEmptyStats() {
        RateLimitStatsResponse response = RateLimitStatsResponse.builder()
                .summary(RateLimitStatsResponse.Summary.builder()
                        .totalRequests(0L)
                        .blockedRequests(0L)
                        .blockedRate(0.0)
                        .triggeredRules(0)
                        .activeRules(0)
                        .build())
                .byRule(List.of())
                .timeline(List.of())
                .build();

        when(rateLimitService.getStats(anyString(), anyString(), nullable(String.class), nullable(String.class),
                nullable(String.class), anyString()))
                .thenReturn(Mono.just(response));

        webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/gw/rate-limits/stats")
                        .queryParam("startTime", "2026-07-16T00:00:00+08:00")
                        .queryParam("endTime", "2026-07-16T23:59:59+08:00")
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.summary.totalRequests").isEqualTo(0)
                .jsonPath("$.data.byRule").isArray()
                .jsonPath("$.data.timeline").isArray();
    }

    @Test
    void getRuleStats_shouldReturnEmptyStats() {
        RateLimitRuleStatsResponse response = RateLimitRuleStatsResponse.builder()
                .ruleId("rl-1")
                .ruleName("test-limit")
                .limitType("QPS")
                .qpsLimit(100)
                .currentQps(0L)
                .currentConcurrent(0L)
                .summary(RateLimitRuleStatsResponse.Summary.builder()
                        .totalRequests(0L)
                        .blockedRequests(0L)
                        .blockedRate(0.0)
                        .maxQps(0L)
                        .avgQps(0L)
                        .triggeredCount(0L)
                        .build())
                .timeline(List.of())
                .build();

        when(rateLimitService.getRuleStats(anyString(), nullable(String.class), nullable(String.class), anyString()))
                .thenReturn(Mono.just(response));

        webTestClient.get()
                .uri("/api/v1/gw/rate-limits/rl-1/stats")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.ruleId").isEqualTo("rl-1")
                .jsonPath("$.data.summary.totalRequests").isEqualTo(0);
    }
}
