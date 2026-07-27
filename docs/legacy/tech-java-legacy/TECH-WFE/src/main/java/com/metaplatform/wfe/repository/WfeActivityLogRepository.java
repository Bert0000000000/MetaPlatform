package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.WfeActivityLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WfeActivityLogRepository extends JpaRepository<WfeActivityLogEntity, String> {

    List<WfeActivityLogEntity> findByTenantIdAndProcessInstanceIdOrderByEnteredAtAsc(
            String tenantId, String processInstanceId);

    List<WfeActivityLogEntity> findByTenantIdAndProcessInstanceIdAndTaskId(
            String tenantId, String processInstanceId, String taskId);
}
