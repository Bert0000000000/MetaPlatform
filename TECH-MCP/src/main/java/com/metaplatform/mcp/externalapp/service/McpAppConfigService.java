package com.metaplatform.mcp.externalapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.externalapp.dto.*;
import com.metaplatform.mcp.externalapp.entity.McpAppApiKeyEntity;
import com.metaplatform.mcp.externalapp.entity.McpAppConfigEntity;
import com.metaplatform.mcp.externalapp.repository.McpAppApiKeyRepository;
import com.metaplatform.mcp.externalapp.repository.McpAppConfigRepository;
import com.metaplatform.mcp.external.entity.ExternalAgentEntity;
import com.metaplatform.mcp.external.repository.ExternalAgentRepository;
import com.metaplatform.mcp.permission.entity.McpPermissionRuleEntity;
import com.metaplatform.mcp.permission.service.McpPermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 外部应用子资源服务：配置 / API Key / 工具授权。
 *
 * 设计要点：
 * 1. app_id = ExternalAgentEntity.id（UUID 字符串），所有操作前先校验 app 存在。
 * 2. 应用配置走 upsert 语义（GET 不存在返回默认空配置；PUT 创建或更新）。
 * 3. API Key 使用 BCrypt hash，明文 secret 仅创建时返回一次，格式 keyId:secret（与 IamAuthFilter 对齐）。
 * 4. 工具授权复用 mcp_permission_rules（subjectType=EXTERNAL_APP），通过 McpPermissionService 操作。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class McpAppConfigService {

    private static final String KEY_STATUS_ACTIVE = "ACTIVE";
    private static final String KEY_STATUS_REVOKED = "REVOKED";
    private static final String KEY_ID_PREFIX = "mak_";

    private final McpAppConfigRepository configRepository;
    private final McpAppApiKeyRepository apiKeyRepository;
    private final ExternalAgentRepository externalAgentRepository;
    private final McpPermissionService permissionService;
    private final ObjectMapper objectMapper;

    // ==================== 应用配置 ====================

    @Transactional(readOnly = true)
    public AppConfigResponse getConfig(String appId) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        return configRepository.findByTenantIdAndAppId(tenantId, appId)
                .map(this::toResponse)
                .orElseGet(() -> AppConfigResponse.builder()
                        .appId(appId)
                        .allowedTools("[]")
                        .deniedTools("[]")
                        .metadata("{}")
                        .build());
    }

    @Transactional
    public AppConfigResponse upsertConfig(String appId, UpdateAppConfigRequest request) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        validateJsonIfPresent(request.allowedTools(), "allowedTools");
        validateJsonIfPresent(request.deniedTools(), "deniedTools");
        validateJsonIfPresent(request.metadata(), "metadata");

        McpAppConfigEntity entity = configRepository.findByTenantIdAndAppId(tenantId, appId)
                .orElseGet(() -> McpAppConfigEntity.builder()
                        .tenantId(tenantId)
                        .appId(appId)
                        .allowedTools("[]")
                        .deniedTools("[]")
                        .metadata("{}")
                        .build());
        if (request.rateLimitQps() != null) {
            entity.setRateLimitQps(request.rateLimitQps());
        }
        if (request.timeoutMs() != null) {
            entity.setTimeoutMs(request.timeoutMs());
        }
        if (request.allowedTools() != null) {
            entity.setAllowedTools(request.allowedTools());
        }
        if (request.deniedTools() != null) {
            entity.setDeniedTools(request.deniedTools());
        }
        if (request.webhookUrl() != null) {
            entity.setWebhookUrl(request.webhookUrl());
        }
        if (request.metadata() != null) {
            entity.setMetadata(request.metadata());
        }
        configRepository.save(entity);
        return toResponse(entity);
    }

    // ==================== 应用 API Key ====================

    @Transactional(readOnly = true)
    public List<AppApiKeyResponse> listApiKeys(String appId) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        return apiKeyRepository.findByTenantIdAndAppId(tenantId, appId).stream()
                .map(this::toKeyResponse)
                .toList();
    }

    @Transactional
    public AppApiKeyCreatedResponse createApiKey(String appId, CreateAppApiKeyRequest request) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        String keyId = KEY_ID_PREFIX + UUID.randomUUID().toString().replace("-", "");
        String secret = UUID.randomUUID().toString().replace("-", "");
        String keyHash = BCrypt.hashpw(secret, BCrypt.gensalt());
        McpAppApiKeyEntity entity = McpAppApiKeyEntity.builder()
                .tenantId(tenantId)
                .appId(appId)
                .keyId(keyId)
                .keyHash(keyHash)
                .name(request.name())
                .status(KEY_STATUS_ACTIVE)
                .build();
        apiKeyRepository.save(entity);
        log.info("App API Key created, tenantId={}, appId={}, keyId={}", tenantId, appId, keyId);
        return AppApiKeyCreatedResponse.builder()
                .keyId(keyId)
                .appId(appId)
                .name(request.name())
                .apiKey(keyId + ":" + secret)
                .status(KEY_STATUS_ACTIVE)
                .build();
    }

    @Transactional
    public void revokeApiKey(String appId, String keyId) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        McpAppApiKeyEntity entity = apiKeyRepository.findByTenantIdAndKeyId(tenantId, keyId)
                .orElseThrow(() -> new McpException(ErrorCode.APP_API_KEY_NOT_FOUND, "应用 API Key 不存在"));
        if (!appId.equals(entity.getAppId())) {
            throw new McpException(ErrorCode.APP_API_KEY_NOT_FOUND, "API Key 不属于该应用");
        }
        entity.setStatus(KEY_STATUS_REVOKED);
        apiKeyRepository.save(entity);
        log.info("App API Key revoked, tenantId={}, appId={}, keyId={}", tenantId, appId, keyId);
    }

    @Transactional
    public void deleteApiKey(String appId, String keyId) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        McpAppApiKeyEntity entity = apiKeyRepository.findByTenantIdAndKeyId(tenantId, keyId)
                .orElseThrow(() -> new McpException(ErrorCode.APP_API_KEY_NOT_FOUND, "应用 API Key 不存在"));
        if (!appId.equals(entity.getAppId())) {
            throw new McpException(ErrorCode.APP_API_KEY_NOT_FOUND, "API Key 不属于该应用");
        }
        apiKeyRepository.delete(entity);
        log.info("App API Key deleted, tenantId={}, appId={}, keyId={}", tenantId, appId, keyId);
    }

    // ==================== 应用工具授权 ====================

    @Transactional(readOnly = true)
    public AppToolGrantResponse listToolGrants(String appId) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        List<McpPermissionRuleEntity> rules = permissionService.listAppToolGrants(tenantId, appId);
        List<String> toolIds = rules.stream()
                .filter(r -> "TOOL".equalsIgnoreCase(r.getResourceType()))
                .map(McpPermissionRuleEntity::getResourceId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        return AppToolGrantResponse.builder()
                .appId(appId)
                .toolIds(toolIds)
                .build();
    }

    @Transactional
    public AppToolGrantResponse replaceToolGrants(String appId, UpdateAppToolGrantRequest request) {
        String tenantId = TenantContext.getOrDefault();
        ensureAppExists(tenantId, appId);
        List<String> toolIds = request.toolIds() == null ? List.of() : request.toolIds();
        permissionService.replaceAppToolGrants(tenantId, appId, toolIds);
        return AppToolGrantResponse.builder()
                .appId(appId)
                .toolIds(toolIds)
                .build();
    }

    // ==================== 内部工具 ====================

    private void ensureAppExists(String tenantId, String appId) {
        // 校验 appId 是合法 UUID 且对应的外部应用存在
        UUID uuid;
        try {
            uuid = UUID.fromString(appId);
        } catch (IllegalArgumentException e) {
            throw new McpException(ErrorCode.INVALID_PARAM, "appId 不是合法的 UUID");
        }
        ExternalAgentEntity agent = externalAgentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(uuid, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.APP_NOT_FOUND, "外部应用不存在"));
        if (!"ACTIVE".equalsIgnoreCase(agent.getStatus()) && !"INACTIVE".equalsIgnoreCase(agent.getStatus())) {
            // 允许 ACTIVE / INACTIVE 状态的应用管理子资源，ERROR 状态拒绝
            throw new McpException(ErrorCode.STATE_CONFLICT, "应用状态不允许管理子资源");
        }
    }

    private AppConfigResponse toResponse(McpAppConfigEntity e) {
        return AppConfigResponse.builder()
                .appId(e.getAppId())
                .rateLimitQps(e.getRateLimitQps())
                .timeoutMs(e.getTimeoutMs())
                .allowedTools(e.getAllowedTools())
                .deniedTools(e.getDeniedTools())
                .webhookUrl(e.getWebhookUrl())
                .metadata(e.getMetadata())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private AppApiKeyResponse toKeyResponse(McpAppApiKeyEntity e) {
        return AppApiKeyResponse.builder()
                .keyId(e.getKeyId())
                .appId(e.getAppId())
                .name(e.getName())
                .status(e.getStatus())
                .lastUsedAt(e.getLastUsedAt())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private void validateJsonIfPresent(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }
}
