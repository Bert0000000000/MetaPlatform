package com.metaplatform.obs.topology.repository;

import com.metaplatform.obs.topology.entity.ServiceHealthEntity;
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
public class ServiceHealthRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<ServiceHealthEntity> ROW_MAPPER = (rs, rowNum) -> ServiceHealthEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .serviceName(rs.getString("service_name"))
            .tenantId(rs.getString("tenant_id"))
            .status(rs.getString("status"))
            .lastCheckAt(rs.getTimestamp("last_check_at") != null
                    ? rs.getTimestamp("last_check_at").toInstant() : Instant.now())
            .responseTimeMs(rs.getDouble("response_time_ms"))
            .errorRate(rs.getDouble("error_rate"))
            .build();

    public ServiceHealthEntity upsert(ServiceHealthEntity entity) {
        Instant now = entity.getLastCheckAt() != null ? entity.getLastCheckAt() : Instant.now();
        String sql = "INSERT INTO obs_service_health (service_name, tenant_id, status, last_check_at, "
                + "response_time_ms, error_rate) VALUES (?, ?, ?, ?, ?, ?) "
                + "ON CONFLICT (tenant_id, service_name) DO UPDATE SET "
                + "status = EXCLUDED.status, last_check_at = EXCLUDED.last_check_at, "
                + "response_time_ms = EXCLUDED.response_time_ms, error_rate = EXCLUDED.error_rate";
        jdbcTemplate.update(sql,
                entity.getServiceName(),
                entity.getTenantId(),
                entity.getStatus(),
                Timestamp.from(now),
                entity.getResponseTimeMs(),
                entity.getErrorRate());
        entity.setLastCheckAt(now);
        return entity;
    }

    public List<ServiceHealthEntity> findAll(String tenantId) {
        String sql = "SELECT id, service_name, tenant_id, status, last_check_at, response_time_ms, error_rate "
                + "FROM obs_service_health WHERE tenant_id = ? ORDER BY service_name";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId);
    }

    public ServiceHealthEntity findByServiceName(String tenantId, String serviceName) {
        String sql = "SELECT id, service_name, tenant_id, status, last_check_at, response_time_ms, error_rate "
                + "FROM obs_service_health WHERE tenant_id = ? AND service_name = ?";
        List<ServiceHealthEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, tenantId, serviceName);
        return list.isEmpty() ? null : list.get(0);
    }
}