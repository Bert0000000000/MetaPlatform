package com.metaplatform.a2a.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.entity.AuditRecordEntity;
import com.metaplatform.a2a.repository.AuditRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 审计日志服务。
 *
 * <p>对应 Python {@code app.audit.service.AuditService}。
 * 负责审计记录写入与查询统计。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditRecordRepository auditRepository;
    private final ObjectMapper objectMapper;

    /**
     * 审计动作常量（对应 Python {@code app.audit.schemas.AuditAction}）。
     */
    public static final String ACTION_CARD_CREATED = "card.created";
    public static final String ACTION_CARD_UPDATED = "card.updated";
    public static final String ACTION_CARD_DELETED = "card.deleted";
    public static final String ACTION_AGENT_REGISTERED = "agent.registered";
    public static final String ACTION_AGENT_DEREGISTERED = "agent.deregistered";
    public static final String ACTION_AGENT_HEARTBEAT = "agent.heartbeat";
    public static final String ACTION_TASK_DELEGATED = "task.delegated";
    public static final String ACTION_TASK_UPDATED = "task.updated";
    public static final String ACTION_TASK_CANCELED = "task.canceled";
    public static final String ACTION_TASK_COMPLETED = "task.completed";
    public static final String ACTION_MESSAGE_SENT = "message.sent";
    public static final String ACTION_MESSAGE_ACKED = "message.acked";
    public static final String ACTION_KEY_CREATED = "key.created";
    public static final String ACTION_KEY_REVOKED = "key.revoked";

    /**
     * 记录审计日志。
     *
     * @param tenantId 租户 ID
     * @param action   动作
     * @param actorId  操作者
     * @param targetId 目标对象
     * @param details  详情（Map 会被序列化为 JSONB）
     * @param traceId  链路追踪 ID
     */
    @Transactional
    public void record(String tenantId, String action, String actorId,
                       String targetId, Map<String, Object> details, String traceId) {
        AuditRecordEntity entity = new AuditRecordEntity();
        entity.setId(UUID.randomUUID().toString().replace("-", ""));
        entity.setTenantId(tenantId);
        entity.setAction(action);
        entity.setActorId(actorId != null ? actorId : "");
        entity.setTargetId(targetId != null ? targetId : "");

        String detailsJson;
        try {
            detailsJson = objectMapper.writeValueAsString(details != null ? details : Map.of());
        } catch (JsonProcessingException ex) {
            log.warn("审计 details 序列化失败，降级为空对象 | action={}", action);
            detailsJson = "{}";
        }
        entity.setDetails(detailsJson);
        entity.setTraceId(traceId);

        auditRepository.save(entity);
    }

    /**
     * 便捷方法：使用当前上下文的 traceId 与 tenantId。
     */
    public void record(String action, String actorId, String targetId, Map<String, Object> details) {
        record(TenantContext.getTenantIdOrDefault(), action, actorId,
                targetId, details, TenantContext.getTraceId());
    }

    /**
     * 审计记录列表（分页）。
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(
            String tenantId, String action, String actorId, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AuditRecordEntity> result;
        if (action != null && !action.isBlank()) {
            result = auditRepository.findByTenantIdAndAction(tenantId, action, pageRequest);
        } else if (actorId != null && !actorId.isBlank()) {
            result = auditRepository.findByTenantIdAndActorId(tenantId, actorId, pageRequest);
        } else {
            result = auditRepository.findByTenantId(tenantId, pageRequest);
        }

        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    /**
     * 协作统计：按 action 分组计数。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> collaborationStats(String tenantId, OffsetDateTime start, OffsetDateTime end) {
        List<AuditRecordEntity> records = (start != null && end != null)
                ? auditRepository.findByTenantIdAndCreatedAtBetween(tenantId, start, end)
                : auditRepository.findByTenantId(tenantId, PageRequest.of(0, Integer.MAX_VALUE)).getContent();

        Map<String, Long> byAction = new HashMap<>();
        for (AuditRecordEntity r : records) {
            byAction.merge(r.getAction(), 1L, Long::sum);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", records.size());
        result.put("byAction", byAction);
        return result;
    }

    /**
     * 委派统计：按 source_agent / target_agent 分组。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> delegationStats(String tenantId, OffsetDateTime start, OffsetDateTime end) {
        List<AuditRecordEntity> records;
        if (start != null && end != null) {
            records = auditRepository.findByTenantIdAndCreatedAtBetween(tenantId, start, end);
        } else {
            records = auditRepository.findByTenantId(tenantId,
                    PageRequest.of(0, Integer.MAX_VALUE)).getContent();
        }

        Map<String, Long> byActor = new HashMap<>();
        for (AuditRecordEntity r : records) {
            if (r.getActorId() != null && !r.getActorId().isBlank()) {
                byActor.merge(r.getActorId(), 1L, Long::sum);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", records.size());
        result.put("byActor", byActor);
        return result;
    }

    /**
     * 错误统计：统计含 error 字段的审计记录。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> errorStats(String tenantId, OffsetDateTime start, OffsetDateTime end) {
        List<AuditRecordEntity> records;
        if (start != null && end != null) {
            records = auditRepository.findByTenantIdAndCreatedAtBetween(tenantId, start, end);
        } else {
            records = auditRepository.findByTenantId(tenantId,
                    PageRequest.of(0, Integer.MAX_VALUE)).getContent();
        }

        long errorCount = records.stream()
                .filter(r -> r.getAction().contains("error") || r.getAction().contains("failed"))
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", records.size());
        result.put("errors", errorCount);
        return result;
    }

    /**
     * 按 Agent 维度统计。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> agentStats(String tenantId, String agentId) {
        List<AuditRecordEntity> records = auditRepository
                .findByTenantIdAndActorId(tenantId, agentId,
                        PageRequest.of(0, Integer.MAX_VALUE)).getContent();

        Map<String, Long> byAction = new HashMap<>();
        for (AuditRecordEntity r : records) {
            byAction.merge(r.getAction(), 1L, Long::sum);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("agentId", agentId);
        result.put("total", records.size());
        result.put("byAction", byAction);
        return result;
    }

    /**
     * 导出审计记录（CSV 友好的 List 格式）。
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> export(String tenantId, OffsetDateTime start, OffsetDateTime end) {
        List<AuditRecordEntity> records;
        if (start != null && end != null) {
            records = auditRepository.findByTenantIdAndCreatedAtBetween(tenantId, start, end);
        } else {
            records = auditRepository.findByTenantId(tenantId,
                    PageRequest.of(0, Integer.MAX_VALUE)).getContent();
        }
        return records.stream().map(this::toResponse).toList();
    }

    // ----------------------------------------------------------- helpers

    private Map<String, Object> toResponse(AuditRecordEntity entity) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("tenantId", entity.getTenantId());
        result.put("action", entity.getAction());
        result.put("actorId", entity.getActorId());
        result.put("targetId", entity.getTargetId());
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> details = objectMapper.readValue(entity.getDetails(), Map.class);
            result.put("details", details);
        } catch (Exception e) {
            result.put("details", Map.of());
        }
        result.put("traceId", entity.getTraceId());
        result.put("createdAt", entity.getCreatedAt());
        return result;
    }
}
