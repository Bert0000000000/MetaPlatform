package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.CypherTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CypherTemplateRepository extends JpaRepository<CypherTemplateEntity, String> {

    List<CypherTemplateEntity> findByTenantIdOrderByUpdatedAtDesc(String tenantId);

    List<CypherTemplateEntity> findByTenantIdAndCategoryOrderByUpdatedAtDesc(String tenantId, String category);

    Optional<CypherTemplateEntity> findByTemplateIdAndTenantId(String templateId, String tenantId);

    boolean existsByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndNameAndTemplateIdNot(String tenantId, String name, String templateId);
}
