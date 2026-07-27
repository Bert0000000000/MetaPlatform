package com.metaplatform.a2a.auth;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.config.A2aProperties;
import com.metaplatform.a2a.entity.ApiKeyEntity;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.ApiKeyRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 认证与授权服务。
 *
 * <p>对应 Python {@code app.auth.service.AuthService}。
 * 提供 API Key 管理（CRUD + 鉴权）与 JWT 验证能力。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final ApiKeyRepository apiKeyRepository;
    private final A2aProperties properties;
    private final ObjectMapper objectMapper;

    private static final TypeReference<List<String>> LIST_TYPE = new TypeReference<>() {};

    // ============================================================
    // API Key 管理
    // ============================================================

    /**
     * 为 Agent 生成新的 API Key。
     *
     * @param tenantId    租户 ID
     * @param agentId     Agent ID
     * @param permissions 权限列表
     * @return 含 plaintext key 的响应（plaintext 只在此返回一次）
     */
    @Transactional
    public Map<String, Object> createApiKey(String tenantId, String agentId, List<String> permissions) {
        String plainKey = generatePlainKey();
        String keyHash = hashKey(plainKey);
        String keyId = UUID.randomUUID().toString().replace("-", "");

        ApiKeyEntity entity = new ApiKeyEntity();
        entity.setKeyId(keyId);
        entity.setTenantId(tenantId);
        entity.setAgentId(agentId);
        entity.setKeyHash(keyHash);
        try {
            entity.setPermissions(objectMapper.writeValueAsString(
                    permissions != null ? permissions : List.of()));
        } catch (Exception e) {
            entity.setPermissions("[]");
        }
        entity.setRevoked(false);

        apiKeyRepository.save(entity);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("keyId", keyId);
        result.put("apiKey", plainKey);
        result.put("agentId", agentId);
        result.put("permissions", permissions);
        return result;
    }

    /**
     * 列出某 Agent 的所有 API Key。
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listApiKeys(String tenantId, String agentId) {
        Iterable<ApiKeyEntity> entities = apiKeyRepository.findByTenantIdAndAgentId(tenantId, agentId);
        java.util.List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (ApiKeyEntity e : entities) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("keyId", e.getKeyId());
            item.put("agentId", e.getAgentId());
            try {
                item.put("permissions", objectMapper.readValue(e.getPermissions(), LIST_TYPE));
            } catch (Exception ex) {
                item.put("permissions", List.of());
            }
            item.put("revoked", e.getRevoked());
            item.put("createdAt", e.getCreatedAt());
            result.add(item);
        }
        return result;
    }

    /**
     * 撤销 API Key。
     */
    @Transactional
    public boolean revokeApiKey(String tenantId, String keyId) {
        ApiKeyEntity entity = apiKeyRepository.findByKeyIdAndTenantId(keyId, tenantId)
                .orElseThrow(() -> A2aException.keyNotFound(keyId));
        entity.setRevoked(true);
        apiKeyRepository.save(entity);
        return true;
    }

    /**
     * 验证 API Key 并返回关联信息。
     *
     * @param plainKey 明文 API Key
     * @return 验证结果（含 agentId / permissions），无效时抛出 {@link A2aException}
     */
    @Transactional(readOnly = true)
    public Map<String, Object> verifyApiKey(String plainKey) {
        if (plainKey == null || plainKey.isBlank()) {
            throw A2aException.unauthorized("API Key 不能为空");
        }
        String keyHash = hashKey(plainKey);
        ApiKeyEntity entity = apiKeyRepository.findByKeyHashAndRevokedFalse(keyHash)
                .orElseThrow(() -> A2aException.unauthorized("API Key 无效或已撤销"));

        List<String> permissions;
        try {
            permissions = objectMapper.readValue(entity.getPermissions(), LIST_TYPE);
        } catch (Exception e) {
            permissions = List.of();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("keyId", entity.getKeyId());
        result.put("tenantId", entity.getTenantId());
        result.put("agentId", entity.getAgentId());
        result.put("permissions", permissions);
        return result;
    }

    // ============================================================
    // JWT 验证
    // ============================================================

    /**
     * 验证 JWT token 并返回 claims。
     *
     * @param token JWT token
     * @return claims Map（含 sub / tenantId / agentId 等）
     */
    public Map<String, Object> verifyJwt(String token) {
        if (token == null || token.isBlank()) {
            throw A2aException.unauthorized("JWT token 不能为空");
        }
        try {
            SecretKey key = Keys.hmacShaKeyFor(
                    properties.getJwtSecret().getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Map<String, Object> result = new HashMap<>();
            result.put("subject", claims.getSubject());
            result.putAll(claims);
            return result;
        } catch (Exception ex) {
            log.warn("JWT 验证失败 | reason={}", ex.getMessage());
            throw A2aException.unauthorized("JWT 验证失败: " + ex.getMessage());
        }
    }

    /**
     * 从 Authorization 头中提取 Bearer token。
     */
    public static String extractBearerToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }

    // ============================================================
    // 内部辅助
    // ============================================================

    private String generatePlainKey() {
        return "ma_" + UUID.randomUUID().toString().replace("-", "");
    }

    private String hashKey(String plainKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(plainKey.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
