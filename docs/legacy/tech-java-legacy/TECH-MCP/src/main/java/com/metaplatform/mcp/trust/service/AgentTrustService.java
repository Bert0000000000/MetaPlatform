package com.metaplatform.mcp.trust.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.external.entity.ExternalAgentEntity;
import com.metaplatform.mcp.external.repository.ExternalAgentRepository;
import com.metaplatform.mcp.trust.dto.CreateTrustRequest;
import com.metaplatform.mcp.trust.dto.TrustResponse;
import com.metaplatform.mcp.trust.dto.UpdateTrustRequest;
import com.metaplatform.mcp.trust.entity.AgentTrustEntity;
import com.metaplatform.mcp.trust.repository.AgentTrustRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentTrustService {

    private final AgentTrustRepository trustRepository;
    private final ExternalAgentRepository externalAgentRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TrustResponse create(CreateTrustRequest request) {
        String tenantId = TenantContext.getOrDefault();
        ExternalAgentEntity agent = externalAgentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(request.getAgentId(), tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.EXTERNAL_AGENT_NOT_FOUND, "外部 Agent 不存在"));

        validateJson(request.getAllowedOperations(), "allowedOperations");
        Instant now = Instant.now();
        AgentTrustEntity entity = AgentTrustEntity.builder()
                .tenantId(tenantId)
                .agentId(request.getAgentId())
                .trustLevel(request.getTrustLevel().toUpperCase())
                .reason(request.getReason())
                .allowedOperations(normalizeJson(request.getAllowedOperations(), "[]"))
                .expiresAt(request.getExpiresAt())
                .createdAt(now)
                .updatedAt(now)
                .build();
        AgentTrustEntity saved = trustRepository.save(entity);

        agent.setTrustLevel(saved.getTrustLevel());
        agent.setUpdatedAt(now);
        externalAgentRepository.save(agent);

        return toResponse(saved, agent.getName());
    }

    @Transactional(readOnly = true)
    public PageResponse<TrustResponse> list(UUID agentId, String trustLevel, String keyword,
                                             Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));
        Page<AgentTrustEntity> result = trustRepository.search(
                tenantId, agentId,
                trustLevel == null ? null : trustLevel.toUpperCase(),
                keyword, pageable);
        return PageResponse.<TrustResponse>builder()
                .items(result.getContent().stream()
                        .map(e -> toResponse(e, resolveAgentName(e.getAgentId(), tenantId))).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public TrustResponse get(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        AgentTrustEntity entity = findById(id, tenantId);
        return toResponse(entity, resolveAgentName(entity.getAgentId(), tenantId));
    }

    @Transactional
    public TrustResponse update(UUID id, UpdateTrustRequest request) {
        String tenantId = TenantContext.getOrDefault();
        AgentTrustEntity entity = findById(id, tenantId);
        if (request.getTrustLevel() != null) {
            entity.setTrustLevel(request.getTrustLevel().toUpperCase());
        }
        if (request.getReason() != null) {
            entity.setReason(request.getReason());
        }
        if (request.getAllowedOperations() != null) {
            validateJson(request.getAllowedOperations(), "allowedOperations");
            entity.setAllowedOperations(request.getAllowedOperations());
        }
        if (request.getExpiresAt() != null) {
            entity.setExpiresAt(request.getExpiresAt());
        }
        entity.setUpdatedAt(Instant.now());
        AgentTrustEntity saved = trustRepository.save(entity);

        externalAgentRepository.findByIdAndTenantIdAndDeletedAtIsNull(saved.getAgentId(), tenantId)
                .ifPresent(agent -> {
                    agent.setTrustLevel(saved.getTrustLevel());
                    agent.setUpdatedAt(Instant.now());
                    externalAgentRepository.save(agent);
                });

        return toResponse(saved, resolveAgentName(saved.getAgentId(), tenantId));
    }

    @Transactional
    public void delete(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        AgentTrustEntity entity = findById(id, tenantId);
        trustRepository.delete(entity);
    }

    private AgentTrustEntity findById(UUID id, String tenantId) {
        return trustRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.AGENT_TRUST_NOT_FOUND, "信任关系不存在"));
    }

    private String resolveAgentName(UUID agentId, String tenantId) {
        return externalAgentRepository.findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .map(ExternalAgentEntity::getName)
                .orElse("");
    }

    private TrustResponse toResponse(AgentTrustEntity entity, String agentName) {
        return TrustResponse.builder()
                .id(entity.getId())
                .agentId(entity.getAgentId())
                .agentName(agentName)
                .trustLevel(entity.getTrustLevel())
                .reason(entity.getReason())
                .allowedOperations(entity.getAllowedOperations())
                .expiresAt(entity.getExpiresAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
