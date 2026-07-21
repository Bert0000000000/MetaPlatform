package com.metaplatform.ea.governance.principle.repository;

import com.metaplatform.ea.governance.principle.entity.ArchitecturePrincipleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ArchitecturePrincipleRepository extends JpaRepository<ArchitecturePrincipleEntity, UUID> {

    Optional<ArchitecturePrincipleEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ArchitecturePrincipleEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<ArchitecturePrincipleEntity> findByTenantIdAndCategoryIdAndDeletedAtIsNull(String tenantId, UUID categoryId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
