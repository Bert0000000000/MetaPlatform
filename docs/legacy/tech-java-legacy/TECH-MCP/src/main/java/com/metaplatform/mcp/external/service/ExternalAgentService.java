package com.metaplatform.mcp.external.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.external.dto.CreateExternalAgentRequest;
import com.metaplatform.mcp.external.dto.ExternalAgentResponse;
import com.metaplatform.mcp.external.dto.ExternalAgentTestResult;
import com.metaplatform.mcp.external.dto.UpdateExternalAgentRequest;
import com.metaplatform.mcp.external.entity.ExternalAgentEntity;
import com.metaplatform.mcp.external.repository.ExternalAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExternalAgentService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final String STATUS_ERROR = "ERROR";
    private static final String TRUST_UNTRUSTED = "UNTRUSTED";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);

    private final ExternalAgentRepository repository;
    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    @Transactional
    public ExternalAgentResponse create(CreateExternalAgentRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndNameAndDeletedAtIsNull(tenantId, request.getName())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "外部 Agent 名称在该租户下已存在");
        }
        validateJson(request.getAuthConfig(), "authConfig");
        validateJson(request.getCapabilities(), "capabilities");

        Instant now = Instant.now();
        ExternalAgentEntity entity = ExternalAgentEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .description(request.getDescription())
                .endpoint(request.getEndpoint())
                .protocolType(normalize(request.getProtocolType(), "MCP"))
                .status(STATUS_INACTIVE)
                .trustLevel(TRUST_UNTRUSTED)
                .authType(normalize(request.getAuthType(), "none"))
                .authConfig(normalizeJson(request.getAuthConfig(), "{}"))
                .capabilities(normalizeJson(request.getCapabilities(), "[]"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<ExternalAgentResponse> list(String status, String trustLevel, String protocolType,
                                                     String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));
        Page<ExternalAgentEntity> result = repository.search(tenantId, status, trustLevel, protocolType, keyword, pageable);
        return PageResponse.<ExternalAgentResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public ExternalAgentResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ExternalAgentResponse update(UUID id, UpdateExternalAgentRequest request) {
        ExternalAgentEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getEndpoint() != null) {
            entity.setEndpoint(request.getEndpoint());
        }
        if (request.getProtocolType() != null) {
            entity.setProtocolType(request.getProtocolType().toUpperCase());
        }
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getTrustLevel() != null) {
            entity.setTrustLevel(request.getTrustLevel().toUpperCase());
        }
        if (request.getAuthType() != null) {
            entity.setAuthType(request.getAuthType());
        }
        if (request.getAuthConfig() != null) {
            validateJson(request.getAuthConfig(), "authConfig");
            entity.setAuthConfig(request.getAuthConfig());
        }
        if (request.getCapabilities() != null) {
            validateJson(request.getCapabilities(), "capabilities");
            entity.setCapabilities(request.getCapabilities());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        ExternalAgentEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        repository.save(entity);
    }

    @Transactional
    public ExternalAgentTestResult testConnection(UUID id) {
        ExternalAgentEntity entity = findById(id);
        Instant start = Instant.now();
        try {
            WebClient.ResponseSpec spec = webClientBuilder.build().get()
                    .uri(entity.getEndpoint())
                    .retrieve();
            String body = spec.bodyToMono(String.class).block(HTTP_TIMEOUT);
            long elapsed = Duration.between(start, Instant.now()).toMillis();
            entity.setStatus(STATUS_ACTIVE);
            entity.setLastConnectedAt(Instant.now());
            entity.setLastErrorMessage(null);
            repository.save(entity);
            return ExternalAgentTestResult.builder()
                    .success(true)
                    .responseTimeMs(elapsed)
                    .message("连接成功")
                    .protocolType(entity.getProtocolType())
                    .build();
        } catch (Exception e) {
            long elapsed = Duration.between(start, Instant.now()).toMillis();
            log.warn("External agent connection test failed for {}: {}", entity.getEndpoint(), e.getMessage());
            entity.setStatus(STATUS_ERROR);
            entity.setLastErrorMessage(e.getMessage());
            repository.save(entity);
            return ExternalAgentTestResult.builder()
                    .success(false)
                    .responseTimeMs(elapsed)
                    .message("连接失败: " + e.getMessage())
                    .protocolType(entity.getProtocolType())
                    .build();
        }
    }

    ExternalAgentEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.EXTERNAL_AGENT_NOT_FOUND, "外部 Agent 不存在"));
    }

    private ExternalAgentResponse toResponse(ExternalAgentEntity entity) {
        return ExternalAgentResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .endpoint(entity.getEndpoint())
                .protocolType(entity.getProtocolType())
                .status(entity.getStatus())
                .trustLevel(entity.getTrustLevel())
                .authType(entity.getAuthType())
                .authConfig(entity.getAuthConfig())
                .capabilities(entity.getCapabilities())
                .lastConnectedAt(entity.getLastConnectedAt())
                .lastErrorMessage(entity.getLastErrorMessage())
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

    private String normalize(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value.toUpperCase();
    }
}
