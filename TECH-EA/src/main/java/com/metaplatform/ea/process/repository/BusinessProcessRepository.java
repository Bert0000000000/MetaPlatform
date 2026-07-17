package com.metaplatform.ea.process.repository;

import com.metaplatform.ea.process.entity.BusinessProcessEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessProcessRepository extends JpaRepository<BusinessProcessEntity, UUID> {

    Optional<BusinessProcessEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<BusinessProcessEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    List<BusinessProcessEntity> findByValueStreamIdAndDeletedAtIsNull(UUID valueStreamId);
}
