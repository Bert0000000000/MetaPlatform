package com.metaplatform.gw.gray.repository;

import com.metaplatform.gw.gray.entity.GwGrayReleaseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GwGrayReleaseRepository extends JpaRepository<GwGrayReleaseEntity, UUID> {

    Optional<GwGrayReleaseEntity> findByIdAndDeletedAtIsNull(UUID id);

    Page<GwGrayReleaseEntity> findByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String tenantId, Pageable pageable);

    List<GwGrayReleaseEntity> findByApiIdAndStatusAndDeletedAtIsNull(UUID apiId, String status);
}
