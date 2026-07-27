package com.metaplatform.ea.review.repository;

import com.metaplatform.ea.review.entity.ArchitectureReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ArchitectureReviewRepository extends JpaRepository<ArchitectureReviewEntity, UUID> {

    Optional<ArchitectureReviewEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ArchitectureReviewEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<ArchitectureReviewEntity> findByTenantIdAndStatusAndDeletedAtIsNull(String tenantId, String status);

    List<ArchitectureReviewEntity> findByTenantIdAndTargetIdAndTargetTypeAndDeletedAtIsNull(
            String tenantId, UUID targetId, String targetType);
}