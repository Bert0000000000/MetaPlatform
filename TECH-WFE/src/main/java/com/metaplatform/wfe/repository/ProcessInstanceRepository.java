package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.ProcessInstanceEntity;
import com.metaplatform.wfe.entity.ProcessInstanceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProcessInstanceRepository extends JpaRepository<ProcessInstanceEntity, String> {

    Optional<ProcessInstanceEntity> findByIdAndTenantId(String id, String tenantId);

    Page<ProcessInstanceEntity> findByTenantId(String tenantId, Pageable pageable);

    Page<ProcessInstanceEntity> findByTenantIdAndStatus(String tenantId, ProcessInstanceStatus status, Pageable pageable);
}
