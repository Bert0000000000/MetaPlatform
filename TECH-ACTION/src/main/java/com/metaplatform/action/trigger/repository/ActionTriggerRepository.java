package com.metaplatform.action.trigger.repository;

import com.metaplatform.action.trigger.entity.ActionTriggerEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ActionTriggerRepository extends JpaRepository<ActionTriggerEntity, UUID> {

    Optional<ActionTriggerEntity> findByTenantIdAndTriggerIdAndDeletedAtIsNull(String tenantId, String triggerId);

    boolean existsByTenantIdAndNameAndDeletedAtIsNull(String tenantId, String name);

    List<ActionTriggerEntity> findByTenantIdAndTriggerTypeAndEnabledTrueAndDeletedAtIsNull(String tenantId, String triggerType);

    List<ActionTriggerEntity> findByTenantIdAndActionIdAndDeletedAtIsNull(String tenantId, String actionId);

    List<ActionTriggerEntity> findAllByTriggerTypeAndEnabledAndDeletedAtIsNull(String triggerType, Boolean enabled);

    @Query("SELECT t FROM ActionTriggerEntity t " +
           "WHERE t.tenantId = :tenantId AND t.deletedAt IS NULL " +
           "AND (:actionId IS NULL OR t.actionId = :actionId) " +
           "AND (:triggerType IS NULL OR t.triggerType = :triggerType) " +
           "AND (:enabled IS NULL OR t.enabled = :enabled) " +
           "ORDER BY t.updatedAt DESC")
    Page<ActionTriggerEntity> search(@Param("tenantId") String tenantId,
                                     @Param("actionId") String actionId,
                                     @Param("triggerType") String triggerType,
                                     @Param("enabled") Boolean enabled,
                                     Pageable pageable);
}
