package com.metaplatform.ea.governance.principle.repository;

import com.metaplatform.ea.governance.principle.entity.PrincipleCategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PrincipleCategoryRepository extends JpaRepository<PrincipleCategoryEntity, UUID> {

    Optional<PrincipleCategoryEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<PrincipleCategoryEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<PrincipleCategoryEntity> findByTenantIdAndParentIdAndDeletedAtIsNull(String tenantId, UUID parentId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
