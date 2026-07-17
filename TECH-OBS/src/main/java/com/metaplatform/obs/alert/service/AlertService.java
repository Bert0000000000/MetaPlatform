package com.metaplatform.obs.alert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.alert.dto.AlertRuleRequest;
import com.metaplatform.obs.alert.dto.AlertStatistics;
import com.metaplatform.obs.alert.dto.NotificationChannelRequest;
import com.metaplatform.obs.alert.dto.SilenceRequest;
import com.metaplatform.obs.alert.entity.AlertEntity;
import com.metaplatform.obs.alert.entity.AlertRuleEntity;
import com.metaplatform.obs.alert.entity.AlertSilenceEntity;
import com.metaplatform.obs.alert.entity.NotificationChannelEntity;
import com.metaplatform.obs.alert.repository.AlertRepository;
import com.metaplatform.obs.alert.repository.AlertRuleRepository;
import com.metaplatform.obs.alert.repository.AlertSilenceRepository;
import com.metaplatform.obs.alert.repository.NotificationChannelRepository;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.exception.ObsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private static final Set<String> VALID_OPERATORS = Set.of("GT", "LT", "EQ", "GTE", "LTE");
    private static final Set<String> VALID_SEVERITIES = Set.of("INFO", "WARNING", "CRITICAL");
    private static final Set<String> VALID_CHANNEL_TYPES = Set.of("email", "webhook", "feishu", "slack");

    private final AlertRuleRepository ruleRepository;
    private final AlertRepository alertRepository;
    private final AlertSilenceRepository silenceRepository;
    private final NotificationChannelRepository channelRepository;
    private final ObjectMapper objectMapper;

    public AlertRuleEntity createRule(AlertRuleRequest request) {
        validateRuleRequest(request);
        String tenantId = TenantContext.get();
        AlertRuleEntity entity = AlertRuleEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .metricName(request.getMetricName())
                .conditionOperator(request.getConditionOperator().toUpperCase())
                .threshold(request.getThreshold())
                .durationSeconds(request.getDurationSeconds() <= 0 ? 60 : request.getDurationSeconds())
                .severity(request.getSeverity() != null ? request.getSeverity().toUpperCase() : "WARNING")
                .notificationChannels(request.getNotificationChannels())
                .enabled(request.getEnabled() == null || request.getEnabled())
                .build();
        AlertRuleEntity saved = ruleRepository.insert(entity);
        JsonNode channels = request.getNotificationChannels();
        if (channels != null) {
            saved.setNotificationChannels(channels);
        }
        return saved;
    }

    public AlertRuleEntity updateRule(UUID id, AlertRuleRequest request) {
        validateRuleRequest(request);
        AlertRuleEntity existing = ruleRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "告警规则不存在: " + id));
        existing.setName(request.getName());
        existing.setMetricName(request.getMetricName());
        existing.setConditionOperator(request.getConditionOperator().toUpperCase());
        existing.setThreshold(request.getThreshold());
        existing.setDurationSeconds(request.getDurationSeconds() <= 0 ? 60 : request.getDurationSeconds());
        existing.setSeverity(request.getSeverity() != null ? request.getSeverity().toUpperCase() : "WARNING");
        existing.setNotificationChannels(request.getNotificationChannels());
        existing.setEnabled(request.getEnabled() == null || request.getEnabled());
        AlertRuleEntity updated = ruleRepository.update(existing);
        if (request.getNotificationChannels() != null) {
            updated.setNotificationChannels(request.getNotificationChannels());
        }
        return updated;
    }

    public void deleteRule(UUID id) {
        AlertRuleEntity existing = ruleRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "告警规则不存在: " + id));
        int rows = ruleRepository.softDelete(existing.getId());
        if (rows == 0) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR, "删除告警规则失败");
        }
    }

    public AlertRuleEntity getRule(UUID id) {
        return ruleRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "告警规则不存在: " + id));
    }

    public List<AlertRuleEntity> listRules() {
        List<AlertRuleEntity> list = ruleRepository.findAll(TenantContext.get());
        hydrateChannels(list);
        return list;
    }

    public List<AlertEntity> listAlerts(String status) {
        String tenantId = TenantContext.get();
        List<AlertEntity> list;
        if (status != null && !status.isBlank()) {
            list = alertRepository.findByStatus(tenantId, status.toUpperCase());
        } else {
            list = alertRepository.findActive(tenantId);
        }
        return list;
    }

    @Transactional
    public AlertSilenceEntity silenceAlert(UUID alertId, SilenceRequest request) {
        AlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "告警不存在: " + alertId));
        if (alert.getStatus() != null && "RESOLVED".equalsIgnoreCase(alert.getStatus())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE, "已恢复的告警不能静默");
        }
        int duration = request.getDurationSeconds() <= 0 ? 3600 : request.getDurationSeconds();
        Instant until = Instant.now().plusSeconds(duration);
        AlertSilenceEntity silence = AlertSilenceEntity.builder()
                .alertId(alertId)
                .tenantId(alert.getTenantId())
                .silencedUntil(until)
                .reason(request.getReason())
                .createdBy(request.getCreatedBy())
                .build();
        silenceRepository.insert(silence);
        alertRepository.silence(alertId);
        return silence;
    }

    public AlertEntity recoverAlert(UUID alertId) {
        AlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "告警不存在: " + alertId));
        Instant now = Instant.now();
        alertRepository.resolve(alertId, now);
        alert.setStatus("RESOLVED");
        alert.setResolvedAt(now);
        return alert;
    }

    public List<AlertEntity> getHistory(UUID ruleId, Instant startTime, Instant endTime) {
        if (ruleId == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "ruleId 不能为空");
        }
        Instant start = startTime != null ? startTime : Instant.now().minusSeconds(86400 * 7);
        Instant end = endTime != null ? endTime : Instant.now();
        return alertRepository.findByRuleAndTimeRange(ruleId, start, end);
    }

    public AlertStatistics getStatistics() {
        String tenantId = TenantContext.get();
        long firing = alertRepository.countByStatus(tenantId, "FIRING");
        long silenced = alertRepository.countByStatus(tenantId, "SILENCED");
        long active = firing + silenced;
        long recoveredToday = alertRepository.countResolvedSince(tenantId,
                LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC));

        Map<String, Long> bySeverity = new HashMap<>();
        bySeverity.put("INFO", 0L);
        bySeverity.put("WARNING", 0L);
        bySeverity.put("CRITICAL", 0L);

        List<AlertRuleEntity> rules = ruleRepository.findAll(tenantId);
        Map<String, Long> ruleSeverityCount = new HashMap<>();
        for (AlertRuleEntity rule : rules) {
            ruleSeverityCount.merge(rule.getSeverity(), 1L, Long::sum);
        }
        for (Map.Entry<String, Long> e : ruleSeverityCount.entrySet()) {
            bySeverity.merge(e.getKey(), e.getValue(), Long::sum);
        }
        return AlertStatistics.builder()
                .active(active)
                .firing(firing)
                .silenced(silenced)
                .recoveredToday(recoveredToday)
                .bySeverity(bySeverity)
                .build();
    }

    public NotificationChannelEntity createChannel(NotificationChannelRequest request) {
        validateChannelRequest(request);
        NotificationChannelEntity entity = NotificationChannelEntity.builder()
                .tenantId(TenantContext.get())
                .name(request.getName())
                .type(request.getType().toLowerCase())
                .config(request.getConfig())
                .enabled(request.getEnabled() == null || request.getEnabled())
                .build();
        NotificationChannelEntity saved = channelRepository.insert(entity);
        if (request.getConfig() != null) {
            saved.setConfig(request.getConfig());
        }
        return saved;
    }

    public NotificationChannelEntity updateChannel(UUID id, NotificationChannelRequest request) {
        validateChannelRequest(request);
        NotificationChannelEntity existing = channelRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "通知通道不存在: " + id));
        existing.setName(request.getName());
        existing.setType(request.getType().toLowerCase());
        existing.setConfig(request.getConfig());
        existing.setEnabled(request.getEnabled() == null || request.getEnabled());
        NotificationChannelEntity updated = channelRepository.update(existing);
        if (request.getConfig() != null) {
            updated.setConfig(request.getConfig());
        }
        return updated;
    }

    public void deleteChannel(UUID id) {
        NotificationChannelEntity existing = channelRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "通知通道不存在: " + id));
        int rows = channelRepository.softDelete(existing.getId());
        if (rows == 0) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR, "删除通知通道失败");
        }
    }

    public NotificationChannelEntity getChannel(UUID id) {
        NotificationChannelEntity entity = channelRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "通知通道不存在: " + id));
        String raw = channelRepository.getConfigJson(id);
        if (raw != null) {
            try {
                entity.setConfig(objectMapper.readTree(raw));
            } catch (Exception e) {
                log.warn("Failed to parse channel config, id={}", id);
            }
        }
        return entity;
    }

    public List<NotificationChannelEntity> listChannels() {
        List<NotificationChannelEntity> list = channelRepository.findAll(TenantContext.get());
        for (NotificationChannelEntity entity : list) {
            String raw = channelRepository.getConfigJson(entity.getId());
            if (raw != null) {
                try {
                    entity.setConfig(objectMapper.readTree(raw));
                } catch (Exception e) {
                    log.warn("Failed to parse channel config, id={}", entity.getId());
                }
            }
        }
        return list;
    }

    /**
     * 评估单条规则是否触发,产生活动告警。
     * 由 AlertEvaluator 调用,公开以便服务测试可以独立触发。
     */
    public AlertEntity triggerIfMatched(AlertRuleEntity rule, double currentValue) {
        if (rule == null || !rule.isEnabled()) {
            return null;
        }
        if (!matches(rule, currentValue)) {
            return null;
        }
        AlertEntity alert = AlertEntity.builder()
                .ruleId(rule.getId())
                .tenantId(rule.getTenantId())
                .value(currentValue)
                .status("FIRING")
                .message(buildMessage(rule, currentValue))
                .triggeredAt(Instant.now())
                .build();
        return alertRepository.insert(alert);
    }

    boolean matches(AlertRuleEntity rule, double value) {
        return switch (rule.getConditionOperator()) {
            case "GT" -> value > rule.getThreshold();
            case "GTE" -> value >= rule.getThreshold();
            case "LT" -> value < rule.getThreshold();
            case "LTE" -> value <= rule.getThreshold();
            case "EQ" -> Double.compare(value, rule.getThreshold()) == 0;
            default -> false;
        };
    }

    private String buildMessage(AlertRuleEntity rule, double value) {
        return String.format("指标 %s 当前值 %.2f %s 阈值 %.2f,严重程度 %s",
                rule.getMetricName(), value, rule.getConditionOperator().toLowerCase(),
                rule.getThreshold(), rule.getSeverity());
    }

    private void validateRuleRequest(AlertRuleRequest request) {
        if (request == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "请求体不能为空");
        }
        if (request.getMetricName() == null || request.getMetricName().isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "metricName 不能为空");
        }
        if (request.getConditionOperator() == null
                || !VALID_OPERATORS.contains(request.getConditionOperator().toUpperCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "conditionOperator 必须是 GT/LT/EQ/GTE/LTE 之一");
        }
        if (request.getSeverity() != null
                && !VALID_SEVERITIES.contains(request.getSeverity().toUpperCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "severity 必须是 INFO/WARNING/CRITICAL 之一");
        }
    }

    private void validateChannelRequest(NotificationChannelRequest request) {
        if (request == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "请求体不能为空");
        }
        if (request.getName() == null || request.getName().isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "name 不能为空");
        }
        if (request.getType() == null
                || !VALID_CHANNEL_TYPES.contains(request.getType().toLowerCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "type 必须是 email/webhook/feishu/slack 之一");
        }
    }

    private void hydrateChannels(List<AlertRuleEntity> rules) {
        for (AlertRuleEntity rule : rules) {
            String raw = ruleRepository.getChannelsJson(rule.getId());
            if (raw != null) {
                try {
                    rule.setNotificationChannels(objectMapper.readTree(raw));
                } catch (Exception e) {
                    log.warn("Failed to parse rule channels, id={}", rule.getId());
                }
            }
        }
    }
}