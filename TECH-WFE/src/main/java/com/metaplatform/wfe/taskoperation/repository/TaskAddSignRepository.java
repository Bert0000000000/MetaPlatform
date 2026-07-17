package com.metaplatform.wfe.taskoperation.repository;

import com.metaplatform.wfe.taskoperation.entity.TaskAddSignEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskAddSignRepository extends JpaRepository<TaskAddSignEntity, String> {

    List<TaskAddSignEntity> findByTenantIdAndTaskIdOrderByCreatedAtDesc(String tenantId, String taskId);
}