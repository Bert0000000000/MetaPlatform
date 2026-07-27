package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.ApiKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * API Key 仓储。
 *
 * <p>对应 Python {@code app.auth.service} 中的 API Key 数据访问。</p>
 */
@Repository
public interface ApiKeyRepository extends JpaRepository<ApiKeyEntity, String> {

    /**
     * 按 keyId + 租户查询。
     */
    Optional<ApiKeyEntity> findByKeyIdAndTenantId(String keyId, String tenantId);

    /**
     * 按 keyHash 查询未撤销的 Key（用于鉴权）。
     */
    Optional<ApiKeyEntity> findByKeyHashAndRevokedFalse(String keyHash);

    /**
     * 按租户 + agentId 查询所有 Key（用于列出某 Agent 的 Key）。
     */
    Iterable<ApiKeyEntity> findByTenantIdAndAgentId(String tenantId, String agentId);

    /**
     * 校验唯一性：(tenant_id, key_hash) 是否已存在。
     */
    boolean existsByKeyHash(String keyHash);
}
