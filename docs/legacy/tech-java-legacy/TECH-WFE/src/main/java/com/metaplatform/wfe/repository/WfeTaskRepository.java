package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.WfeTaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WfeTaskRepository extends JpaRepository<WfeTaskEntity, String> {

    Page<WfeTaskEntity> findByTenantIdAndAssigneeAndStatus(
            String tenantId, String assignee, String status, Pageable pageable);

    List<WfeTaskEntity> findByTenantIdAndProcessInstanceIdOrderByCreatedAtDesc(
            String tenantId, String processInstanceId);

    Optional<WfeTaskEntity> findByIdAndStatus(String id, String status);

    long countByTenantIdAndStatus(String tenantId, String status);

    long countByTenantIdAndStatusAndCreatedAtBefore(
            String tenantId, String status, Instant before);

    List<WfeTaskEntity> findByStatusAndCreatedAtBefore(String status, Instant before);

    List<WfeTaskEntity> findByProcessInstanceIdAndStatusAndTenantId(
            String processInstanceId, String status, String tenantId);
}
