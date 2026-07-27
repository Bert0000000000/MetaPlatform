package com.metaplatform.ea.dataarchitecture.repository;

import com.metaplatform.ea.dataarchitecture.entity.DataStandardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DataStandardRepository extends JpaRepository<DataStandardEntity, UUID> {

    Optional<DataStandardEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<DataStandardEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
