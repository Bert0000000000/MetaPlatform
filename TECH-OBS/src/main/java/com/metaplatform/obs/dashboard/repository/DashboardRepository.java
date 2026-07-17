package com.metaplatform.obs.dashboard.repository;

import com.metaplatform.obs.dashboard.entity.DashboardEntity;
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
public class DashboardRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<DashboardEntity> ROW_MAPPER = (rs, rowNum) -> DashboardEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .title(rs.getString("title"))
            .description(rs.getString("description"))
            .isPublic(rs.getBoolean("is_public"))
            .shareToken(rs.getString("share_token"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .updatedAt(rs.getTimestamp("updated_at") != null
                    ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
            .deletedAt(rs.getTimestamp("deleted_at") != null
                    ? rs.getTimestamp("deleted_at").toInstant() : null)
            .build();

    public DashboardEntity insert(DashboardEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant now = Instant.now();
        String sql = "INSERT INTO obs_dashboard (id, tenant_id, title, description, layout, panels, "
                + "is_public, share_token, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getLayout() != null ? entity.getLayout().toString() : "[]",
                entity.getPanels() != null ? entity.getPanels().toString() : "[]",
                entity.isPublic(),
                entity.getShareToken(),
                Timestamp.from(now),
                Timestamp.from(now));
        entity.setId(id);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public Optional<DashboardEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, title, description, is_public, share_token, "
                + "created_at, updated_at, deleted_at FROM obs_dashboard WHERE id = ? AND deleted_at IS NULL";
        List<DashboardEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Optional<DashboardEntity> findByShareToken(String token) {
        String sql = "SELECT id, tenant_id, title, description, is_public, share_token, "
                + "created_at, updated_at, deleted_at FROM obs_dashboard "
                + "WHERE share_token = ? AND deleted_at IS NULL";
        List<DashboardEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, token);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<DashboardEntity> findAll(String tenantId) {
        String sql = "SELECT id, tenant_id, title, description, is_public, share_token, "
                + "created_at, updated_at, deleted_at FROM obs_dashboard "
                + "WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public DashboardEntity update(DashboardEntity entity) {
        Instant now = Instant.now();
        String sql = "UPDATE obs_dashboard SET title = ?, description = ?, layout = ?::jsonb, "
                + "panels = ?::jsonb, is_public = ?, share_token = ?, updated_at = ? "
                + "WHERE id = ? AND deleted_at IS NULL";
        jdbcTemplate.update(sql,
                entity.getTitle(),
                entity.getDescription(),
                entity.getLayout() != null ? entity.getLayout().toString() : "[]",
                entity.getPanels() != null ? entity.getPanels().toString() : "[]",
                entity.isPublic(),
                entity.getShareToken(),
                Timestamp.from(now),
                entity.getId());
        entity.setUpdatedAt(now);
        return entity;
    }

    public int softDelete(UUID id) {
        String sql = "UPDATE obs_dashboard SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL";
        return jdbcTemplate.update(sql, Timestamp.from(Instant.now()), id);
    }

    public String getLayoutJson(UUID id) {
        return getJson(id, "layout");
    }

    public String getPanelsJson(UUID id) {
        return getJson(id, "panels");
    }

    private String getJson(UUID id, String column) {
        String sql = "SELECT " + column + " FROM obs_dashboard WHERE id = ?";
        List<String> list = jdbcTemplate.query(sql, (rs, rn) -> rs.getString(1), id);
        return list.isEmpty() ? null : list.get(0);
    }
}