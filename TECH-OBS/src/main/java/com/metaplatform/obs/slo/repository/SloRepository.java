package com.metaplatform.obs.slo.repository;

import com.metaplatform.obs.slo.entity.SloEntity;
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
public class SloRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<SloEntity> ROW_MAPPER = (rs, rowNum) -> SloEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .name(rs.getString("name"))
            .description(rs.getString("description"))
            .serviceName(rs.getString("service_name"))
            .sliType(rs.getString("sli_type"))
            .sliQuery(rs.getString("sli_query"))
            .target(rs.getDouble("target"))
            .window(rs.getString("window"))
            .errorBudgetTotal(rs.getObject("error_budget_total") != null
                    ? rs.getDouble("error_budget_total") : null)
            .errorBudgetConsumed(rs.getDouble("error_budget_consumed"))
            .burnRate(rs.getDouble("burn_rate"))
            .status(rs.getString("status"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .updatedAt(rs.getTimestamp("updated_at") != null
                    ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
            .deletedAt(rs.getTimestamp("deleted_at") != null
                    ? rs.getTimestamp("deleted_at").toInstant() : null)
            .build();

    public SloEntity insert(SloEntity entity) {
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant now = Instant.now();
        String sql = "INSERT INTO obs_slo (id, tenant_id, name, description, service_name, sli_type, "
                + "sli_query, target, window, error_budget_total, error_budget_consumed, burn_rate, "
                + "status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql,
                id,
                entity.getTenantId(),
                entity.getName(),
                entity.getDescription(),
                entity.getServiceName(),
                entity.getSliType(),
                entity.getSliQuery(),
                entity.getTarget(),
                entity.getWindow() != null ? entity.getWindow() : "30d",
                entity.getErrorBudgetTotal(),
                entity.getErrorBudgetConsumed(),
                entity.getBurnRate(),
                entity.getStatus() != null ? entity.getStatus() : "HEALTHY",
                Timestamp.from(now),
                Timestamp.from(now));
        entity.setId(id);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public Optional<SloEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, name, description, service_name, sli_type, sli_query, "
                + "target, window, error_budget_total, error_budget_consumed, burn_rate, status, "
                + "created_at, updated_at, deleted_at FROM obs_slo "
                + "WHERE id = ? AND deleted_at IS NULL";
        List<SloEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<SloEntity> findAll(String tenantId) {
        String sql = "SELECT id, tenant_id, name, description, service_name, sli_type, sli_query, "
                + "target, window, error_budget_total, error_budget_consumed, burn_rate, status, "
                + "created_at, updated_at, deleted_at FROM obs_slo "
                + "WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public SloEntity update(SloEntity entity) {
        Instant now = Instant.now();
        String sql = "UPDATE obs_slo SET name = ?, description = ?, service_name = ?, sli_type = ?, "
                + "sli_query = ?, target = ?, window = ?, error_budget_total = ?, "
                + "error_budget_consumed = ?, burn_rate = ?, status = ?, updated_at = ? "
                + "WHERE id = ? AND deleted_at IS NULL";
        jdbcTemplate.update(sql,
                entity.getName(),
                entity.getDescription(),
                entity.getServiceName(),
                entity.getSliType(),
                entity.getSliQuery(),
                entity.getTarget(),
                entity.getWindow(),
                entity.getErrorBudgetTotal(),
                entity.getErrorBudgetConsumed(),
                entity.getBurnRate(),
                entity.getStatus(),
                Timestamp.from(now),
                entity.getId());
        entity.setUpdatedAt(now);
        return entity;
    }

    public int softDelete(UUID id) {
        String sql = "UPDATE obs_slo SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL";
        return jdbcTemplate.update(sql, Timestamp.from(Instant.now()), id);
    }
}