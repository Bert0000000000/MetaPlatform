package com.metaplatform.ea.dataarchitecture.repository;

import com.metaplatform.ea.dataarchitecture.entity.DataAssetEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DataAssetRepository extends JpaRepository<DataAssetEntity, UUID> {

    Optional<DataAssetEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<DataAssetEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}