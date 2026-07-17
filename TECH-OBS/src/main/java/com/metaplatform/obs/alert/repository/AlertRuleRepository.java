package com.metaplatform.obs.alert.repository;

import com.metaplatform.obs.alert.entity.AlertRuleEntity;
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
public class AlertRuleRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<AlertRuleEntity> ROW_MAPPER = (rs, rowNum) -> AlertRuleEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .name(rs.getString("name"))
            .metricName(rs.getString("metric_name"))
            .conditionOperator(rs.getString("condition_operator"))
            .threshold(rs.getDouble("threshold"))
            .durationSeconds(rs.getInt("duration_seconds"))
            .severity(rs.getString("severity"))
            .enabled(rs.getBoolean("enabled"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .updatedAt(rs.getTimestamp("updated_at") != null
                    ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
            .deletedAt(rs.getTimestamp("deleted_at") != null
                    ? rs.getTimestamp("deleted_at").toInstant() : null)
            .build();

    public AlertRuleEntity insert(AlertRuleEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant now = Instant.now();
        String sql = "INSERT INTO obs_alert_rule (id, tenant_id, name, metric_name, condition_operator, "
                + "threshold, duration_seconds, severity, notification_channels, enabled, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getName(),
                entity.getMetricName(),
                entity.getConditionOperator(),
                entity.getThreshold(),
                entity.getDurationSeconds(),
                entity.getSeverity(),
                entity.getNotificationChannels() != null ? entity.getNotificationChannels().toString() : "[]",
                entity.isEnabled(),
                Timestamp.from(now),
                Timestamp.from(now));
        entity.setId(id);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public Optional<AlertRuleEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, name, metric_name, condition_operator, threshold, duration_seconds, "
                + "severity, enabled, created_at, updated_at, deleted_at FROM obs_alert_rule "
                + "WHERE id = ? AND deleted_at IS NULL";
        List<AlertRuleEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<AlertRuleEntity> findAll(String tenantId) {
        String sql = "SELECT id, tenant_id, name, metric_name, condition_operator, threshold, duration_seconds, "
                + "severity, enabled, created_at, updated_at, deleted_at FROM obs_alert_rule "
                + "WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public List<AlertRuleEntity> findAllEnabled(String tenantId) {
        String sql = "SELECT id, tenant_id, name, metric_name, condition_operator, threshold, duration_seconds, "
                + "severity, enabled, created_at, updated_at, deleted_at FROM obs_alert_rule "
                + "WHERE tenant_id = ? AND deleted_at IS NULL AND enabled = TRUE";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public AlertRuleEntity update(AlertRuleEntity entity) {
        Instant now = Instant.now();
        String sql = "UPDATE obs_alert_rule SET name = ?, metric_name = ?, condition_operator = ?, "
                + "threshold = ?, duration_seconds = ?, severity = ?, notification_channels = ?::jsonb, "
                + "enabled = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL";
        jdbcTemplate.update(sql,
                entity.getName(),
                entity.getMetricName(),
                entity.getConditionOperator(),
                entity.getThreshold(),
                entity.getDurationSeconds(),
                entity.getSeverity(),
                entity.getNotificationChannels() != null ? entity.getNotificationChannels().toString() : "[]",
                entity.isEnabled(),
                Timestamp.from(now),
                entity.getId());
        entity.setUpdatedAt(now);
        return entity;
    }

    public int softDelete(UUID id) {
        String sql = "UPDATE obs_alert_rule SET deleted_at = ?, enabled = FALSE WHERE id = ? AND deleted_at IS NULL";
        return jdbcTemplate.update(sql, Timestamp.from(Instant.now()), id);
    }

    public String getChannelsJson(UUID id) {
        String sql = "SELECT notification_channels FROM obs_alert_rule WHERE id = ?";
        List<String> list = jdbcTemplate.query(sql, (rs, rn) -> rs.getString(1), id);
        return list.isEmpty() ? null : list.get(0);
    }
}