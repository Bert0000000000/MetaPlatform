package com.metaplatform.obs.alert.repository;

import com.metaplatform.obs.alert.entity.AlertEntity;
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
public class AlertRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<AlertEntity> ROW_MAPPER = (rs, rowNum) -> AlertEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .ruleId(rs.getObject("rule_id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .triggeredAt(rs.getTimestamp("triggered_at") != null
                    ? rs.getTimestamp("triggered_at").toInstant() : Instant.now())
            .resolvedAt(rs.getTimestamp("resolved_at") != null
                    ? rs.getTimestamp("resolved_at").toInstant() : null)
            .value(rs.getDouble("value"))
            .status(rs.getString("status"))
            .message(rs.getString("message"))
            .build();

    public AlertEntity insert(AlertEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant triggeredAt = entity.getTriggeredAt() != null ? entity.getTriggeredAt() : Instant.now();
        String sql = "INSERT INTO obs_alert (id, rule_id, tenant_id, triggered_at, resolved_at, value, status, message) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getRuleId(),
                entity.getTenantId(),
                Timestamp.from(triggeredAt),
                entity.getResolvedAt() != null ? Timestamp.from(entity.getResolvedAt()) : null,
                entity.getValue(),
                entity.getStatus(),
                entity.getMessage());
        entity.setId(id);
        entity.setTriggeredAt(triggeredAt);
        return entity;
    }

    public Optional<AlertEntity> findById(UUID id) {
        String sql = "SELECT id, rule_id, tenant_id, triggered_at, resolved_at, value, status, message "
                + "FROM obs_alert WHERE id = ?";
        List<AlertEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<AlertEntity> findByStatus(String tenantId, String status) {
        String sql = "SELECT id, rule_id, tenant_id, triggered_at, resolved_at, value, status, message "
                + "FROM obs_alert WHERE tenant_id = ? AND status = ? ORDER BY triggered_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId, status);
    }

    public List<AlertEntity> findActive(String tenantId) {
        String sql = "SELECT id, rule_id, tenant_id, triggered_at, resolved_at, value, status, message "
                + "FROM obs_alert WHERE tenant_id = ? AND status IN ('FIRING', 'SILENCED') "
                + "ORDER BY triggered_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public List<AlertEntity> findByRuleAndTimeRange(UUID ruleId, Instant start, Instant end) {
        String sql = "SELECT id, rule_id, tenant_id, triggered_at, resolved_at, value, status, message "
                + "FROM obs_alert WHERE rule_id = ? AND triggered_at >= ? AND triggered_at <= ? "
                + "ORDER BY triggered_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, ruleId, Timestamp.from(start), Timestamp.from(end));
    }

    public int resolve(UUID id, Instant resolvedAt) {
        String sql = "UPDATE obs_alert SET status = 'RESOLVED', resolved_at = ? WHERE id = ?";
        return jdbcTemplate.update(sql, Timestamp.from(resolvedAt), id);
    }

    public int silence(UUID id) {
        String sql = "UPDATE obs_alert SET status = 'SILENCED' WHERE id = ?";
        return jdbcTemplate.update(sql, id);
    }

    public long countByStatus(String tenantId, String status) {
        String sql = "SELECT COUNT(*) FROM obs_alert WHERE tenant_id = ? AND status = ?";
        Long count = jdbcTemplate.queryForObject(sql, Long.class, tenantId, status);
        return count != null ? count : 0L;
    }

    public long countResolvedSince(String tenantId, Instant since) {
        String sql = "SELECT COUNT(*) FROM obs_alert WHERE tenant_id = ? AND status = 'RESOLVED' "
                + "AND resolved_at >= ?";
        Long count = jdbcTemplate.queryForObject(sql, Long.class, tenantId, Timestamp.from(since));
        return count != null ? count : 0L;
    }

    public List<AlertEntity> findAll(String tenantId) {
        String sql = "SELECT id, rule_id, tenant_id, triggered_at, resolved_at, value, status, message "
                + "FROM obs_alert WHERE tenant_id = ? ORDER BY triggered_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }
}