package com.metaplatform.obs.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.entity.ObsLogEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ObsLogRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    private static final RowMapper<ObsLogEntity> ROW_MAPPER = (rs, rowNum) -> ObsLogEntity.builder()
            .id(rs.getString("id"))
            .tenantId(rs.getString("tenant_id"))
            .serviceName(rs.getString("service_name"))
            .level(rs.getString("level"))
            .traceId(rs.getString("trace_id"))
            .message(rs.getString("message"))
            .labels(parseLabels(rs.getString("labels")))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .build();

    private static JsonNode parseLabels(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new ObjectMapper().readTree(raw);
        } catch (Exception e) {
            return null;
        }
    }

    public ObsLogEntity insert(ObsLogEntity entity) {
        String sql = "INSERT INTO obs_logs (id, tenant_id, service_name, level, trace_id, message, labels, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
        jdbcTemplate.update(sql,
                entity.getId(),
                entity.getTenantId(),
                entity.getServiceName(),
                entity.getLevel(),
                entity.getTraceId(),
                entity.getMessage(),
                entity.getLabels() != null ? entity.getLabels().toString() : null,
                Timestamp.from(entity.getCreatedAt() != null ? entity.getCreatedAt() : Instant.now()));
        return entity;
    }

    public Optional<ObsLogEntity> findById(String id) {
        String sql = "SELECT id, tenant_id, service_name, level, trace_id, message, labels, created_at "
                + "FROM obs_logs WHERE id = ?";
        List<ObsLogEntity> results = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public long countByTenantAndService(String tenantId, String serviceName) {
        String sql = "SELECT COUNT(*) FROM obs_logs WHERE tenant_id = ? AND service_name = ?";
        Long count = jdbcTemplate.queryForObject(sql, Long.class, tenantId, serviceName);
        return count != null ? count : 0L;
    }

    public List<ObsLogEntity> findByTenantAndService(String tenantId, String serviceName, int limit, int offset) {
        String sql = "SELECT id, tenant_id, service_name, level, trace_id, message, labels, created_at "
                + "FROM obs_logs WHERE tenant_id = ? AND service_name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
        return jdbcTemplate.query(sql, ROW_MAPPER, tenantId, serviceName, limit, offset);
    }

    public List<ObsLogEntity> findByTraceId(String traceId, int limit) {
        String sql = "SELECT id, tenant_id, service_name, level, trace_id, message, labels, created_at "
                + "FROM obs_logs WHERE trace_id = ? ORDER BY created_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, ROW_MAPPER, traceId, limit);
    }
}
