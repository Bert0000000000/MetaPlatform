package com.metaplatform.llmgw.quotas.service;

import com.metaplatform.llmgw.entity.QuotaEntity;
import com.metaplatform.llmgw.quotas.dto.CreateQuotaRequest;
import com.metaplatform.llmgw.quotas.dto.QuotaDto;
import com.metaplatform.llmgw.repository.QuotaEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class QuotaService {

    private final QuotaEntityRepository quotaEntityRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String QUOTA_KEY_PREFIX = "llmgw:quota:";
    private static final DateTimeFormatter DAY_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMM");

    @Transactional
    public QuotaDto create(CreateQuotaRequest request) {
        QuotaEntity entity = new QuotaEntity();
        entity.setScope(request.scope() == null ? "user" : request.scope());
        entity.setScopeKey(request.scopeKey());
        entity.setModelId(request.modelId());
        entity.setDailyTokenLimit(request.dailyTokenLimit());
        entity.setMonthlyTokenLimit(request.monthlyTokenLimit());
        entity.setDailyRequestLimit(request.dailyRequestLimit());
        entity.setMonthlyRequestLimit(request.monthlyRequestLimit());
        entity.setPeriodStart(request.periodStart() == null ? LocalDate.now() : request.periodStart());
        entity.setIsActive(request.isActive() == null ? Boolean.TRUE : request.isActive());
        QuotaEntity saved = quotaEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public QuotaDto getById(Long id) {
        QuotaEntity entity = quotaEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Quota not found: " + id));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public Page<QuotaDto> listAll(Pageable pageable) {
        return quotaEntityRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional
    public QuotaDto update(Long id, CreateQuotaRequest request) {
        QuotaEntity entity = quotaEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Quota not found: " + id));
        entity.setScope(request.scope() == null ? entity.getScope() : request.scope());
        entity.setScopeKey(request.scopeKey());
        entity.setModelId(request.modelId());
        entity.setDailyTokenLimit(request.dailyTokenLimit());
        entity.setMonthlyTokenLimit(request.monthlyTokenLimit());
        entity.setDailyRequestLimit(request.dailyRequestLimit());
        entity.setMonthlyRequestLimit(request.monthlyRequestLimit());
        entity.setPeriodStart(request.periodStart() == null ? entity.getPeriodStart() : request.periodStart());
        entity.setIsActive(request.isActive() == null ? entity.getIsActive() : request.isActive());
        QuotaEntity saved = quotaEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        quotaEntityRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public boolean checkQuota(String scope, String scopeKey, String modelId, int tokenCount) {
        QuotaEntity quota = quotaEntityRepository.findByScopeAndScopeKeyAndModelId(scope, scopeKey, modelId)
                .orElse(null);
        if (quota == null || Boolean.FALSE.equals(quota.getIsActive())) {
            return true;
        }
        LocalDate now = LocalDate.now();
        String daySuffix = now.format(DAY_FORMATTER);
        String monthSuffix = now.format(MONTH_FORMATTER);
        long dailyTokens = getCount(buildTokenKey(scope, scopeKey, modelId, "daily", daySuffix));
        long monthlyTokens = getCount(buildTokenKey(scope, scopeKey, modelId, "monthly", monthSuffix));
        long dailyRequests = getCount(buildRequestKey(scope, scopeKey, modelId, "daily", daySuffix));
        long monthlyRequests = getCount(buildRequestKey(scope, scopeKey, modelId, "monthly", monthSuffix));
        if (quota.getDailyTokenLimit() != null && dailyTokens + tokenCount > quota.getDailyTokenLimit()) {
            return false;
        }
        if (quota.getMonthlyTokenLimit() != null && monthlyTokens + tokenCount > quota.getMonthlyTokenLimit()) {
            return false;
        }
        if (quota.getDailyRequestLimit() != null && dailyRequests + 1 > quota.getDailyRequestLimit()) {
            return false;
        }
        if (quota.getMonthlyRequestLimit() != null && monthlyRequests + 1 > quota.getMonthlyRequestLimit()) {
            return false;
        }
        return true;
    }

    public void incrementUsage(String scope, String scopeKey, String modelId, int tokens) {
        LocalDate now = LocalDate.now();
        String daySuffix = now.format(DAY_FORMATTER);
        String monthSuffix = now.format(MONTH_FORMATTER);
        increment(buildTokenKey(scope, scopeKey, modelId, "daily", daySuffix), tokens, Duration.ofDays(2));
        increment(buildTokenKey(scope, scopeKey, modelId, "monthly", monthSuffix), tokens, Duration.ofDays(32));
        increment(buildRequestKey(scope, scopeKey, modelId, "daily", daySuffix), 1, Duration.ofDays(2));
        increment(buildRequestKey(scope, scopeKey, modelId, "monthly", monthSuffix), 1, Duration.ofDays(32));
    }

    private long getCount(String key) {
        String value = redisTemplate.opsForValue().get(key);
        return value == null ? 0L : Long.parseLong(value);
    }

    private void increment(String key, long delta, Duration ttl) {
        redisTemplate.opsForValue().increment(key, delta);
        redisTemplate.expire(key, ttl);
    }

    private String buildTokenKey(String scope, String scopeKey, String modelId, String period, String suffix) {
        return QUOTA_KEY_PREFIX + "tokens:" + period + ":" + scope + ":" + scopeKey + ":" + modelId + ":" + suffix;
    }

    private String buildRequestKey(String scope, String scopeKey, String modelId, String period, String suffix) {
        return QUOTA_KEY_PREFIX + "requests:" + period + ":" + scope + ":" + scopeKey + ":" + modelId + ":" + suffix;
    }

    private QuotaDto toDto(QuotaEntity entity) {
        return new QuotaDto(
                entity.getId(),
                entity.getScope(),
                entity.getScopeKey(),
                entity.getModelId(),
                entity.getDailyTokenLimit(),
                entity.getMonthlyTokenLimit(),
                entity.getDailyRequestLimit(),
                entity.getMonthlyRequestLimit(),
                entity.getPeriodStart(),
                entity.getIsActive(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
