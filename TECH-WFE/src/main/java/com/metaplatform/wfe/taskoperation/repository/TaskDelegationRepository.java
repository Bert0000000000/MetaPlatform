package com.metaplatform.wfe.taskoperation.repository;

import com.metaplatform.wfe.taskoperation.entity.TaskDelegationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskDelegationRepository extends JpaRepository<TaskDelegationEntity, String> {

    List<TaskDelegationEntity> findByTenantIdAndTaskIdOrderByCreatedAtDesc(String tenantId, String taskId);
}