package com.metaplatform.mcp.trust.repository;

import com.metaplatform.mcp.trust.entity.AgentTrustEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentTrustRepository extends JpaRepository<AgentTrustEntity, UUID> {

    @Query("SELECT t FROM AgentTrustEntity t " +
           "WHERE t.tenantId = :tenantId " +
           "AND (:agentId IS NULL OR t.agentId = :agentId) " +
           "AND (:trustLevel IS NULL OR t.trustLevel = :trustLevel) " +
           "AND (:keyword IS NULL OR LOWER(t.reason) LIKE LOWER(CONCAT('%', :keyword, '%')))" +
           "ORDER BY t.updatedAt DESC")
    Page<AgentTrustEntity> search(@Param("tenantId") String tenantId,
                                  @Param("agentId") UUID agentId,
                                  @Param("trustLevel") String trustLevel,
                                  @Param("keyword") String keyword,
                                  Pageable pageable);

    Optional<AgentTrustEntity> findByIdAndTenantId(UUID id, String tenantId);
}
