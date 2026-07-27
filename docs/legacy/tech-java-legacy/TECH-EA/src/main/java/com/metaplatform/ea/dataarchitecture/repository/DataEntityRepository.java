package com.metaplatform.ea.dataarchitecture.repository;

import com.metaplatform.ea.dataarchitecture.entity.DataEntityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DataEntityRepository extends JpaRepository<DataEntityEntity, UUID> {

    Optional<DataEntityEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<DataEntityEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<DataEntityEntity> findByDomainIdAndDeletedAtIsNull(UUID domainId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}