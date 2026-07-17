package com.metaplatform.obs.alert.repository;

import com.metaplatform.obs.alert.entity.NotificationChannelEntity;
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
public class NotificationChannelRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<NotificationChannelEntity> ROW_MAPPER = (rs, rowNum) -> NotificationChannelEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .name(rs.getString("name"))
            .type(rs.getString("type"))
            .enabled(rs.getBoolean("enabled"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .updatedAt(rs.getTimestamp("updated_at") != null
                    ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
            .deletedAt(rs.getTimestamp("deleted_at") != null
                    ? rs.getTimestamp("deleted_at").toInstant() : null)
            .build();

    public NotificationChannelEntity insert(NotificationChannelEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant now = Instant.now();
        String sql = "INSERT INTO obs_alert_notification_channel (id, tenant_id, name, type, config, "
                + "enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getName(),
                entity.getType(),
                entity.getConfig() != null ? entity.getConfig().toString() : "{}",
                entity.isEnabled(),
                Timestamp.from(now),
                Timestamp.from(now));
        entity.setId(id);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public Optional<NotificationChannelEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, name, type, enabled, created_at, updated_at, deleted_at "
                + "FROM obs_alert_notification_channel WHERE id = ? AND deleted_at IS NULL";
        List<NotificationChannelEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<NotificationChannelEntity> findAll(String tenantId) {
        String sql = "SELECT id, tenant_id, name, type, enabled, created_at, updated_at, deleted_at "
                + "FROM obs_alert_notification_channel WHERE tenant_id = ? AND deleted_at IS NULL "
                + "ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public NotificationChannelEntity update(NotificationChannelEntity entity) {
        Instant now = Instant.now();
        String sql = "UPDATE obs_alert_notification_channel SET name = ?, type = ?, config = ?::jsonb, "
                + "enabled = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL";
        jdbcTemplate.update(sql,
                entity.getName(),
                entity.getType(),
                entity.getConfig() != null ? entity.getConfig().toString() : "{}",
                entity.isEnabled(),
                Timestamp.from(now),
                entity.getId());
        entity.setUpdatedAt(now);
        return entity;
    }

    public int softDelete(UUID id) {
        String sql = "UPDATE obs_alert_notification_channel SET deleted_at = ?, enabled = FALSE "
                + "WHERE id = ? AND deleted_at IS NULL";
        return jdbcTemplate.update(sql, Timestamp.from(Instant.now()), id);
    }

    public String getConfigJson(UUID id) {
        String sql = "SELECT config FROM obs_alert_notification_channel WHERE id = ?";
        List<String> list = jdbcTemplate.query(sql, (rs, rn) -> rs.getString(1), id);
        return list.isEmpty() ? null : list.get(0);
    }
}