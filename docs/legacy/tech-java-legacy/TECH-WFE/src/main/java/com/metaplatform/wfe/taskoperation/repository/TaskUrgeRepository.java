package com.metaplatform.wfe.taskoperation.repository;

import com.metaplatform.wfe.taskoperation.entity.TaskUrgeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskUrgeRepository extends JpaRepository<TaskUrgeEntity, String> {

    List<TaskUrgeEntity> findByTenantIdAndTaskIdOrderByCreatedAtDesc(String tenantId, String taskId);
}