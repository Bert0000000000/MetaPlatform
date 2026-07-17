package com.metaplatform.wfe.taskoperation.repository;

import com.metaplatform.wfe.taskoperation.entity.EventSubscriptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventSubscriptionRepository extends JpaRepository<EventSubscriptionEntity, String> {

    Optional<EventSubscriptionEntity> findByIdAndTenantId(String id, String tenantId);

    List<EventSubscriptionEntity> findByTenantIdAndUserId(String tenantId, String userId);

    List<EventSubscriptionEntity> findByTenantIdAndEnabledTrue(String tenantId);
}