package com.metaplatform.ea.dataarchitecture.repository;

import com.metaplatform.ea.dataarchitecture.entity.DataDomainEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DataDomainRepository extends JpaRepository<DataDomainEntity, UUID> {

    Optional<DataDomainEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<DataDomainEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}