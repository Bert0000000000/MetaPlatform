package com.metaplatform.wfe.apphub.repository;

import com.metaplatform.wfe.apphub.entity.TemplateEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateRepository extends JpaRepository<TemplateEntity, String> {

    Optional<TemplateEntity> findByTenantIdAndTemplateId(String tenantId, String templateId);

    Page<TemplateEntity> findByTenantId(String tenantId, Pageable pageable);

    Page<TemplateEntity> findByTenantIdAndCategory(String tenantId, String category, Pageable pageable);

    Page<TemplateEntity> findByTenantIdAndNameContaining(String tenantId, String keyword, Pageable pageable);

    Page<TemplateEntity> findByTenantIdAndCategoryAndNameContaining(
            String tenantId, String category, String keyword, Pageable pageable);

    List<TemplateEntity> findByTenantIdIn(List<String> tenantIds);
}
