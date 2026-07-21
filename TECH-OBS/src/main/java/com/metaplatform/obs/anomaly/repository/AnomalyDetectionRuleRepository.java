package com.metaplatform.obs.anomaly.repository;

import com.metaplatform.obs.anomaly.entity.AnomalyDetectionRuleEntity;
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
public class AnomalyDetectionRuleRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<AnomalyDetectionRuleEntity> ROW_MAPPER = (rs, rowNum) ->
            AnomalyDetectionRuleEntity.builder()
                    .id(rs.getObject("id", UUID.class))
                    .tenantId(rs.getString("tenant_id"))
                    .name(rs.getString("name"))
                    .metricType(rs.getString("metric_type"))
                    .conditionOperator(rs.getString("condition_operator"))
                    .threshold(rs.getDouble("threshold"))
                    .timeWindowSeconds(rs.getInt("time_window_seconds"))
                    .aggregationFunction(rs.getString("aggregation_function"))
                    .severity(rs.getString("severity"))
                    .enabled(rs.getBoolean("enabled"))
                    .createdAt(rs.getTimestamp("created_at") != null
                            ? rs.getTimestamp("created_at").toInstant() : Instant.now())
                    .updatedAt(rs.getTimestamp("updated_at") != null
                            ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
                    .deletedAt(rs.getTimestamp("deleted_at") != null
                            ? rs.getTimestamp("deleted_at").toInstant() : null)
                    .build();

    public AnomalyDetectionRuleEntity insert(AnomalyDetectionRuleEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant now = Instant.now();
        String sql = "INSERT INTO obs_anomaly_detection_rule (id, tenant_id, name, metric_type, condition_operator, threshold, "
                + "time_window_seconds, aggregation_function, severity, enabled, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getName(),
                entity.getMetricType(),
                entity.getConditionOperator(),
                entity.getThreshold(),
                entity.getTimeWindowSeconds(),
                entity.getAggregationFunction(),
                entity.getSeverity(),
                entity.isEnabled(),
                Timestamp.from(now),
                Timestamp.from(now));
        entity.setId(id);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public Optional<AnomalyDetectionRuleEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, name, metric_type, condition_operator, threshold, time_window_seconds, "
                + "aggregation_function, severity, enabled, created_at, updated_at, deleted_at "
                + "FROM obs_anomaly_detection_rule WHERE id = ? AND deleted_at IS NULL";
        List<AnomalyDetectionRuleEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<AnomalyDetectionRuleEntity> findAll(String tenantId) {
        String sql = "SELECT id, tenant_id, name, metric_type, condition_operator, threshold, time_window_seconds, "
                + "aggregation_function, severity, enabled, created_at, updated_at, deleted_at "
                + "FROM obs_anomaly_detection_rule WHERE tenant_id = ? AND deleted_at IS NULL "
                + "ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public List<AnomalyDetectionRuleEntity> findAllEnabled(String tenantId) {
        String sql = "SELECT id, tenant_id, name, metric_type, condition_operator, threshold, time_window_seconds, "
                + "aggregation_function, severity, enabled, created_at, updated_at, deleted_at "
                + "FROM obs_anomaly_detection_rule WHERE tenant_id = ? AND deleted_at IS NULL AND enabled = TRUE";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public AnomalyDetectionRuleEntity update(AnomalyDetectionRuleEntity entity) {
        Instant now = Instant.now();
        String sql = "UPDATE obs_anomaly_detection_rule SET name = ?, metric_type = ?, condition_operator = ?, threshold = ?, "
                + "time_window_seconds = ?, aggregation_function = ?, severity = ?, enabled = ?, updated_at = ? "
                + "WHERE id = ? AND deleted_at IS NULL";
        jdbcTemplate.update(sql,
                entity.getName(),
                entity.getMetricType(),
                entity.getConditionOperator(),
                entity.getThreshold(),
                entity.getTimeWindowSeconds(),
                entity.getAggregationFunction(),
                entity.getSeverity(),
                entity.isEnabled(),
                Timestamp.from(now),
                entity.getId());
        entity.setUpdatedAt(now);
        return entity;
    }

    public int softDelete(UUID id) {
        String sql = "UPDATE obs_anomaly_detection_rule SET deleted_at = ?, enabled = FALSE "
                + "WHERE id = ? AND deleted_at IS NULL";
        return jdbcTemplate.update(sql, Timestamp.from(Instant.now()), id);
    }
}
