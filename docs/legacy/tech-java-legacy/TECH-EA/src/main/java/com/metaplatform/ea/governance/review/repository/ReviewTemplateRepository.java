package com.metaplatform.ea.governance.review.repository;

import com.metaplatform.ea.governance.review.entity.ReviewTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewTemplateRepository extends JpaRepository<ReviewTemplateEntity, UUID> {

    Optional<ReviewTemplateEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ReviewTemplateEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
