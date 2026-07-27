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

@Repository
public interface AgentDefinitionRepository extends JpaRepository<AgentDefinitionEntity, String> {

    Page<AgentDefinitionEntity> findByTenantIdAndDeletedAtIsNull(String tenantId, Pageable pageable);

    Optional<AgentDefinitionEntity> findByTenantIdAndAgentCode(String tenantId, String agentCode);

    Optional<AgentDefinitionEntity> findByTenantIdAndAgentCodeAndDeletedAtIsNull(String tenantId, String agentCode);

    Optional<AgentDefinitionEntity> findByIdAndTenantIdAndDeletedAtIsNull(String id, String tenantId);

    List<AgentDefinitionEntity> findByTenantIdAndStatusAndDeletedAtIsNull(String tenantId, String status);

    boolean existsByTenantIdAndAgentCode(String tenantId, String agentCode);

    @Query("SELECT a FROM AgentDefinitionEntity a " +
           "WHERE a.tenantId = :tenantId AND a.deletedAt IS NULL " +
           "AND (LOWER(a.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "     OR LOWER(a.agentCode) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "     OR LOWER(a.description) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
    Page<AgentDefinitionEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                                @Param("keyword") String keyword,
                                                Pageable pageable);
}
