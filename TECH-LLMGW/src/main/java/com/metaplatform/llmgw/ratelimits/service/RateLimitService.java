package com.metaplatform.llmgw.ratelimits.service;

import com.metaplatform.llmgw.entity.RateLimitRuleEntity;
import com.metaplatform.llmgw.ratelimits.dto.CreateRateLimitRuleRequest;
import com.metaplatform.llmgw.ratelimits.dto.RateLimitRuleDto;
import com.metaplatform.llmgw.ratelimits.dto.RateLimitStatsDto;
import com.metaplatform.llmgw.repository.RateLimitRuleEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final RateLimitRuleEntityRepository rateLimitRuleEntityRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String RPM_KEY_PREFIX = "llmgw:ratelimit:rpm:";
    private static final DateTimeFormatter MINUTE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    @Transactional
    public RateLimitRuleDto create(CreateRateLimitRuleRequest request) {
        RateLimitRuleEntity entity = new RateLimitRuleEntity();
        entity.setName(request.name());
        entity.setScope(request.scope() == null ? "user" : request.scope());
        entity.setScopeKey(request.scopeKey());
        entity.setModelId(request.modelId());
        entity.setRpm(request.rpm() == null ? 60 : request.rpm());
        entity.setTpm(request.tpm());
        entity.setConcurrent(request.concurrent());
        entity.setIsActive(request.isActive() == null ? Boolean.TRUE : request.isActive());
        RateLimitRuleEntity saved = rateLimitRuleEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public RateLimitRuleDto getById(Long id) {
        RateLimitRuleEntity entity = rateLimitRuleEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rate limit rule not found: " + id));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public Page<RateLimitRuleDto> listAll(Pageable pageable) {
        return rateLimitRuleEntityRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional
    public RateLimitRuleDto update(Long id, CreateRateLimitRuleRequest request) {
        RateLimitRuleEntity entity = rateLimitRuleEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rate limit rule not found: " + id));
        entity.setName(request.name());
        entity.setScope(request.scope() == null ? entity.getScope() : request.scope());
        entity.setScopeKey(request.scopeKey());
        entity.setModelId(request.modelId());
        entity.setRpm(request.rpm() == null ? entity.getRpm() : request.rpm());
        entity.setTpm(request.tpm());
        entity.setConcurrent(request.concurrent());
        entity.setIsActive(request.isActive() == null ? entity.getIsActive() : request.isActive());
        RateLimitRuleEntity saved = rateLimitRuleEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        rateLimitRuleEntityRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public boolean checkLimit(String scope, String scopeKey, String modelId) {
        List<RateLimitRuleEntity> rules = rateLimitRuleEntityRepository.findByScopeAndScopeKey(scope, scopeKey);
        String minuteBucket = LocalDateTime.now().format(MINUTE_FORMATTER);
        for (RateLimitRuleEntity rule : rules) {
            if (Boolean.FALSE.equals(rule.getIsActive())) {
                continue;
            }
            if (rule.getModelId() != null && !rule.getModelId().equals(modelId)) {
                continue;
            }
            if (rule.getRpm() != null && rule.getRpm() > 0) {
                String key = buildRpmKey(rule.getId(), scope, scopeKey, modelId, minuteBucket);
                String value = redisTemplate.opsForValue().get(key);
                long current = value == null ? 0L : Long.parseLong(value);
                if (current >= rule.getRpm()) {
                    return false;
                }
            }
        }
        return true;
    }

    public void incrementCounter(String scope, String scopeKey, String modelId) {
        List<RateLimitRuleEntity> rules = rateLimitRuleEntityRepository.findByScopeAndScopeKey(scope, scopeKey);
        String minuteBucket = LocalDateTime.now().format(MINUTE_FORMATTER);
        for (RateLimitRuleEntity rule : rules) {
            if (Boolean.FALSE.equals(rule.getIsActive())) {
                continue;
            }
            if (rule.getModelId() != null && !rule.getModelId().equals(modelId)) {
                continue;
            }
            if (rule.getRpm() != null && rule.getRpm() > 0) {
                String key = buildRpmKey(rule.getId(), scope, scopeKey, modelId, minuteBucket);
                redisTemplate.opsForValue().increment(key);
                redisTemplate.expire(key, Duration.ofSeconds(120));
            }
        }
    }

    @Transactional(readOnly = true)
    public RateLimitStatsDto getStats(Long id) {
        RateLimitRuleEntity entity = rateLimitRuleEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rate limit rule not found: " + id));
        String minuteBucket = LocalDateTime.now().format(MINUTE_FORMATTER);
        String key = buildRpmKey(entity.getId(), entity.getScope(), entity.getScopeKey(), entity.getModelId(), minuteBucket);
        String value = redisTemplate.opsForValue().get(key);
        long current = value == null ? 0L : Long.parseLong(value);
        boolean limited = entity.getRpm() != null && current >= entity.getRpm();
        return new RateLimitStatsDto(entity.getId(), entity.getName(), entity.getRpm(), current, limited);
    }

    public void resetCounters(Long id) {
        RateLimitRuleEntity entity = rateLimitRuleEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rate limit rule not found: " + id));
        String pattern = RPM_KEY_PREFIX + id + ":*";
        java.util.Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    private String buildRpmKey(Long ruleId, String scope, String scopeKey, String modelId, String minuteBucket) {
        return RPM_KEY_PREFIX + ruleId + ":" + scope + ":" + scopeKey + ":" + modelId + ":" + minuteBucket;
    }

    private RateLimitRuleDto toDto(RateLimitRuleEntity entity) {
        return new RateLimitRuleDto(
                entity.getId(),
                entity.getName(),
                entity.getScope(),
                entity.getScopeKey(),
                entity.getModelId(),
                entity.getRpm(),
                entity.getTpm(),
                entity.getConcurrent(),
                entity.getIsActive(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
