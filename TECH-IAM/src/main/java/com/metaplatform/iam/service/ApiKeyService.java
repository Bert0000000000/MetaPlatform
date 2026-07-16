package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyCreatedResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyResponse;
import com.metaplatform.iam.entity.ApiKeyEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.ApiKeyRepository;
import com.metaplatform.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private static final String KEY_PREFIX = "mp_";
    private static final int RANDOM_HEX_LENGTH = 32;

    private final ApiKeyRepository apiKeyRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // ==================== CRUD ====================

    @Transactional
    public ApiKeyCreatedResponse create(String tenantId, String name, String userId,
                                        List<String> scopes, Instant expiresAt) {
        String tid = resolveTenantId(tenantId);

        if (!userRepository.existsById(userId)) {
            throw new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在");
        }
        if (apiKeyRepository.existsByTenantIdAndName(tid, name)) {
            throw new IamException(ErrorCode.STATE_CONFLICT, "API Key 名称已存在");
        }

        String apiKey = generateApiKey();
        String keyPrefix = apiKey.substring(0, 8);
        String keyHash = sha256(apiKey);
        String scopesJson = writeJson(scopes);

        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tid)
                .name(name)
                .keyPrefix(keyPrefix)
                .keyHash(keyHash)
                .userId(userId)
                .scopes(scopesJson)
                .status(ApiKeyEntity.Status.ACTIVE)
                .expiresAt(expiresAt)
                .build();
        apiKeyRepository.save(entity);

        return ApiKeyCreatedResponse.builder()
                .apiKeyId(entity.getId())
                .name(name)
                .keyPrefix(keyPrefix)
                .apiKey(apiKey)
                .userId(userId)
                .scopes(scopes)
                .status(ApiKeyEntity.Status.ACTIVE.name())
                .expiresAt(expiresAt)
                .createdAt(entity.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<ApiKeyResponse> list(String tenantId, int page, int size) {
        String tid = resolveTenantId(tenantId);
        Pageable pageable = PageRequest.of(page, size);
        Page<ApiKeyEntity> pageResult = apiKeyRepository.findByTenantId(tid, pageable);
        List<ApiKeyResponse> items = pageResult.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<ApiKeyResponse>builder()
                .items(items)
                .total(pageResult.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(pageResult.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public ApiKeyResponse getById(String id) {
        ApiKeyEntity entity = apiKeyRepository.findById(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "API Key 不存在"));
        return toResponse(entity);
    }

    @Transactional
    public void revoke(String id) {
        ApiKeyEntity entity = apiKeyRepository.findById(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "API Key 不存在"));
        entity.setStatus(ApiKeyEntity.Status.REVOKED);
        apiKeyRepository.save(entity);
    }

    // ==================== 验证 ====================

    @Transactional
    public ApiKeyEntity validate(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IamException(ErrorCode.API_KEY_INVALID, "API Key 为空");
        }
        String keyHash = sha256(apiKey);
        ApiKeyEntity entity = apiKeyRepository.findByKeyHash(keyHash)
                .orElseThrow(() -> new IamException(ErrorCode.API_KEY_INVALID, "API Key 无效"));
        if (entity.getStatus() != ApiKeyEntity.Status.ACTIVE) {
            throw new IamException(ErrorCode.API_KEY_INVALID, "API Key 已被吊销");
        }
        if (entity.getExpiresAt() != null && entity.getExpiresAt().isBefore(Instant.now())) {
            throw new IamException(ErrorCode.API_KEY_INVALID, "API Key 已过期");
        }
        entity.setLastUsedAt(Instant.now());
        apiKeyRepository.save(entity);
        return entity;
    }

    // ==================== 内部辅助 ====================

    private String generateApiKey() {
        return KEY_PREFIX + generateRandomHex(RANDOM_HEX_LENGTH);
    }

    private String generateRandomHex(int length) {
        byte[] bytes = new byte[length / 2];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(length);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IamException(ErrorCode.INTERNAL_ERROR, "SHA-256 算法不可用");
        }
    }

    private String writeJson(List<String> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("scopes 序列化失败，使用降级方案", e);
            return "[\"" + String.join("\",\"", list) + "\"]";
        }
    }

    private List<String> readJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException e) {
            log.warn("scopes 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }

    private ApiKeyResponse toResponse(ApiKeyEntity e) {
        return ApiKeyResponse.builder()
                .apiKeyId(e.getId())
                .name(e.getName())
                .keyPrefix(e.getKeyPrefix())
                .userId(e.getUserId())
                .scopes(readJson(e.getScopes()))
                .status(e.getStatus().name())
                .expiresAt(e.getExpiresAt())
                .lastUsedAt(e.getLastUsedAt())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? "tenant-default" : requestTenantId;
    }
}
