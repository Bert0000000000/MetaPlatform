package com.metaplatform.obs.repository;

import com.metaplatform.obs.entity.NotificationSettingsEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class NotificationSettingsRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<NotificationSettingsEntity> ROW_MAPPER = (rs, rowNum) -> NotificationSettingsEntity.builder()
            .id(rs.getString("id"))
            .tenantId(rs.getString("tenant_id"))
            .userId(rs.getString("user_id"))
            .approval(rs.getBoolean("approval"))
            .task(rs.getBoolean("task"))
            .system(rs.getBoolean("system"))
            .mention(rs.getBoolean("mention"))
            .alert(rs.getBoolean("alert"))
            .email(rs.getBoolean("email"))
            .push(rs.getBoolean("push"))
            .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : null)
            .updatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant() : null)
            .build();

    public Optional<NotificationSettingsEntity> findByUserId(String userId) {
        String sql = "SELECT id, tenant_id, user_id, approval, task, system, mention, alert, email, push, created_at, updated_at "
                + "FROM obs_notification_settings WHERE user_id = ?";
        List<NotificationSettingsEntity> results = jdbcTemplate.query(sql, ROW_MAPPER, userId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public NotificationSettingsEntity save(NotificationSettingsEntity entity) {
        String id = entity.getId() != null ? entity.getId() : UUID.randomUUID().toString();
        Instant now = Instant.now();
        Optional<NotificationSettingsEntity> existing = findByUserId(entity.getUserId());
        if (existing.isPresent()) {
            String sql = "UPDATE obs_notification_settings SET approval = ?, task = ?, system = ?, mention = ?, alert = ?, email = ?, push = ?, updated_at = ? "
                    + "WHERE user_id = ?";
            jdbcTemplate.update(sql,
                    entity.isApproval(), entity.isTask(), entity.isSystem(), entity.isMention(),
                    entity.isAlert(), entity.isEmail(), entity.isPush(), Timestamp.from(now), entity.getUserId());
            return entity.toBuilder().id(existing.get().getId()).createdAt(existing.get().getCreatedAt()).updatedAt(now).build();
        }
        String sql = "INSERT INTO obs_notification_settings (id, tenant_id, user_id, approval, task, system, mention, alert, email, push, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id, entity.getTenantId(), entity.getUserId(),
                entity.isApproval(), entity.isTask(), entity.isSystem(), entity.isMention(),
                entity.isAlert(), entity.isEmail(), entity.isPush(), Timestamp.from(now), Timestamp.from(now));
        return entity.toBuilder().id(id).createdAt(now).updatedAt(now).build();
    }
}
