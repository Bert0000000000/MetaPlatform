package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.WfeProcessVariableEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WfeProcessVariableRepository extends JpaRepository<WfeProcessVariableEntity, String> {

    List<WfeProcessVariableEntity> findByTenantIdAndProcessInstanceId(
            String tenantId, String processInstanceId);

    Optional<WfeProcessVariableEntity> findByTenantIdAndProcessInstanceIdAndName(
            String tenantId, String processInstanceId, String name);

    void deleteByTenantIdAndProcessInstanceId(String tenantId, String processInstanceId);
}
