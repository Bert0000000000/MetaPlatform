package com.metaplatform.llmgw.ratelimits;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

/**
 * OpenAI 兼容端点的限流拦截器（P0.3.4）。
 *
 * <p>策略：按租户 + 模型名 + 分钟级滑动窗口。
 * 计数键 {@code llmgw:rl:{tenantId}:{model}:{yyyyMMddHHmm}}，TTL 70s。
 * 超限时返回 HTTP 429 + OpenAI 错误体。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiRateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;

    @Value("${llmgw.ratelimit.enabled:true}")
    private boolean enabled;

    @Value("${llmgw.ratelimit.default-rpm:60}")
    private int defaultRpm;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        if (!enabled || !path.startsWith("/v1/")) {
            chain.doFilter(req, resp);
            return;
        }

        String tenantId = req.getHeader("X-Tenant-Id");
        if (tenantId == null || tenantId.isBlank()) tenantId = "tenant-default";
        String model = req.getHeader("X-Resolved-Model");
        if (model == null || model.isBlank()) model = "unknown";

        long windowEpochMinute = Instant.now().getEpochSecond() / 60;
        String key = "llmgw:rl:" + tenantId + ":" + model + ":" + windowEpochMinute;
        Long count = redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, Duration.ofSeconds(70));

        if (count != null && count > defaultRpm) {
            log.warn("[RateLimit] 429 tenant={} model={} count={} rpm={}", tenantId, model, count, defaultRpm);
            resp.setStatus(429);
            resp.setContentType("application/json");
            resp.getWriter().write(
                "{\"error\":{\"message\":\"rate limit exceeded for tenant " + tenantId
                + " on model " + model + "\",\"type\":\"rate_limit_error\",\"code\":\"429\"}}"
            );
            return;
        }

        chain.doFilter(req, resp);
    }
}
