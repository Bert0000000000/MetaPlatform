package com.metaplatform.a2a.agentregistry;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.audit.AuditService;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.config.A2aProperties;
import com.metaplatform.a2a.entity.AgentRegistrationEntity;
import com.metaplatform.a2a.events.EventType;
import com.metaplatform.a2a.events.OutboxService;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.AgentRegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Agent 注册表服务。
 *
 * <p>对应 Python {@code app.agent_registry.service.AgentRegistryService}。
 * 提供 Agent 的注册 / 注销 / 心跳 / 健康检查能力。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRegistryService {

    public static final String STATUS_HEALTHY = "HEALTHY";
    public static final String STATUS_DEGRADED = "DEGRADED";
    public static final String STATUS_UNKNOWN = "UNKNOWN";
    public static final String STATUS_DEREGISTERED = "DEREGISTERED";

    private final AgentRegistrationRepository registryRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;
    private final OutboxService outboxService;
    private final A2aProperties properties;

    /**
     * 注册 Agent。
     */
    @Transactional
    public Map<String, Object> register(String tenantId, AgentRegistrationRequest request, String actorId) {
        if (registryRepository.existsByTenantIdAndAgentId(tenantId, request.getAgentId())) {
            throw A2aException.agentAlreadyRegistered(request.getAgentId());
        }

        AgentRegistrationEntity entity = new AgentRegistrationEntity();
        entity.setId(UUID.randomUUID().toString().replace("-", ""));
        entity.setTenantId(tenantId);
        entity.setAgentId(request.getAgentId());
        entity.setName(request.getName());
        entity.setDescription(request.getDescription() != null ? request.getDescription() : "");
        entity.setEndpoints(toJson(request.getEndpoints(), "[]"));
        entity.setCapabilities(toJson(request.getCapabilities(), "[]"));
        entity.setMetadata(toJson(request.getMetadata(), "{}"));
        entity.setStatus(request.getStatus() != null ? request.getStatus() : STATUS_HEALTHY);
        entity.setLastHeartbeat(OffsetDateTime.now());

        AgentRegistrationEntity saved = registryRepository.save(entity);

        auditService.record(AuditService.ACTION_AGENT_REGISTERED, actorId,
                saved.getAgentId(), Map.of("name", saved.getName()));
        outboxService.recordEvent(EventType.AGENT_REGISTERED, toEventPayload(saved));

        return toResponse(saved);
    }

    /**
     * 注销 Agent。
     */
    @Transactional
    public boolean deregister(String tenantId, String agentId, String actorId) {
        AgentRegistrationEntity entity = registryRepository
                .findByTenantIdAndAgentId(tenantId, agentId)
                .orElseThrow(() -> A2aException.agentNotFound(agentId));

        entity.setStatus(STATUS_DEREGISTERED);
        registryRepository.save(entity);

        auditService.record(AuditService.ACTION_AGENT_DEREGISTERED, actorId,
                agentId, Map.of());
        outboxService.recordEvent(EventType.AGENT_DEREGISTERED, toEventPayload(entity));

        return true;
    }

    /**
     * 心跳上报。
     */
    @Transactional
    public Map<String, Object> heartbeat(String tenantId, String agentId) {
        AgentRegistrationEntity entity = registryRepository
                .findByTenantIdAndAgentId(tenantId, agentId)
                .orElseThrow(() -> A2aException.agentNotFound(agentId));

        entity.setLastHeartbeat(OffsetDateTime.now());
        if (STATUS_UNKNOWN.equals(entity.getStatus())) {
            entity.setStatus(STATUS_HEALTHY);
        }
        AgentRegistrationEntity saved = registryRepository.save(entity);

        auditService.record(AuditService.ACTION_AGENT_HEARTBEAT, agentId,
                agentId, Map.of("timestamp", saved.getLastHeartbeat()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("agentId", agentId);
        result.put("status", saved.getStatus());
        result.put("lastHeartbeat", saved.getLastHeartbeat());
        return result;
    }

    /**
     * 健康检查：扫描心跳超时的 Agent，标记为 UNKNOWN。
     */
    @Transactional
    public Map<String, Object> healthCheck(String tenantId) {
        OffsetDateTime threshold = OffsetDateTime.now()
                .minusSeconds(properties.getHeartbeatTimeoutSeconds());
        List<AgentRegistrationEntity> stale =
                registryRepository.findByTenantIdAndLastHeartbeatBefore(tenantId, threshold);

        int marked = 0;
        for (AgentRegistrationEntity e : stale) {
            if (!STATUS_UNKNOWN.equals(e.getStatus())
                    && !STATUS_DEREGISTERED.equals(e.getStatus())) {
                e.setStatus(STATUS_UNKNOWN);
                registryRepository.save(e);
                marked++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scanned", stale.size());
        result.put("markedUnknown", marked);
        result.put("thresholdSeconds", properties.getHeartbeatTimeoutSeconds());
        return result;
    }

    /**
     * 查询注册详情。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> get(String tenantId, String agentId) {
        AgentRegistrationEntity entity = registryRepository
                .findByTenantIdAndAgentId(tenantId, agentId)
                .orElseThrow(() -> A2aException.agentNotFound(agentId));
        return toResponse(entity);
    }

    /**
     * 注册列表（分页 + 状态过滤）。
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(
            String tenantId, String status, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.ASC, "registeredAt"));
        Page<AgentRegistrationEntity> result = (status != null && !status.isBlank())
                ? registryRepository.findByTenantIdAndStatus(tenantId, status, pageRequest)
                : registryRepository.findByTenantId(tenantId, pageRequest);
        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    // ----------------------------------------------------------- helpers

    private String toJson(Object obj, String defaultValue) {
        if (obj == null) {
            return defaultValue;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException ex) {
            return defaultValue;
        }
    }

    private Map<String, Object> toResponse(AgentRegistrationEntity entity) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("tenantId", entity.getTenantId());
        result.put("agentId", entity.getAgentId());
        result.put("name", entity.getName());
        result.put("description", entity.getDescription());
        result.put("endpoints", parseJson(entity.getEndpoints(), List.class));
        result.put("capabilities", parseJson(entity.getCapabilities(), List.class));
        result.put("metadata", parseJson(entity.getMetadata(), Map.class));
        result.put("status", entity.getStatus());
        result.put("lastHeartbeat", entity.getLastHeartbeat());
        result.put("registeredAt", entity.getRegisteredAt());
        result.put("updatedAt", entity.getUpdatedAt());
        return result;
    }

    @SuppressWarnings("unchecked")
    private <T> T parseJson(String json, Class<?> type) {
        if (json == null || json.isBlank()) {
            return (T) (type == Map.class ? Map.of() : List.of());
        }
        try {
            if (type == Map.class) {
                return (T) objectMapper.readValue(json, Map.class);
            } else {
                return (T) objectMapper.readValue(json, List.class);
            }
        } catch (Exception e) {
            return (T) (type == Map.class ? Map.of() : List.of());
        }
    }

    private Map<String, Object> toEventPayload(AgentRegistrationEntity entity) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("agentId", entity.getAgentId());
        payload.put("tenantId", entity.getTenantId());
        payload.put("name", entity.getName());
        payload.put("status", entity.getStatus());
        return payload;
    }
}
