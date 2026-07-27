package com.metaplatform.obs.trace.repository;

import com.metaplatform.obs.trace.entity.ServiceDependencyEntity;
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
public class ServiceDependencyRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<ServiceDependencyEntity> ROW_MAPPER = (rs, rowNum) -> ServiceDependencyEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .sourceService(rs.getString("source_service"))
            .targetService(rs.getString("target_service"))
            .callCount(rs.getLong("call_count"))
            .avgDurationMs(rs.getDouble("avg_duration_ms"))
            .updatedAt(rs.getTimestamp("updated_at") != null
                    ? rs.getTimestamp("updated_at").toInstant() : Instant.now())
            .build();

    public List<ServiceDependencyEntity> findAll(String tenantId) {
        String sql = "SELECT id, tenant_id, source_service, target_service, call_count, avg_duration_ms, updated_at "
                + "FROM obs_service_dependency WHERE tenant_id = ? ORDER BY source_service, target_service";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public List<ServiceDependencyEntity> findUpstream(String tenantId, String service) {
        String sql = "SELECT id, tenant_id, source_service, target_service, call_count, avg_duration_ms, updated_at "
                + "FROM obs_service_dependency WHERE tenant_id = ? AND target_service = ?";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId, service);
    }

    public List<ServiceDependencyEntity> findDownstream(String tenantId, String service) {
        String sql = "SELECT id, tenant_id, source_service, target_service, call_count, avg_duration_ms, updated_at "
                + "FROM obs_service_dependency WHERE tenant_id = ? AND source_service = ?";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId, service);
    }

    public ServiceDependencyEntity upsert(ServiceDependencyEntity entity) {
        String sql = "INSERT INTO obs_service_dependency (tenant_id, source_service, target_service, "
                + "call_count, avg_duration_ms, updated_at) VALUES (?, ?, ?, ?, ?, ?) "
                + "ON CONFLICT (tenant_id, source_service, target_service) DO UPDATE SET "
                + "call_count = EXCLUDED.call_count, avg_duration_ms = EXCLUDED.avg_duration_ms, "
                + "updated_at = EXCLUDED.updated_at";
        Instant now = entity.getUpdatedAt() != null ? entity.getUpdatedAt() : Instant.now();
        jdbcTemplate.update(sql,
                entity.getTenantId(),
                entity.getSourceService(),
                entity.getTargetService(),
                entity.getCallCount(),
                entity.getAvgDurationMs(),
                Timestamp.from(now));
        return entity;
    }
}