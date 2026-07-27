package com.metaplatform.ea.dataarchitecture.repository;

import com.metaplatform.ea.dataarchitecture.entity.DataFlowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DataFlowRepository extends JpaRepository<DataFlowEntity, UUID> {

    List<DataFlowEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);
}