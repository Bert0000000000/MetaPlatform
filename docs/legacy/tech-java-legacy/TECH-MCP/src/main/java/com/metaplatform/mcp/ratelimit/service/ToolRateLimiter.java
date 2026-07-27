package com.metaplatform.mcp.ratelimit.service;

import com.metaplatform.mcp.config.McpRateLimitProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Objects;

/**
 * 基于 Redis 的 Tool 并发限流（分布式信号量）。
 *
 * 工作原理：
 *   key = mcp:ratelimit:{toolId}
 *   value = 当前并发计数
 *   - tryAcquire：
 *       INCR key（若 key 不存在则从 0 → 1）
 *       若 INCR 后值 > maxConcurrent：DECR key 并返回 false
 *       否则返回 true（并设置 key 过期，避免长期占用）
 *   - release：DECR key（保护下限为 0）
 *
 * Redis 不可用时一律放行（fail-open），确保主链路不被限流阻塞；
 * 仅 WARN 日志，不抛异常。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ToolRateLimiter {

    private static final String KEY_PREFIX = "mcp:ratelimit:";

    private final StringRedisTemplate redisTemplate;
    private final McpRateLimitProperties rateLimitProperties;

    public boolean tryAcquire(String toolId, int maxConcurrent) {
        if (!rateLimitProperties.isEnabled()) {
            return true;
        }
        if (toolId == null || toolId.isBlank()) {
            return true;
        }
        int limit = maxConcurrent > 0 ? maxConcurrent : rateLimitProperties.getDefaultMaxConcurrent();
        String key = KEY_PREFIX + toolId;
        try {
            Long current = redisTemplate.opsForValue().increment(key);
            if (current == null) {
                log.warn("RateLimiter INCR returned null, fail-open, toolId={}", toolId);
                return true;
            }
            if (current == 1L) {
                redisTemplate.expire(key, Duration.ofSeconds(rateLimitProperties.getKeyTtlSeconds()));
            }
            if (current > limit) {
                redisTemplate.opsForValue().decrement(key);
                log.debug("RateLimiter reject toolId={}, current={}, limit={}", toolId, current, limit);
                return false;
            }
            return true;
        } catch (Exception e) {
            log.warn("RateLimiter tryAcquire failed, fail-open, toolId={}, err={}", toolId, e.getMessage());
            return true;
        }
    }

    public void release(String toolId) {
        if (!rateLimitProperties.isEnabled()) {
            return;
        }
        if (toolId == null || toolId.isBlank()) {
            return;
        }
        String key = KEY_PREFIX + toolId;
        try {
            Long current = redisTemplate.opsForValue().get(key) == null
                    ? null
                    : Long.valueOf(Objects.requireNonNullElse(redisTemplate.opsForValue().get(key), "0"));
            if (current != null && current <= 0L) {
                return;
            }
            redisTemplate.opsForValue().decrement(key);
        } catch (Exception e) {
            log.warn("RateLimiter release failed, toolId={}, err={}", toolId, e.getMessage());
        }
    }

    public boolean tryAcquireDefault(String toolId) {
        return tryAcquire(toolId, rateLimitProperties.getDefaultMaxConcurrent());
    }
}