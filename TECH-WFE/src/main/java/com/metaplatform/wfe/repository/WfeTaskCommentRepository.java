package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.WfeTaskCommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WfeTaskCommentRepository extends JpaRepository<WfeTaskCommentEntity, String> {

    List<WfeTaskCommentEntity> findByTenantIdAndTaskIdOrderByCreatedAtAsc(
            String tenantId, String taskId);

    List<WfeTaskCommentEntity> findByTenantIdAndProcessInstanceIdOrderByCreatedAtAsc(
            String tenantId, String processInstanceId);
}
