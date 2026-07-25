package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentDefinitionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AgentDefinition 仓储。
 */
@Repository
public interface AgentDefinitionRepository extends JpaRepository<AgentDefinitionEntity, String> {

    /**
     * 按租户查询未软删的 Agent（分页）。
     */
    Page<AgentDefinitionEntity> findByTenantIdAndDeletedAtIsNull(String tenantId, Pageable pageable);

    /**
     * 按租户 + agentCode 查询（含软删）。
     */
    Optional<AgentDefinitionEntity> findByTenantIdAndAgentCode(String tenantId, String agentCode);

    /**
     * 按租户 + agentCode 查询未软删的 Agent。
     */
    Optional<AgentDefinitionEntity> findByTenantIdAndAgentCodeAndDeletedAtIsNull(String tenantId, String agentCode);

    /**
     * 按 ID + 租户查询未软删的 Agent。
     */
    Optional<AgentDefinitionEntity> findByIdAndTenantIdAndDeletedAtIsNull(String id, String tenantId);

    /**
     * 按租户查询活跃 Agent。
     */
    List<AgentDefinitionEntity> findByTenantIdAndStatusAndDeletedAtIsNull(String tenantId, String status);

    /**
     * 校验唯一性：(tenant_id, agent_code) 是否已存在。
     */
    boolean existsByTenantIdAndAgentCode(String tenantId, String agentCode);

    /**
     * 关键词模糊检索（名称 / agentCode / description），租户隔离且排除软删。
     */
    @Query("SELECT a FROM AgentDefinitionEntity a " +
            "WHERE a.tenantId = :tenantId AND a.deletedAt IS NULL " +
            "AND (LOWER(a.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) " +
            "     OR LOWER(a.agentCode) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) " +
            "     OR LOWER(a.description) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))")
    Page<AgentDefinitionEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                                @Param("keyword") String keyword,
                                                Pageable pageable);
}
