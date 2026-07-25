package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.WfeTaskHistoryEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WfeTaskHistoryRepository extends JpaRepository<WfeTaskHistoryEntity, String> {

    List<WfeTaskHistoryEntity> findByTenantIdAndTaskIdOrderByCreatedAtDesc(
            String tenantId, String taskId);

    Page<WfeTaskHistoryEntity> findByTenantIdAndAssigneeAndActionIn(
            String tenantId, String assignee, List<String> actions, Pageable pageable);

    List<WfeTaskHistoryEntity> findByTenantIdAndProcessInstanceIdOrderByCreatedAtAsc(
            String tenantId, String processInstanceId);

    long countByTenantId(String tenantId);

    Page<WfeTaskHistoryEntity> findByTenantIdAndActionInOrderByCreatedAtDesc(
            String tenantId, List<String> actions, Pageable pageable);
}
