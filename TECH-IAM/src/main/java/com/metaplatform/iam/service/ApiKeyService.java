package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyCreatedResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyResponse;
import com.metaplatform.iam.dto.apikey.PermissionEntry;
import com.metaplatform.iam.dto.apikey.ValidateResponse;
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
import java.util.Objects;
import java.util.Optional;
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
        revoke(id, null);
    }

    /**
     * 增强吊销：记录吊销原因和吊销时间。
     *
     * @param id     API Key ID
     * @param reason 吊销原因，可为 null
     */
    @Transactional
    public void revoke(String id, String reason) {
        ApiKeyEntity entity = apiKeyRepository.findById(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "API Key 不存在"));
        entity.setStatus(ApiKeyEntity.Status.REVOKED);
        entity.setRevokedReason(reason);
        entity.setRevokedAt(Instant.now());
        apiKeyRepository.save(entity);
    }

    // ==================== 权限范围 ====================

    /**
     * 更新 API Key 的权限范围（覆盖式写入）。
     *
     * @param id          API Key ID
     * @param permissions 权限列表，空列表表示清空权限
     */
    @Transactional
    public void updatePermissions(String id, List<PermissionEntry> permissions) {
        ApiKeyEntity entity = apiKeyRepository.findById(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "API Key 不存在"));
        entity.setPermissions(writePermissionsJson(permissions));
        apiKeyRepository.save(entity);
    }

    /**
     * 获取 API Key 的权限范围。
     */
    @Transactional(readOnly = true)
    public List<PermissionEntry> getPermissions(String id) {
        ApiKeyEntity entity = apiKeyRepository.findById(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "API Key 不存在"));
        return readPermissionsJson(entity.getPermissions());
    }

    // ==================== 验证（含权限检查） ====================

    /**
     * 验证 API Key 有效性及对指定资源的操作权限。
     * 不抛异常：所有失败场景返回 valid=false。
     *
     * @param apiKey   明文 API Key
     * @param resource 资源标识，如 "ont:concepts"
     * @param action   操作，如 "read"
     * @return ValidateResponse，valid=true 时附带身份与权限范围
     */
    @Transactional
    public ValidateResponse validateWithPermissions(String apiKey, String resource, String action) {
        if (apiKey == null || apiKey.isBlank()) {
            return ValidateResponse.builder().valid(false).build();
        }
        String keyHash = sha256(apiKey);
        Optional<ApiKeyEntity> opt = apiKeyRepository.findByKeyHash(keyHash);
        if (opt.isEmpty()) {
            return ValidateResponse.builder().valid(false).build();
        }
        ApiKeyEntity entity = opt.get();
        if (entity.getStatus() != ApiKeyEntity.Status.ACTIVE) {
            return ValidateResponse.builder().valid(false).build();
        }
        if (entity.getExpiresAt() != null && entity.getExpiresAt().isBefore(Instant.now())) {
            return ValidateResponse.builder().valid(false).build();
        }
        List<PermissionEntry> permissions = readPermissionsJson(entity.getPermissions());
        boolean hasPermission = permissions.stream()
                .anyMatch(p -> Objects.equals(p.getResource(), resource)
                        && p.getActions() != null
                        && p.getActions().contains(action));
        if (!hasPermission) {
            return ValidateResponse.builder().valid(false).build();
        }
        entity.setLastUsedAt(Instant.now());
        apiKeyRepository.save(entity);
        return ValidateResponse.builder()
                .valid(true)
                .userId(entity.getUserId())
                .tenantId(entity.getTenantId())
                .permissions(permissions)
                .build();
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

    private String writePermissionsJson(List<PermissionEntry> permissions) {
        if (permissions == null || permissions.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(permissions);
        } catch (JsonProcessingException e) {
            throw new IamException(ErrorCode.INTERNAL_ERROR, "permissions 序列化失败");
        }
    }

    private List<PermissionEntry> readPermissionsJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, PermissionEntry.class));
        } catch (JsonProcessingException e) {
            log.warn("permissions 反序列化失败: {}", json, e);
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
