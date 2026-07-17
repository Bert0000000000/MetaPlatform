package com.metaplatform.action.orchestration.repository;

import com.metaplatform.action.orchestration.entity.OrchestrationEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrchestrationRepository extends JpaRepository<OrchestrationEntity, UUID> {

    Optional<OrchestrationEntity> findByTenantIdAndOrchestrationIdAndDeletedAtIsNull(String tenantId, String orchestrationId);

    Optional<OrchestrationEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    @Query("SELECT o FROM OrchestrationEntity o " +
           "WHERE o.tenantId = :tenantId AND o.deletedAt IS NULL " +
           "AND (:status IS NULL OR o.status = :status) " +
           "AND (:keyword IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(o.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<OrchestrationEntity> search(@Param("tenantId") String tenantId,
                                     @Param("status") String status,
                                     @Param("keyword") String keyword,
                                     Pageable pageable);
}
