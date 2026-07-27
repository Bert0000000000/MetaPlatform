package com.metaplatform.mcp.alert.repository;

import com.metaplatform.mcp.alert.entity.McpAlertRuleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpAlertRuleRepository extends JpaRepository<McpAlertRuleEntity, UUID> {

    @Query("SELECT r FROM McpAlertRuleEntity r " +
           "WHERE r.tenantId = :tenantId " +
           "AND (:enabled IS NULL OR r.enabled = :enabled)")
    Page<McpAlertRuleEntity> search(@Param("tenantId") String tenantId,
                                    @Param("enabled") Boolean enabled,
                                    Pageable pageable);

    Optional<McpAlertRuleEntity> findByIdAndTenantId(UUID id, String tenantId);
}
