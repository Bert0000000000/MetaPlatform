package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProcessDefinitionRepository extends JpaRepository<ProcessDefinitionEntity, String> {

    Optional<ProcessDefinitionEntity> findByIdAndStatusNot(String id, ProcessDefinitionStatus status);

    Page<ProcessDefinitionEntity> findByTenantIdAndStatusNot(
            String tenantId, ProcessDefinitionStatus status, Pageable pageable);

    Page<ProcessDefinitionEntity> findByTenantIdAndStatus(
            String tenantId, ProcessDefinitionStatus status, Pageable pageable);

    boolean existsByTenantIdAndProcessKeyAndVersion(
            String tenantId, String processKey, Integer version);

    Optional<ProcessDefinitionEntity> findFirstByTenantIdAndProcessKeyAndStatusNotOrderByVersionDesc(
            String tenantId, String processKey, ProcessDefinitionStatus status);
}
