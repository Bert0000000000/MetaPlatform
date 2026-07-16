package com.metaplatform.ai.billing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Token billing service:
 * - In-memory counter (real-time stats, low latency)
 * - Redis distributed counter (shared across instances)
 * - PG persistence (daily aggregation)
 * - Daily quota check
 */
@Service
public class TokenBillingService {

    private static final Logger log = LoggerFactory.getLogger(TokenBillingService.class);
    private static final String REDIS_PREFIX = "billing:tokens:";
    private static final long REDIS_TTL_HOURS = 48;

    private final BillingRepository billingRepository;
    private final StringRedisTemplate redisTemplate;
    private final long dailyQuotaPerTenant;

    /**
     * In-memory counter: tenantId -> (date -> totalTokens)
     */
    private final Map<String, Map<String, Long>> inMemoryCounters = new ConcurrentHashMap<>();

    public TokenBillingService(BillingRepository billingRepository,
                               StringRedisTemplate redisTemplate,
                               @Value("${ai.billing.daily-quota-per-tenant:1000000}") long dailyQuotaPerTenant) {
        this.billingRepository = billingRepository;
        this.redisTemplate = redisTemplate;
        this.dailyQuotaPerTenant = dailyQuotaPerTenant;
    }

    /**
     * Record token usage.
     * Writes to in-memory counter + Redis counter + PG (async/batch in future).
     */
    public void recordUsage(String tenantId, String model, int promptTokens, int completionTokens) {
        int totalTokens = promptTokens + completionTokens;
        String today = LocalDate.now().toString();

        // 1. In-memory counter
        inMemoryCounters
                .computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>())
                .merge(today, (long) totalTokens, Long::sum);

        // 2. Redis counter
        try {
            String redisKey = buildRedisKey(tenantId, today);
            redisTemplate.opsForValue().increment(redisKey, totalTokens);
            redisTemplate.expire(redisKey, REDIS_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to update Redis counter: {}", e.getMessage());
        }

        // 3. PG persistence (v0.1: synchronous, optimize to batch later)
        try {
            TokenUsage usage = new TokenUsage(
                    UUID.fromString(tenantId), model, promptTokens, completionTokens);
            billingRepository.save(usage);
        } catch (Exception e) {
            log.error("Failed to persist token usage: {}", e.getMessage());
        }

        log.debug("Recorded token usage: tenant={}, model={}, prompt={}, completion={}, total={}",
                tenantId, model, promptTokens, completionTokens, totalTokens);
    }

    /**
     * Check if daily quota is exceeded
     */
    public boolean isQuotaExceeded(String tenantId) {
        long usage = getDailyUsage(tenantId);
        return usage >= dailyQuotaPerTenant;
    }

    /**
     * Get today's usage (in-memory first, Redis fallback, PG final fallback)
     */
    public long getDailyUsage(String tenantId) {
        String today = LocalDate.now().toString();

        // 1. Try in-memory
        Map<String, Long> tenantCounters = inMemoryCounters.get(tenantId);
        if (tenantCounters != null && tenantCounters.containsKey(today)) {
            return tenantCounters.get(today);
        }

        // 2. Try Redis
        try {
            String redisKey = buildRedisKey(tenantId, today);
            String value = redisTemplate.opsForValue().get(redisKey);
            if (value != null) {
                return Long.parseLong(value);
            }
        } catch (Exception e) {
            log.warn("Failed to read from Redis: {}", e.getMessage());
        }

        // 3. Query PG
        try {
            Integer sum = billingRepository.sumTotalTokensByTenantAndDate(
                    UUID.fromString(tenantId), LocalDate.now());
            return sum != null ? sum : 0;
        } catch (Exception e) {
            log.warn("Failed to query PG: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Get usage summary
     */
    public BillingSummary getSummary(String tenantId) {
        long dailyUsage = getDailyUsage(tenantId);
        LocalDate today = LocalDate.now();

        // Aggregate by model
        Map<String, Long> byModel = new HashMap<>();
        try {
            List<Object[]> modelStats = billingRepository.sumTokensByModelAndDate(
                    UUID.fromString(tenantId), today);
            for (Object[] row : modelStats) {
                byModel.put((String) row[0], ((Number) row[1]).longValue());
            }
        } catch (Exception e) {
            log.warn("Failed to query model stats: {}", e.getMessage());
        }

        return new BillingSummary(
                tenantId,
                today.toString(),
                dailyUsage,
                dailyQuotaPerTenant,
                dailyQuotaPerTenant - dailyUsage,
                byModel
        );
    }

    /**
     * Usage summary record
     */
    public record BillingSummary(
        String tenantId,
        String date,
        long dailyUsage,
        long dailyQuota,
        long remainingQuota,
        Map<String, Long> usageByModel
    ) {}

    private String buildRedisKey(String tenantId, String date) {
        return REDIS_PREFIX + tenantId + ":" + date;
    }
}
