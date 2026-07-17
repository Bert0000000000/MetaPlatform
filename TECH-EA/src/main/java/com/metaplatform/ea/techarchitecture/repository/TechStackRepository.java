package com.metaplatform.ea.techarchitecture.repository;

import com.metaplatform.ea.techarchitecture.entity.TechStackEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TechStackRepository extends JpaRepository<TechStackEntity, UUID> {

    Optional<TechStackEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<TechStackEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}