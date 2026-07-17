package com.metaplatform.iam.audit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.audit.dto.AuditLogResponse;
import com.metaplatform.iam.audit.dto.AuditLogStatisticsResponse;
import com.metaplatform.iam.audit.entity.IamAuditLogEntity;
import com.metaplatform.iam.audit.repository.IamAuditLogRepository;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.common.TraceContext;
import com.metaplatform.iam.exception.IamException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";

    private final IamAuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public void record(String tenantId, String userId, IamAuditLogEntity.Action action,
                       String resourceType, String resourceId, String description,
                       IamAuditLogEntity.Status status, Map<String, Object> metadata) {
        try {
            IamAuditLogEntity entity = IamAuditLogEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(resolveTenantId(tenantId))
                    .userId(userId)
                    .action(action)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .description(description)
                    .traceId(TraceContext.getOrCreate())
                    .status(status == null ? IamAuditLogEntity.Status.SUCCESS : status)
                    .metadata(metadata == null ? null : objectMapper.writeValueAsString(metadata))
                    .build();
            auditLogRepository.save(entity);
        } catch (Exception e) {
            // 审计日志失败不应阻断业务主流程
            log.warn("Failed to record audit log: action={}, userId={}", action, userId, e);
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> query(String tenantId, String userId, String action,
                                                 String resourceType, String status,
                                                 Instant startTime, Instant endTime,
                                                 Integer page, Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<IamAuditLogEntity> result = auditLogRepository.search(
                tid,
                userId,
                parseEnum(action, IamAuditLogEntity.Action.class),
                resourceType,
                parseEnum(status, IamAuditLogEntity.Status.class),
                startTime,
                endTime,
                pageable);

        List<AuditLogResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<AuditLogResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AuditLogResponse get(String id) {
        return toResponse(auditLogRepository.findById(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "审计日志不存在")));
    }

    @Transactional(readOnly = true)
    public byte[] export(String tenantId, String userId, String action, String resourceType,
                         String status, Instant startTime, Instant endTime, String format) {
        String tid = resolveTenantId(tenantId);
        List<IamAuditLogEntity> all = auditLogRepository.search(
                tid, userId,
                parseEnum(action, IamAuditLogEntity.Action.class),
                resourceType,
                parseEnum(status, IamAuditLogEntity.Status.class),
                startTime, endTime,
                PageRequest.of(0, 10_000, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent();

        boolean asJson = "json".equalsIgnoreCase(format);
        StringBuilder sb = new StringBuilder();
        if (asJson) {
            try {
                return objectMapper.writerWithDefaultPrettyPrinter()
                        .writeValueAsString(all.stream().map(this::toResponse).toList())
                        .getBytes();
            } catch (Exception e) {
                throw new IamException(ErrorCode.INTERNAL_ERROR, "导出 JSON 失败");
            }
        }
        sb.append("id,tenant_id,user_id,action,resource_type,resource_id,status,trace_id,created_at,description\n");
        for (IamAuditLogEntity a : all) {
            sb.append(csv(a.getId())).append(',')
                    .append(csv(a.getTenantId())).append(',')
                    .append(csv(a.getUserId())).append(',')
                    .append(csv(a.getAction() == null ? null : a.getAction().name())).append(',')
                    .append(csv(a.getResourceType())).append(',')
                    .append(csv(a.getResourceId())).append(',')
                    .append(csv(a.getStatus() == null ? null : a.getStatus().name())).append(',')
                    .append(csv(a.getTraceId())).append(',')
                    .append(csv(a.getCreatedAt() == null ? null : a.getCreatedAt().toString())).append(',')
                    .append(csv(a.getDescription())).append('\n');
        }
        return sb.toString().getBytes();
    }

    @Transactional(readOnly = true)
    public AuditLogStatisticsResponse statistics(String tenantId, Instant startTime, Instant endTime) {
        String tid = resolveTenantId(tenantId);
        Map<String, Long> byAction = new LinkedHashMap<>();
        for (Object[] row : auditLogRepository.countByAction(tid, startTime, endTime)) {
            byAction.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (Object[] row : auditLogRepository.countByStatus(tid, startTime, endTime)) {
            byStatus.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        long total = byAction.values().stream().mapToLong(Long::longValue).sum();
        return AuditLogStatisticsResponse.builder()
                .total(total)
                .byAction(byAction)
                .byStatus(byStatus)
                .build();
    }

    private AuditLogResponse toResponse(IamAuditLogEntity a) {
        return AuditLogResponse.builder()
                .id(a.getId())
                .tenantId(a.getTenantId())
                .userId(a.getUserId())
                .action(a.getAction())
                .resourceType(a.getResourceType())
                .resourceId(a.getResourceId())
                .description(a.getDescription())
                .ipAddress(a.getIpAddress())
                .userAgent(a.getUserAgent())
                .traceId(a.getTraceId())
                .status(a.getStatus())
                .metadata(a.getMetadata())
                .createdAt(a.getCreatedAt())
                .build();
    }

    private String csv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private <T extends Enum<T>> T parseEnum(String value, Class<T> type) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? DEFAULT_TENANT_ID : requestTenantId;
    }
}
