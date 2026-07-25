package com.metaplatform.data.monitoring;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.MonitoringAlertEntity;
import com.metaplatform.data.entity.MonitoringLogEntity;
import com.metaplatform.data.entity.SlaRecordEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.monitoring.dto.AlertResponse;
import com.metaplatform.data.monitoring.dto.MonitoringLogResponse;
import com.metaplatform.data.monitoring.dto.MonitoringOverviewResponse;
import com.metaplatform.data.monitoring.dto.SlaResponse;
import com.metaplatform.data.repository.MonitoringAlertRepository;
import com.metaplatform.data.repository.MonitoringLogRepository;
import com.metaplatform.data.repository.SlaRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 监控告警服务：overview/sla/alerts + ack/resolve + logs。
 *
 * <p>对应 Python app/monitoring/service.py 的 MonitoringService。</p>
 *
 * <p>持久化存储（monitoring_alert / monitoring_log / sla_record 表）；
 * 组件健康度检查保留为静态配置（未来对接 Prometheus）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringService {

    private final ObjectMapper objectMapper;
    private final MonitoringAlertRepository monitoringAlertRepository;
    private final MonitoringLogRepository monitoringLogRepository;
    private final SlaRecordRepository slaRecordRepository;

    /**
     * 监控概览（从 Repository 聚合真实指标）。
     */
    @Transactional(readOnly = true)
    public MonitoringOverviewResponse overview() {
        String tenantId = TenantContext.getTenantIdOrDefault();

        long activeAlerts = countAlerts(tenantId, "ACTIVE", null);
        long critical = countAlerts(tenantId, "ACTIVE", "CRITICAL");
        long warning = countAlerts(tenantId, "ACTIVE", "WARNING");
        long info = countAlerts(tenantId, "ACTIVE", "INFO");

        // SLA 达成率
        long totalSla = slaRecordRepository.findByTenantIdOrderByMeasuredAtDesc(tenantId,
                PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "measuredAt"))).getTotalElements();
        long metSla = slaRecordRepository.findByTenantIdAndStatus(tenantId, "MET",
                PageRequest.of(0, 1)).getTotalElements();
        double slaRate = totalSla > 0 ? (double) metSla / totalSla : 1.0;

        // 组件健康度：静态配置（未来对接 Prometheus）
        Map<String, Double> componentHealth = new LinkedHashMap<>();
        componentHealth.put("database", 1.0);
        componentHealth.put("etl", 1.0);
        componentHealth.put("warehouse", 1.0);
        componentHealth.put("lakehouse", 1.0);

        return MonitoringOverviewResponse.builder()
                .activeAlerts((int) activeAlerts)
                .criticalAlerts((int) critical)
                .warningAlerts((int) warning)
                .infoAlerts((int) info)
                .overallHealth(slaRate)
                .componentHealth(componentHealth)
                .generatedAt(OffsetDateTime.now())
                .build();
    }

    /**
     * SLA 报告。
     */
    @Transactional(readOnly = true)
    public PageResponse<SlaResponse> sla(String component, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "measuredAt"));

        Page<SlaRecordEntity> result;
        if (component != null && !component.isBlank()) {
            result = slaRecordRepository.findByTenantIdAndTargetTypeAndTargetId(
                    tenantId, "component", component, pageable);
        } else {
            result = slaRecordRepository.findByTenantIdOrderByMeasuredAtDesc(tenantId, pageable);
        }

        return PageResponse.of(
                result.getContent().stream().map(this::toSlaResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 告警列表。
     */
    @Transactional(readOnly = true)
    public PageResponse<AlertResponse> alerts(String severity, String status, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "triggeredAt"));

        MonitoringAlertEntity probe = new MonitoringAlertEntity();
        probe.setTenantId(tenantId);
        if (status != null && !status.isBlank()) {
            probe.setStatus(status);
        }
        if (severity != null && !severity.isBlank()) {
            probe.setSeverity(severity);
        }
        Page<MonitoringAlertEntity> result = monitoringAlertRepository.findAll(Example.of(probe), pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toAlertResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * ACK 告警。
     */
    @Transactional
    public AlertResponse ack(String alertId) {
        MonitoringAlertEntity entity = requireAlert(alertId);
        entity.setStatus("ACKNOWLEDGED");
        MonitoringAlertEntity saved = monitoringAlertRepository.save(entity);
        log.info("告警 ACK | id={}", alertId);
        AlertResponse resp = toAlertResponse(saved);
        resp.setAcknowledgedBy(TenantContext.getUserId() != null ? TenantContext.getUserId() : "system");
        resp.setAcknowledgedAt(OffsetDateTime.now());
        return resp;
    }

    /**
     * 解决告警。
     */
    @Transactional
    public AlertResponse resolve(String alertId) {
        MonitoringAlertEntity entity = requireAlert(alertId);
        entity.setStatus("RESOLVED");
        entity.setResolvedAt(OffsetDateTime.now());
        MonitoringAlertEntity saved = monitoringAlertRepository.save(entity);
        log.info("告警解决 | id={}", alertId);
        return toAlertResponse(saved);
    }

    /**
     * 监控日志。
     */
    @Transactional(readOnly = true)
    public PageResponse<MonitoringLogResponse> logs(String component, String level, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        MonitoringLogEntity probe = new MonitoringLogEntity();
        probe.setTenantId(tenantId);
        if (component != null && !component.isBlank()) {
            probe.setComponent(component);
        }
        if (level != null && !level.isBlank()) {
            probe.setLevel(level);
        }
        Page<MonitoringLogEntity> result = monitoringLogRepository.findAll(Example.of(probe), pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toLogResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private long countAlerts(String tenantId, String status, String severity) {
        MonitoringAlertEntity probe = new MonitoringAlertEntity();
        probe.setTenantId(tenantId);
        if (status != null) {
            probe.setStatus(status);
        }
        if (severity != null) {
            probe.setSeverity(severity);
        }
        return monitoringAlertRepository.count(Example.of(probe));
    }

    private MonitoringAlertEntity requireAlert(String alertId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return monitoringAlertRepository.findByIdAndTenantId(alertId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.ALERT_NOT_FOUND, "告警不存在: " + alertId));
    }

    private AlertResponse toAlertResponse(MonitoringAlertEntity entity) {
        return AlertResponse.builder()
                .alertId(entity.getId())
                .tenantId(entity.getTenantId())
                .severity(entity.getSeverity())
                .component(entity.getSource())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .context(parseMap(entity.getMetadata()))
                .triggeredAt(entity.getTriggeredAt())
                .resolvedAt(entity.getResolvedAt())
                .build();
    }

    private MonitoringLogResponse toLogResponse(MonitoringLogEntity entity) {
        return MonitoringLogResponse.builder()
                .logId(String.valueOf(entity.getId()))
                .component(entity.getComponent())
                .level(entity.getLevel())
                .message(entity.getMessage())
                .context(parseMap(entity.getMetadata()))
                .timestamp(entity.getCreatedAt())
                .build();
    }

    private SlaResponse toSlaResponse(SlaRecordEntity entity) {
        double actual = entity.getActual() != null ? entity.getActual() : 0.0;
        double threshold = entity.getThreshold() != null ? entity.getThreshold() : 0.0;
        boolean meetsTarget = "MET".equals(entity.getStatus());
        return SlaResponse.builder()
                .component(entity.getTargetId())
                .uptime(actual)
                .targetUptime(threshold)
                .meetsTarget(meetsTarget)
                .totalRequests(0L)
                .failedRequests(0L)
                .errorRate(0.0)
                .p99LatencyMs(0.0)
                .avgLatencyMs(0.0)
                .details(Collections.emptyMap())
                .build();
    }

    private Map<String, Object> parseMap(String json) {
        if (json == null || json.isBlank()) return Collections.emptyMap();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }
}
