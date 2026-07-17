package com.metaplatform.mcp.resource.repository;

import com.metaplatform.mcp.resource.entity.McpResourceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpResourceRepository extends JpaRepository<McpResourceEntity, UUID> {

    Optional<McpResourceEntity> findByIdAndDeletedAtIsNull(UUID id);

    Optional<McpResourceEntity> findByTenantIdAndUriAndDeletedAtIsNull(String tenantId, String uri);

    boolean existsByTenantIdAndUriAndDeletedAtIsNull(String tenantId, String uri);

    List<McpResourceEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    @Query("SELECT r FROM McpResourceEntity r " +
           "WHERE r.tenantId = :tenantId AND r.deletedAt IS NULL " +
           "AND (:conceptId IS NULL OR r.relatedConceptId = :conceptId) " +
           "AND (:keyword IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(r.uri) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<McpResourceEntity> search(@Param("tenantId") String tenantId,
                                   @Param("conceptId") String conceptId,
                                   @Param("keyword") String keyword);

    List<McpResourceEntity> findByTenantIdAndRelatedConceptIdAndDeletedAtIsNull(String tenantId, String conceptId);
}