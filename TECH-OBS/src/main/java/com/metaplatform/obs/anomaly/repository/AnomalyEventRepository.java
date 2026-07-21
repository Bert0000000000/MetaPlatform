package com.metaplatform.obs.anomaly.repository;

import com.metaplatform.obs.anomaly.entity.AnomalyEventEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Repository
@RequiredArgsConstructor
public class AnomalyEventRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<AnomalyEventEntity> ROW_MAPPER = (rs, rowNum) ->
            AnomalyEventEntity.builder()
                    .id(rs.getObject("id", UUID.class))
                    .tenantId(rs.getString("tenant_id"))
                    .ruleId(rs.getObject("rule_id", UUID.class))
                    .anomalyType(rs.getString("anomaly_type"))
                    .severity(rs.getString("severity"))
                    .serviceName(rs.getString("service_name"))
                    .traceId(rs.getString("trace_id"))
                    .metricValue(rs.getDouble("metric_value"))
                    .rootCause(rs.getString("root_cause"))
                    .remediationAction(rs.getString("remediation_action"))
                    .status(rs.getString("status"))
                    .detectedAt(rs.getTimestamp("detected_at") != null
                            ? rs.getTimestamp("detected_at").toInstant() : Instant.now())
                    .resolvedAt(rs.getTimestamp("resolved_at") != null
                            ? rs.getTimestamp("resolved_at").toInstant() : null)
                    .createdAt(rs.getTimestamp("created_at") != null
                            ? rs.getTimestamp("created_at").toInstant() : Instant.now())
                    .updatedAt(rs.getTimestamp("updated_at") != null
                            ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
                    .build();

    public AnomalyEventEntity insert(AnomalyEventEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant now = Instant.now();
        String sql = "INSERT INTO obs_anomaly_event (id, tenant_id, rule_id, anomaly_type, severity, "
                + "service_name, trace_id, metric_value, root_cause, remediation_action, status, detected_at, "
                + "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getRuleId(),
                entity.getAnomalyType(),
                entity.getSeverity(),
                entity.getServiceName(),
                entity.getTraceId(),
                entity.getMetricValue(),
                entity.getRootCause(),
                entity.getRemediationAction(),
                entity.getStatus(),
                Timestamp.from(entity.getDetectedAt() != null ? entity.getDetectedAt() : now),
                Timestamp.from(now),
                Timestamp.from(now));
        entity.setId(id);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public Optional<AnomalyEventEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, rule_id, anomaly_type, severity, service_name, trace_id, "
                + "metric_value, root_cause, remediation_action, status, detected_at, resolved_at, "
                + "created_at, updated_at FROM obs_anomaly_event WHERE id = ?";
        List<AnomalyEventEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<AnomalyEventEntity> findByTenant(String tenantId) {
        String sql = "SELECT id, tenant_id, rule_id, anomaly_type, severity, service_name, trace_id, "
                + "metric_value, root_cause, remediation_action, status, detected_at, resolved_at, "
                + "created_at, updated_at FROM obs_anomaly_event WHERE tenant_id = ? "
                + "ORDER BY detected_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public List<AnomalyEventEntity> findByTenantAndStatus(String tenantId, String status) {
        String sql = "SELECT id, tenant_id, rule_id, anomaly_type, severity, service_name, trace_id, "
                + "metric_value, root_cause, remediation_action, status, detected_at, resolved_at, "
                + "created_at, updated_at FROM obs_anomaly_event WHERE tenant_id = ? AND status = ? "
                + "ORDER BY detected_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId, status);
    }

    public int updateStatus(UUID id, String status, Instant resolvedAt) {
        String sql = "UPDATE obs_anomaly_event SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?";
        return jdbcTemplate.update(sql, status, resolvedAt != null ? Timestamp.from(resolvedAt) : null,
                Timestamp.from(Instant.now()), id);
    }

    public int updateRootCause(UUID id, String rootCause) {
        String sql = "UPDATE obs_anomaly_event SET root_cause = ?, updated_at = ? WHERE id = ?";
        return jdbcTemplate.update(sql, rootCause, Timestamp.from(Instant.now()), id);
    }

    public int updateRemediationAction(UUID id, String remediationAction) {
        String sql = "UPDATE obs_anomaly_event SET remediation_action = ?, updated_at = ? WHERE id = ?";
        return jdbcTemplate.update(sql, remediationAction, Timestamp.from(Instant.now()), id);
    }
}
