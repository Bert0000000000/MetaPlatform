package com.metaplatform.obs.alert.repository;

import com.metaplatform.obs.alert.entity.AlertSilenceEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Repository
@RequiredArgsConstructor
public class AlertSilenceRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<AlertSilenceEntity> ROW_MAPPER = (rs, rowNum) -> AlertSilenceEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .alertId(rs.getObject("alert_id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .silencedUntil(rs.getTimestamp("silenced_until") != null
                    ? rs.getTimestamp("silenced_until").toInstant() : Instant.now())
            .reason(rs.getString("reason"))
            .createdBy(rs.getString("created_by"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .build();

    public AlertSilenceEntity insert(AlertSilenceEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant createdAt = entity.getCreatedAt() != null ? entity.getCreatedAt() : Instant.now();
        String sql = "INSERT INTO obs_alert_silence (id, alert_id, tenant_id, silenced_until, reason, "
                + "created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getAlertId(),
                entity.getTenantId(),
                Timestamp.from(entity.getSilencedUntil()),
                entity.getReason(),
                entity.getCreatedBy(),
                Timestamp.from(createdAt));
        entity.setId(id);
        entity.setCreatedAt(createdAt);
        return entity;
    }

    public List<AlertSilenceEntity> findActiveByAlertId(UUID alertId, Instant now) {
        String sql = "SELECT id, alert_id, tenant_id, silenced_until, reason, created_by, created_at "
                + "FROM obs_alert_silence WHERE alert_id = ? AND silenced_until >= ? ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, alertId, Timestamp.from(now));
    }
}