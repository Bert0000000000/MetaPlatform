package com.metaplatform.mcp.client.repository;

import com.metaplatform.mcp.client.entity.McpClientConnectionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpClientConnectionRepository extends JpaRepository<McpClientConnectionEntity, UUID> {

    Optional<McpClientConnectionEntity> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByTenantIdAndNameAndDeletedAtIsNull(String tenantId, String name);

    @Query("SELECT c FROM McpClientConnectionEntity c " +
           "WHERE c.tenantId = :tenantId AND c.deletedAt IS NULL " +
           "AND (:status IS NULL OR c.status = :status) " +
           "AND (:keyword IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<McpClientConnectionEntity> search(@Param("tenantId") String tenantId,
                                           @Param("status") String status,
                                           @Param("keyword") String keyword,
                                           Pageable pageable);

    List<McpClientConnectionEntity> findByTenantIdAndDeletedAtIsNull(String tenantId, Sort sort);
}
