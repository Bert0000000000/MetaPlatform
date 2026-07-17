package com.metaplatform.ea.debt.repository;

import com.metaplatform.ea.debt.entity.TechStandardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TechStandardRepository extends JpaRepository<TechStandardEntity, UUID> {

    Optional<TechStandardEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<TechStandardEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}