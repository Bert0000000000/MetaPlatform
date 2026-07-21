package com.metaplatform.wfe.form.repository;

import com.metaplatform.wfe.form.entity.FormDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FormDefinitionRepository extends JpaRepository<FormDefinitionEntity, String> {

    Optional<FormDefinitionEntity> findByIdAndTenantId(String id, String tenantId);

    boolean existsByIdAndTenantId(String id, String tenantId);
}
