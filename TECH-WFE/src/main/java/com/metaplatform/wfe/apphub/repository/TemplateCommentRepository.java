package com.metaplatform.wfe.apphub.repository;

import com.metaplatform.wfe.apphub.entity.TemplateCommentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TemplateCommentRepository extends JpaRepository<TemplateCommentEntity, String> {

    Page<TemplateCommentEntity> findByTenantIdAndTemplateIdOrderByUpdatedAtDesc(
            String tenantId, String templateId, Pageable pageable);

    Optional<TemplateCommentEntity> findByTenantIdAndTemplateIdAndUserId(
            String tenantId, String templateId, String userId);

    @Query("SELECT COALESCE(SUM(c.rating), 0), COALESCE(COUNT(c), 0) " +
            "FROM TemplateCommentEntity c WHERE c.tenantId = :tenantId AND c.templateId = :templateId")
    Object[] sumRatingAndCount(String tenantId, String templateId);
}
