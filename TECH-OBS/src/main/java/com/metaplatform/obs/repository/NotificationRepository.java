package com.metaplatform.obs.repository;

import com.metaplatform.obs.entity.NotificationEntity;
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
public class NotificationRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<NotificationEntity> ROW_MAPPER = (rs, rowNum) -> NotificationEntity.builder()
            .id(rs.getString("id"))
            .tenantId(rs.getString("tenant_id"))
            .userId(rs.getString("user_id"))
            .type(rs.getString("type"))
            .title(rs.getString("title"))
            .content(rs.getString("content"))
            .read(rs.getBoolean("read"))
            .link(rs.getString("link"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .build();

    public NotificationEntity insert(NotificationEntity entity) {
        String id = entity.getId() != null ? entity.getId() : UUID.randomUUID().toString();
        String sql = "INSERT INTO obs_notifications (id, tenant_id, user_id, type, title, content, read, link, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getUserId(),
                entity.getType(),
                entity.getTitle(),
                entity.getContent(),
                entity.isRead(),
                entity.getLink(),
                Timestamp.from(entity.getCreatedAt() != null ? entity.getCreatedAt() : Instant.now()));
        return entity.toBuilder().id(id).build();
    }

    public Optional<NotificationEntity> findById(String id) {
        String sql = "SELECT id, tenant_id, user_id, type, title, content, read, link, created_at "
                + "FROM obs_notifications WHERE id = ?";
        List<NotificationEntity> results = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public List<NotificationEntity> findByUser(String userId, String status, int limit, int offset) {
        String sql;
        if ("unread".equalsIgnoreCase(status)) {
            sql = "SELECT id, tenant_id, user_id, type, title, content, read, link, created_at "
                    + "FROM obs_notifications WHERE user_id = ? AND read = false ORDER BY created_at DESC LIMIT ? OFFSET ?";
        } else if ("read".equalsIgnoreCase(status)) {
            sql = "SELECT id, tenant_id, user_id, type, title, content, read, link, created_at "
                    + "FROM obs_notifications WHERE user_id = ? AND read = true ORDER BY created_at DESC LIMIT ? OFFSET ?";
        } else {
            sql = "SELECT id, tenant_id, user_id, type, title, content, read, link, created_at "
                    + "FROM obs_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
        }
        return jdbcTemplate.query(sql, ROW_MAPPER, userId, limit, offset);
    }

    public long countUnreadByUser(String userId) {
        String sql = "SELECT COUNT(*) FROM obs_notifications WHERE user_id = ? AND read = false";
        Long count = jdbcTemplate.queryForObject(sql, Long.class, userId);
        return count != null ? count : 0L;
    }

    public int markRead(String id) {
        String sql = "UPDATE obs_notifications SET read = true WHERE id = ?";
        return jdbcTemplate.update(sql, id);
    }

    public int markAllReadByUser(String userId) {
        String sql = "UPDATE obs_notifications SET read = true WHERE user_id = ? AND read = false";
        return jdbcTemplate.update(sql, userId);
    }
}
