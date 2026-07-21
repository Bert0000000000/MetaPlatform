package com.metaplatform.obs.trace.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.trace.entity.ObsTraceEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ObsTraceRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    private static final RowMapper<ObsTraceEntity> ROW_MAPPER = (rs, rowNum) -> ObsTraceEntity.builder()
            .id(rs.getObject("id", UUID.class))
            .tenantId(rs.getString("tenant_id"))
            .traceId(rs.getString("trace_id"))
            .spanId(rs.getString("span_id"))
            .parentSpanId(rs.getString("parent_span_id"))
            .serviceName(rs.getString("service_name"))
            .operationName(rs.getString("operation_name"))
            .startTimeUs(rs.getLong("start_time_us"))
            .durationUs(rs.getLong("duration_us"))
            .tags(readJson(rs, "tags"))
            .logs(readJson(rs, "logs"))
            .status(rs.getString("status"))
            .createdAt(rs.getTimestamp("created_at") != null
                    ? rs.getTimestamp("created_at").toInstant() : Instant.now())
            .build();

    private static JsonNode readJson(java.sql.ResultSet rs, String column) {
        try {
            String value = rs.getString(column);
            if (value == null || value.isBlank()) {
                return null;
            }
            return new ObjectMapper().readTree(value);
        } catch (Exception e) {
            return null;
        }
    }

    public ObsTraceEntity insert(ObsTraceEntity entity) {
        String sql = "INSERT INTO obs_trace (tenant_id, trace_id, span_id, parent_span_id, service_name, "
                + "operation_name, start_time_us, duration_us, tags, logs, status, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)";
        UUID id = entity.getId() != null ? entity.getId() : UUID.randomUUID();
        Instant createdAt = entity.getCreatedAt() != null ? entity.getCreatedAt() : Instant.now();
        jdbcTemplate.update(sql,
                entity.getTenantId(),
                entity.getTraceId(),
                entity.getSpanId(),
                entity.getParentSpanId(),
                entity.getServiceName(),
                entity.getOperationName(),
                entity.getStartTimeUs(),
                entity.getDurationUs(),
                entity.getTags() != null ? entity.getTags().toString() : "{}",
                entity.getLogs() != null ? entity.getLogs().toString() : "[]",
                entity.getStatus() != null ? entity.getStatus() : "OK",
                Timestamp.from(createdAt));
        entity.setId(id);
        entity.setCreatedAt(createdAt);
        return entity;
    }

    public List<ObsTraceEntity> findSpansByTraceId(String traceId) {
        String sql = "SELECT id, tenant_id, trace_id, span_id, parent_span_id, service_name, operation_name, "
                + "start_time_us, duration_us, tags, logs, status, created_at FROM obs_trace "
                + "WHERE trace_id = ? ORDER BY start_time_us ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER, traceId);
    }

    public List<ObsTraceEntity> search(String tenantId, String service, String operation,
                                       long startUs, long endUs, int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT id, tenant_id, trace_id, span_id, parent_span_id, "
                + "service_name, operation_name, start_time_us, duration_us, tags, logs, status, created_at "
                + "FROM obs_trace WHERE tenant_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(tenantId);
        if (service != null && !service.isBlank()) {
            sql.append(" AND service_name = ?");
            args.add(service);
        }
        if (operation != null && !operation.isBlank()) {
            sql.append(" AND operation_name = ?");
            args.add(operation);
        }
        if (startUs > 0) {
            sql.append(" AND start_time_us >= ?");
            args.add(startUs);
        }
        if (endUs > 0) {
            sql.append(" AND start_time_us <= ?");
            args.add(endUs);
        }
        sql.append(" ORDER BY start_time_us DESC LIMIT ? OFFSET ?");
        args.add(limit);
        args.add(offset);
        return jdbcTemplate.query(sql.toString(), ROW_MAPPER, args.toArray());
    }

    public long countSearch(String tenantId, String service, String operation, long startUs, long endUs) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM obs_trace WHERE tenant_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(tenantId);
        if (service != null && !service.isBlank()) {
            sql.append(" AND service_name = ?");
            args.add(service);
        }
        if (operation != null && !operation.isBlank()) {
            sql.append(" AND operation_name = ?");
            args.add(operation);
        }
        if (startUs > 0) {
            sql.append(" AND start_time_us >= ?");
            args.add(startUs);
        }
        if (endUs > 0) {
            sql.append(" AND start_time_us <= ?");
            args.add(endUs);
        }
        Long count = jdbcTemplate.queryForObject(sql.toString(), Long.class, args.toArray());
        return count != null ? count : 0L;
    }

    public Optional<ObsTraceEntity> findById(UUID id) {
        String sql = "SELECT id, tenant_id, trace_id, span_id, parent_span_id, service_name, operation_name, "
                + "start_time_us, duration_us, tags, logs, status, created_at FROM obs_trace WHERE id = ?";
        List<ObsTraceEntity> list = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public JsonNode getTags(UUID id) {
        String sql = "SELECT tags FROM obs_trace WHERE id = ?";
        List<String> raw = jdbcTemplate.query(sql, (rs, rn) -> rs.getString(1), id);
        if (raw.isEmpty() || raw.get(0) == null) {
            return null;
        }
        try {
            return objectMapper.readTree(raw.get(0));
        } catch (Exception e) {
            return null;
        }
    }
}