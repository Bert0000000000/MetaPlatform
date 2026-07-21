package com.metaplatform.mcp.external.repository;

import com.metaplatform.mcp.external.entity.ExternalAgentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExternalAgentRepository extends JpaRepository<ExternalAgentEntity, UUID> {

    @Query("SELECT a FROM ExternalAgentEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND a.deletedAt IS NULL " +
           "AND (:status IS NULL OR a.status = :status) " +
           "AND (:trustLevel IS NULL OR a.trustLevel = :trustLevel) " +
           "AND (:protocolType IS NULL OR a.protocolType = :protocolType) " +
           "AND (:keyword IS NULL OR LOWER(a.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(a.endpoint) LIKE LOWER(CONCAT('%', :keyword, '%')))" +
           "ORDER BY a.updatedAt DESC")
    Page<ExternalAgentEntity> search(@Param("tenantId") String tenantId,
                                     @Param("status") String status,
                                     @Param("trustLevel") String trustLevel,
                                     @Param("protocolType") String protocolType,
                                     @Param("keyword") String keyword,
                                     Pageable pageable);

    Optional<ExternalAgentEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    boolean existsByTenantIdAndNameAndDeletedAtIsNull(String tenantId, String name);
}
