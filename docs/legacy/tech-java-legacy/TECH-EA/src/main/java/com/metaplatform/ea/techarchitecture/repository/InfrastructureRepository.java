package com.metaplatform.ea.techarchitecture.repository;

import com.metaplatform.ea.techarchitecture.entity.InfrastructureEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InfrastructureRepository extends JpaRepository<InfrastructureEntity, UUID> {

    Optional<InfrastructureEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<InfrastructureEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}