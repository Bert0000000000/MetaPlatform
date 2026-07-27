package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DataMappingExecutionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DataMappingExecutionRepository extends JpaRepository<DataMappingExecutionEntity, String> {

    Page<DataMappingExecutionEntity> findByTenantIdAndMappingIdOrderByStartedAtDesc(String tenantId, String mappingId, Pageable pageable);

    Optional<DataMappingExecutionEntity> findByIdAndTenantId(String id, String tenantId);
}
