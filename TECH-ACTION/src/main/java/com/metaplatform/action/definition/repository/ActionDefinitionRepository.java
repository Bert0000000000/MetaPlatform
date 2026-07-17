package com.metaplatform.action.definition.repository;

import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ActionDefinitionRepository extends JpaRepository<ActionDefinitionEntity, UUID> {

    Optional<ActionDefinitionEntity> findByTenantIdAndActionIdAndDeletedAtIsNull(String tenantId, String actionId);

    Optional<ActionDefinitionEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    @Query("SELECT a FROM ActionDefinitionEntity a " +
           "WHERE a.tenantId = :tenantId AND a.deletedAt IS NULL " +
           "AND (:status IS NULL OR a.status = :status) " +
           "AND (:keyword IS NULL OR LOWER(a.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(a.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<ActionDefinitionEntity> search(@Param("tenantId") String tenantId,
                                        @Param("status") String status,
                                        @Param("keyword") String keyword,
                                        Pageable pageable);
}
