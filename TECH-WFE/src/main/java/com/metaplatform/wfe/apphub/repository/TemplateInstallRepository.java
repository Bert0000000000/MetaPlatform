package com.metaplatform.wfe.apphub.repository;

import com.metaplatform.wfe.apphub.entity.TemplateInstallEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TemplateInstallRepository extends JpaRepository<TemplateInstallEntity, String> {

    Optional<TemplateInstallEntity> findByTenantIdAndTemplateId(String tenantId, String templateId);
}
